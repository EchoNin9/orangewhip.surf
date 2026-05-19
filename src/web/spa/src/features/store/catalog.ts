/* ------------------------------------------------------------------ */
/*  Online store — hardcoded product catalog                           */
/*                                                                     */
/*  Edited by PR. The Lambda has a server-side mirror keyed by         */
/*  product_id + variant_id (see src/lambda/api/store_catalog.py,      */
/*  added in Chunk 3) — keep the two in lockstep on every edit.        */
/*                                                                     */
/*  Prices on this side are for display only. Stripe Checkout always   */
/*  builds line items from the server mirror.                          */
/* ------------------------------------------------------------------ */

export interface ProductVariant {
  id: string;
  label: string;
  gelato_variant_uid: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  variants: ProductVariant[];
  gelato_product_uid: string;
  /** S3 key (or path) for the hero/lifestyle shot in our own bucket. */
  hero_image: string;
  /** Optional Gelato mockup URLs used as detail-view alternates. */
  mockup_images?: string[];
}

// Placeholder SKUs — replace the UIDs, copy, and images with real values
// once we've picked the actual Gelato products.
export const CATALOG: Product[] = [
  {
    id: 'tee-classic',
    slug: 'tee-classic',
    title: 'Orange Whip Classic Tee',
    description: 'Soft cotton tee with the Orange Whip logo on the chest.',
    price_cents: 2800,
    currency: 'usd',
    gelato_product_uid: 'PLACEHOLDER_TSHIRT_UID',
    hero_image: 'store/tee-classic/hero.jpg',
    variants: [
      { id: 's',  label: 'S',  gelato_variant_uid: 'PLACEHOLDER_TSHIRT_S' },
      { id: 'm',  label: 'M',  gelato_variant_uid: 'PLACEHOLDER_TSHIRT_M' },
      { id: 'l',  label: 'L',  gelato_variant_uid: 'PLACEHOLDER_TSHIRT_L' },
      { id: 'xl', label: 'XL', gelato_variant_uid: 'PLACEHOLDER_TSHIRT_XL' },
    ],
  },
  {
    id: 'poster-tour',
    slug: 'poster-tour',
    title: 'Tour Poster',
    description: 'Heavy-stock matte print of the tour poster art.',
    price_cents: 2000,
    currency: 'usd',
    gelato_product_uid: 'PLACEHOLDER_POSTER_UID',
    hero_image: 'store/poster-tour/hero.jpg',
    variants: [
      { id: 'a3', label: 'A3', gelato_variant_uid: 'PLACEHOLDER_POSTER_A3' },
      { id: 'a2', label: 'A2', gelato_variant_uid: 'PLACEHOLDER_POSTER_A2' },
    ],
  },
  {
    id: 'sticker-pack',
    slug: 'sticker-pack',
    title: 'Sticker Pack',
    description: 'Three vinyl stickers, weather-resistant.',
    price_cents: 600,
    currency: 'usd',
    gelato_product_uid: 'PLACEHOLDER_STICKER_UID',
    hero_image: 'store/sticker-pack/hero.jpg',
    variants: [
      { id: 'default', label: 'Pack of 3', gelato_variant_uid: 'PLACEHOLDER_STICKER_DEFAULT' },
    ],
  },
];

export function findProduct(slug: string): Product | undefined {
  return CATALOG.find((p) => p.slug === slug);
}

export function findVariant(product: Product, variantId: string): ProductVariant | undefined {
  return product.variants.find((v) => v.id === variantId);
}
