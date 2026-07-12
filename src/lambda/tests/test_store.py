"""
Online store — Checkout API tests (Chunk 3).

Covers:
- POST /checkout happy path (and server-side price authority)
- POST /checkout rejecting unknown SKUs and bad quantities
- GET /orders auth gating + sort order
"""

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Patch boto3 before importing the handler (mirrors test_handler.py)
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
    with patch.dict(os.environ, {
        "TABLE_NAME": "ows-main-test",
        "MEDIA_BUCKET": "ows-media-test",
        "COGNITO_USER_POOL_ID": "us-west-2_TESTPOOL",
        "THUMB_FUNCTION_NAME": "ows-thumb-test",
        "STRIPE_SECRET_KEY": "sk_test_dummy",
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

            if "api.handler" in sys.modules:
                del sys.modules["api.handler"]
            if "common.response" in sys.modules:
                del sys.modules["common.response"]

            lambda_root = os.path.join(os.path.dirname(__file__), os.pardir)
            if lambda_root not in sys.path:
                sys.path.insert(0, os.path.abspath(lambda_root))

            from api.handler import handler
            yield handler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_event(method="POST", path="/checkout", body=None, auth=False, groups=None, origin=None):
    event = {
        "requestContext": {
            "http": {"method": method, "path": path},
        },
        "rawPath": path,
        "headers": {},
        "queryStringParameters": {},
    }
    if origin is not None:
        event["headers"]["origin"] = origin
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
    assert "statusCode" in response
    assert "body" in response
    return response["statusCode"], json.loads(response["body"])


# ---------------------------------------------------------------------------
# /checkout
# ---------------------------------------------------------------------------


class TestCheckout:
    def test_happy_path_ignores_client_prices(self, _patch_boto3):
        """Even if the client sends inflated/deflated prices, the server
        rebuilds line items from the canonical catalog."""
        handler = _patch_boto3

        fake_session = MagicMock()
        fake_session.id = "cs_test_123"
        fake_session.url = "https://checkout.stripe.com/c/pay/cs_test_123"

        with patch("stripe.checkout.Session.create", return_value=fake_session) as mock_create:
            event = _make_event(
                "POST", "/checkout",
                body={
                    "items": [
                        # Tampered prices — should be IGNORED.
                        {"product_id": "tee-classic", "variant_id": "m", "qty": 2,
                         "price_cents": 1, "currency": "usd"},
                        {"product_id": "sticker-pack", "variant_id": "default", "qty": 1,
                         "price_cents": 999999},
                    ],
                },
                origin="https://orangewhip.surf",
            )
            status, body = _parse_response(handler(event, None))

        assert status == 200, body
        assert body["url"] == fake_session.url

        # Verify the prices Stripe received came from store_catalog, not the
        # request body.
        mock_create.assert_called_once()
        kwargs = mock_create.call_args.kwargs
        line_items = kwargs["line_items"]
        assert len(line_items) == 2

        tee = line_items[0]
        assert tee["price_data"]["unit_amount"] == 2800  # canonical, not 1
        assert tee["price_data"]["currency"] == "usd"
        assert tee["quantity"] == 2

        stickers = line_items[1]
        assert stickers["price_data"]["unit_amount"] == 600  # canonical, not 999999
        assert stickers["quantity"] == 1

        # Server metadata records canonical unit prices for the webhook.
        cart = json.loads(kwargs["metadata"]["cart"])
        assert cart[0]["unit_price_cents"] == 2800
        assert cart[1]["unit_price_cents"] == 600

        # URLs derived from the request origin header.
        assert kwargs["success_url"].startswith("https://orangewhip.surf/store/success")
        assert "{CHECKOUT_SESSION_ID}" in kwargs["success_url"]
        assert kwargs["cancel_url"] == "https://orangewhip.surf/store/cancel"
        assert kwargs["mode"] == "payment"
        assert kwargs["automatic_tax"] == {"enabled": False}
        assert "US" in kwargs["shipping_address_collection"]["allowed_countries"]

        # Flat-rate shipping is charged at checkout.
        ship = kwargs["shipping_options"][0]["shipping_rate_data"]
        assert ship["type"] == "fixed_amount"
        assert ship["fixed_amount"] == {"amount": 599, "currency": "usd"}

    def test_unknown_product_rejected(self, _patch_boto3):
        handler = _patch_boto3
        with patch("stripe.checkout.Session.create") as mock_create:
            event = _make_event(
                "POST", "/checkout",
                body={"items": [
                    {"product_id": "does-not-exist", "variant_id": "m", "qty": 1},
                ]},
            )
            status, body = _parse_response(handler(event, None))
        assert status == 400
        assert "Unknown" in body["error"]
        mock_create.assert_not_called()

    def test_unknown_variant_rejected(self, _patch_boto3):
        handler = _patch_boto3
        with patch("stripe.checkout.Session.create") as mock_create:
            event = _make_event(
                "POST", "/checkout",
                body={"items": [
                    {"product_id": "tee-classic", "variant_id": "xxxxl", "qty": 1},
                ]},
            )
            status, body = _parse_response(handler(event, None))
        assert status == 400
        mock_create.assert_not_called()

    def test_qty_zero_rejected(self, _patch_boto3):
        handler = _patch_boto3
        with patch("stripe.checkout.Session.create") as mock_create:
            event = _make_event(
                "POST", "/checkout",
                body={"items": [
                    {"product_id": "tee-classic", "variant_id": "m", "qty": 0},
                ]},
            )
            status, body = _parse_response(handler(event, None))
        assert status == 400
        assert "quantity" in body["error"].lower()
        mock_create.assert_not_called()

    def test_qty_negative_rejected(self, _patch_boto3):
        handler = _patch_boto3
        with patch("stripe.checkout.Session.create") as mock_create:
            event = _make_event(
                "POST", "/checkout",
                body={"items": [
                    {"product_id": "tee-classic", "variant_id": "m", "qty": -3},
                ]},
            )
            status, body = _parse_response(handler(event, None))
        assert status == 400
        mock_create.assert_not_called()

    def test_empty_cart_rejected(self, _patch_boto3):
        handler = _patch_boto3
        with patch("stripe.checkout.Session.create") as mock_create:
            event = _make_event("POST", "/checkout", body={"items": []})
            status, body = _parse_response(handler(event, None))
        assert status == 400
        mock_create.assert_not_called()

    def test_origin_fallback_when_header_missing(self, _patch_boto3):
        handler = _patch_boto3
        fake_session = MagicMock()
        fake_session.id = "cs_test_xyz"
        fake_session.url = "https://checkout.stripe.com/c/pay/cs_test_xyz"
        with patch("stripe.checkout.Session.create", return_value=fake_session) as mock_create:
            event = _make_event(
                "POST", "/checkout",
                body={"items": [
                    {"product_id": "sticker-pack", "variant_id": "default", "qty": 1},
                ]},
            )
            status, _ = _parse_response(handler(event, None))
        assert status == 200
        kwargs = mock_create.call_args.kwargs
        assert kwargs["success_url"].startswith("https://orangewhip.surf/store/success")

    def test_stripe_error_returns_502(self, _patch_boto3):
        handler = _patch_boto3
        import stripe
        with patch(
            "stripe.checkout.Session.create",
            side_effect=stripe.error.StripeError("boom"),
        ):
            event = _make_event(
                "POST", "/checkout",
                body={"items": [
                    {"product_id": "sticker-pack", "variant_id": "default", "qty": 1},
                ]},
            )
            status, body = _parse_response(handler(event, None))
        assert status == 502
        assert "Stripe" in body["error"]


# ---------------------------------------------------------------------------
# /orders
# ---------------------------------------------------------------------------


class TestPrintFiles:
    def test_unauthenticated_unauthorized(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("GET", "/store-print-files")
        status, _ = _parse_response(handler(event, None))
        assert status == 401

    def test_non_admin_forbidden(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("GET", "/store-print-files", auth=True, groups=["editor"])
        status, _ = _parse_response(handler(event, None))
        assert status == 403

    def test_get_lists_status_per_product(self, _patch_boto3):
        handler = _patch_boto3
        from datetime import datetime, timezone
        mock_s3.head_object.return_value = {
            "LastModified": datetime(2026, 7, 5, tzinfo=timezone.utc)
        }
        event = _make_event("GET", "/store-print-files", auth=True, groups=["admin"])
        status, body = _parse_response(handler(event, None))
        assert status == 200
        # One row per product (variants share a print file), sorted by id.
        assert [f["product_id"] for f in body] == ["poster-tour", "sticker-pack", "tee-classic"]
        assert all(f["uploaded"] and f["last_modified"] for f in body)
        assert body[2]["s3_key"] == "store-print/tee-classic.png"

    def test_post_returns_presigned_put_for_canonical_key(self, _patch_boto3):
        handler = _patch_boto3
        mock_s3.generate_presigned_url.return_value = "https://test/presigned-put"
        event = _make_event(
            "POST", "/store-print-files", auth=True, groups=["admin"],
            body={"product_id": "tee-classic"},
        )
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body == {"uploadUrl": "https://test/presigned-put",
                        "s3Key": "store-print/tee-classic.png"}
        # The key came from store_catalog, not the request.
        params = mock_s3.generate_presigned_url.call_args.kwargs["Params"]
        assert params["Key"] == "store-print/tee-classic.png"

    def test_post_unknown_product_rejected(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event(
            "POST", "/store-print-files", auth=True, groups=["admin"],
            body={"product_id": "../../etc/passwd"},
        )
        status, body = _parse_response(handler(event, None))
        assert status == 400
        assert "Unknown" in body["error"]


class TestStoreConfig:
    def test_unauthenticated_unauthorized(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("GET", "/store-config")
        status, _ = _parse_response(handler(event, None))
        assert status == 401

    def test_non_admin_forbidden(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("PUT", "/store-config", auth=True, groups=["editor"],
                            body={"gelato_uids": {}})
        status, _ = _parse_response(handler(event, None))
        assert status == 403

    def test_get_lists_every_sku_with_saved_uids(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.get_item.return_value = {
            "Item": {"gelato_uids": {"tee-classic/m": "uid-m"}}
        }
        event = _make_event("GET", "/store-config", auth=True, groups=["admin"])
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert len(body) == 7  # every SKU in store_catalog
        by_sku = {f"{r['product_id']}/{r['variant_id']}": r for r in body}
        assert by_sku["tee-classic/m"]["gelato_uid"] == "uid-m"
        assert by_sku["tee-classic/s"]["gelato_uid"] == ""
        assert by_sku["sticker-pack/default"]["title"] == "Sticker Pack — Pack of 3"

    def test_put_saves_trimmed_map_and_drops_empties(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event(
            "PUT", "/store-config", auth=True, groups=["admin"],
            body={"gelato_uids": {
                "tee-classic/m": "  uid-m  ",
                "tee-classic/s": "",
                "poster-tour/a2": "uid-a2",
            }},
        )
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body["gelato_uids"] == {"tee-classic/m": "uid-m", "poster-tour/a2": "uid-a2"}
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["PK"] == item["SK"] == "STORE#CONFIG"
        assert item["gelato_uids"] == {"tee-classic/m": "uid-m", "poster-tour/a2": "uid-a2"}

    def test_put_unknown_sku_rejected(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.put_item.reset_mock()
        event = _make_event(
            "PUT", "/store-config", auth=True, groups=["admin"],
            body={"gelato_uids": {"ghost-product/m": "uid"}},
        )
        status, body = _parse_response(handler(event, None))
        assert status == 400
        assert "Unknown SKU" in body["error"]
        mock_table.put_item.assert_not_called()

    def test_put_non_object_rejected(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event(
            "PUT", "/store-config", auth=True, groups=["admin"],
            body={"gelato_uids": "not-a-dict"},
        )
        status, _ = _parse_response(handler(event, None))
        assert status == 400


class TestOrders:
    def test_non_admin_forbidden(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("GET", "/orders", auth=True, groups=["editor"])
        status, _ = _parse_response(handler(event, None))
        assert status == 403

    def test_unauthenticated_unauthorized(self, _patch_boto3):
        handler = _patch_boto3
        event = _make_event("GET", "/orders")
        status, _ = _parse_response(handler(event, None))
        assert status == 401

    def test_admin_empty_table(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.query.return_value = {"Items": []}
        event = _make_event("GET", "/orders", auth=True, groups=["admin"])
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert body == []

    def test_admin_two_orders_newest_first(self, _patch_boto3):
        handler = _patch_boto3
        mock_table.query.return_value = {
            "Items": [
                {
                    "PK": "ORDER#cs_test_old",
                    "SK": "ORDER#cs_test_old",
                    "entityType": "ORDER",
                    "stripe_session_id": "cs_test_old",
                    "created_at": "2025-01-01T12:00:00+00:00",
                    "status": "submitted",
                    "email": "old@example.com",
                    "total_cents": 2800,
                    "currency": "usd",
                },
                {
                    "PK": "ORDER#cs_test_new",
                    "SK": "ORDER#cs_test_new",
                    "entityType": "ORDER",
                    "stripe_session_id": "cs_test_new",
                    "created_at": "2026-05-17T12:00:00+00:00",
                    "status": "submitted",
                    "email": "new@example.com",
                    "total_cents": 600,
                    "currency": "usd",
                },
            ]
        }
        event = _make_event("GET", "/orders", auth=True, groups=["admin"])
        status, body = _parse_response(handler(event, None))
        assert status == 200
        assert isinstance(body, list)
        assert len(body) == 2
        assert body[0]["stripe_session_id"] == "cs_test_new"
        assert body[1]["stripe_session_id"] == "cs_test_old"
