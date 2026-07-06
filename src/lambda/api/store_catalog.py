"""
Server-side mirror of the online store catalog.

This file is the canonical source of truth for prices, currencies, titles,
and print files used when building Stripe Checkout sessions and submitting
Gelato orders. The client-side catalog lives at
``src/web/spa/src/features/store/catalog.ts`` and is for display only — the
server NEVER trusts prices or Gelato UIDs supplied by the client.

The two catalogs MUST be kept in lockstep. Any time you edit ``catalog.ts``
(add a SKU, change a price, change a variant), update the mirror here in the
same PR.

Lookup is keyed by ``(product_id, variant_id)`` and returns the canonical
entry for that SKU:

- ``price_cents`` / ``currency`` / ``title`` — what appears on the
  Stripe-hosted checkout line item.
- ``print_file_key`` — S3 key of the print-ready artwork in the media
  bucket. Presigned and sent to Gelato as the order's print file.

Gelato product UIDs are NOT stored here: admins set them per SKU on the
Admin → Store page, persisted on the ``STORE#CONFIG`` DynamoDB item (see
``handle_store_config`` in handler.py). An optional ``gelato_product_uid``
key on an entry still works as a hardcoded fallback.
"""

# (product_id, variant_id) -> entry
CATALOG: dict[tuple[str, str], dict] = {
    # Orange Whip Classic Tee — same artwork for every size.
    ("tee-classic", "s"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — S",
        "print_file_key": "store-print/tee-classic.png",
    },
    ("tee-classic", "m"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — M",
        "print_file_key": "store-print/tee-classic.png",
    },
    ("tee-classic", "l"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — L",
        "print_file_key": "store-print/tee-classic.png",
    },
    ("tee-classic", "xl"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — XL",
        "print_file_key": "store-print/tee-classic.png",
    },

    # Tour Poster
    ("poster-tour", "a3"): {
        "price_cents": 2000,
        "currency": "usd",
        "title": "Tour Poster — A3",
        "print_file_key": "store-print/poster-tour.png",
    },
    ("poster-tour", "a2"): {
        "price_cents": 2000,
        "currency": "usd",
        "title": "Tour Poster — A2",
        "print_file_key": "store-print/poster-tour.png",
    },

    # Sticker Pack
    ("sticker-pack", "default"): {
        "price_cents": 600,
        "currency": "usd",
        "title": "Sticker Pack — Pack of 3",
        "print_file_key": "store-print/sticker-pack.png",
    },
}


def get_canonical_price(product_id: str, variant_id: str) -> dict | None:
    """Return the canonical catalog entry for a SKU, or None if unknown.

    The returned dict has keys ``price_cents`` (int), ``currency`` (str),
    ``title`` (str), and ``print_file_key`` (str). Callers MUST treat a
    ``None`` result as a 400-class client error — never fall back to a
    default price.
    """
    entry = CATALOG.get((product_id, variant_id))
    if entry is None:
        return None
    # Return a shallow copy so callers can safely mutate without poisoning
    # the module-level dict.
    return dict(entry)
