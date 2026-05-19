/* ------------------------------------------------------------------ */
/*  useCart — localStorage-backed shopping-cart hook                   */
/*                                                                     */
/*  Prices on the client are purely informational. The Lambda always  */
/*  re-derives them from the server-side catalog when building Stripe */
/*  line items, so a tampered cart is rejected at /checkout.           */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from 'react';
import { CATALOG } from './catalog';
import type { CartItem } from './types';

const STORAGE_KEY = 'ows_store_cart_v1';

/** Cross-tab + cross-hook subscription so every consumer stays in sync. */
type Listener = (items: CartItem[]) => void;
const listeners = new Set<Listener>();

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: filter to valid shape
    return parsed.filter(
      (it): it is CartItem =>
        it &&
        typeof it.product_id === 'string' &&
        typeof it.variant_id === 'string' &&
        typeof it.qty === 'number' &&
        it.qty > 0,
    );
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded or unavailable — silently ignore
  }
}

function notify(items: CartItem[]): void {
  saveToStorage(items);
  listeners.forEach((l) => l(items));
}

export interface UseCart {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  clear: () => void;
  /** Display-only subtotal in cents (server is the source of truth). */
  totalCents: number;
  /** Sum of qty across all line items (used by the header badge). */
  itemCount: number;
}

export function useCart(): UseCart {
  const [items, setItems] = useState<CartItem[]>(() => loadFromStorage());

  useEffect(() => {
    const onChange: Listener = (next) => setItems(next);
    listeners.add(onChange);

    /* Sync between browser tabs */
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(loadFromStorage());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /* Mutations compute the next array against the latest storage snapshot
     (the single source of truth across instances) and then broadcast it.
     Subscribers — including the caller — pick it up via the listener. */

  const addItem = useCallback((item: CartItem) => {
    const qty = Math.max(1, Math.floor(item.qty));
    const prev = loadFromStorage();
    const idx = prev.findIndex(
      (i) => i.product_id === item.product_id && i.variant_id === item.variant_id,
    );
    const next =
      idx >= 0
        ? prev.map((i, k) => (k === idx ? { ...i, qty: i.qty + qty } : i))
        : [...prev, { ...item, qty }];
    notify(next);
  }, []);

  const removeItem = useCallback((productId: string, variantId: string) => {
    const next = loadFromStorage().filter(
      (i) => !(i.product_id === productId && i.variant_id === variantId),
    );
    notify(next);
  }, []);

  const updateQty = useCallback(
    (productId: string, variantId: string, qty: number) => {
      const clamped = Math.max(0, Math.floor(qty));
      const prev = loadFromStorage();
      const next =
        clamped === 0
          ? prev.filter(
              (i) => !(i.product_id === productId && i.variant_id === variantId),
            )
          : prev.map((i) =>
              i.product_id === productId && i.variant_id === variantId
                ? { ...i, qty: clamped }
                : i,
            );
      notify(next);
    },
    [],
  );

  const clear = useCallback(() => {
    notify([]);
  }, []);

  const totalCents = items.reduce((sum, it) => {
    const product = CATALOG.find((p) => p.id === it.product_id);
    if (!product) return sum;
    return sum + product.price_cents * it.qty;
  }, 0);

  const itemCount = items.reduce((sum, it) => sum + it.qty, 0);

  return { items, addItem, removeItem, updateQty, clear, totalCents, itemCount };
}

/** Format a price in cents to a locale string for display. */
export function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
