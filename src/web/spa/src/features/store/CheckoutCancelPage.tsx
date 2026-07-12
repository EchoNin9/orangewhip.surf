import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';

export default function CheckoutCancelPage() {
  return (
    <main className="container-max section-padding">
      <motion.div
        className="max-w-xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mx-auto w-20 h-20 rounded-2xl bg-secondary-800 border border-secondary-700 flex items-center justify-center mb-8">
          <ShoppingBagIcon className="w-10 h-10 text-secondary-400" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-bold text-secondary-100 mb-4">
          Checkout cancelled
        </h1>
        <p className="text-secondary-400 text-lg mb-8">
          No charge was made. Your cart is still here whenever you're ready.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/store" className="btn-primary text-sm">
            Back to cart
          </Link>
          <Link to="/" className="btn-secondary text-sm">
            Back to home
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
