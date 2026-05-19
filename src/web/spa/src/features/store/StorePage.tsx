import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { OptimizedImg } from '../../utils/OptimizedImg';
import { CATALOG } from './catalog';
import type { Product } from './catalog';
import { formatPrice } from './useCart';

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

function ProductCard({ product, index }: { product: Product; index: number }) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <Link
        to={`/store/${product.slug}`}
        className="card block overflow-hidden group transition-all duration-300 hover:border-primary-500/60 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-0.5"
      >
        <div className="relative aspect-square bg-secondary-800 overflow-hidden">
          {product.hero_image ? (
            <OptimizedImg
              src={product.hero_image}
              alt={product.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-secondary-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h18v18H3z M3 16l5-5 4 4 8-8" />
              </svg>
            </div>
          )}
        </div>

        <div className="p-5">
          <h3 className="text-lg font-display font-bold text-white group-hover:text-primary-400 transition-colors truncate">
            {product.title}
          </h3>
          <p className="mt-1 text-sm text-primary-400 font-medium">
            {formatPrice(product.price_cents, product.currency)}
          </p>
          <p className="mt-3 text-sm text-secondary-300 line-clamp-2">
            {product.description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StorePage() {
  return (
    <main className="container-max section-padding">
      <motion.h1
        className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-3"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Store
      </motion.h1>
      <motion.p
        className="text-secondary-400 mb-10 max-w-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        Merch printed on demand. Cards, Apple Pay, and Google Pay accepted at checkout.
      </motion.p>

      {CATALOG.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">
          The store is empty right now — check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATALOG.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}
