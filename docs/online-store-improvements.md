# Online Store — Post-MVP Improvements

Backlog of features explicitly scoped OUT of the MVP (see [online-store.md](online-store.md)). Pick these up once the store is live, orders are flowing, and we have real signal about which gaps hurt most.

## Inventory tracking

Track stock levels for products that aren't pure print-on-demand (e.g. signed prints, limited drops). Gelato items stay always-in-stock; only finite SKUs need a counter.

- Add `stock_count` (nullable) to the `Product` type — `null` means infinite (Gelato).
- Decrement on `checkout.session.completed` inside the webhook, before the Gelato call.
- Reject `POST /checkout` when any requested line item would drop below zero.
- Admin view shows current stock per product.

## Discount codes & promotions

- Use Stripe Promotion Codes (server-side) — no custom coupon table needed.
- `POST /checkout` accepts an optional `promotion_code` and passes it through to the Checkout Session.
- Codes are created/managed in the Stripe dashboard; no admin UI in the app.
- Consider a launch code (e.g. `LIVE10`) for fans at shows.

## Gelato retry

Failed Gelato calls currently write `status='failed'` and stop. Add safe retry:

- Manual retry button in the admin orders view → calls a new `POST /orders/:id/retry` Lambda route.
- Retry endpoint re-reads the order row, calls `gelato_client.create_order` again, updates the row.
- Optionally: scheduled CloudWatch event that auto-retries `status='failed'` orders up to N times with backoff. Keep the manual button regardless — auto-retry should never be the only path.
- Never retry on `checkout.session.completed` redelivery from Stripe (idempotency: check `gelato_order_id` is null before calling Gelato).

## Sales tax automation

- Enable Stripe Tax (`automatic_tax: { enabled: true }` on the Checkout Session).
- Confirm Stripe Tax registrations cover the countries we ship to — sign up for the jurisdictions that matter.
- Verify Gelato's pricing already accounts for tax-inclusive vs tax-exclusive — set our prices accordingly so we don't double-tax buyers.
- Update receipts and admin orders view to show tax line separately.

## Refund flow

- Admin orders view gets a "Refund" button per row.
- New `POST /orders/:id/refund` Lambda route: calls `stripe.Refund.create(payment_intent=...)`, updates the DynamoDB row with `status='refunded'` and `refund_id`.
- If the Gelato order hasn't shipped yet, also call Gelato's cancel-order endpoint. If it has shipped, refund only — don't try to recall the package.
- Log refund actions with admin user identity for audit.

## Order history (customer-facing)

The MVP has no accounts. If demand appears, the lightest version is:

- Magic-link lookup: customer enters their email on `/store/orders`, we email them a one-time link.
- Link opens a page showing all orders for that email address.
- No password, no signup — reuses Stripe's email as the identity.
- If this still isn't enough, then build proper accounts on top of the existing Cognito setup.

## Sequencing suggestion

Rough order if/when picked up:

1. Refund flow (operations pain — manual Stripe dashboard refunds are fine until volume picks up)
2. Gelato retry (reliability win, small surface)
3. Discount codes (cheap revenue lever, especially around shows)
4. Inventory tracking (only if we add finite SKUs)
5. Sales tax automation (when revenue or jurisdictions force the issue)
6. Order history (only if customers actually ask)
