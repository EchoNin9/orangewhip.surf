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
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  variants: ProductVariant[];
  /** Site-relative path to the hero/lifestyle shot, served from
   *  src/web/spa/public/ (ships with the SPA build). */
  hero_image: string;
  /** Optional homepage tag pill, e.g. "New" / "Vinyl" / "Limited" (display only). */
  tag?: string;
  /** Optional Gelato mockup URLs used as detail-view alternates. */
  mockup_images?: string[];
}

// Gelato product UIDs are set in Admin → Store (server-side), not here.
// Replace copy and images with real values once products are final.
export const CATALOG: Product[] = [
  {
    id: 'tee-classic',
    slug: 'tee-classic',
    title: 'Orange Whip Classic Tee',
    description: 'Soft cotton tee with the Orange Whip logo on the chest.',
    price_cents: 2800,
    currency: 'usd',
    hero_image: '/store-img/tee-classic/hero.jpg',
    tag: 'New',
    variants: [
      { id: 's',  label: 'S' },
      { id: 'm',  label: 'M' },
      { id: 'l',  label: 'L' },
      { id: 'xl', label: 'XL' },
    ],
  },
  {
    id: 'poster-tour',
    slug: 'poster-tour',
    title: 'Tour Poster',
    description: 'Heavy-stock matte print of the tour poster art.',
    price_cents: 2000,
    currency: 'usd',
    hero_image: '/store-img/poster-tour/hero.jpg',
    variants: [
      { id: 'a3', label: 'A3' },
      { id: 'a2', label: 'A2' },
    ],
  },
  {
    id: 'sticker-pack',
    slug: 'sticker-pack',
    title: 'Sticker Pack',
    description: 'Three vinyl stickers, weather-resistant.',
    price_cents: 600,
    currency: 'usd',
    hero_image: '/store-img/sticker-pack/hero.jpg',
    variants: [
      { id: 'default', label: 'Pack of 3' },
    ],
  },
];

export function findProduct(slug: string): Product | undefined {
  return CATALOG.find((p) => p.slug === slug);
}

export function findVariant(product: Product, variantId: string): ProductVariant | undefined {
  return product.variants.find((v) => v.id === variantId);
}
