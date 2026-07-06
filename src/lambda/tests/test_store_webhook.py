"""
Tests for the Stripe webhook handler (Chunk 4 — store).

Idempotency + failure semantics:
- Bad signature -> 400, no DynamoDB write.
- checkout.session.completed -> 200, Gelato called, ORDER# row written.
- Gelato raises -> still 200, row with status='failed', status_error set.
- Redelivery (existing row status='submitted') -> 200, Gelato NOT called, no new write.
- Other event types -> 200 with {"ignored": true}, no Gelato call, no write.
- Cart SKU not in store_catalog -> 200, Gelato NOT called, row status='failed'.
"""

import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

mock_dynamodb_resource = MagicMock()
mock_table = MagicMock()
mock_dynamodb_resource.Table.return_value = mock_table

mock_s3 = MagicMock()
mock_s3.generate_presigned_url.return_value = "https://test/presigned"
mock_cognito = MagicMock()
mock_lambda_client = MagicMock()
mock_bedrock = MagicMock()


@pytest.fixture(autouse=True)
def _patch_boto3_and_env():
    """Patch boto3 + env vars; reset DynamoDB mock between tests."""
    mock_table.reset_mock()
    # Default: no existing order row.
    mock_table.get_item.return_value = {}

    with patch.dict(os.environ, {
        "TABLE_NAME": "ows-main-test",
        "MEDIA_BUCKET": "ows-media-test",
        "COGNITO_USER_POOL_ID": "us-west-2_TESTPOOL",
        "THUMB_FUNCTION_NAME": "ows-thumb-test",
        "STRIPE_WEBHOOK_SECRET": "whsec_test_secret",
        "STRIPE_SECRET_KEY": "sk_test_dummy",
        "GELATO_API_KEY": "gelato_test_key",
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

            # Force re-import to pick up patched clients.
            for mod in ("api.handler", "api.gelato_client", "common.response"):
                sys.modules.pop(mod, None)

            lambda_root = os.path.join(os.path.dirname(__file__), os.pardir)
            if lambda_root not in sys.path:
                sys.path.insert(0, os.path.abspath(lambda_root))

            from api.handler import handler  # noqa: E402
            yield handler


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SESSION_ID = "cs_test_abc123"


def _webhook_event(body: str = "{}", signature: str = "t=1,v1=fake") -> dict:
    return {
        "requestContext": {"http": {"method": "POST", "path": "/stripe-webhook"}},
        "rawPath": "/stripe-webhook",
        "headers": {
            "stripe-signature": signature,
            "content-type": "application/json",
        },
        "body": body,
        "isBase64Encoded": False,
        "queryStringParameters": {},
    }


def _checkout_session_event(
    session_id: str = SESSION_ID,
    cart: list | None = None,
    email: str = "buyer@example.com",
) -> dict:
    """Build a fake Stripe event dict representing checkout.session.completed."""
    if cart is None:
        # Mirrors what handle_checkout writes to session metadata: SKU +
        # canonical price only. Gelato UIDs come from store_catalog, never
        # from the metadata.
        cart = [{
            "product_id": "tee-classic",
            "variant_id": "m",
            "qty": 2,
            "unit_price_cents": 2800,
            "title": "Orange Whip Classic Tee — M",
        }]
    return {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "amount_total": 5000,
                "currency": "usd",
                "metadata": {"cart": json.dumps(cart)},
                "customer_details": {"email": email},
                "shipping_details": {
                    "name": "Ada Lovelace",
                    "address": {
                        "line1": "1 Test St",
                        "line2": "",
                        "city": "London",
                        "postal_code": "EC1A 1BB",
                        "state": "",
                        "country": "GB",
                    },
                },
            },
        },
    }


def _parse(response):
    assert "statusCode" in response
    return response["statusCode"], json.loads(response["body"])


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestBadSignature:
    def test_bad_signature_returns_400_and_no_write(self, _patch_boto3_and_env):
        handler = _patch_boto3_and_env

        # Build a stripe module mock that raises on construct_event.
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event",
                          side_effect=Exception("invalid signature")):
            event = _webhook_event(body="{}", signature="bad")
            status, body = _parse(handler(event, None))

        assert status == 400
        assert body == {"error": "Invalid signature"}
        # No DynamoDB writes, no reads (we bail before idempotency check).
        mock_table.put_item.assert_not_called()
        mock_table.get_item.assert_not_called()


class TestHappyPath:
    def test_checkout_session_completed_writes_submitted_row(self, _patch_boto3_and_env):
        handler = _patch_boto3_and_env

        fake_event = _checkout_session_event()
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event", return_value=fake_event), \
             patch("api.gelato_client.create_order",
                   return_value={"gelato_order_id": "gelato-123"}) as mock_gelato:

            ev = _webhook_event(body=json.dumps(fake_event))
            status, body = _parse(handler(ev, None))

        assert status == 200
        assert body == {"received": True}

        # Gelato called with the right reference id + email.
        mock_gelato.assert_called_once()
        kwargs = mock_gelato.call_args.kwargs
        assert kwargs["reference_id"] == SESSION_ID
        assert kwargs["customer_email"] == "buyer@example.com"
        assert kwargs["shipping"]["name"] == "Ada Lovelace"
        assert kwargs["shipping"]["country"] == "GB"
        # Gelato UID + print file resolved from store_catalog, not the cart.
        assert kwargs["line_items"] == [{
            "gelato_variant_uid": "PLACEHOLDER_TSHIRT_M",
            "qty": 2,
            "print_file_url": "https://test/presigned",
        }]

        # DynamoDB row written with status=submitted.
        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["PK"] == f"ORDER#{SESSION_ID}"
        assert item["SK"] == f"ORDER#{SESSION_ID}"
        assert item["status"] == "submitted"
        assert item["gelato_order_id"] == "gelato-123"
        assert item["status_error"] is None
        assert item["email"] == "buyer@example.com"
        assert item["total_cents"] == 5000
        assert item["currency"] == "usd"
        assert item["stripe_session_id"] == SESSION_ID
        assert "created_at" in item


class TestGelatoFailure:
    def test_gelato_failure_returns_200_with_failed_row(self, _patch_boto3_and_env):
        handler = _patch_boto3_and_env

        fake_event = _checkout_session_event()
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event", return_value=fake_event), \
             patch("api.gelato_client.create_order",
                   side_effect=RuntimeError("Gelato API HTTP 401: bad key")):
            ev = _webhook_event(body=json.dumps(fake_event))
            status, body = _parse(handler(ev, None))

        # MUST still be 200 — Stripe should not retry on Gelato downstream failure.
        assert status == 200
        assert body == {"received": True}

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["status"] == "failed"
        assert item["gelato_order_id"] is None
        assert "Gelato API HTTP 401" in item["status_error"]


class TestIdempotency:
    def test_redelivery_when_order_already_submitted_is_noop(self, _patch_boto3_and_env):
        handler = _patch_boto3_and_env

        # Pretend the order is already in DynamoDB as submitted.
        mock_table.get_item.return_value = {
            "Item": {
                "PK": f"ORDER#{SESSION_ID}",
                "SK": f"ORDER#{SESSION_ID}",
                "status": "submitted",
                "gelato_order_id": "gelato-existing",
            }
        }

        fake_event = _checkout_session_event()
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event", return_value=fake_event), \
             patch("api.gelato_client.create_order") as mock_gelato:
            ev = _webhook_event(body=json.dumps(fake_event))
            status, body = _parse(handler(ev, None))

        assert status == 200
        assert body == {"already_processed": True}
        mock_gelato.assert_not_called()
        mock_table.put_item.assert_not_called()

    def test_redelivery_of_failed_row_retries(self, _patch_boto3_and_env):
        """If a prior attempt failed, we should retry (not bail)."""
        handler = _patch_boto3_and_env
        mock_table.get_item.return_value = {
            "Item": {
                "PK": f"ORDER#{SESSION_ID}",
                "SK": f"ORDER#{SESSION_ID}",
                "status": "failed",
                "gelato_order_id": None,
                "status_error": "previous failure",
            }
        }

        fake_event = _checkout_session_event()
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event", return_value=fake_event), \
             patch("api.gelato_client.create_order",
                   return_value={"gelato_order_id": "gelato-retry-ok"}) as mock_gelato:
            ev = _webhook_event(body=json.dumps(fake_event))
            status, body = _parse(handler(ev, None))

        assert status == 200
        assert body == {"received": True}
        mock_gelato.assert_called_once()
        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["status"] == "submitted"
        assert item["gelato_order_id"] == "gelato-retry-ok"


class TestUnknownSku:
    def test_unmapped_sku_writes_failed_row_without_calling_gelato(self, _patch_boto3_and_env):
        """A cart SKU missing from store_catalog must fail the whole order —
        never submit a partial order or a client-supplied UID to Gelato."""
        handler = _patch_boto3_and_env

        fake_event = _checkout_session_event(cart=[{
            "product_id": "tee-classic",
            "variant_id": "m",
            "qty": 1,
            "unit_price_cents": 2800,
            "title": "Orange Whip Classic Tee — M",
        }, {
            "product_id": "ghost-product",
            "variant_id": "m",
            "qty": 1,
            "unit_price_cents": 100,
            "title": "Not In Catalog",
        }])
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event", return_value=fake_event), \
             patch("api.gelato_client.create_order") as mock_gelato:
            ev = _webhook_event(body=json.dumps(fake_event))
            status, body = _parse(handler(ev, None))

        assert status == 200
        assert body == {"received": True}
        mock_gelato.assert_not_called()

        mock_table.put_item.assert_called_once()
        item = mock_table.put_item.call_args.kwargs["Item"]
        assert item["status"] == "failed"
        assert item["gelato_order_id"] is None
        assert "ghost-product/m" in item["status_error"]


class TestOtherEventTypes:
    def test_non_checkout_event_is_ignored(self, _patch_boto3_and_env):
        handler = _patch_boto3_and_env

        fake_event = {
            "type": "payment_intent.succeeded",
            "data": {"object": {"id": "pi_test"}},
        }
        import stripe  # type: ignore

        with patch.object(stripe.Webhook, "construct_event", return_value=fake_event), \
             patch("api.gelato_client.create_order") as mock_gelato:
            ev = _webhook_event(body=json.dumps(fake_event))
            status, body = _parse(handler(ev, None))

        assert status == 200
        assert body == {"ignored": True}
        mock_gelato.assert_not_called()
        mock_table.put_item.assert_not_called()
