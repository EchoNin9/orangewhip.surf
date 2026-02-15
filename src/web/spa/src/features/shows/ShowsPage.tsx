import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet } from "../../utils/api";
import { EmptyState } from "../../shell/EmptyState";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Show {
  id: string;
  title: string;
  date: string; // ISO date string
  venue: {
    name: string;
    address?: string;
    website?: string;
  };
  description?: string;
  thumbnail?: string;
  media?: { url: string; type: "image" | "video" }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toDateStr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isFuture(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= now;
}

/* ------------------------------------------------------------------ */
/*  Skeleton card                                                      */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-48 bg-secondary-700/50" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-secondary-700/50 rounded w-3/4" />
        <div className="h-4 bg-secondary-700/50 rounded w-1/2" />
        <div className="h-4 bg-secondary-700/50 rounded w-full" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Show card                                                          */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

function ShowCard({ show, index }: { show: Show; index: number }) {
  const today = isToday(show.date);

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
    >
      <Link
        to={`/shows/${show.id}`}
        className={`card block overflow-hidden group hover:border-primary-500/60 transition-colors ${
          today ? "border-2 border-primary-500 ring-2 ring-primary-500/30" : ""
        }`}
      >
        {/* Thumbnail */}
        <div className="relative h-48 bg-secondary-800 overflow-hidden">
          {show.thumbnail ? (
            <img
              src={show.thumbnail}
              alt={show.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-secondary-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
          {today && (
            <span className="absolute top-3 right-3 px-3 py-1 bg-primary-500 text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg">
              TODAY!
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-lg font-display font-bold text-white group-hover:text-primary-400 transition-colors truncate">
            {show.title}
          </h3>
          <p className="mt-1 text-sm text-primary-400 font-medium">
            {toDateStr(show.date)}
          </p>
          <p className="mt-1 text-sm text-secondary-400">
            {show.venue.name}
          </p>
          {show.description && (
            <p className="mt-3 text-sm text-secondary-300 line-clamp-2">
              {show.description}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

function ShowSection({
  title,
  shows,
  emptyMsg,
}: {
  title: string;
  shows: Show[];
  emptyMsg: string;
}) {
  if (shows.length === 0) {
    return (
      <section className="mb-12">
        <h2 className="text-2xl font-display font-bold text-white mb-6">{title}</h2>
        <p className="text-secondary-400 text-center py-12">{emptyMsg}</p>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <h2 className="text-2xl font-display font-bold text-white mb-6">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {shows.map((s, i) => (
          <ShowCard key={s.id} show={s} index={i} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ShowsPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<Show[]>("/shows");
        if (!cancelled) setShows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load shows");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { upcoming, past } = useMemo(() => {
    const up: Show[] = [];
    const pa: Show[] = [];
    for (const s of shows) {
      if (isFuture(s.date)) up.push(s);
      else pa.push(s);
    }
    up.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    pa.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { upcoming: up, past: pa };
  }, [shows]);

  return (
    <main className="container-max section-padding">
      <motion.h1
        className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Shows
      </motion.h1>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary text-sm">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && shows.length === 0 && (
        <EmptyState
          iconPath="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
          title="No Shows Scheduled Yet"
          description="We're cooking up some live dates. Check back soon for upcoming gigs and past shows."
          adminLink="/admin/shows"
          adminLabel="Create First Show"
        />
      )}

      {!loading && !error && shows.length > 0 && (
        <>
          <ShowSection title="Upcoming Shows" shows={upcoming} emptyMsg="No upcoming shows scheduled." />
          <ShowSection title="Past Shows" shows={past} emptyMsg="No past shows to display." />
        </>
      )}
    </main>
  );
}
