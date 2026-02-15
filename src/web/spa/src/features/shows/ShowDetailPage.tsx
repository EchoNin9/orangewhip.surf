import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { apiGet } from "../../utils/api";
import type { Show } from "./ShowsPage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ShowDetail extends Show {
  media?: { url: string; type: "image" | "video" }[];
}

/* ------------------------------------------------------------------ */
/*  Carousel                                                           */
/* ------------------------------------------------------------------ */

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

function MediaCarousel({ media }: { media: { url: string; type: "image" | "video" }[] }) {
  const [[current, direction], setCurrent] = useState<[number, number]>([0, 0]);

  const paginate = useCallback(
    (dir: number) => {
      setCurrent(([prev]) => {
        const next = (prev + dir + media.length) % media.length;
        return [next, dir];
      });
    },
    [media.length],
  );

  const item = media[current];

  return (
    <div className="relative rounded-xl overflow-hidden bg-secondary-800">
      {/* Slide area */}
      <div className="relative aspect-video overflow-hidden">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {item.type === "video" ? (
              <video
                src={item.url}
                controls
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <img
                src={item.url}
                alt={`Media ${current + 1}`}
                className="w-full h-full object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrows */}
      {media.length > 1 && (
        <>
          <button
            onClick={() => paginate(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-secondary-900/70 text-white hover:bg-primary-500/80 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => paginate(1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-secondary-900/70 text-white hover:bg-primary-500/80 transition-colors"
            aria-label="Next"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {media.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {media.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent([i, i > current ? 1 : -1])}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === current ? "bg-primary-500" : "bg-secondary-400/50 hover:bg-secondary-300"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-secondary-700/50 rounded w-1/2" />
      <div className="aspect-video bg-secondary-700/50 rounded-xl" />
      <div className="space-y-3">
        <div className="h-5 bg-secondary-700/50 rounded w-1/3" />
        <div className="h-4 bg-secondary-700/50 rounded w-1/4" />
        <div className="h-4 bg-secondary-700/50 rounded w-full" />
        <div className="h-4 bg-secondary-700/50 rounded w-5/6" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ShowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [show, setShow] = useState<ShowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<ShowDetail>(`/shows?id=${id}`);
        if (!cancelled) setShow(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load show");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const formattedDate = show
    ? new Date(show.date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <main className="container-max section-padding max-w-4xl">
      {/* Back link */}
      <Link
        to="/shows"
        className="inline-flex items-center gap-2 text-secondary-400 hover:text-primary-400 transition-colors mb-8 text-sm"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Shows
      </Link>

      {loading && <DetailSkeleton />}

      {error && (
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/shows" className="btn-secondary text-sm">
            Back to Shows
          </Link>
        </div>
      )}

      {!loading && !error && !show && (
        <div className="text-center py-16">
          <p className="text-secondary-400 text-lg mb-4">Show not found.</p>
          <Link to="/shows" className="btn-secondary text-sm">
            Back to Shows
          </Link>
        </div>
      )}

      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-2">
            {show.title}
          </h1>

          {/* Date */}
          <p className="text-primary-400 font-medium text-lg mb-6">{formattedDate}</p>

          {/* Carousel */}
          {show.media && show.media.length > 0 && (
            <div className="mb-8">
              <MediaCarousel media={show.media} />
            </div>
          )}

          {/* Venue info */}
          <div className="card p-6 mb-8">
            <h2 className="text-sm uppercase tracking-wider text-secondary-400 font-semibold mb-3">
              Venue
            </h2>
            <p className="text-xl font-display font-bold text-white">{show.venue.name}</p>
            {show.venue.address && (
              <p className="text-secondary-300 mt-1">{show.venue.address}</p>
            )}
            {show.venue.website && (
              <a
                href={show.venue.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-primary-400 hover:text-primary-300 transition-colors text-sm"
              >
                Visit venue website &rarr;
              </a>
            )}
          </div>

          {/* Description */}
          {show.description && (
            <div className="prose prose-invert max-w-none">
              <h2 className="text-sm uppercase tracking-wider text-secondary-400 font-semibold mb-3">
                About This Show
              </h2>
              <p className="text-secondary-200 leading-relaxed whitespace-pre-line">
                {show.description}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </main>
  );
}
