"""
OWS Thumbnail Generation Lambda
Triggered by S3 ObjectCreated events or EventBridge MediaConvert completion.
Generates thumbnails for images, videos, and audio.
"""

import io
import json
import logging
import os
import urllib.parse

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ.get("TABLE_NAME", "ows-main")
MEDIA_BUCKET = os.environ.get("MEDIA_BUCKET", "ows-media")
MEDIACONVERT_ROLE_ARN = os.environ.get("MEDIACONVERT_ROLE_ARN", "")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)
s3 = boto3.client("s3")

THUMB_SIZE = (300, 300)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_media_id_from_key(s3_key: str) -> str:
    """
    Extract media ID from S3 key pattern: media/{type}/{mediaId}/{filename}
    """
    parts = s3_key.split("/")
    if len(parts) >= 3:
        return parts[2]
    return ""


def _update_thumbnail_key(media_id: str, thumb_key: str):
    """Update the DynamoDB record with the thumbnail S3 key."""
    try:
        table.update_item(
            Key={"PK": f"MEDIA#{media_id}", "SK": "META"},
            UpdateExpression="SET thumbnailKey = :tk",
            ExpressionAttributeValues={":tk": thumb_key},
        )
        logger.info("Updated thumbnail for media %s -> %s", media_id, thumb_key)
    except ClientError:
        logger.exception("Failed to update thumbnail for %s", media_id)


# ---------------------------------------------------------------------------
# Image thumbnail
# ---------------------------------------------------------------------------

def _generate_image_thumbnail(bucket: str, s3_key: str, media_id: str):
    """Download image from S3, create 300x300 thumbnail, upload back."""
    try:
        from PIL import Image
    except ImportError:
        logger.error("Pillow not available — cannot generate image thumbnail")
        return

    try:
        response = s3.get_object(Bucket=bucket, Key=s3_key)
        image_data = response["Body"].read()
    except ClientError:
        logger.exception("Failed to download image %s from %s", s3_key, bucket)
        return

    try:
        img = Image.open(io.BytesIO(image_data))
        img.thumbnail(THUMB_SIZE, Image.LANCZOS)

        # Convert to RGB if necessary (e.g. RGBA PNGs)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        buffer.seek(0)

        thumb_key = f"thumbnails/{media_id}/thumb.jpg"
        s3.put_object(
            Bucket=bucket,
            Key=thumb_key,
            Body=buffer.getvalue(),
            ContentType="image/jpeg",
        )
        _update_thumbnail_key(media_id, thumb_key)
        logger.info("Generated image thumbnail for %s", media_id)

    except Exception:
        logger.exception("Failed to process image thumbnail for %s", media_id)


# ---------------------------------------------------------------------------
# Video thumbnail (via MediaConvert)
# ---------------------------------------------------------------------------

def _submit_video_thumbnail_job(bucket: str, s3_key: str, media_id: str):
    """Submit a MediaConvert job to extract a thumbnail frame from a video."""
    if not MEDIACONVERT_ROLE_ARN:
        logger.warning("MEDIACONVERT_ROLE_ARN not set — skipping video thumbnail")
        return

    try:
        mc_client = boto3.client("mediaconvert")

        # Get the MediaConvert endpoint
        endpoints = mc_client.describe_endpoints(MaxResults=1)
        endpoint_url = endpoints["Endpoints"][0]["Url"]
        mc = boto3.client("mediaconvert", endpoint_url=endpoint_url)

        input_s3 = f"s3://{bucket}/{s3_key}"
        output_s3 = f"s3://{bucket}/thumbnails/{media_id}/"

        job_settings = {
            "Inputs": [
                {
                    "FileInput": input_s3,
                    "VideoSelector": {},
                    "TimecodeSource": "ZEROBASED",
                }
            ],
            "OutputGroups": [
                {
                    "Name": "Thumbnail",
                    "OutputGroupSettings": {
                        "Type": "FILE_GROUP_SETTINGS",
                        "FileGroupSettings": {
                            "Destination": output_s3,
                        },
                    },
                    "Outputs": [
                        {
                            "ContainerSettings": {"Container": "RAW"},
                            "VideoDescription": {
                                "Width": THUMB_SIZE[0],
                                "Height": THUMB_SIZE[1],
                                "CodecSettings": {
                                    "Codec": "FRAME_CAPTURE",
                                    "FrameCaptureSettings": {
                                        "FramerateNumerator": 1,
                                        "FramerateDenominator": 1,
                                        "MaxCaptures": 1,
                                        "Quality": 80,
                                    },
                                },
                            },
                        }
                    ],
                }
            ],
        }

        mc.create_job(
            Role=MEDIACONVERT_ROLE_ARN,
            Settings=job_settings,
            UserMetadata={"mediaId": media_id},
        )
        logger.info("Submitted MediaConvert job for video %s", media_id)

    except Exception:
        logger.exception("Failed to submit MediaConvert job for %s", media_id)


def _handle_mediaconvert_completion(event_detail: dict):
    """Handle EventBridge MediaConvert COMPLETE event."""
    status = event_detail.get("status", "")
    if status != "COMPLETE":
        logger.warning("MediaConvert job status: %s — skipping", status)
        return

    user_metadata = event_detail.get("userMetadata", {})
    media_id = user_metadata.get("mediaId", "")
    if not media_id:
        logger.warning("No mediaId in MediaConvert user metadata")
        return

    # Find the output thumbnail in the output group
    output_groups = event_detail.get("outputGroupDetails", [])
    for group in output_groups:
        for output_detail in group.get("outputDetails", []):
            output_paths = output_detail.get("outputFilePaths", [])
            for path in output_paths:
                # path looks like s3://bucket/thumbnails/mediaId/file.jpg
                if path.startswith(f"s3://{MEDIA_BUCKET}/"):
                    thumb_key = path.replace(f"s3://{MEDIA_BUCKET}/", "")
                    _update_thumbnail_key(media_id, thumb_key)
                    logger.info("MediaConvert thumbnail complete for %s: %s", media_id, thumb_key)
                    return

    logger.warning("Could not find output path for media %s", media_id)


# ---------------------------------------------------------------------------
# Audio thumbnail (default icon)
# ---------------------------------------------------------------------------

def _generate_audio_thumbnail(media_id: str):
    """
    Audio files don't have visual frames.
    Skip thumbnail generation — the frontend uses a default audio icon.
    """
    logger.info("Audio media %s — skipping thumbnail (frontend uses default icon)", media_id)


# ---------------------------------------------------------------------------
# Direct invocation handler (from API Lambda)
# ---------------------------------------------------------------------------

def _handle_direct_invocation(event: dict):
    """Handle direct async invocation from the API Lambda."""
    media_id = event.get("mediaId", "")
    s3_key = event.get("s3Key", "")
    media_type = event.get("mediaType", "")
    bucket = event.get("bucket", MEDIA_BUCKET)

    if not media_id or not s3_key:
        logger.error("Direct invocation missing mediaId or s3Key")
        return

    logger.info("Direct invocation: mediaId=%s, type=%s, key=%s", media_id, media_type, s3_key)

    if media_type == "image":
        _generate_image_thumbnail(bucket, s3_key, media_id)
    elif media_type == "video":
        _submit_video_thumbnail_job(bucket, s3_key, media_id)
    elif media_type == "audio":
        _generate_audio_thumbnail(media_id)
    else:
        logger.warning("Unknown media type: %s", media_type)


# ---------------------------------------------------------------------------
# S3 event handler
# ---------------------------------------------------------------------------

def _handle_s3_event(record: dict):
    """Process a single S3 event record."""
    bucket = record["s3"]["bucket"]["name"]
    s3_key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

    logger.info("S3 event: bucket=%s, key=%s", bucket, s3_key)

    # Skip thumbnails directory to avoid infinite loops
    if s3_key.startswith("thumbnails/"):
        logger.info("Skipping thumbnail key: %s", s3_key)
        return

    media_id = _extract_media_id_from_key(s3_key)
    if not media_id:
        logger.warning("Could not extract media ID from key: %s", s3_key)
        return

    # Determine media type from prefix
    if s3_key.startswith("media/image") or s3_key.startswith("media/images"):
        _generate_image_thumbnail(bucket, s3_key, media_id)
    elif s3_key.startswith("media/video") or s3_key.startswith("media/videos"):
        _submit_video_thumbnail_job(bucket, s3_key, media_id)
    elif s3_key.startswith("media/audio"):
        _generate_audio_thumbnail(media_id)
    else:
        logger.info("Unrecognized media prefix for key: %s", s3_key)


# ---------------------------------------------------------------------------
# Lambda entry point
# ---------------------------------------------------------------------------

def handler(event, context):
    """
    Thumbnail Lambda entry point.

    Handles three event sources:
    1. S3 ObjectCreated events (media/images/, media/videos/, media/audio/)
    2. EventBridge MediaConvert completion events
    3. Direct async invocation from the API Lambda
    """
    logger.info("Thumb event: %s", json.dumps(event, default=str))

    # Direct invocation from API Lambda
    if "mediaId" in event:
        _handle_direct_invocation(event)
        return {"status": "ok"}

    # EventBridge MediaConvert event
    if event.get("source") == "aws.mediaconvert":
        detail = event.get("detail", {})
        _handle_mediaconvert_completion(detail)
        return {"status": "ok"}

    # S3 event
    records = event.get("Records", [])
    for record in records:
        event_source = record.get("eventSource", "")
        if event_source == "aws:s3":
            _handle_s3_event(record)

    return {"status": "ok", "processed": len(records)}
