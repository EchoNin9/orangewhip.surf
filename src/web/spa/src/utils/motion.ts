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

/* Child element: scale in (for cards, modals) */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/* Staggered grid child — custom index delay via `custom={i}` */
export const fadeUpStaggered: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: EASE_OUT },
  }),
};

/* Default viewport trigger config */
export const viewportOnce = { once: true, margin: "-80px" as const };

/* SVG grain texture for atmospheric overlays */
export const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;
