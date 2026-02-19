"""
OWS API Handler — Unit Tests
"""

import json
import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Patch boto3 before importing the handler so module-level clients don't fail
# ---------------------------------------------------------------------------

mock_dynamodb_resource = MagicMock()
mock_table = MagicMock()
mock_dynamodb_resource.Table.return_value = mock_table

mock_s3 = MagicMock()
mock_s3.generate_presigned_url.return_value = "https://test-bucket.s3.amazonaws.com/presigned"
mock_cognito = MagicMock()
mock_lambda_client = MagicMock()
mock_bedrock = MagicMock()


@pytest.fixture(autouse=True)
def _patch_boto3():
    """Patch boto3 at module level for every test."""
    with patch.dict(os.environ, {
        "TABLE_NAME": "ows-main-test",
        "MEDIA_BUCKET": "ows-media-test",
        "COGNITO_USER_POOL_ID": "us-west-2_TESTPOOL",
        "THUMB_FUNCTION_NAME": "ows-thumb-test",
    }):
        with patch("boto3.resource", return_value=mock_dynamodb_resource), \
             patch("boto3.client") as mock_client:

            def client_factory(service, **kwargs):
                return {
                    "s3": mock_s3,
                    "cognito-idp": mock_cognito,
                    "lambda": mock_lambda_client,
                    "bedrock-runtime": mock_bedrock,
                }.get(service, MagicMock())

            mock_client.side_effect = client_factory

            # Force re-import to pick up patched clients
            if "api.handler" in sys.modules:
                del sys.modules["api.handler"]
            if "common.response" in sys.modules:
                del sys.modules["common.response"]

            # Make sure src/lambda is on the path
            lambda_root = os.path.join(
                os.path.dirname(__file__), os.pardir
            )
            if lambda_root not in sys.path:
                sys.path.insert(0, os.path.abspath(lambda_root))

            from api.handler import handler
            yield handler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_event(method="GET", path="/health", body=None, auth=False, groups=None):
    """Build a minimal API Gateway v2 event."""
    event = {
        "requestContext": {
            "http": {"method": method, "path": path},
        },
        "rawPath": path,
        "headers": {},
        "queryStringParameters": {},
    }
    if body is not None:
        event["body"] = json.dumps(body)
    if auth:
        claims = {
            "sub": "user-123",
            "email": "test@orangewhip.surf",
            "cognito:groups": json.dumps(groups or ["band"]),
        }
        event["requestContext"]["authorizer"] = {"jwt": {"claims": claims}}
    return event


def _parse_response(response):
    """Parse the Lambda response body."""
    assert "statusCode" in response
    assert "body" in response
    body = json.loads(response["body"])
    return response["statusCode"], body


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("GET", "/health")
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body == {"status": "ok"}


class TestShows:
    def test_shows_get(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.query.return_value = {
            "Items": [
                {
                    "PK": "SHOW#1",
                    "SK": "META",
                    "id": "1",
                    "title": "Commodore Ballroom",
                    "date": "2026-03-15",
                    "entityType": "SHOW",
                    "entitySk": "2026-03-15#1",
                },
                {
                    "PK": "SHOW#2",
                    "SK": "META",
                    "id": "2",
                    "title": "Biltmore Cabaret",
                    "date": "2025-01-10",
                    "entityType": "SHOW",
                    "entitySk": "2025-01-10#2",
                },
            ]
        }

        event = _make_event("GET", "/shows")
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert isinstance(body, list)
        assert len(body) == 2
        # Upcoming first, then past
        assert body[0]["date"] == "2026-03-15"
        assert body[1]["date"] == "2025-01-10"


class TestMedia:
    def test_media_get(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.query.return_value = {
            "Items": [
                {
                    "PK": "MEDIA#m1",
                    "SK": "META",
                    "id": "m1",
                    "title": "Live at the Commodore",
                    "mediaType": "video",
                    "public": True,
                    "categories": ["live"],
                    "entityType": "MEDIA",
                },
                {
                    "PK": "MEDIA#m2",
                    "SK": "META",
                    "id": "m2",
                    "title": "Album Cover",
                    "mediaType": "image",
                    "public": True,
                    "categories": ["promo"],
                    "entityType": "MEDIA",
                },
            ]
        }

        event = _make_event("GET", "/media")
        event["queryStringParameters"] = {"type": "video"}
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert isinstance(body, list)
        # Only videos returned
        assert all(m["mediaType"] == "video" for m in body)

    def test_media_get_search(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.query.return_value = {
            "Items": [
                {
                    "PK": "MEDIA#m1",
                    "SK": "META",
                    "id": "m1",
                    "title": "Live at the Commodore",
                    "mediaType": "video",
                    "public": True,
                    "aiSummary": "",
                    "categories": [],
                    "entityType": "MEDIA",
                },
            ]
        }

        event = _make_event("GET", "/media")
        event["queryStringParameters"] = {"q": "commodore"}
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert isinstance(body, list)
        assert len(body) == 1

    def test_media_get_private_as_member(self, _patch_boto3):
        """Authenticated band member can fetch a private media item by id."""
        handler = _patch_boto3
        private_media = {
            "PK": "MEDIA#priv1",
            "SK": "META",
            "id": "priv1",
            "title": "Private rehearsal",
            "mediaType": "video",
            "public": False,
            "categories": [],
            "entityType": "MEDIA",
        }
        mock_table.get_item.return_value = {"Item": private_media}

        event = _make_event("GET", "/media", auth=True, groups=["band"])
        event["queryStringParameters"] = {"id": "priv1"}
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body["id"] == "priv1"
        assert body["public"] is False

    def test_media_get_private_as_guest_404(self, _patch_boto3):
        """Guest (no auth) gets 404 when fetching private media by id."""
        handler = _patch_boto3
        private_media = {
            "PK": "MEDIA#priv1",
            "SK": "META",
            "id": "priv1",
            "title": "Private rehearsal",
            "mediaType": "video",
            "public": False,
            "entityType": "MEDIA",
        }
        mock_table.get_item.return_value = {"Item": private_media}

        event = _make_event("GET", "/media")
        event["queryStringParameters"] = {"id": "priv1"}
        status, body = _parse_response(handler(event, None))
        assert status == 404
        assert body.get("error") == "Media not found"


class TestVenues:
    def test_venue_create(self, _patch_boto3):
        """Authenticated editor can create a venue (verifies group parsing)."""
        handler = _patch_boto3
        mock_table.put_item.return_value = {}

        event = _make_event(
            "POST", "/venues",
            body={"name": "The Commodore"},
            auth=True, groups=["editor"],
        )
        status, body = _parse_response(handler(event, None))
        assert status == 201
        assert body["name"] == "The Commodore"
        assert "id" in body
        mock_table.put_item.assert_called()

    def test_venue_create_apigw_format(self, _patch_boto3):
        """Handles API GW v2 stringified group format '[editor, band]'."""
        handler = _patch_boto3
        mock_table.put_item.return_value = {}

        event = _make_event("POST", "/venues", body={"name": "Biltmore"})
        # Simulate API GW v2 stringified array (no JSON quotes)
        event["requestContext"]["authorizer"] = {
            "jwt": {"claims": {
                "sub": "user-456",
                "email": "editor@orangewhip.surf",
                "cognito:groups": "[editor, band]",
            }}
        }
        status, body = _parse_response(handler(event, None))
        assert status == 201
        assert body["name"] == "Biltmore"


class TestUnauthorized:
    def test_unauthorized_post(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("POST", "/shows", body={"title": "Test Show"})
        status, body = _parse_response(handler(event, None))
        assert status == 401
        assert "error" in body

    def test_unauthorized_delete(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("DELETE", "/shows", body={"id": "123"})
        status, body = _parse_response(handler(event, None))
        assert status == 401
        assert "error" in body


class TestPress:
    def test_press_upload_url(self, _patch_boto3):
        """Editor can get presigned upload URL for press attachments."""
        handler = _patch_boto3

        event = _make_event(
            "POST", "/press/upload-url",
            body={"filename": "bio.pdf", "contentType": "application/pdf"},
            auth=True, groups=["editor"],
        )
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert "uploadUrl" in body
        assert "fileUrl" in body
        assert "fileId" in body
        assert "s3Key" in body
        assert "press/" in body["s3Key"]

    def test_press_upload_url_unauthorized(self, _patch_boto3):
        """Unauthenticated request to upload-url returns 401."""
        handler = _patch_boto3
        event = _make_event(
            "POST", "/press/upload-url",
            body={"filename": "bio.pdf", "contentType": "application/pdf"},
        )
        status, body = _parse_response(handler(event, None))
        assert status == 401


class TestOptions:
    def test_options_preflight(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("OPTIONS", "/shows")
        status, body = _parse_response(handler(event, None))
        assert status == 200


class TestPublicProfile:
    def test_public_profile_returns_profile(self, _patch_boto3):
        """GET /profile/:identifier returns profile when profilePublic is True."""
        handler = _patch_boto3

        def get_item_side_effect(**kwargs):
            key = kwargs.get("Key", {})
            if key.get("PK") == "USER#user-abc" and key.get("SK") == "PROFILE":
                return {
                    "Item": {
                        "PK": "USER#user-abc",
                        "SK": "PROFILE",
                        "displayName": "Test User",
                        "userHandle": "testuser",
                        "about": "Band member",
                        "profilePublic": True,
                    }
                }
            return {}

        mock_table.get_item.side_effect = get_item_side_effect

        event = _make_event("GET", "/profile/user-abc")
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body["displayName"] == "Test User"
        assert body["userHandle"] == "testuser"
        assert body["about"] == "Band member"

    def test_public_profile_private_returns_403(self, _patch_boto3):
        """GET /profile/:identifier returns 403 when profilePublic is False."""
        handler = _patch_boto3
        mock_table.get_item.side_effect = None  # Clear side_effect from prior test
        mock_table.get_item.return_value = {
            "Item": {
                "PK": "USER#user-xyz",
                "SK": "PROFILE",
                "displayName": "Private User",
                "profilePublic": False,
            }
        }

        event = _make_event("GET", "/profile/user-xyz")
        status, body = _parse_response(handler(event, None))
        assert status == 403
        assert body["error"] == "This user's profile is private"

    def test_public_profile_not_found_returns_404(self, _patch_boto3):
        """GET /profile/:identifier returns 404 when profile does not exist."""
        handler = _patch_boto3
        mock_table.get_item.return_value = {}

        event = _make_event("GET", "/profile/nonexistent")
        status, body = _parse_response(handler(event, None))
        assert status == 404
        assert "error" in body


class TestProfilePhotoUpload:
    def test_profile_photo_upload_returns_presigned_url(self, _patch_boto3):
        """POST /profile/photo-upload returns presigned URL for band+ users."""
        handler = _patch_boto3

        event = _make_event(
            "POST", "/profile/photo-upload",
            body={"filename": "avatar.jpg"},
            auth=True, groups=["band"],
        )
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert "uploadUrl" in body
        assert "s3Key" in body
        assert "profiles/" in body["s3Key"]


class TestBranding:
    def test_branding_get_returns_defaults(self, _patch_boto3):
        """GET /branding returns default hero config when no branding exists."""
        handler = _patch_boto3
        mock_table.get_item.return_value = {}

        event = _make_event("GET", "/branding")
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body["heroTitle"] == "Orange Whip"
        assert body["heroTagline"] == "Industrial Surf"
        assert body["heroImageOpacity"] == 25

    def test_branding_put_requires_admin(self, _patch_boto3):
        """PUT /branding requires admin role."""
        handler = _patch_boto3
        mock_table.get_item.return_value = {}

        event = _make_event(
            "PUT", "/branding",
            body={"heroTitle": "New Title"},
            auth=True, groups=["editor"],
        )
        status, body = _parse_response(handler(event, None))
        assert status == 403

    def test_branding_put_admin_succeeds(self, _patch_boto3):
        """PUT /branding succeeds for admin users."""
        handler = _patch_boto3
        mock_table.get_item.return_value = {}

        event = _make_event(
            "PUT", "/branding",
            body={"heroTitle": "New Title", "heroTagline": "New Tagline"},
            auth=True, groups=["admin"],
        )
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body["heroTitle"] == "New Title"
        assert body["heroTagline"] == "New Tagline"

    def test_branding_get_returns_hero_image_url_when_stored(self, _patch_boto3):
        """GET /branding returns heroImageUrl when heroImageS3Key is in DB."""
        handler = _patch_boto3
        mock_table.get_item.return_value = {
            "Item": {
                "PK": "BRANDING",
                "SK": "HERO",
                "heroTitle": "Orange Whip",
                "heroImageS3Key": "branding/hero/abc123.jpg",
            }
        }

        event = _make_event("GET", "/branding")
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert "heroImageUrl" in body
        assert body["heroImageUrl"]  # presigned URL should be non-empty
        assert "heroImageS3Key" not in body  # not exposed to public
