import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EASE_OUT } from "./motion";

const variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } },
};

/**
 * Wraps page content with a smooth fade + slide transition.
 * Use inside AnimatePresence (in AppLayout) with a key tied to pathname.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
