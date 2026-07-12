import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useCart } from './useCart';

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const { clear } = useCart();

  /* Clear once on mount — useCart's clear identity changes per render so
     don't list it in the deps array. */
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    if (!cleared) {
      clear();
      setCleared(true);
    }
  }, [cleared, clear]);

  return (
    <main className="container-max section-padding">
      <motion.div
        className="max-w-xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center mb-8">
          <CheckCircleIcon className="w-12 h-12 text-primary-400" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-bold text-gradient mb-4">
          Thanks for your order
        </h1>
        <p className="text-secondary-300 text-lg mb-3">
          Your payment came through and we're sending it to print. You'll get a
          shipping email when it leaves the warehouse.
        </p>
        {sessionId && (
          <p className="text-xs text-secondary-500 mb-8">
            Confirmation reference: <span className="font-mono">{sessionId}</span>
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/store" className="btn-primary text-sm">
            Keep browsing
          </Link>
          <Link to="/" className="btn-secondary text-sm">
            Back to home
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
