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
        assert "shows" in body
        shows = body["shows"]
        assert len(shows) == 2
        # Upcoming first, then past
        assert shows[0]["date"] == "2026-03-15"
        assert shows[1]["date"] == "2025-01-10"


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
        assert "media" in body
        # Only videos returned
        assert all(m["mediaType"] == "video" for m in body["media"])

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
        assert len(body["media"]) == 1


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


class TestOptions:
    def test_options_preflight(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("OPTIONS", "/shows")
        status, body = _parse_response(handler(event, None))
        assert status == 200
