import { GRAIN_SVG } from "../../utils/motion";

/**
 * OW redesign global page chrome (OW-3, docs/ow-redesign-2 §0):
 * warm near-black radial glow, three drifting accent blobs (z-0),
 * and a fixed film-grain overlay (z-60). Content sits at z-10, nav at z-50.
 * Blob drift keyframes live in index.css behind prefers-reduced-motion.
 */
export function PageChrome({ showGrain = true }: { showGrain?: boolean }) {
  return (
    <>
      {/* Radial glow + blobs, behind all content */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, var(--ow-bg-top) 0%, var(--ow-bg) 55%)",
          }}
        />
        <div
          className="ow-blob-1 absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full opacity-40 blur-[60px]"
          style={{ background: "radial-gradient(circle, var(--ow-accent), transparent 70%)" }}
        />
        <div
          className="ow-blob-2 absolute top-1/3 -right-32 w-[460px] h-[460px] rounded-full opacity-30 blur-[50px]"
          style={{ background: "radial-gradient(circle, var(--ow-accent-2), transparent 70%)" }}
        />
        <div
          className="ow-blob-3 absolute bottom-0 left-1/4 w-[420px] h-[420px] rounded-full opacity-30 blur-[40px]"
          style={{ background: "radial-gradient(circle, var(--ow-accent-3), transparent 70%)" }}
        />
      </div>

      {/* Film grain — fixed, above content (z-60), toggleable; admin wiring lands in OW-13 */}
      {showGrain && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] opacity-[0.07] mix-blend-overlay"
          style={{ backgroundImage: GRAIN_SVG }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
