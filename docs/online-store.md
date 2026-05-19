# Online Store — Build Task List

Print-on-demand merch store for orangewhip.surf. Gelato handles fulfillment, Stripe Checkout handles payments. This document is the brief for four parallel build agents.

## Goals

- Let show attendees buy merch from the site after a gig.
- Cover hosting + Gelato fees as the success bar for the first 3 months.
- Operationally lightweight — no inventory, no buyer-uploaded art, no bespoke shipping, no customer accounts.

## Locked decisions

| Decision | Choice |
|---|---|
| Payments | Stripe Checkout (hosted). Cards + Apple Pay + Google Pay. |
| Catalog | Hardcoded TypeScript file (`catalog.ts`), edited via PR. |
| Cart | Client-side `localStorage` only. |
| Accounts | None. Stripe collects email + shipping address. |
| Images | Hero/lifestyle shots in S3 + CloudFront; Gelato mockup URLs as fallback / detail-view alternates. |
| Orders | Minimal DynamoDB row per order; Stripe + Gelato dashboards remain source of truth. |
| Refunds | Manual via Stripe dashboard. |
| Observability | CloudWatch logs + read-only admin `/admin/store/orders` view. |

## Stack reference

- Vite + React 18 + TypeScript SPA: `src/web/spa/`
- Routes: `src/web/spa/src/shell/AppLayout.tsx` (React Router v6, lazy-loaded feature folders)
- Styling: Tailwind + utility classes `btn-primary`, `container-max`, `section-padding` in `src/web/spa/src/index.css`
- API client: `src/web/spa/src/utils/api.ts` (`apiGet`, `apiPost`, etc., handles Cognito token)
- Auth: `src/web/spa/src/shell/AuthContext.tsx` (`useAuth`, `hasRole`)
- Motion: `src/web/spa/src/utils/PageTransition.tsx`, `src/web/spa/src/utils/motion.ts`
- Images: `src/web/spa/src/utils/OptimizedImg.tsx`
- Lambda API: `src/lambda/api/handler.py` (Python 3.12)
- Infra: `infra/main.tf` (Lambda env vars near line 747; API Gateway routes co-located)
- DynamoDB single table: `ows-main` (items keyed by `PK`/`SK`)

## DynamoDB order item shape

```
PK              = "ORDER#<stripe_session_id>"
SK              = "ORDER#<stripe_session_id>"
stripe_session_id : string
gelato_order_id   : string | null
status            : "submitted" | "failed"
status_error      : string | null   # populated when status = "failed"
email             : string
total_cents       : number
currency          : string          # "usd", "gbp", etc.
created_at        : ISO 8601 string
line_items        : [{ product_id, variant_id, qty, unit_price_cents, title }]
shipping          : { name, address_line1, address_line2?, city, postal_code, state?, country }
```

## Parallelization graph

```
Chunk 1 (foundation)  ── MUST land first
     ├── Chunk 2 (storefront UI)         ┐
     ├── Chunk 3 (checkout API)           ├── end-to-end smoke test
     └── Chunk 4 (webhook + Gelato)      ┘
```

Chunks 2/3/4 are independently delegable to separate agents once Chunk 1 has merged the shared types and infra stubs.

---

## Chunk 1 — Foundation & contracts

Owner: 1 agent. Blocks everything else.

**Why first:** every other chunk consumes the product/line-item types, the API routes, or the env vars.

**Tasks**

- [ ] Create `src/web/spa/src/features/store/catalog.ts`:
  - `Product` type with: `id`, `slug`, `title`, `description`, `price_cents`, `currency`, `variants` (array of `{ id, label, gelato_variant_uid }`), `gelato_product_uid`, `hero_image` (S3 key/path), `mockup_images` (Gelato URLs, optional)
  - Seed 3 placeholder SKUs (e.g. t-shirt, poster, sticker) using example Gelato product UIDs — real catalog populated in a follow-up PR
- [ ] Create `src/web/spa/src/features/store/types.ts` with shared types: `CartItem`, `LineItem`, `Order` (mirrors the DynamoDB shape above)
- [ ] Update `infra/main.tf`:
  - Add Lambda env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GELATO_API_KEY` (read from Terraform variables; do NOT commit values)
  - Register API Gateway routes: `POST /checkout`, `POST /stripe-webhook`, `GET /orders`
- [ ] Update `src/lambda/api/handler.py`: register stub handlers for the three routes that return HTTP 501 — keeps deploys green until Chunks 3/4 fill them in.
- [ ] Add a `STORE_` section to whatever runtime config file the SPA reads at boot (see `src/web/spa/dist/config.js` flow) for `STRIPE_PUBLISHABLE_KEY`. Frontend never needs the secret key.

**Done when**

- `npm run build` succeeds in `src/web/spa/`.
- `terraform plan` shows the new env vars + three new routes.
- Stub Lambda routes deploy and return 501 to curl.

---

## Chunk 2 — Storefront UI

Owner: 1 agent. Starts as soon as Chunk 1 types are merged.

**Tasks** (all files under `src/web/spa/src/features/store/` unless noted)

- [ ] `StorePage.tsx` — product grid; lazy-loaded route `/store`
- [ ] `ProductPage.tsx` — `/store/:slug`; variant picker (size/color), "Add to cart" button
- [ ] `useCart.ts` — localStorage-backed hook: `items`, `addItem`, `removeItem`, `updateQty`, `clear`, `totalCents`
- [ ] `CartDrawer.tsx` — slide-over with line items, subtotal, "Checkout" button. Calls `apiPost('/checkout', { items })` → redirects via `window.location.href = response.url`
- [ ] Cart item-count badge in site header (`src/web/spa/src/shell/`)
- [ ] `CheckoutSuccessPage.tsx` — route `/store/success`; reads `?session_id=` from URL, clears cart, shows thanks message
- [ ] `CheckoutCancelPage.tsx` — route `/store/cancel`; "back to cart" link
- [ ] `AdminOrdersPage.tsx` — route `/admin/store/orders`; gated on `hasRole('admin')`; `apiGet('/orders')`; table with date, email, total, gelato_order_id, status
- [ ] Register all routes in `src/web/spa/src/shell/AppLayout.tsx` (lazy-loaded)
- [ ] Add `/store` link to the main site header

**Reuse:** `OptimizedImg`, `PageTransition`, `motion.ts` presets, `btn-primary`, `apiGet`/`apiPost`, `useAuth`.

**Done when**

- Browse `/store` → see product grid.
- Click product → see detail page, pick variants, add to cart.
- Open cart → see items, click Checkout → browser redirects to a Stripe-hosted page (smoke-test that the request lands; the API is mocked until Chunk 3).
- `/admin/store/orders` renders empty table for admin user, returns redirect/forbidden for everyone else.

---

## Chunk 3 — Checkout API

Owner: 1 agent. Parallel with Chunks 2 + 4.

**Tasks** (under `src/lambda/api/`)

- [ ] `store_catalog.py` — server-side mirror of `catalog.ts` keyed by `product_id` + `variant_id` returning canonical `price_cents`, `currency`, `title`. **Never trust client-supplied prices.** Mirror updated in lockstep with the frontend catalog.
- [ ] `store_checkout.py` (or extend `handler.py`) — `POST /checkout`:
  1. Parse `items: [{ product_id, variant_id, qty }]` from request body
  2. For each item, look up canonical price from `store_catalog`; reject 400 if any item is unknown
  3. Build Stripe `line_items` with `price_data` (currency, unit_amount, product_data.name)
  4. Create `stripe.checkout.Session.create(...)`:
     - `mode='payment'`
     - `shipping_address_collection={'allowed_countries': [...]}` — broad list; Gelato handles availability
     - `automatic_tax={'enabled': False}` (revisit later)
     - `payment_method_types` omitted (Stripe picks; covers cards + Apple/Google Pay automatically)
     - `success_url` → `<site>/store/success?session_id={CHECKOUT_SESSION_ID}`
     - `cancel_url` → `<site>/store/cancel`
     - `metadata={'cart': json.dumps(server_line_items)}` — webhook reads this back
  5. Return `{ url: session.url }`
- [ ] `store_orders.py` — `GET /orders`:
  - Admin-gated (reuse existing role check from `handler.py`)
  - DynamoDB scan/query for `PK begins_with ORDER#`, sort by `created_at` desc
  - Return JSON list
- [ ] Add `stripe` to Lambda Python requirements file; redeploy

**Done when**

- `curl POST /checkout` with a valid cart returns a Stripe Checkout Session URL (using test keys).
- `curl POST /checkout` with a tampered price is rejected 400.
- `GET /orders` returns 403 for non-admin, 200 with empty list for admin.

---

## Chunk 4 — Stripe webhook + Gelato fulfillment

Owner: 1 agent. Parallel with Chunks 2 + 3.

**Tasks** (under `src/lambda/api/`)

- [ ] `gelato_client.py` — thin wrapper:
  - `create_order(reference_id: str, shipping: dict, line_items: list) -> { gelato_order_id }`
  - Posts to Gelato Orders API with `GELATO_API_KEY`
  - Raises on non-2xx; caller decides how to surface
- [ ] `stripe_webhook.py` — `POST /stripe-webhook`:
  1. Verify Stripe signature against `STRIPE_WEBHOOK_SECRET`; return 400 on failure
  2. If `event.type == 'checkout.session.completed'`:
     - Parse cart from `session.metadata.cart`
     - Read buyer email from `session.customer_details.email`
     - Read shipping from `session.shipping_details.address` + `.name`
     - Try `gelato_client.create_order(reference_id=session.id, shipping=..., line_items=...)`
     - Write `ORDER#` row to DynamoDB:
       - On success: `status='submitted'`, `gelato_order_id=...`
       - On failure: `status='failed'`, `status_error=str(exception)`, `gelato_order_id=None`
     - Log everything to CloudWatch (loud on failure — these need eyeballs, not auto-retry)
  3. Return 200 to Stripe after a successful signature verify, even if Gelato failed — the order record carries the failure state and Stripe should not retry the whole webhook
- [ ] Reuse the existing DynamoDB client/helpers in `handler.py` for the write

**Done when**

- `stripe trigger checkout.session.completed` (Stripe CLI, pointed at the dev Lambda) flows through to a Gelato test order, writes a DynamoDB row, and the row appears in the admin orders view from Chunk 2.
- Bad signature returns 400 and writes nothing.
- Simulated Gelato failure (invalid API key) still returns 200, writes a row with `status='failed'`, error visible in CloudWatch and admin view.

---

## End-to-end smoke test (after all four chunks land)

Both Stripe and Gelato in test mode.

1. `npm run dev` in `src/web/spa/`; deploy Lambdas to dev stage with test keys.
2. Browse `/store`, add a product, hit Checkout → land on Stripe-hosted page.
3. Pay with `4242 4242 4242 4242`, complete with test shipping address.
4. Redirected to `/store/success`. Cart clears.
5. CloudWatch shows webhook fired; Gelato API returned 201; DynamoDB has the ORDER# row.
6. Gelato dashboard shows the order in test mode.
7. Admin user visits `/admin/store/orders` and sees the row.
8. Refund the test charge in Stripe dashboard → confirm app doesn't break (refunds are manual; we don't sync state back).

Failure paths to verify:

- Client-side cart price tampering → 400 from `/checkout`.
- Stripe webhook with bad signature → 400, no DynamoDB write.
- Invalid `GELATO_API_KEY` → webhook returns 200, row written with `status='failed'`, error visible in admin view.

## Out of scope (do NOT build)

- Customer accounts, login, order history pages
- Buyer-uploaded custom designs
- Bespoke shipping rules beyond what Stripe Checkout provides
- Inventory tracking
- Discount codes, promotions, email marketing
- Automatic Gelato retry on failure
- Sales tax automation
- In-app refund flow
