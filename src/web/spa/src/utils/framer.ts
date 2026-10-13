/**
 * Every framer-motion import goes through this module so reduced motion is
 * honoured site-wide without a <MotionConfig> in the app shell — which keeps
 * framer-motion out of the homepage's initial bundle (lazy routes load it).
 * ponytail: read once at load; a visitor toggling the OS setting mid-visit
 * gets it on the next reload.
 */
import { MotionGlobalConfig } from "framer-motion";

if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  MotionGlobalConfig.skipAnimations = true;
}

export * from "framer-motion";
