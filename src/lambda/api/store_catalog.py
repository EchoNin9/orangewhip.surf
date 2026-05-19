"""
Server-side mirror of the online store catalog.

This file is the canonical source of truth for prices, currencies, and titles
used when building Stripe Checkout sessions. The client-side catalog lives at
``src/web/spa/src/features/store/catalog.ts`` and is for display only — the
server NEVER trusts prices supplied in the checkout request body.

The two catalogs MUST be kept in lockstep. Any time you edit ``catalog.ts``
(add a SKU, change a price, change a variant), update the mirror here in the
same PR.

Lookup is keyed by ``(product_id, variant_id)`` and returns the canonical
``price_cents`` / ``currency`` / ``title`` for that SKU. ``title`` is what
appears on the Stripe-hosted checkout line item.
"""

# (product_id, variant_id) -> { price_cents, currency, title }
CATALOG: dict[tuple[str, str], dict] = {
    # Orange Whip Classic Tee
    ("tee-classic", "s"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — S",
    },
    ("tee-classic", "m"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — M",
    },
    ("tee-classic", "l"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — L",
    },
    ("tee-classic", "xl"): {
        "price_cents": 2800,
        "currency": "usd",
        "title": "Orange Whip Classic Tee — XL",
    },

    # Tour Poster
    ("poster-tour", "a3"): {
        "price_cents": 2000,
        "currency": "usd",
        "title": "Tour Poster — A3",
    },
    ("poster-tour", "a2"): {
        "price_cents": 2000,
        "currency": "usd",
        "title": "Tour Poster — A2",
    },

    # Sticker Pack
    ("sticker-pack", "default"): {
        "price_cents": 600,
        "currency": "usd",
        "title": "Sticker Pack — Pack of 3",
    },
}


def get_canonical_price(product_id: str, variant_id: str) -> dict | None:
    """Return canonical pricing info for a SKU, or None if unknown.

    The returned dict has keys ``price_cents`` (int), ``currency`` (str), and
    ``title`` (str). Callers MUST treat a ``None`` result as a 400-class
    client error — never fall back to a default price.
    """
    entry = CATALOG.get((product_id, variant_id))
    if entry is None:
        return None
    # Return a shallow copy so callers can safely mutate without poisoning
    # the module-level dict.
    return dict(entry)
