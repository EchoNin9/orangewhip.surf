import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { apiPost, ApiError } from '../../utils/api';
import { CATALOG, findVariant } from './catalog';
import { useCart, formatPrice } from './useCart';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, updateQty, removeItem, totalCents } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Pick a currency for display — fall back to USD if cart is empty */
  const firstProduct = items.length > 0
    ? CATALOG.find((p) => p.id === items[0].product_id)
    : undefined;
  const currency = firstProduct?.currency ?? 'usd';

  const handleCheckout = async () => {
    if (items.length === 0 || checkingOut) return;
    setError(null);
    setCheckingOut(true);
    try {
      const res = await apiPost<{ url: string }>('/checkout', { items });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        throw new Error('Checkout did not return a redirect URL.');
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `Checkout unavailable (HTTP ${err.status}). Please try again shortly.`
          : err instanceof Error
            ? err.message
            : 'Checkout failed.';
      setError(msg);
      setCheckingOut(false);
    }
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in duration-200"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md bg-secondary-900 border-l border-secondary-800 shadow-2xl flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-800">
                    <Dialog.Title className="text-lg font-display font-bold text-secondary-100 flex items-center gap-2">
                      <ShoppingBagIcon className="w-5 h-5 text-primary-400" />
                      Your cart
                    </Dialog.Title>
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-1 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-800 transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Items */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
                    {items.length === 0 ? (
                      <div className="text-center py-16">
                        <ShoppingBagIcon className="w-12 h-12 text-secondary-600 mx-auto mb-3" />
                        <p className="text-secondary-400 mb-6">Your cart is empty.</p>
                        <Link
                          to="/store"
                          onClick={onClose}
                          className="btn-secondary text-sm"
                        >
                          Browse store
                        </Link>
                      </div>
                    ) : (
                      <ul className="divide-y divide-secondary-800">
                        {items.map((item) => {
                          const product = CATALOG.find((p) => p.id === item.product_id);
                          const variant = product
                            ? findVariant(product, item.variant_id)
                            : undefined;
                          if (!product) {
                            return (
                              <li key={`${item.product_id}-${item.variant_id}`} className="py-4 flex items-center justify-between gap-3">
                                <div className="text-sm text-secondary-400">
                                  Unknown product
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeItem(item.product_id, item.variant_id)
                                  }
                                  className="text-secondary-500 hover:text-red-400 transition-colors"
                                  aria-label="Remove item"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </li>
                            );
                          }
                          return (
                            <li
                              key={`${item.product_id}-${item.variant_id}`}
                              className="py-4 flex gap-4"
                            >
                              <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-secondary-800">
                                {product.hero_image && (
                                  <img
                                    src={product.hero_image}
                                    alt={product.title}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <Link
                                      to={`/store/${product.slug}`}
                                      onClick={onClose}
                                      className="text-sm font-semibold text-secondary-100 hover:text-primary-400 transition-colors truncate block"
                                    >
                                      {product.title}
                                    </Link>
                                    {variant && (
                                      <p className="text-xs text-secondary-500 mt-0.5">
                                        {variant.label}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItem(item.product_id, item.variant_id)
                                    }
                                    className="text-secondary-500 hover:text-red-400 transition-colors p-1 -m-1"
                                    aria-label="Remove item"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="mt-2 flex items-center justify-between gap-3">
                                  <div className="inline-flex items-center border border-secondary-700 rounded-lg overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQty(
                                          item.product_id,
                                          item.variant_id,
                                          item.qty - 1,
                                        )
                                      }
                                      className="px-2.5 py-1 text-secondary-300 hover:bg-secondary-800 transition-colors"
                                      aria-label="Decrease quantity"
                                    >
                                      −
                                    </button>
                                    <span className="px-3 py-1 text-sm tabular-nums min-w-[2rem] text-center text-secondary-100">
                                      {item.qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateQty(
                                          item.product_id,
                                          item.variant_id,
                                          item.qty + 1,
                                        )
                                      }
                                      className="px-2.5 py-1 text-secondary-300 hover:bg-secondary-800 transition-colors"
                                      aria-label="Increase quantity"
                                    >
                                      +
                                    </button>
                                  </div>
                                  <p className="text-sm font-semibold text-secondary-100 tabular-nums">
                                    {formatPrice(
                                      product.price_cents * item.qty,
                                      product.currency,
                                    )}
                                  </p>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Footer */}
                  {items.length > 0 && (
                    <div className="border-t border-secondary-800 px-5 py-4 space-y-4 bg-secondary-900">
                      {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                          {error}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-secondary-400">Subtotal</span>
                        <span className="text-lg font-display font-bold text-secondary-100 tabular-nums">
                          {formatPrice(totalCents, currency)}
                        </span>
                      </div>
                      <p className="text-xs text-secondary-500">
                        Shipping and taxes calculated at checkout.
                      </p>
                      <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={checkingOut}
                        className="btn-primary w-full"
                      >
                        {checkingOut ? 'Redirecting…' : 'Checkout'}
                      </button>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
