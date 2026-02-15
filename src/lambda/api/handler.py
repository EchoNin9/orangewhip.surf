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
s3 = boto3.client("s3")
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
    cognito_groups_raw = claims.get("cognito:groups", "[]")

    # cognito:groups can come as a string like "[admin editor]" or a real list
    if isinstance(cognito_groups_raw, list):
        groups = cognito_groups_raw
    elif isinstance(cognito_groups_raw, str):
        cleaned = cognito_groups_raw.strip("[]")
        groups = [g.strip() for g in cleaned.split() if g.strip()] if cleaned else []
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
        return None, error("Unauthorized", 401)

    user_level = ROLE_HIERARCHY.index(user["role"])
    required_level = ROLE_HIERARCHY.index(min_role)
    if user_level < required_level:
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
    """Query byEntity GSI by entityType."""
    try:
        resp = table.query(
            IndexName="byEntity",
            KeyConditionExpression="entityType = :et",
            ExpressionAttributeValues={":et": entity_type},
            ScanIndexForward=False,
        )
        items = resp.get("Items", [])
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
            return ok(item)

        items = _query_entity("SHOW")
        _resolve_venues(items)
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
        return ok(items[0])

    if method == "GET":
        qs = _qs(event)
        # When all=true, return all updates (admin use)
        if qs.get("all") == "true":
            items = _query_entity("UPDATE")
        else:
            items = _query_entity("UPDATE", visible=True)
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

def handle_press(event, method, parts):
    if method == "GET":
        qs = _qs(event)
        if qs.get("all") == "true":
            items = _query_entity("PRESS")
        else:
            items = _query_entity("PRESS", public=True)
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
            "thumbnailKey": data.get("thumbnailKey", ""),
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
        for field in [
            "title", "mediaType", "format", "dimensions", "filesize",
            "s3Key", "thumbnailKey", "categories", "public", "aiSummary",
        ]:
            if field in data:
                existing[field] = data[field]
        if "categories" in data:
            existing["categoryId"] = data["categories"][0] if data["categories"] else "NONE"
        table.put_item(Item=existing)
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
            # Clean up S3 objects
            for key_field in ["s3Key", "thumbnailKey"]:
                s3_key = existing.get(key_field, "")
                if s3_key:
                    try:
                        s3.delete_object(Bucket=MEDIA_BUCKET, Key=s3_key)
                    except Exception:
                        logger.exception("Failed to delete S3 object %s", s3_key)
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
    return ok(user)


def handle_profile(event, method, parts):
    user, err = require_role(event, "band")
    if err:
        return err
    user_id = user["userId"]

    if method == "GET":
        profile = _get_item(f"USER#{user_id}", "PROFILE")
        if not profile:
            profile = {"displayName": "", "email": user["email"], "bio": ""}
        # Merge role info from JWT for the frontend
        profile["role"] = user["role"]
        profile["groups"] = user["groups"]
        profile["customGroups"] = user.get("customGroups", [])
        return ok(profile)

    if method == "PUT":
        data = _body(event)
        item = {
            "PK": f"USER#{user_id}",
            "SK": "PROFILE",
            "displayName": data.get("displayName", ""),
            "email": data.get("email", user["email"]),
            "bio": data.get("bio", ""),
        }
        table.put_item(Item=item)
        # Merge role info back for the frontend
        item["role"] = user["role"]
        item["groups"] = user["groups"]
        item["customGroups"] = user.get("customGroups", [])
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
                users.append({
                    "username": u["Username"],
                    "email": attrs.get("email", ""),
                    "status": u.get("UserStatus", ""),
                    "enabled": u.get("Enabled", False),
                    "created": u.get("UserCreateDate", "").isoformat()
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
                group_name = data.get("groupName", "")
                if not group_name:
                    return error("Missing groupName")
                try:
                    cognito.admin_add_user_to_group(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        Username=username,
                        GroupName=group_name,
                    )
                    return ok({"added": group_name, "username": username})
                except ClientError:
                    logger.exception("Failed to add %s to group %s", username, group_name)
                    return error("Failed to add user to group", 500)

            # DELETE /admin/users/{username}/groups/{groupName}
            if method == "DELETE" and len(parts) >= 5:
                group_name = parts[4]
                try:
                    cognito.admin_remove_user_from_group(
                        UserPoolId=COGNITO_USER_POOL_ID,
                        Username=username,
                        GroupName=group_name,
                    )
                    return ok({"removed": group_name, "username": username})
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
