"""
OWS API Lambda Handler
Main router for all orangewhip.surf API routes.
"""

import json
import logging
import os
import uuid
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ.get("TABLE_NAME", "ows-main")
MEDIA_BUCKET = os.environ.get("MEDIA_BUCKET", "ows-media")
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
THUMB_FUNCTION_NAME = os.environ.get("THUMB_FUNCTION_NAME", "ows-thumb")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)
s3 = boto3.client("s3", config=BotoConfig(signature_version="s3v4"))
cognito = boto3.client("cognito-idp")
lambda_client = boto3.client("lambda")
bedrock = boto3.client("bedrock-runtime")

from common.response import ok, error  # noqa: E402

# ---------------------------------------------------------------------------
# Role hierarchy helpers
# ---------------------------------------------------------------------------

ROLE_HIERARCHY = ["guest", "band", "editor", "manager", "admin"]


def get_role(groups: list[str]) -> str:
    """Return the highest role from a list of Cognito groups."""
    best = 0
    for g in groups:
        g_lower = g.lower()
        if g_lower in ROLE_HIERARCHY:
            idx = ROLE_HIERARCHY.index(g_lower)
            if idx > best:
                best = idx
    return ROLE_HIERARCHY[best]


def _parse_jwt_claims(event: dict) -> dict:
    """Extract JWT claims from API Gateway v2 event."""
    try:
        return event["requestContext"]["authorizer"]["jwt"]["claims"]
    except (KeyError, TypeError):
        return {}


def get_user_info(event: dict) -> dict | None:
    """Return user info dict from the JWT, or None if unauthenticated."""
    claims = _parse_jwt_claims(event)
    if not claims:
        auth_header = event.get("headers", {}).get("authorization", "")
        if not auth_header:
            return None
        # Fallback: try to decode from header (API GW should have done this)
        return None

    sub = claims.get("sub", "")
    email = claims.get("email", "")
    # Cognito/API GW may use cognito:groups or cognito_groups
    cognito_groups_raw = claims.get("cognito:groups") or claims.get("cognito_groups") or "[]"

    # cognito:groups can arrive as:
    #   - a real list            ["admin", "band"]
    #   - a JSON-encoded string  '["admin","band"]'
    #   - API GW v2 stringified  '[admin, band]'
    #   - space-separated        'admin band'
    if isinstance(cognito_groups_raw, list):
        groups = cognito_groups_raw
    elif isinstance(cognito_groups_raw, str):
        # Try JSON first (handles '["admin","band"]')
        try:
            parsed = json.loads(cognito_groups_raw)
            groups = parsed if isinstance(parsed, list) else [str(parsed)]
        except (json.JSONDecodeError, ValueError):
            # Fallback: strip brackets, split on commas or whitespace, clean quotes
            cleaned = cognito_groups_raw.strip("[]")
            parts = cleaned.replace(",", " ").split()
            groups = [p.strip().strip('"').strip("'") for p in parts if p.strip()]
    else:
        groups = []

    role = get_role(groups)

    # Fetch custom groups from DynamoDB
    custom_groups = []
    try:
        resp = table.query(
            KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
            ExpressionAttributeValues={":pk": f"USER#{sub}", ":sk": "GROUP#"},
        )
        custom_groups = [item.get("groupName", "") for item in resp.get("Items", [])]
    except Exception:
        logger.exception("Failed to fetch custom groups for user %s", sub)

    return {
        "userId": sub,
        "email": email,
        "groups": groups,
        "role": role,
        "customGroups": custom_groups,
    }


def require_role(event: dict, min_role: str) -> tuple[dict | None, dict | None]:
    """
    Return (user_info, error_response).
    If user doesn't meet min_role, error_response is set.
    """
    user = get_user_info(event)
    if user is None:
        logger.warning("require_role: no user info (missing/invalid JWT)")
        return None, error("Unauthorized", 401)

    user_level = ROLE_HIERARCHY.index(user["role"])
    required_level = ROLE_HIERARCHY.index(min_role)
    if user_level < required_level:
        logger.warning(
            "require_role: user role=%s groups=%s insufficient for min_role=%s",
            user["role"], user.get("groups", []), min_role,
        )
        return user, error("Forbidden", 403)
    return user, None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


def _body(event: dict) -> dict:
    """Parse JSON body from the event."""
    raw = event.get("body", "{}")
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def _qs(event: dict) -> dict:
    """Return query-string parameters."""
    return event.get("queryStringParameters") or {}


def _path_parts(event: dict) -> list[str]:
    """Return path segments, e.g. /shows/123 -> ['shows', '123']."""
    raw = event.get("rawPath", "/")
    return [p for p in raw.strip("/").split("/") if p]


def _query_entity(entity_type: str, **extra_filters) -> list[dict]:
    """Query byEntity GSI by entityType, paginating through all results."""
    try:
        query_params = {
            "IndexName": "byEntity",
            "KeyConditionExpression": "entityType = :et",
            "ExpressionAttributeValues": {":et": entity_type},
            "ScanIndexForward": False,
        }
        items: list[dict] = []
        while True:
            resp = table.query(**query_params)
            items.extend(resp.get("Items", []))
            last_key = resp.get("LastEvaluatedKey")
            if not last_key:
                break
            query_params["ExclusiveStartKey"] = last_key
        # Apply extra filters in-memory
        for key, val in extra_filters.items():
            items = [i for i in items if i.get(key) == val]
        return items
    except ClientError:
        logger.exception("GSI1 query failed for %s", entity_type)
        return []


def _get_item(pk: str, sk: str = "META") -> dict | None:
    resp = table.get_item(Key={"PK": pk, "SK": sk})
    return resp.get("Item")


def _delete_item(pk: str, sk: str = "META"):
    table.delete_item(Key={"PK": pk, "SK": sk})


def _invoke_thumb(media_id: str, s3_key: str, media_type: str):
    """Asynchronously invoke the thumbnail Lambda."""
    try:
        lambda_client.invoke(
            FunctionName=THUMB_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps({
                "mediaId": media_id,
                "s3Key": s3_key,
                "mediaType": media_type,
                "bucket": MEDIA_BUCKET,
            }),
        )
    except Exception:
        logger.exception("Failed to invoke thumb Lambda for %s", media_id)


def _generate_ai_summary(title: str, media_type: str) -> str:
    """Call Bedrock Nova Micro to generate a brief description."""
    try:
        prompt = (
            f"Write a one-sentence description for a rock band's {media_type} "
            f'titled "{title}". Keep it brief and energetic.'
        )
        resp = bedrock.invoke_model(
            modelId="amazon.nova-micro",
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 100, "temperature": 0.7},
            }),
        )
        result = json.loads(resp["body"].read())
        return result.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")
    except Exception:
        logger.exception("Bedrock AI summary failed")
        return ""


PRESIGNED_GET_EXPIRY = 3600  # 1 hour


def _presign_get(s3_key: str) -> str:
    """Generate a presigned GET URL for an S3 key."""
    if not s3_key:
        return ""
    try:
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": MEDIA_BUCKET, "Key": s3_key},
            ExpiresIn=PRESIGNED_GET_EXPIRY,
        )
    except Exception:
        logger.exception("Failed to generate presigned GET URL for %s", s3_key)
        return ""


def _is_image_key(s3_key: str) -> bool:
    """Check if an S3 key points to an image (not a video/audio media file)."""
    if not s3_key:
        return False
    # Generated thumbnails are always images
    if s3_key.startswith("thumbnails/"):
        return True
    # Image media files are valid thumbnails
    if s3_key.startswith("media/image"):
        return True
    # Check extension as fallback
    ext = s3_key.rsplit(".", 1)[-1].lower() if "." in s3_key else ""
    return ext in ("jpg", "jpeg", "png", "webp", "gif")


def _enrich_media_item(item: dict) -> dict:
    """Add url, thumbnail, and type fields for frontend consumption."""
    url = _presign_get(item.get("s3Key", ""))
    item["url"] = url

    # Only presign thumbnailKey if it points to an actual image file
    thumb_key = item.get("thumbnailKey", "")
    thumb = _presign_get(thumb_key) if _is_image_key(thumb_key) else ""
    # For images, fall back to the main URL as the thumbnail preview
    if not thumb and item.get("mediaType") == "image":
        thumb = url
    item["thumbnail"] = thumb
    item["type"] = item.get("mediaType", "image")

    # Enrich files array with presigned URLs
    files = item.get("files", [])
    if files:
        for f in files:
            f["url"] = _presign_get(f.get("s3Key", ""))
        item["files"] = files
    return item


def _enrich_media_items(items: list[dict]) -> list[dict]:
    """Enrich a list of media items with presigned URLs."""
    return [_enrich_media_item(item) for item in items]


def _resolve_media_ids(media_ids: list[str]) -> list[dict]:
    """Look up media items by IDs and return enriched items."""
    if not media_ids:
        return []
    result = []
    for mid in media_ids:
        item = _get_item(f"MEDIA#{mid}")
        if item:
            result.append(_enrich_media_item(item))
    return result


def _resolve_show_media(show: dict) -> dict:
    """Resolve thumbnailMediaId and mediaIds on a show for frontend display."""
    thumb_media_id = show.get("thumbnailMediaId", "")
    if thumb_media_id:
        thumb_item = _get_item(f"MEDIA#{thumb_media_id}")
        if thumb_item:
            enriched = _enrich_media_item(thumb_item)
            # Use the thumbnail URL, or the main URL for images
            show["thumbnail"] = enriched.get("thumbnail") or enriched.get("url", "")

    media_ids = show.get("mediaIds", [])
    if media_ids:
        resolved = _resolve_media_ids(media_ids)
        show["media"] = resolved

        # Fallback: if no explicit thumbnail, use first image media's thumbnail
        if not show.get("thumbnail") and resolved:
            for m in resolved:
                if m.get("type") == "image":
                    show["thumbnail"] = m.get("thumbnail") or m.get("url", "")
                    break
    return show


def _resolve_update_media(update: dict) -> dict:
    """Resolve mediaIds on an update for frontend display."""
    media_ids = update.get("mediaIds", [])
    if media_ids:
        media_items = _resolve_media_ids(media_ids)
        # Map to the shape the frontend expects
        update["media"] = [
            {
                "id": m.get("id", ""),
                "url": m.get("url", ""),
                "type": m.get("type", "image"),
                "thumbnailUrl": m.get("thumbnail", ""),
                "filename": m.get("title", ""),
            }
            for m in media_items
        ]
    return update


def _validate_api_key(event: dict, scope: str = "embed") -> bool:
    """Validate X-Api-Key header against DynamoDB APIKEY records."""
    api_key = event.get("headers", {}).get("x-api-key", "")
    if not api_key:
        return False
    item = _get_item(f"APIKEY#{api_key}")
    if not item:
        return False
    scopes = item.get("scopes", [])
    return scope in scopes or "*" in scopes


# ---------------------------------------------------------------------------
# Route: Health
# ---------------------------------------------------------------------------

def handle_health(event, method):
    return ok({"status": "ok"})


# ---------------------------------------------------------------------------
# Route: Shows
# ---------------------------------------------------------------------------

def _resolve_venues(shows: list[dict]) -> list[dict]:
    """Attach a 'venue' object to each show that has a venueId."""
    venue_ids = {s.get("venueId") for s in shows if s.get("venueId")}
    if not venue_ids:
        return shows
    venue_map: dict[str, dict] = {}
    for vid in venue_ids:
        v = _get_item(f"VENUE#{vid}")
        if v:
            venue_map[vid] = {
                "name": v.get("name", ""),
                "address": v.get("address", ""),
                "website": v.get("website", v.get("websiteUrl", "")),
            }
    for show in shows:
        vid = show.get("venueId", "")
        if vid and vid in venue_map:
            show["venue"] = venue_map[vid]
    return shows


def handle_shows(event, method, parts):
    if method == "GET":
        qs = _qs(event)
        # Single show lookup: GET /shows?id=xxx
        show_id = qs.get("id")
        if show_id:
            item = _get_item(f"SHOW#{show_id}")
            if not item:
                return error("Show not found", 404)
            _resolve_venues([item])
            _resolve_show_media(item)
            return ok(item)

        items = _query_entity("SHOW")
        _resolve_venues(items)
        for item in items:
            _resolve_show_media(item)
        now = _now_iso()
        upcoming = sorted(
            [s for s in items if s.get("date", "") >= now[:10]],
            key=lambda s: s.get("date", ""),
        )
        past = sorted(
            [s for s in items if s.get("date", "") < now[:10]],
            key=lambda s: s.get("date", ""),
            reverse=True,
        )
        return ok(upcoming + past)

    if method == "POST":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        show_id = _new_id()
        date = data.get("date", "")
        item = {
            "PK": f"SHOW#{show_id}",
            "SK": "META",
            "id": show_id,
            "date": date,
            "venueId": data.get("venueId", ""),
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "mediaIds": data.get("mediaIds", []),
            "thumbnailMediaId": data.get("thumbnailMediaId", ""),
            "createdBy": user["userId"],
            "createdAt": _now_iso(),
            "entityType": "SHOW",
            "entitySk": f"{date}#{show_id}",
        }
        table.put_item(Item=item)
        return ok(item, 201)

    if method == "PUT":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        show_id = data.get("id", "") or qs.get("id", "")
        if not show_id:
            return error("Missing show id")
        existing = _get_item(f"SHOW#{show_id}")
        if not existing:
            return error("Show not found", 404)
        for field in ["date", "venueId", "title", "description", "mediaIds", "thumbnailMediaId"]:
            if field in data:
                existing[field] = data[field]
        if "date" in data:
            existing["entitySk"] = f"{data['date']}#{show_id}"
        table.put_item(Item=existing)
        return ok(existing)

    if method == "DELETE":
        user, err = require_role(event, "admin")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        show_id = data.get("id", "") or qs.get("id", "")
        if not show_id:
            return error("Missing show id")
        _delete_item(f"SHOW#{show_id}")
        return ok({"deleted": show_id})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Venues
# ---------------------------------------------------------------------------

def handle_venues(event, method, parts):
    if method == "GET":
        items = _query_entity("VENUE")
        return ok(items)

    if method == "POST":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        venue_id = _new_id()
        name = data.get("name", "")
        item = {
            "PK": f"VENUE#{venue_id}",
            "SK": "META",
            "id": venue_id,
            "name": name,
            "address": data.get("address", ""),
            "thumbnailUrl": data.get("thumbnailUrl", ""),
            "info": data.get("info", ""),
            "website": data.get("website", data.get("websiteUrl", "")),
            "entityType": "VENUE",
            "entitySk": f"{name}#{venue_id}",
        }
        table.put_item(Item=item)
        return ok(item, 201)

    if method == "PUT":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        venue_id = data.get("id", "")
        if not venue_id:
            return error("Missing venue id")
        existing = _get_item(f"VENUE#{venue_id}")
        if not existing:
            return error("Venue not found", 404)
        for field in ["name", "address", "thumbnailUrl", "info", "website"]:
            if field in data:
                existing[field] = data[field]
        if "name" in data:
            existing["entitySk"] = f"{data['name']}#{venue_id}"
        table.put_item(Item=existing)
        return ok(existing)

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Updates
# ---------------------------------------------------------------------------

def handle_updates(event, method, parts):
    # GET /updates/pinned
    if method == "GET" and len(parts) >= 2 and parts[1] == "pinned":
        items = _query_entity("UPDATE", pinned=True, visible=True)
        if not items:
            return error("No pinned update", 404)
        _resolve_update_media(items[0])
        return ok(items[0])

    if method == "GET":
        qs = _qs(event)
        # When all=true, return all updates (admin use)
        if qs.get("all") == "true":
            items = _query_entity("UPDATE")
        else:
            items = _query_entity("UPDATE", visible=True)
        for item in items:
            _resolve_update_media(item)
        return ok(items)

    if method == "POST":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        update_id = _new_id()
        created_at = _now_iso()
        item = {
            "PK": f"UPDATE#{update_id}",
            "SK": "META",
            "id": update_id,
            "title": data.get("title", ""),
            "content": data.get("content", ""),
            "mediaIds": data.get("mediaIds", []),
            "visible": data.get("visible", True),
            "pinned": data.get("pinned", False),
            "createdBy": user["userId"],
            "createdAt": created_at,
            "entityType": "UPDATE",
            "entitySk": f"{created_at}#{update_id}",
        }
        table.put_item(Item=item)
        return ok(item, 201)

    if method == "PUT":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        update_id = data.get("id", "") or qs.get("id", "")
        if not update_id:
            return error("Missing update id")
        existing = _get_item(f"UPDATE#{update_id}")
        if not existing:
            return error("Update not found", 404)
        for field in ["title", "content", "mediaIds", "visible", "pinned"]:
            if field in data:
                existing[field] = data[field]
        table.put_item(Item=existing)
        return ok(existing)

    if method == "DELETE":
        user, err = require_role(event, "admin")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        update_id = data.get("id", "") or qs.get("id", "")
        if not update_id:
            return error("Missing update id")
        _delete_item(f"UPDATE#{update_id}")
        return ok({"deleted": update_id})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Press
# ---------------------------------------------------------------------------

def _enrich_press_attachments(item: dict) -> dict:
    """Add presigned URLs to fileAttachments in a press item."""
    attachments = item.get("fileAttachments", []) or item.get("attachments", [])
    if not attachments:
        return item
    enriched = []
    for att in attachments:
        a = dict(att)
        s3_key = a.get("s3Key", "")
        if s3_key:
            a["url"] = _presign_get(s3_key)
        enriched.append(a)
    item["fileAttachments"] = enriched
    item["attachments"] = enriched
    return item


def handle_press(event, method, parts):
    # POST /press/upload-url — presigned URL for file upload
    if method == "POST" and len(parts) >= 2 and parts[1] == "upload-url":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        filename = data.get("filename", "upload.bin")
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
        file_id = _new_id()
        file_uuid = str(uuid.uuid4())
        s3_key = f"press/{file_id}/{file_uuid}.{ext}"

        # Do not include ContentType in Params - S3 would enforce exact match
        # and browsers can vary (e.g. PDF as application/pdf vs application/x-pdf)
        presigned_put = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": MEDIA_BUCKET, "Key": s3_key},
            ExpiresIn=3600,
        )
        file_url = _presign_get(s3_key)
        return ok({
            "uploadUrl": presigned_put,
            "fileUrl": file_url,
            "fileId": file_id,
            "s3Key": s3_key,
        })

    if method == "GET":
        qs = _qs(event)
        # Single item: GET /press?id=xxx
        press_id = qs.get("id")
        if press_id:
            item = _get_item(f"PRESS#{press_id}")
            if not item:
                return error("Press not found", 404)
            if not item.get("public") and not get_user_info(event):
                return error("Press not found", 404)
            _enrich_press_attachments(item)
            return ok(item)
        if qs.get("all") == "true":
            items = _query_entity("PRESS")
        else:
            items = _query_entity("PRESS", public=True)
        for item in items:
            _enrich_press_attachments(item)
        return ok(items)

    if method == "POST":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        press_id = _new_id()
        created_at = _now_iso()
        item = {
            "PK": f"PRESS#{press_id}",
            "SK": "META",
            "id": press_id,
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "fileAttachments": data.get("fileAttachments", []),
            "links": data.get("links", []),
            "public": data.get("public", True),
            "pinned": data.get("pinned", False),
            "createdBy": user["userId"],
            "createdAt": created_at,
            "entityType": "PRESS",
            "entitySk": f"{created_at}#{press_id}",
        }
        table.put_item(Item=item)
        return ok(item, 201)

    if method == "PUT":
        user, err = require_role(event, "editor")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        press_id = data.get("id", "") or qs.get("id", "")
        if not press_id:
            return error("Missing press id")
        existing = _get_item(f"PRESS#{press_id}")
        if not existing:
            return error("Press not found", 404)
        for field in ["title", "description", "fileAttachments", "links", "public", "pinned"]:
            if field in data:
                existing[field] = data[field]
        table.put_item(Item=existing)
        return ok(existing)

    if method == "DELETE":
        user, err = require_role(event, "admin")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        press_id = data.get("id", "") or qs.get("id", "")
        if not press_id:
            return error("Missing press id")
        _delete_item(f"PRESS#{press_id}")
        return ok({"deleted": press_id})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Media
# ---------------------------------------------------------------------------

def handle_media(event, method, parts):
    # GET /media/all — authenticated, band+
    if method == "GET" and len(parts) >= 2 and parts[1] == "all":
        user, err = require_role(event, "band")
        if err:
            return err
        items = _query_entity("MEDIA")
        _enrich_media_items(items)
        return ok(items)

    # GET /media — public only, with filters
    if method == "GET":
        qs = _qs(event)

        # Single item lookup: GET /media?id=xxx
        media_id = qs.get("id")
        if media_id:
            item = _get_item(f"MEDIA#{media_id}")
            if not item:
                return error("Media not found", 404)
            _enrich_media_item(item)
            return ok(item)

        items = _query_entity("MEDIA", public=True)
        media_type = qs.get("type")
        query = qs.get("search", qs.get("q", "")).lower()
        category_ids = qs.get("categoryIds", qs.get("category", ""))

        if media_type:
            items = [m for m in items if m.get("mediaType") == media_type]
        if query:
            items = [
                m for m in items
                if query in m.get("title", "").lower()
                or query in m.get("aiSummary", "").lower()
            ]
        if category_ids:
            cat_set = set(category_ids.split(","))
            items = [
                m for m in items
                if cat_set.intersection(set(m.get("categories", [])))
            ]
        _enrich_media_items(items)
        return ok(items)

    # POST /media/upload — presigned URL
    if method == "POST" and len(parts) >= 2 and parts[1] == "upload":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        media_type = data.get("mediaType", "image")
        filename = data.get("filename", "upload.bin")
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
        media_id = data.get("mediaId", _new_id())
        file_uuid = str(uuid.uuid4())
        s3_key = f"media/{media_type}/{media_id}/{file_uuid}.{ext}"

        presigned = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": MEDIA_BUCKET, "Key": s3_key},
            ExpiresIn=3600,
        )
        return ok({"uploadUrl": presigned, "s3Key": s3_key, "mediaId": media_id})

    # POST /media/thumbnail-upload — presigned URL for custom thumbnail
    if method == "POST" and len(parts) >= 2 and parts[1] == "thumbnail-upload":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        media_id = data.get("mediaId", "")
        if not media_id:
            return error("Missing mediaId")
        filename = data.get("filename", "thumb.jpg")
        ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        file_uuid = str(uuid.uuid4())
        s3_key = f"thumbnails/{media_id}/{file_uuid}.{ext}"

        presigned = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": MEDIA_BUCKET, "Key": s3_key},
            ExpiresIn=3600,
        )
        return ok({"uploadUrl": presigned, "s3Key": s3_key})

    # POST /media/import-from-url — download from URL, upload to S3
    if method == "POST" and len(parts) >= 2 and parts[1] == "import-from-url":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        source_url = data.get("url", "")
        title = data.get("title", "Imported media")
        media_type = data.get("mediaType", "image")
        if not source_url:
            return error("Missing url")

        try:
            req = urllib.request.Request(source_url, headers={"User-Agent": "OWS-Bot/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                file_data = resp.read(50 * 1024 * 1024)  # 50 MB max
                content_type = resp.headers.get("Content-Type", "application/octet-stream")
        except (urllib.error.URLError, Exception) as exc:
            logger.exception("Failed to download from %s", source_url)
            return error(f"Download failed: {str(exc)}", 502)

        ext_map = {
            "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
            "image/gif": "gif", "audio/mpeg": "mp3", "audio/wav": "wav",
            "video/mp4": "mp4", "video/webm": "webm",
        }
        ext = ext_map.get(content_type, "bin")
        media_id = _new_id()
        file_uuid = str(uuid.uuid4())
        s3_key = f"media/{media_type}/{media_id}/{file_uuid}.{ext}"

        s3.put_object(
            Bucket=MEDIA_BUCKET,
            Key=s3_key,
            Body=file_data,
            ContentType=content_type,
        )

        added_at = _now_iso()
        ai_summary = _generate_ai_summary(title, media_type)
        categories = data.get("categories", [])

        item = {
            "PK": f"MEDIA#{media_id}",
            "SK": "META",
            "id": media_id,
            "title": title,
            "mediaType": media_type,
            "format": ext,
            "dimensions": "",
            "filesize": len(file_data),
            "s3Key": s3_key,
            "thumbnailKey": "",
            "categories": categories,
            "public": data.get("public", True),
            "addedBy": user["userId"],
            "addedAt": added_at,
            "aiSummary": ai_summary,
            "entityType": "MEDIA",
            "entitySk": f"{added_at}#{media_id}",
            "categoryId": categories[0] if categories else "NONE",
        }
        table.put_item(Item=item)
        _invoke_thumb(media_id, s3_key, media_type)
        return ok({"mediaId": media_id}, 201)

    # POST /media — create media record (after client-side upload)
    if method == "POST":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        media_id = data.get("id", _new_id())
        added_at = _now_iso()
        title = data.get("title", "")
        media_type = data.get("mediaType", "image")
        categories = data.get("categories", [])
        ai_summary = _generate_ai_summary(title, media_type) if title else ""
        s3_key = data.get("s3Key", "")
        files = data.get("files", [])

        # Validate max 15 files
        if len(files) > 15:
            return error("Maximum 15 files per media item", 400)

        # If files provided but no explicit s3Key, use first file as primary
        if files and not s3_key:
            s3_key = files[0].get("s3Key", "")

        # Auto-assign thumbnailKey: use explicit value if it's an image,
        # or fall back to first image file. Video/audio s3Keys are never
        # valid thumbnails — the thumb Lambda generates those async.
        thumbnail_key = data.get("thumbnailKey", "")
        if thumbnail_key and not _is_image_key(thumbnail_key):
            thumbnail_key = ""  # discard non-image thumbnailKey
        if not thumbnail_key and files:
            for f in files:
                ct = f.get("contentType", "")
                if ct.startswith("image/"):
                    thumbnail_key = f.get("s3Key", "")
                    break

        item = {
            "PK": f"MEDIA#{media_id}",
            "SK": "META",
            "id": media_id,
            "title": title,
            "mediaType": media_type,
            "format": data.get("format", ""),
            "dimensions": data.get("dimensions", ""),
            "filesize": data.get("filesize", 0),
            "s3Key": s3_key,
            "thumbnailKey": thumbnail_key,
            "files": files,
            "categories": categories,
            "public": data.get("public", True),
            "addedBy": user["userId"],
            "addedAt": added_at,
            "aiSummary": ai_summary,
            "entityType": "MEDIA",
            "entitySk": f"{added_at}#{media_id}",
            "categoryId": categories[0] if categories else "NONE",
        }
        table.put_item(Item=item)
        if s3_key:
            _invoke_thumb(media_id, s3_key, media_type)
        return ok(item, 201)

    if method == "PUT":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        media_id = data.get("id", "")
        if not media_id:
            return error("Missing media id")
        existing = _get_item(f"MEDIA#{media_id}")
        if not existing:
            return error("Media not found", 404)

        # Handle files array update
        if "files" in data:
            new_files = data["files"]
            if len(new_files) > 15:
                return error("Maximum 15 files per media item", 400)
            # Clean up removed S3 objects
            old_keys = {f.get("s3Key") for f in existing.get("files", [])}
            new_keys = {f.get("s3Key") for f in new_files}
            removed_keys = old_keys - new_keys
            for rk in removed_keys:
                if rk:
                    try:
                        s3.delete_object(Bucket=MEDIA_BUCKET, Key=rk)
                    except Exception:
                        logger.exception("Failed to delete removed file %s", rk)
            existing["files"] = new_files
            # Update primary s3Key to first file if present
            if new_files:
                existing["s3Key"] = new_files[0].get("s3Key", existing.get("s3Key", ""))

        for field in [
            "title", "mediaType", "format", "dimensions", "filesize",
            "s3Key", "thumbnailKey", "categories", "public", "aiSummary",
        ]:
            if field in data:
                existing[field] = data[field]
        if "categories" in data:
            existing["categoryId"] = data["categories"][0] if data["categories"] else "NONE"
        table.put_item(Item=existing)
        _enrich_media_item(existing)
        return ok(existing)

    if method == "DELETE":
        user, err = require_role(event, "admin")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        media_id = data.get("id", "") or qs.get("id", "")
        if not media_id:
            return error("Missing media id")
        existing = _get_item(f"MEDIA#{media_id}")
        if existing:
            # Clean up legacy top-level S3 objects
            for key_field in ["s3Key", "thumbnailKey"]:
                s3_key = existing.get(key_field, "")
                if s3_key:
                    try:
                        s3.delete_object(Bucket=MEDIA_BUCKET, Key=s3_key)
                    except Exception:
                        logger.exception("Failed to delete S3 object %s", s3_key)
            # Clean up all files in the files array
            for f in existing.get("files", []):
                fk = f.get("s3Key", "")
                if fk:
                    try:
                        s3.delete_object(Bucket=MEDIA_BUCKET, Key=fk)
                    except Exception:
                        logger.exception("Failed to delete file S3 object %s", fk)
        _delete_item(f"MEDIA#{media_id}")
        return ok({"deleted": media_id})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Categories
# ---------------------------------------------------------------------------

def handle_categories(event, method, parts):
    if method == "GET":
        items = _query_entity("CATEGORY")
        return ok(items)

    if method == "POST":
        user, err = require_role(event, "manager")
        if err:
            return err
        data = _body(event)
        cat_id = _new_id()
        name = data.get("name", "")
        item = {
            "PK": f"CATEGORY#{cat_id}",
            "SK": "META",
            "id": cat_id,
            "name": name,
            "entityType": "CATEGORY",
            "entitySk": f"{name}#{cat_id}",
        }
        table.put_item(Item=item)
        return ok(item, 201)

    if method == "PUT":
        user, err = require_role(event, "manager")
        if err:
            return err
        data = _body(event)
        cat_id = data.get("id", "")
        if not cat_id:
            return error("Missing category id")
        existing = _get_item(f"CATEGORY#{cat_id}")
        if not existing:
            return error("Category not found", 404)
        if "name" in data:
            existing["name"] = data["name"]
            existing["entitySk"] = f"{data['name']}#{cat_id}"
        table.put_item(Item=existing)
        return ok(existing)

    if method == "DELETE":
        user, err = require_role(event, "manager")
        if err:
            return err
        data = _body(event)
        qs = _qs(event)
        cat_id = data.get("id", "") or qs.get("id", "")
        if not cat_id:
            return error("Missing category id")
        _delete_item(f"CATEGORY#{cat_id}")
        return ok({"deleted": cat_id})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: User profile & self
# ---------------------------------------------------------------------------

def handle_me(event, method, parts):
    user, err = require_role(event, "band")
    if err:
        return err
    # Enrich with profile displayName and userHandle for header display
    profile = _get_item(f"USER#{user['userId']}", "PROFILE")
    if profile:
        user["displayName"] = profile.get("displayName", user.get("email", ""))
        user["userHandle"] = profile.get("userHandle", "")
    else:
        user["displayName"] = user.get("email", "")
        user["userHandle"] = ""
    return ok(user)


def _resolve_profile_identifier(identifier: str) -> str | None:
    """Resolve identifier (userId or handle slug) to userId. Returns None if not found."""
    if not identifier:
        return None
    # Try direct userId lookup (UUID format or Cognito sub)
    profile = _get_item(f"USER#{identifier}", "PROFILE")
    if profile:
        return identifier
    # Try handle lookup: HANDLE#<slug> -> userId
    handle_lookup = _get_item(f"HANDLE#{identifier.lower()}", "META")
    if handle_lookup:
        return handle_lookup.get("userId")
    return None


def handle_public_profile(event, method, parts):
    """GET /profile/:identifier — public profile view. No auth required."""
    if method != "GET" or len(parts) < 2:
        return error("Not found", 404)
    identifier = parts[1]
    user_id = _resolve_profile_identifier(identifier)
    if not user_id:
        return error("Profile not found", 404)
    profile = _get_item(f"USER#{user_id}", "PROFILE")
    if not profile:
        return error("Profile not found", 404)
    if not profile.get("profilePublic", False):
        return error("This user's profile is private", 403)
    # Return sanitized public profile (no email, no internal fields)
    key = profile.get("profilePhotoKey", "")
    photo_url = _presign_get(key) if key and _is_image_key(key) else ""
    public = {
        "displayName": profile.get("displayName", ""),
        "userHandle": profile.get("userHandle", ""),
        "about": profile.get("about", profile.get("bio", "")),
        "profilePhotoUrl": photo_url,
    }
    return ok(public)


def _enrich_profile_with_photo(profile: dict) -> dict:
    """Add profilePhotoUrl (presigned) from profilePhotoKey."""
    key = profile.get("profilePhotoKey", "")
    if key and _is_image_key(key):
        profile["profilePhotoUrl"] = _presign_get(key)
    elif not profile.get("profilePhotoUrl"):
        profile["profilePhotoUrl"] = ""
    return profile


def _update_last_login(profile: dict, event: dict) -> None:
    """Update profile with last login timestamp and IP from request."""
    try:
        ctx = event.get("requestContext", {})
        http = ctx.get("http", {})
        source_ip = http.get("sourceIp", "")
        now = _now_iso()
        profile["lastLoginAt"] = now
        profile["lastLoginIp"] = source_ip
        # Persist to DynamoDB
        pk = profile.get("PK", "")
        sk = profile.get("SK", "PROFILE")
        if pk and sk:
            table.update_item(
                Key={"PK": pk, "SK": sk},
                UpdateExpression="SET lastLoginAt = :t, lastLoginIp = :ip",
                ExpressionAttributeValues={":t": now, ":ip": source_ip},
            )
    except Exception:
        logger.exception("Failed to update last login")


def handle_profile(event, method, parts):
    # POST /profile/photo-upload — presigned URL for profile photo
    if method == "POST" and len(parts) >= 2 and parts[1] == "photo-upload":
        user, err = require_role(event, "band")
        if err:
            return err
        data = _body(event)
        filename = data.get("filename", "avatar.jpg")
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "gif"):
            ext = "jpg"
        user_id = user["userId"]
        file_uuid = str(uuid.uuid4())
        s3_key = f"profiles/{user_id}/{file_uuid}.{ext}"
        presigned = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": MEDIA_BUCKET, "Key": s3_key},
            ExpiresIn=3600,
        )
        return ok({"uploadUrl": presigned, "s3Key": s3_key})

    # Public profile by identifier: GET /profile/:identifier
    if method == "GET" and len(parts) >= 2:
        return handle_public_profile(event, method, parts)

    user, err = require_role(event, "band")
    if err:
        return err
    user_id = user["userId"]

    if method == "GET":
        profile = _get_item(f"USER#{user_id}", "PROFILE")
        if not profile:
            profile = {"displayName": "", "email": user["email"], "bio": ""}
        profile["PK"] = f"USER#{user_id}"
        profile["SK"] = "PROFILE"
        _update_last_login(profile, event)
        _enrich_profile_with_photo(profile)
        profile["role"] = user["role"]
        profile["groups"] = user["groups"]
        profile["customGroups"] = user.get("customGroups", [])
        profile["about"] = profile.get("about", profile.get("bio", ""))
        return ok(profile)

    if method == "PUT":
        data = _body(event)
        about_val = data.get("about", data.get("bio", ""))
        item = {
            "PK": f"USER#{user_id}",
            "SK": "PROFILE",
            "displayName": data.get("displayName", ""),
            "email": data.get("email", user["email"]),
            "bio": about_val,
            "about": about_val,
            "profilePublic": data.get("profilePublic", False),
            "userHandle": data.get("userHandle", ""),
            "profilePhotoKey": data.get("profilePhotoKey", ""),
        }
        # Handle slug lookup for userHandle (for /profile/:handle URLs)
        user_handle = (item.get("userHandle") or "").strip()
        handle_slug = user_handle.lower().replace(" ", "-").replace("_", "-") if user_handle else ""
        existing = _get_item(f"USER#{user_id}", "PROFILE")
        old_slug = ""
        if existing and existing.get("userHandle"):
            old_slug = existing.get("userHandle", "").lower().replace(" ", "-").replace("_", "-")
        if handle_slug:
            existing_handle = _get_item(f"HANDLE#{handle_slug}", "META")
            if existing_handle and existing_handle.get("userId") != user_id:
                return error("That handle is already taken", 400)
        if old_slug and old_slug != handle_slug:
            _delete_item(f"HANDLE#{old_slug}", "META")
        if handle_slug:
            table.put_item(Item={
                "PK": f"HANDLE#{handle_slug}",
                "SK": "META",
                "userId": user_id,
                "entityType": "HANDLE_LOOKUP",
            })
        table.put_item(Item=item)
        # Merge role info and enrich photo URL for the frontend
        item["role"] = user["role"]
        item["groups"] = user["groups"]
        item["customGroups"] = user.get("customGroups", [])
        _enrich_profile_with_photo(item)
        return ok(item)

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Custom groups (self-service)
# ---------------------------------------------------------------------------

def handle_my_groups(event, method, parts):
    user, err = require_role(event, "band")
    if err:
        return err
    user_id = user["userId"]

    # POST /me/groups — join a group
    if method == "POST":
        data = _body(event)
        group_name = data.get("groupName", "")
        if not group_name:
            return error("Missing groupName")
        # Check group exists and is selfJoin
        group = _get_item(f"GROUP#{group_name}")
        if not group:
            return error("Group not found", 404)
        if not group.get("selfJoin", False):
            return error("Group does not allow self-join", 403)
        table.put_item(Item={
            "PK": f"GROUP#{group_name}",
            "SK": f"MEMBER#{user_id}",
            "userId": user_id,
            "joinedAt": _now_iso(),
        })
        return ok({"joined": group_name})

    # DELETE /me/groups/{groupName} — leave a group
    if method == "DELETE" and len(parts) >= 3:
        group_name = parts[2]
        _delete_item(f"GROUP#{group_name}", f"MEMBER#{user_id}")
        return ok({"left": group_name})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Groups (public list)
# ---------------------------------------------------------------------------

def handle_groups(event, method, parts):
    if method == "GET":
        items = _query_entity("GROUP")
        return ok(items)
    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Embed (API-key gated)
# ---------------------------------------------------------------------------

def handle_embed(event, method, parts):
    if not _validate_api_key(event, "embed"):
        return error("Invalid or missing API key", 401)

    if len(parts) < 2:
        return error("Missing embed resource")

    resource = parts[1]
    if resource == "shows":
        items = _query_entity("SHOW")
        now = _now_iso()
        upcoming = sorted(
            [s for s in items if s.get("date", "") >= now[:10]],
            key=lambda s: s.get("date", ""),
        )
        return ok({"shows": upcoming})

    if resource == "updates":
        items = _query_entity("UPDATE", visible=True)
        return ok({"updates": items[:10]})

    return error("Unknown embed resource", 404)


# ---------------------------------------------------------------------------
# Route: Admin — Users
# ---------------------------------------------------------------------------

def handle_admin_users(event, method, parts):
    user, err = require_role(event, "admin")
    if err:
        return err

    # GET /admin/users
    if method == "GET" and len(parts) == 2:
        try:
            resp = cognito.list_users(UserPoolId=COGNITO_USER_POOL_ID, Limit=60)
            users = []
            for u in resp.get("Users", []):
                attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
                username = u["Username"]
                user_id = attrs.get("sub", username)

                # Fetch Cognito groups for this user
                cognito_groups = []
                try:
                    groups_resp = cognito.admin_list_groups_for_user(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        Username=username,
                    )
                    cognito_groups = [g["GroupName"] for g in groups_resp.get("Groups", [])]
                except ClientError:
                    logger.warning("Failed to fetch groups for user %s", username)

                # Fetch custom groups from DynamoDB
                custom_groups = []
                try:
                    cg_resp = table.query(
                        KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
                        ExpressionAttributeValues={
                            ":pk": f"USER#{user_id}",
                            ":sk": "GROUP#",
                        },
                    )
                    custom_groups = [
                        item.get("groupName", "") for item in cg_resp.get("Items", [])
                    ]
                except Exception:
                    logger.warning("Failed to fetch custom groups for user %s", user_id)

                # Fetch display name from profile
                display_name = ""
                profile = _get_item(f"USER#{user_id}", "PROFILE")
                if profile:
                    display_name = profile.get("displayName", "")

                users.append({
                    "userId": user_id,
                    "username": username,
                    "email": attrs.get("email", ""),
                    "displayName": display_name,
                    "groups": cognito_groups,
                    "customGroups": custom_groups,
                    "createdAt": u.get("UserCreateDate", "").isoformat()
                    if hasattr(u.get("UserCreateDate", ""), "isoformat") else "",
                })
            return ok(users)
        except ClientError:
            logger.exception("Failed to list users")
            return error("Failed to list users", 500)

    # Route with username: /admin/users/{username}/...
    if len(parts) >= 3:
        username = parts[2]

        # DELETE /admin/users/{username}
        if method == "DELETE" and len(parts) == 3:
            try:
                cognito.admin_disable_user(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=username,
                )
                return ok({"disabled": username})
            except ClientError:
                logger.exception("Failed to disable user %s", username)
                return error("Failed to disable user", 500)

        # /admin/users/{username}/groups
        if len(parts) >= 4 and parts[3] == "groups":
            # GET /admin/users/{username}/groups
            if method == "GET":
                try:
                    resp = cognito.admin_list_groups_for_user(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        Username=username,
                    )
                    groups = [g["GroupName"] for g in resp.get("Groups", [])]
                    return ok({"username": username, "groups": groups})
                except ClientError:
                    logger.exception("Failed to list groups for %s", username)
                    return error("Failed to list user groups", 500)

            # POST /admin/users/{username}/groups
            if method == "POST":
                data = _body(event)
                group_type = data.get("type", "cognito")
                group_name = data.get("group") or data.get("groupName", "")
                if not group_name:
                    return error("Missing group name")

                if group_type == "custom":
                    # Look up user sub from Cognito attrs for DynamoDB key
                    try:
                        u_resp = cognito.admin_get_user(
                            UserPoolId=COGNITO_USER_POOL_ID,
                            Username=username,
                        )
                        u_attrs = {a["Name"]: a["Value"] for a in u_resp.get("UserAttributes", [])}
                        user_id = u_attrs.get("sub", username)
                    except ClientError:
                        user_id = username

                    try:
                        # Write membership from both sides for efficient lookups
                        table.put_item(Item={
                            "PK": f"USER#{user_id}",
                            "SK": f"GROUP#{group_name}",
                            "groupName": group_name,
                            "entityType": "USER_GROUP",
                        })
                        table.put_item(Item={
                            "PK": f"GROUP#{group_name}",
                            "SK": f"MEMBER#{user_id}",
                            "userId": user_id,
                        })
                        return ok({"added": group_name, "username": username, "type": "custom"})
                    except Exception:
                        logger.exception("Failed to add %s to custom group %s", username, group_name)
                        return error("Failed to add user to custom group", 500)
                else:
                    try:
                        cognito.admin_add_user_to_group(
                            UserPoolId=COGNITO_USER_POOL_ID,
                            Username=username,
                            GroupName=group_name,
                        )
                        return ok({"added": group_name, "username": username, "type": "cognito"})
                    except ClientError:
                        logger.exception("Failed to add %s to group %s", username, group_name)
                        return error("Failed to add user to group", 500)

            # DELETE /admin/users/{username}/groups
            if method == "DELETE":
                qs = _qs(event)
                group_type = qs.get("type", "cognito")
                group_name = qs.get("group", "")

                # Fallback: group name in path /admin/users/{username}/groups/{groupName}
                if not group_name and len(parts) >= 5:
                    group_name = parts[4]
                if not group_name:
                    return error("Missing group name")

                if group_type == "custom":
                    try:
                        u_resp = cognito.admin_get_user(
                            UserPoolId=COGNITO_USER_POOL_ID,
                            Username=username,
                        )
                        u_attrs = {a["Name"]: a["Value"] for a in u_resp.get("UserAttributes", [])}
                        user_id = u_attrs.get("sub", username)
                    except ClientError:
                        user_id = username

                    try:
                        table.delete_item(Key={
                            "PK": f"USER#{user_id}",
                            "SK": f"GROUP#{group_name}",
                        })
                        table.delete_item(Key={
                            "PK": f"GROUP#{group_name}",
                            "SK": f"MEMBER#{user_id}",
                        })
                        return ok({"removed": group_name, "username": username, "type": "custom"})
                    except Exception:
                        logger.exception("Failed to remove %s from custom group %s", username, group_name)
                        return error("Failed to remove user from custom group", 500)
                else:
                    try:
                        cognito.admin_remove_user_from_group(
                            UserPoolId=COGNITO_USER_POOL_ID,
                            Username=username,
                            GroupName=group_name,
                        )
                        return ok({"removed": group_name, "username": username, "type": "cognito"})
                    except ClientError:
                        logger.exception("Failed to remove %s from group %s", username, group_name)
                        return error("Failed to remove user from group", 500)

    return error("Not found", 404)


# ---------------------------------------------------------------------------
# Route: Admin — Custom groups
# ---------------------------------------------------------------------------

def handle_admin_groups(event, method, parts):
    user, err = require_role(event, "admin")
    if err:
        return err

    # GET /admin/groups
    if method == "GET":
        items = _query_entity("GROUP")
        return ok(items)

    # POST /admin/groups
    if method == "POST":
        data = _body(event)
        name = data.get("name", "")
        if not name:
            return error("Missing group name")
        item = {
            "PK": f"GROUP#{name}",
            "SK": "META",
            "name": name,
            "description": data.get("description", ""),
            "selfJoin": data.get("selfJoin", False),
            "entityType": "GROUP",
            "entitySk": name,
        }
        table.put_item(Item=item)
        return ok(item, 201)

    # PUT /admin/groups/{name}
    if method == "PUT" and len(parts) >= 3:
        name = parts[2]
        existing = _get_item(f"GROUP#{name}")
        if not existing:
            return error("Group not found", 404)
        data = _body(event)
        for field in ["description", "selfJoin"]:
            if field in data:
                existing[field] = data[field]
        table.put_item(Item=existing)
        return ok(existing)

    # DELETE /admin/groups/{name}
    if method == "DELETE" and len(parts) >= 3:
        name = parts[2]
        # Delete group metadata
        _delete_item(f"GROUP#{name}")
        # Delete all members
        try:
            resp = table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :sk)",
                ExpressionAttributeValues={
                    ":pk": f"GROUP#{name}",
                    ":sk": "MEMBER#",
                },
            )
            for member in resp.get("Items", []):
                table.delete_item(Key={"PK": member["PK"], "SK": member["SK"]})
        except Exception:
            logger.exception("Failed to clean up members for group %s", name)
        return ok({"deleted": name})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Route: Admin — API keys
# ---------------------------------------------------------------------------

def handle_admin_api_keys(event, method, parts):
    user, err = require_role(event, "admin")
    if err:
        return err

    if method == "GET":
        items = _query_entity("APIKEY")
        # Mask the actual key values for listing
        for item in items:
            pk = item.get("PK", "")
            key_val = pk.replace("APIKEY#", "")
            item["keyPreview"] = key_val[:8] + "..." if len(key_val) > 8 else key_val
            item["id"] = key_val  # frontend uses id field
        return ok(items)

    if method == "POST":
        data = _body(event)
        api_key = str(uuid.uuid4()).replace("-", "")
        item = {
            "PK": f"APIKEY#{api_key}",
            "SK": "META",
            "label": data.get("label", ""),
            "createdBy": user["userId"],
            "createdAt": _now_iso(),
            "scopes": data.get("scopes", ["embed"]),
            "entityType": "APIKEY",
            "entitySk": f"{_now_iso()}#{api_key}",
        }
        table.put_item(Item=item)
        return ok({"id": api_key, "label": item["label"], "fullKey": api_key}, 201)

    if method == "DELETE":
        data = _body(event)
        qs = _qs(event)
        api_key = data.get("key", "") or data.get("id", "") or qs.get("id", "")
        if not api_key:
            return error("Missing API key")
        _delete_item(f"APIKEY#{api_key}")
        return ok({"deleted": True})

    return error("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Main router
# ---------------------------------------------------------------------------

def handler(event, context):
    """Lambda entry point — routes HTTP API Gateway v2 events."""
    logger.info("Event: %s", json.dumps(event, default=str))

    # Handle OPTIONS preflight
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    if method == "OPTIONS":
        return ok({"message": "CORS preflight"})

    parts = _path_parts(event)
    if not parts:
        return ok({"service": "ows-api", "version": "1.0.0"})

    root = parts[0]

    try:
        # Public routes
        if root == "health":
            return handle_health(event, method)
        if root == "shows":
            return handle_shows(event, method, parts)
        if root == "venues":
            return handle_venues(event, method, parts)
        if root == "updates":
            return handle_updates(event, method, parts)
        if root == "press":
            return handle_press(event, method, parts)
        if root == "media":
            return handle_media(event, method, parts)
        if root == "categories":
            return handle_categories(event, method, parts)
        if root == "embed":
            return handle_embed(event, method, parts)

        # Authenticated routes
        if root == "me":
            if len(parts) >= 2 and parts[1] == "groups":
                return handle_my_groups(event, method, parts)
            return handle_me(event, method, parts)
        if root == "profile":
            return handle_profile(event, method, parts)
        if root == "groups":
            return handle_groups(event, method, parts)

        # Admin routes
        if root == "admin":
            if len(parts) >= 2:
                sub = parts[1]
                if sub == "users":
                    return handle_admin_users(event, method, parts)
                if sub == "groups":
                    return handle_admin_groups(event, method, parts)
                if sub == "api-keys":
                    return handle_admin_api_keys(event, method, parts)
            return error("Not found", 404)

        return error("Not found", 404)

    except Exception:
        logger.exception("Unhandled exception")
        return error("Internal server error", 500)
