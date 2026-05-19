/* ------------------------------------------------------------------ */
/*  Online store — shared types                                        */
/*                                                                     */
/*  Consumed by Chunks 2 (UI), 3 (checkout API client), 4 (admin).    */
/*  The DynamoDB order shape lives in docs/online-store.md; `Order`    */
/*  below mirrors it for the admin orders view.                        */
/* ------------------------------------------------------------------ */

/** A single item sitting in the client-side cart (localStorage). */
export interface CartItem {
  product_id: string;
  variant_id: string;
  qty: number;
}

/**
 * A priced line item as returned by the server and shown in the order
 * record. Prices are always server-derived — never trust client prices.
 */
export interface LineItem {
  product_id: string;
  variant_id: string;
  qty: number;
  unit_price_cents: number;
  title: string;
}

/** Shipping address as captured by Stripe Checkout. */
export interface ShippingAddress {
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postal_code: string;
  state?: string;
  country: string;
}

export type OrderStatus = 'submitted' | 'failed';

/**
 * One order row. Mirrors the DynamoDB `ORDER#<stripe_session_id>` shape.
 * Surfaced via `GET /orders` (admin) and rendered in `AdminOrdersPage`.
 */
export interface Order {
  stripe_session_id: string;
  gelato_order_id: string | null;
  status: OrderStatus;
  status_error: string | null;
  email: string;
  total_cents: number;
  currency: string;
  created_at: string;
  line_items: LineItem[];
  shipping: ShippingAddress;
}
