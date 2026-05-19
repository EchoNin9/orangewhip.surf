import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';
import { OptimizedImg } from '../../utils/OptimizedImg';
import { findProduct } from './catalog';
import { useCart, formatPrice } from './useCart';

export default function ProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const product = useMemo(() => findProduct(slug), [slug]);

  const [variantId, setVariantId] = useState<string>(
    () => product?.variants[0]?.id ?? '',
  );
  const [activeImage, setActiveImage] = useState<string>(
    () => product?.hero_image ?? '',
  );
  const [justAdded, setJustAdded] = useState(false);

  const { addItem } = useCart();

  if (!product) {
    return (
      <main className="container-max section-padding text-center">
        <h1 className="text-3xl font-display font-bold text-secondary-100 mb-4">
          Product not found
        </h1>
        <p className="text-secondary-400 mb-8">
          We couldn't find a product with that name.
        </p>
        <Link to="/store" className="btn-primary text-sm">
          Back to store
        </Link>
      </main>
    );
  }

  const gallery = [product.hero_image, ...(product.mockup_images ?? [])].filter(
    (s): s is string => Boolean(s),
  );

  const handleAdd = () => {
    if (!variantId) return;
    addItem({ product_id: product.id, variant_id: variantId, qty: 1 });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1500);
  };

  return (
    <main className="container-max section-padding">
      <Link
        to="/store"
        className="inline-flex items-center gap-2 text-sm text-secondary-400 hover:text-primary-400 transition-colors mb-8"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to store
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative aspect-square rounded-xl overflow-hidden bg-secondary-800">
            {activeImage ? (
              <OptimizedImg
                src={activeImage}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-secondary-600">
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h18v18H3z M3 16l5-5 4 4 8-8" />
                </svg>
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {gallery.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(src)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    activeImage === src
                      ? 'border-primary-500'
                      : 'border-transparent hover:border-secondary-500'
                  }`}
                >
                  <OptimizedImg src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
            {product.title}
          </h1>
          <p className="text-2xl text-primary-400 font-semibold mb-6">
            {formatPrice(product.price_cents, product.currency)}
          </p>

          <p className="text-secondary-300 leading-relaxed mb-8">
            {product.description}
          </p>

          {product.variants.length > 0 && (
            <div className="mb-8">
              <label className="block text-xs font-semibold uppercase tracking-wider text-secondary-500 mb-3">
                {product.variants.length === 1 ? 'Option' : 'Choose a size'}
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const selected = v.id === variantId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      className={`min-w-[3rem] px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        selected
                          ? 'bg-primary-500/20 text-primary-300 border-primary-500/60'
                          : 'bg-secondary-800 text-secondary-300 border-secondary-700 hover:border-secondary-500'
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={!variantId}
            className="btn-primary w-full sm:w-auto"
          >
            {justAdded ? (
              <span className="inline-flex items-center gap-2">
                <CheckIcon className="w-5 h-5" />
                Added to cart
              </span>
            ) : (
              'Add to cart'
            )}
          </button>

          <p className="mt-4 text-xs text-secondary-500">
            Printed and shipped on demand. Allow 5–10 business days for delivery.
          </p>
        </motion.div>
      </div>
    </main>
  );
}
