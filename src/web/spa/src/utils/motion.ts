import type { Variants } from "framer-motion";

/* Shared easing curve — smooth deceleration */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* Container that staggers its children */
export const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

/* Child element: fade in + slide up */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

/* Default viewport trigger config */
export const viewportOnce = { once: true, margin: "-80px" as const };
