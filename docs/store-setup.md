# Merch Store Setup — the "wire it all up" runbook

This is the checklist for taking the already-built store (see
[online-store.md](online-store.md)) from placeholder to selling real shirts.
Written ELI5-style: every step says exactly where to click and what to copy.

**The 30-second picture of how an order works:**

```
Fan clicks Buy → Stripe takes their money + shipping address
     → Stripe pings our /stripe-webhook
     → our Lambda tells Gelato "print this and ship it to this address"
     → Gelato charges the band's card, prints, and ships
     → the order shows up at /admin/store/orders
```

Stripe pays the band. The band pays Gelato. The gap is the profit.

**Already done — do not redo:** all the code, the API routes, the Lambda env
vars, and the four GitHub secrets (`GELATO_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, set 2026-05-19). What's
missing is the *real product data*: which Gelato products, the artwork, the
photos, and a verified Stripe webhook.

---

## Part 1 — Gelato (the printing company)

### 1.1 Check the account

1. Go to <https://dashboard.gelato.com> and sign in.
2. Click your avatar (top right) → **Billing** → make sure a **payment card
   is on file**. Gelato charges this card every time an order is placed. No
   card = every order fails.
3. Sanity-check the API key: the GitHub secret `GELATO_API_KEY` was set
   2026-05-19. If you're not sure it came from *this* account, make a fresh
   one: Dashboard → **Developer** (left sidebar) → **API Keys** → **Add API
   key** → copy it, then in a terminal:

   ```bash
   gh secret set GELATO_API_KEY --repo EchoNin9/orangewhip.surf
   # paste the key when prompted
   ```

### 1.2 Pick the three products and get their "product UIDs"

Gelato identifies every printable thing (a specific shirt, in a specific
size, in a specific color) with a long string called a **product UID**. It
looks like:

```
apparel_product_gca_t-shirt_gsc_crewneck_gcu_unisex_gqa_classic_gsi_m_gco_white_gpr_4-4
```

We need one UID per SKU we sell — **7 total**:

| Our SKU | What to pick in Gelato |
|---|---|
| Tee S / M / L / XL | A unisex crewneck t-shirt, one UID per size (same color) |
| Poster A3 / A2 | A matte poster, one UID per size |
| Sticker pack | A sticker/sticker sheet product |

**Easiest way to get the UIDs** (recommended):

1. In the Gelato dashboard, go to **Templates** (sometimes under
   "Products") → **Create template**.
2. Pick the product (e.g. *Unisex Classic Crewneck T-shirt*), choose the
   color, enable the sizes S–XL, drop your design on the front, and save it
   with a name like `OW Classic Tee`.
3. Open the template — the **template ID** (a UUID) is in your browser's
   address bar.
4. In a terminal, ask the API for the template (this prints every variant
   with its product UID):

   ```bash
   curl -s -H "X-API-KEY: <your gelato api key>" \
     https://ecommerce.gelatoapis.com/v1/templates/<template-id> | python3 -m json.tool
   ```

5. Repeat for the poster and the stickers (3 templates total).
6. **Paste the three JSON outputs (or just the UIDs) to Claude.** Claude
   updates `src/lambda/api/store_catalog.py` and
   `src/web/spa/src/features/store/catalog.ts` in one PR — the placeholders
   currently say `PLACEHOLDER_TSHIRT_S` etc.

> Why both files? The browser one is display-only; the Lambda one is the one
> that's actually trusted for prices and Gelato UIDs. They must always match.

### 1.3 Upload the print artwork to S3

When an order comes in, our Lambda hands Gelato a link to the artwork file.
That file lives in our media bucket, at these **exact** names (they're
hardcoded in `store_catalog.py`):

| File in S3 | Used for |
|---|---|
| `store-print/tee-classic.png` | Front print of the tee (all sizes) |
| `store-print/poster-tour.png` | The poster (both sizes) |
| `store-print/sticker-pack.png` | The sticker sheet |

Requirements: **PNG, 300 DPI, sized for the print area**. The Gelato template
editor from step 1.2 shows the required pixel dimensions for each product —
export your art at that size (transparent background for the tee).

Upload (either way works):

- **Console:** AWS Console → S3 → the `ows-media-…` bucket → **Create
  folder** `store-print` → **Upload** the three PNGs into it.
- **Terminal:**

  ```bash
  aws s3 cp tee-classic.png  s3://ows-media-452644920012/store-print/tee-classic.png
  aws s3 cp poster-tour.png  s3://ows-media-452644920012/store-print/poster-tour.png
  aws s3 cp sticker-pack.png s3://ows-media-452644920012/store-print/sticker-pack.png
  ```

The bucket stays private — the Lambda creates a temporary (presigned) link
for Gelato at order time.

### 1.4 Check the prices make sense

Our sale prices are: tee **$28**, poster **$20**, stickers **$6**, plus
**$5.99 flat shipping** charged to the buyer at checkout.

In the Gelato catalog page for each product you can see Gelato's price to
*you* (product + their shipping, varies by destination). Make sure there's
margin left. If you want different prices, tell Claude — they're changed in
the same two catalog files.

---

## Part 2 — Stripe (the payment company)

### 2.1 Figure out whether the current keys are test or live

1. Run `gh secret list --repo EchoNin9/orangewhip.surf` — you can't see the
   values, only that they exist.
2. Go to <https://dashboard.stripe.com> → **Developers → API keys**. Stripe
   has two parallel worlds: **Test mode** (toggle top-right; keys start
   `sk_test_` / `pk_test_`, fake money) and **Live mode** (`sk_live_` /
   `pk_live_`, real money).
3. If you don't remember which you saved in May: safest is to re-save the
   **test** keys now, verify everything end-to-end (Part 4), and switch to
   live keys at go-live (Part 5):

   ```bash
   gh secret set STRIPE_SECRET_KEY      --repo EchoNin9/orangewhip.surf   # sk_test_...
   gh secret set STRIPE_PUBLISHABLE_KEY --repo EchoNin9/orangewhip.surf   # pk_test_...
   ```

### 2.2 Create/verify the webhook endpoint

The webhook is how Stripe tells our Lambda "someone paid". Without it, money
arrives but nothing gets printed.

1. Stripe dashboard (in **the same mode as your keys**, test or live) →
   **Developers → Webhooks**.
2. If an endpoint for our API already exists, open it. Otherwise **Add
   endpoint** with:
   - **Endpoint URL:** `https://6crl3vbjgj.execute-api.us-east-1.amazonaws.com/stripe-webhook`
   - **Events:** just `checkout.session.completed`
3. On the endpoint page, click **Reveal** under *Signing secret* (starts
   `whsec_`), copy it, and save it:

   ```bash
   gh secret set STRIPE_WEBHOOK_SECRET --repo EchoNin9/orangewhip.surf
   ```

4. Secrets only take effect on the **next deploy** — push any commit to
   `develop` (or re-run the last "Deploy Staging" workflow in GitHub
   Actions).

> Test mode and live mode each need their **own** webhook endpoint and their
> own `whsec_` secret. When you flip to live keys, redo this step in live
> mode.

---

## Part 3 — Storefront photos (what shoppers see)

The store grid needs a nice photo per product (this is *not* the print
file — it's the marketing shot; Gelato's template mockups work fine here).

Drop them into the repo at exactly:

```
src/web/spa/public/store-img/tee-classic/hero.jpg
src/web/spa/public/store-img/poster-tour/hero.jpg
src/web/spa/public/store-img/sticker-pack/hero.jpg
```

(JPG, roughly square, ~1200px is plenty.) Hand the files to Claude or copy
them in yourself and commit — they ship with the site build automatically.
Until they exist, the store shows a placeholder tile instead of a photo.

---

## Part 4 — Test the whole pipe (test mode, fake money)

After Parts 1–3 are done and deployed to staging:

1. Open <https://stage.orangewhip.surf/store>, add a **sticker pack** (the
   cheapest thing) to the cart, hit **Checkout**.
2. On the Stripe page pay with the magic test card:
   **card `4242 4242 4242 4242`**, any future expiry, any CVC, any name, a
   real-looking US address.
3. You should land back on `/store/success`.
4. Now check the trail, in order:
   - **Stripe dashboard (test mode) → Payments:** the payment is there,
     amount = $6.00 + $5.99 shipping.
   - **`stage.orangewhip.surf/admin/store/orders`** (sign in as admin —
     there's now a *Store Orders* card on the admin dashboard): one row,
     ideally `status: submitted` with a `gelato_order_id`.
   - **Gelato dashboard → Orders:** the order exists. **⚠️ Gelato has no
     fake-money mode — this is a real order and will be printed and charged.
     Cancel it immediately** (open the order → Cancel; you have a window
     before it goes to production).
5. If the row says `status: failed` instead, read `status_error` in the
   admin view and see Troubleshooting below.

## Part 5 — Go live (real money)

1. Repeat 2.1/2.2 with **live** keys and a **live-mode** webhook endpoint
   (this time use `https://orangewhip.surf` — the same Lambda serves both,
   so the URL is identical; only the Stripe-side mode changes).
2. Push/deploy `main` per the normal release flow.
3. Buy the sticker pack yourself with a real card as the final check — you
   get stickers, the band gets ~nothing, the pipe gets proven.

---

## Troubleshooting

| Symptom | Meaning | Fix |
|---|---|---|
| Order row `status_error: Unknown SKU(s)…` | Catalog placeholder/typo — SKU missing from `store_catalog.py` | Fix the catalog, redeploy; re-send the webhook from Stripe dashboard (endpoint → the event → **Resend**) |
| `Gelato API HTTP 401` | Wrong/expired `GELATO_API_KEY` | New key (1.1), redeploy, resend webhook |
| `Gelato API HTTP 400` mentioning productUid | A UID in `store_catalog.py` is wrong | Re-check step 1.2, resend webhook |
| `Gelato API HTTP 400` mentioning files/url | Print file missing in S3 or wrong key name | Re-check step 1.3 file names exactly |
| Payment in Stripe but **no row at all** in admin orders | Webhook never fired or bad signature | Step 2.2; check the endpoint's delivery log in Stripe; CloudWatch log group of the `ows-api` Lambda |
| Checkout button errors immediately | `STRIPE_SECRET_KEY` empty/wrong mode | Step 2.1, redeploy |

Every webhook run logs to CloudWatch (`ows-api` Lambda log group) — the
error text there is always more detailed than the admin view.
