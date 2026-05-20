"""
Thin wrapper around the Gelato Orders API (v4).

Docs: https://dashboard.gelato.com/docs/orders/v4/create/
"""

import json
import logging
import os
import urllib.error
import urllib.request

logger = logging.getLogger(__name__)

GELATO_ORDERS_URL = "https://order.gelatoapis.com/v4/orders"


class GelatoError(Exception):
    """Raised when the Gelato API returns a non-2xx response."""


def _split_name(full_name: str) -> tuple[str, str]:
    """Split a full name into (first_name, last_name). Last token is the last name."""
    full_name = (full_name or "").strip()
    if not full_name:
        return "", ""
    parts = full_name.split()
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def create_order(
    reference_id: str,
    customer_email: str,
    shipping: dict,
    line_items: list[dict],
) -> dict:
    """Create a Gelato order.

    Args:
        reference_id: Caller-supplied idempotency key (we use the Stripe session id).
        customer_email: Buyer email — Gelato wants this on the shipping address block.
        shipping: {
            "name", "address_line1", "address_line2", "city",
            "postal_code", "state", "country"
        }
        line_items: [{"gelato_variant_uid": str, "qty": int}]

    Returns:
        {"gelato_order_id": <id from Gelato>}

    Raises:
        GelatoError on non-2xx response (with the response body in the message).
    """
    api_key = os.environ.get("GELATO_API_KEY", "")
    if not api_key:
        raise GelatoError("GELATO_API_KEY is not configured")

    first_name, last_name = _split_name(shipping.get("name", ""))

    shipping_address = {
        "firstName": first_name,
        "lastName": last_name,
        "addressLine1": shipping.get("address_line1", "") or "",
        "addressLine2": shipping.get("address_line2", "") or "",
        "city": shipping.get("city", "") or "",
        "postCode": shipping.get("postal_code", "") or "",
        "state": shipping.get("state", "") or "",
        "country": shipping.get("country", "") or "",
        "email": customer_email or "",
    }

    items = []
    for idx, li in enumerate(line_items):
        items.append({
            "itemReferenceId": f"{reference_id}-{idx}",
            "productUid": li["gelato_variant_uid"],
            "quantity": int(li["qty"]),
        })

    payload = {
        "orderType": "order",
        "orderReferenceId": reference_id,
        "customerReferenceId": customer_email or reference_id,
        "currency": "USD",
        "items": items,
        "shippingAddress": shipping_address,
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        GELATO_ORDERS_URL,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-API-KEY": api_key,
            # Gelato sits behind Cloudflare, which 403s the default Python-urllib UA
            # with error code 1010. Always send an explicit, identifiable User-Agent.
            "User-Agent": "orangewhip-store/1.0 (+https://orangewhip.surf)",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            status = resp.getcode()
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        raise GelatoError(
            f"Gelato API HTTP {e.code}: {body or e.reason}"
        ) from e
    except urllib.error.URLError as e:
        raise GelatoError(f"Gelato API request failed: {e.reason}") from e

    if status < 200 or status >= 300:
        raise GelatoError(f"Gelato API HTTP {status}: {body}")

    try:
        parsed = json.loads(body) if body else {}
    except json.JSONDecodeError as e:
        raise GelatoError(f"Gelato API returned non-JSON body: {body}") from e

    gelato_order_id = parsed.get("id") or parsed.get("orderId")
    if not gelato_order_id:
        raise GelatoError(f"Gelato API response missing order id: {body}")

    return {"gelato_order_id": gelato_order_id}
