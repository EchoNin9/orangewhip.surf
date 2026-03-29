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
MEDIUM_SIZE = (800, 800)
WEBP_QUALITY = 80
JPEG_QUALITY = 85


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


def _update_thumbnail_key(media_id: str, thumb_key: str, extra_keys: dict | None = None):
    """Update the DynamoDB record with the thumbnail S3 key and optional extras."""
    try:
        update_expr = "SET thumbnailKey = :tk"
        expr_values: dict = {":tk": thumb_key}

        if extra_keys:
            for field, value in extra_keys.items():
                update_expr += f", {field} = :{field}"
                expr_values[f":{field}"] = value

        table.update_item(
            Key={"PK": f"MEDIA#{media_id}", "SK": "META"},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
        logger.info("Updated thumbnail for media %s -> %s (extras: %s)", media_id, thumb_key, extra_keys)
    except ClientError:
        logger.exception("Failed to update thumbnail for %s", media_id)


# ---------------------------------------------------------------------------
# Image thumbnail
# ---------------------------------------------------------------------------

def _generate_image_thumbnail(bucket: str, s3_key: str, media_id: str):
    """Download image from S3, create optimized thumbnails and medium variants."""
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

        # Convert to RGB if necessary (e.g. RGBA PNGs)
        rgb_img = img.convert("RGB") if img.mode in ("RGBA", "P") else img.copy()

        extra_keys = {}

        # --- Thumbnail (300x300) ---
        thumb_img = rgb_img.copy()
        thumb_img.thumbnail(THUMB_SIZE, Image.LANCZOS)

        # JPEG thumbnail (backwards compat)
        buffer = io.BytesIO()
        thumb_img.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        buffer.seek(0)
        thumb_key = f"thumbnails/{media_id}/thumb.jpg"
        s3.put_object(Bucket=bucket, Key=thumb_key, Body=buffer.getvalue(), ContentType="image/jpeg")

        # WebP thumbnail (smaller file size)
        buffer = io.BytesIO()
        thumb_img.save(buffer, format="WEBP", quality=WEBP_QUALITY)
        buffer.seek(0)
        thumb_webp_key = f"thumbnails/{media_id}/thumb.webp"
        s3.put_object(Bucket=bucket, Key=thumb_webp_key, Body=buffer.getvalue(), ContentType="image/webp")
        extra_keys["thumbnailWebpKey"] = thumb_webp_key

        # --- Medium (800px max dimension) ---
        # Only generate if original is larger than medium size
        if rgb_img.width > MEDIUM_SIZE[0] or rgb_img.height > MEDIUM_SIZE[1]:
            medium_img = rgb_img.copy()
            medium_img.thumbnail(MEDIUM_SIZE, Image.LANCZOS)

            buffer = io.BytesIO()
            medium_img.save(buffer, format="WEBP", quality=WEBP_QUALITY)
            buffer.seek(0)
            medium_key = f"thumbnails/{media_id}/medium.webp"
            s3.put_object(Bucket=bucket, Key=medium_key, Body=buffer.getvalue(), ContentType="image/webp")
            extra_keys["mediumWebpKey"] = medium_key

        _update_thumbnail_key(media_id, thumb_key, extra_keys if extra_keys else None)
        logger.info("Generated image thumbnails for %s (webp=%s, medium=%s)",
                     media_id, "thumbnailWebpKey" in extra_keys, "mediumWebpKey" in extra_keys)

    except Exception:
        logger.exception("Failed to process image thumbnail for %s", media_id)


# ---------------------------------------------------------------------------
# Video thumbnail (via ffmpeg)
# ---------------------------------------------------------------------------

FFMPEG_BIN = "/opt/bin/ffmpeg"


def _generate_video_thumbnail(bucket: str, s3_key: str, media_id: str):
    """Download video from S3, extract a frame with ffmpeg, create thumbnails with Pillow."""
    import subprocess
    import tempfile

    try:
        from PIL import Image
    except ImportError:
        logger.error("Pillow not available — cannot generate video thumbnail")
        return

    # Download video to temp file
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_video:
            tmp_video_path = tmp_video.name
            s3.download_fileobj(bucket, s3_key, tmp_video)
    except ClientError:
        logger.exception("Failed to download video %s from %s", s3_key, bucket)
        return

    try:
        # Extract a single frame at 1 second (or first frame if video < 1s)
        tmp_frame_path = tmp_video_path + ".jpg"
        result = subprocess.run(
            [
                FFMPEG_BIN,
                "-i", tmp_video_path,
                "-ss", "1",          # seek to 1 second
                "-frames:v", "1",    # extract 1 frame
                "-q:v", "2",         # JPEG quality (2 = high)
                "-y",                # overwrite
                tmp_frame_path,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            # Retry at 0 seconds (video might be very short)
            result = subprocess.run(
                [
                    FFMPEG_BIN,
                    "-i", tmp_video_path,
                    "-ss", "0",
                    "-frames:v", "1",
                    "-q:v", "2",
                    "-y",
                    tmp_frame_path,
                ],
                capture_output=True,
                text=True,
                timeout=60,
            )

        if result.returncode != 0:
            logger.error("ffmpeg failed for %s: %s", media_id, result.stderr[-500:] if result.stderr else "no output")
            return

        # Open extracted frame with Pillow and generate thumbnails
        img = Image.open(tmp_frame_path)
        rgb_img = img.convert("RGB") if img.mode in ("RGBA", "P") else img.copy()

        extra_keys = {}

        # JPEG thumbnail (300px)
        thumb_img = rgb_img.copy()
        thumb_img.thumbnail(THUMB_SIZE, Image.LANCZOS)

        buffer = io.BytesIO()
        thumb_img.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        buffer.seek(0)
        thumb_key = f"thumbnails/{media_id}/thumb.jpg"
        s3.put_object(Bucket=bucket, Key=thumb_key, Body=buffer.getvalue(), ContentType="image/jpeg")

        # WebP thumbnail (300px)
        buffer = io.BytesIO()
        thumb_img.save(buffer, format="WEBP", quality=WEBP_QUALITY)
        buffer.seek(0)
        thumb_webp_key = f"thumbnails/{media_id}/thumb.webp"
        s3.put_object(Bucket=bucket, Key=thumb_webp_key, Body=buffer.getvalue(), ContentType="image/webp")
        extra_keys["thumbnailWebpKey"] = thumb_webp_key

        _update_thumbnail_key(media_id, thumb_key, extra_keys if extra_keys else None)
        logger.info("Generated video thumbnails for %s (ffmpeg frame extraction)", media_id)

    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out for %s", media_id)
    except Exception:
        logger.exception("Failed to generate video thumbnail for %s", media_id)
    finally:
        # Clean up temp files
        for p in [tmp_video_path, tmp_video_path + ".jpg"]:
            try:
                os.unlink(p)
            except OSError:
                pass


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
        _generate_video_thumbnail(bucket, s3_key, media_id)
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
        _generate_video_thumbnail(bucket, s3_key, media_id)
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

    # EventBridge MediaConvert event (legacy — kept for in-flight jobs)
    if event.get("source") == "aws.mediaconvert":
        logger.info("Ignoring MediaConvert event — video thumbnails now use ffmpeg")
        return {"status": "ok"}

    # S3 event
    records = event.get("Records", [])
    for record in records:
        event_source = record.get("eventSource", "")
        if event_source == "aws:s3":
            _handle_s3_event(record)

    return {"status": "ok", "processed": len(records)}
