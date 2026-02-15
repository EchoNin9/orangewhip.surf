import { useState, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import {
  XMarkIcon,
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { apiGet } from "../../utils/api";
import { useAuth, hasRole } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video" | "audio";
  thumbnailUrl?: string;
  filename?: string;
}

interface Update {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  pinned?: boolean;
  media?: MediaItem[];
}

interface Show {
  id: string;
  date: string;
  venue?: {
    name: string;
    address?: string;
    website?: string;
  };
  description?: string;
  thumbnail?: string;
  media?: { url: string; type: "image" | "video" }[];
  ticketUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.15 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const { user } = useAuth();
  const canEdit = hasRole(user, 'editor');
  const [pinnedUpdate, setPinnedUpdate] = useState<Update | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mediaIdx, setMediaIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        /* Fetch pinned update — fall back to most recent visible */
        let update: Update | null = null;
        try {
          update = await apiGet<Update>("/updates/pinned");
        } catch {
          try {
            const all = await apiGet<Update[]>("/updates");
            if (all.length) update = all[0];
          } catch {
            /* no updates available */
          }
        }

        /* Fetch shows */
        const showsData = await apiGet<Show[]>("/shows").catch(
          () => [] as Show[],
        );

        if (!cancelled) {
          setPinnedUpdate(update);

          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const upcoming = showsData
            .filter((s) => new Date(s.date) >= now)
            .sort(
              (a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            )
            .slice(0, 3);
          setShows(upcoming);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Render ── */

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900 via-secondary-800 to-primary-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent" />

        <div className="relative container-max py-24 sm:py-32 lg:py-40 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-6xl sm:text-8xl lg:text-9xl font-display font-bold text-gradient leading-none tracking-tight">
              Orange Whip
            </h1>
          </motion.div>

          <motion.p
            className="mt-6 text-xl sm:text-2xl text-secondary-300 font-display tracking-widest uppercase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Vancouver Rock
          </motion.p>

          <motion.div
            className="mt-10 flex justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link to="/shows" className="btn-primary">
              Upcoming Shows
            </Link>
            <Link to="/media" className="btn-secondary">
              Listen Now
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Pinned / Latest Update ── */}
      {!loading && pinnedUpdate && (
        <section className="container-max section-padding">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-display font-bold text-secondary-100 mb-8"
            >
              Latest News
            </motion.h2>

            <motion.div
              variants={fadeUp}
              className="card p-6 sm:p-8 cursor-pointer hover:border-primary-500/50 transition-colors"
              onClick={() => {
                setModalOpen(true);
                setMediaIdx(0);
              }}
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {pinnedUpdate.media?.[0] && (
                  <div className="sm:w-48 sm:h-36 flex-shrink-0 rounded-lg overflow-hidden bg-secondary-700">
                    {pinnedUpdate.media[0].type === "image" ? (
                      <img
                        src={
                          pinnedUpdate.media[0].thumbnailUrl ||
                          pinnedUpdate.media[0].url
                        }
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-secondary-400">
                        <PlayTriangle />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {pinnedUpdate.pinned && (
                    <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary-400 mb-2">
                      Pinned
                    </span>
                  )}
                  <h3 className="text-xl font-display font-bold text-secondary-100">
                    {pinnedUpdate.title}
                  </h3>
                  <p className="mt-2 text-secondary-400 line-clamp-3">
                    {pinnedUpdate.content}
                  </p>
                  <p className="mt-3 text-xs text-secondary-500">
                    {formatDate(pinnedUpdate.createdAt)}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>
      )}

      {/* ── Upcoming Shows ── */}
      {!loading && shows.length > 0 && (
        <section className="container-max section-padding border-t border-secondary-800">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <motion.div
              variants={fadeUp}
              className="flex items-end justify-between mb-8"
            >
              <h2 className="text-3xl font-display font-bold text-secondary-100">
                Upcoming Shows
              </h2>
              <Link
                to="/shows"
                className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
              >
                View All Shows &rarr;
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shows.map((show) => (
                <motion.div key={show.id} variants={fadeUp}>
                  <Link
                    to={`/shows/${show.id}`}
                    className={`card block p-5 hover:border-primary-500/50 transition-colors ${
                      isToday(show.date)
                        ? "ring-2 ring-primary-500 border-primary-500/50"
                        : ""
                    }`}
                  >
                    {show.thumbnail && (
                      <div className="h-40 -mx-5 -mt-5 mb-4 rounded-t-xl overflow-hidden bg-secondary-700">
                        <img
                          src={show.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {isToday(show.date) && (
                      <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary-400 mb-2">
                        Tonight
                      </span>
                    )}

                    <div className="flex items-center gap-2 text-sm text-secondary-400 mb-2">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(show.date)}</span>
                    </div>

                    <h3 className="text-lg font-display font-bold text-secondary-100">
                      {show.venue?.name}
                    </h3>

                    {show.venue?.address && (
                      <div className="flex items-center gap-1 text-sm text-secondary-500 mt-1">
                        <MapPinIcon className="w-3.5 h-3.5" />
                        <span>{show.venue.address}</span>
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ── Content coming soon (visible when no data loaded) ── */}
      {!loading && !pinnedUpdate && shows.length === 0 && (
        <section className="container-max section-padding">
          <motion.div
            className="text-center py-12 sm:py-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto mb-12">
              {[
                { label: 'Shows', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', to: '/shows' },
                { label: 'Music', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z', to: '/media' },
                { label: 'News', icon: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z', to: '/updates' },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="card p-6 text-center hover:border-primary-500/50 transition-colors group"
                >
                  <div className="mx-auto w-14 h-14 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                    <svg className="w-7 h-7 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                  </div>
                  <span className="text-lg font-display font-bold text-secondary-200 group-hover:text-primary-400 transition-colors">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>

            <p className="text-secondary-400 text-lg mb-6">
              Content is on the way. Stay tuned!
            </p>

            {canEdit && (
              <Link to="/admin" className="btn-primary">
                Go to Admin Dashboard
              </Link>
            )}
          </motion.div>
        </section>
      )}

      {/* ── Loading spinner ── */}
      {loading && (
        <div className="container-max section-padding text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Update Detail Modal ── */}
      <Transition appear show={modalOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setModalOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl card p-6 sm:p-8">
                  <div className="flex items-start justify-between mb-4">
                    <Dialog.Title className="text-2xl font-display font-bold text-secondary-100">
                      {pinnedUpdate?.title}
                    </Dialog.Title>
                    <button
                      onClick={() => setModalOpen(false)}
                      className="p-1 text-secondary-400 hover:text-white transition-colors"
                    >
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Media carousel */}
                  {pinnedUpdate?.media && pinnedUpdate.media.length > 0 && (
                    <div className="mb-6">
                      <div className="relative rounded-lg overflow-hidden bg-secondary-700 aspect-video">
                        {pinnedUpdate.media[mediaIdx].type === "image" ? (
                          <img
                            src={pinnedUpdate.media[mediaIdx].url}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : pinnedUpdate.media[mediaIdx].type === "video" ? (
                          <video
                            src={pinnedUpdate.media[mediaIdx].url}
                            controls
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <audio
                              src={pinnedUpdate.media[mediaIdx].url}
                              controls
                            />
                          </div>
                        )}
                      </div>

                      {pinnedUpdate.media.length > 1 && (
                        <div className="flex justify-center gap-2 mt-3">
                          {pinnedUpdate.media.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setMediaIdx(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                                i === mediaIdx
                                  ? "bg-primary-500"
                                  : "bg-secondary-600 hover:bg-secondary-500"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-secondary-300 whitespace-pre-wrap leading-relaxed">
                    {pinnedUpdate?.content}
                  </p>

                  <p className="mt-4 text-xs text-secondary-500">
                    {pinnedUpdate && formatDate(pinnedUpdate.createdAt)}
                  </p>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}

/* ── Tiny inline play icon ── */
function PlayTriangle() {
  return (
    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
