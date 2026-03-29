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
import { stagger, fadeUp, viewportOnce, GRAIN_SVG } from "../../utils/motion";
import { OptimizedImg } from "../../utils/OptimizedImg";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video" | "audio";
  thumbnailUrl?: string;
  thumbnailWebp?: string;
  mediumUrl?: string;
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
  thumbnailWebp?: string;
  media?: { url: string; type: "image" | "video" }[];
  ticketUrl?: string;
}

interface HeroBranding {
  heroTitle: string;
  heroTagline: string;
  heroButton1Text: string;
  heroButton1Href: string;
  heroButton2Text: string;
  heroButton2Href: string;
  heroImageUrl?: string;
  heroImageOpacity?: number;
  heroButton1Bg?: string;
  heroButton1TextColor?: string;
  heroButton2Bg?: string;
  heroButton2TextColor?: string;
}

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
/*  Skeleton components                                               */
/* ------------------------------------------------------------------ */

function SkeletonShowCard() {
  return (
    <div className="card p-5">
      <div className="h-40 -mx-5 -mt-5 mb-4 rounded-t-xl bg-secondary-700/50 animate-pulse" />
      <div className="h-3 w-32 bg-secondary-700/50 rounded animate-pulse mb-3" />
      <div className="h-5 w-48 bg-secondary-700/50 rounded animate-pulse mb-2" />
      <div className="h-3 w-40 bg-secondary-700/50 rounded animate-pulse" />
    </div>
  );
}

function SkeletonNewsCard() {
  return (
    <div className="card p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="sm:w-48 sm:h-36 flex-shrink-0 rounded-lg bg-secondary-700/50 animate-pulse" />
        <div className="flex-1 min-w-0 space-y-3">
          <div className="h-3 w-16 bg-secondary-700/50 rounded animate-pulse" />
          <div className="h-5 w-56 bg-secondary-700/50 rounded animate-pulse" />
          <div className="h-3 w-full bg-secondary-700/50 rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-secondary-700/50 rounded animate-pulse" />
          <div className="h-3 w-20 bg-secondary-700/50 rounded animate-pulse mt-2" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const DEFAULT_HERO: HeroBranding = {
  heroTitle: "Orange Whip",
  heroTagline: "Industrial Surf",
  heroButton1Text: "Upcoming Shows",
  heroButton1Href: "/shows",
  heroButton2Text: "Listen Now",
  heroButton2Href: "/media",
  heroImageOpacity: 25,
};

export function HomePage() {
  const { user } = useAuth();
  const canEdit = hasRole(user, 'band');
  const [hero, setHero] = useState<HeroBranding>(DEFAULT_HERO);
  const [pinnedUpdate, setPinnedUpdate] = useState<Update | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [mediaIdx, setMediaIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        /* Try batch endpoint first (single request) */
        const data = await apiGet<{
          branding: HeroBranding;
          pinnedUpdate: Update | null;
          upcomingShows: Show[];
        }>("/homepage");

        if (cancelled) return;

        setHero({ ...DEFAULT_HERO, ...data.branding });
        setPinnedUpdate(data.pinnedUpdate);
        setShows(data.upcomingShows);
      } catch {
        /* Fallback: parallel calls if /homepage not available */
        if (cancelled) return;

        const [brandingResult, updateResult, showsResult] =
          await Promise.allSettled([
            apiGet<HeroBranding>("/branding").catch(() => DEFAULT_HERO),
            apiGet<Update>("/updates/pinned").catch(async () => {
              try {
                const all = await apiGet<Update[]>("/updates");
                return all.length ? all[0] : null;
              } catch {
                return null;
              }
            }),
            apiGet<Show[]>("/shows").catch(() => [] as Show[]),
          ]);

        if (cancelled) return;

        const branding =
          brandingResult.status === "fulfilled"
            ? brandingResult.value
            : DEFAULT_HERO;
        setHero({ ...DEFAULT_HERO, ...branding });

        const update =
          updateResult.status === "fulfilled" ? updateResult.value : null;
        setPinnedUpdate(update);

        const showsData =
          showsResult.status === "fulfilled" ? showsResult.value : [];
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
      <section className="relative overflow-hidden min-h-screen -mt-[88px]">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary-900 via-secondary-800 to-primary-900/20" />
        {hero.heroImageUrl && (
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-fixed"
            style={{
              backgroundImage: `url(${hero.heroImageUrl})`,
              backgroundSize: "100% auto",
              opacity: (hero.heroImageOpacity ?? 25) / 100,
            }}
          />
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_80%,rgba(249,115,22,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_20%,rgba(249,115,22,0.05),transparent)]" />
        {/* Grain texture */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
          style={{ backgroundImage: GRAIN_SVG }}
        />

        <div className="relative z-20 container-max flex flex-col items-center justify-center min-h-screen text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-6xl sm:text-8xl lg:text-9xl font-display font-bold text-gradient leading-tight tracking-tight pb-2">
              {hero.heroTitle}
            </h1>
          </motion.div>

          <motion.p
            className="mt-14 sm:mt-16 text-xl sm:text-2xl text-secondary-300 font-display tracking-widest uppercase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            {hero.heroTagline}
          </motion.p>

          <motion.div
            className="mt-10 flex justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <Link
              to={hero.heroButton1Href}
              className={
                hero.heroButton1Bg || hero.heroButton1TextColor
                  ? "inline-flex items-center justify-center px-6 py-3 font-semibold rounded-lg shadow-lg transition-all duration-200 ease-in-out"
                  : "btn-primary"
              }
              style={
                hero.heroButton1Bg || hero.heroButton1TextColor
                  ? {
                      backgroundColor: hero.heroButton1Bg || undefined,
                      color: hero.heroButton1TextColor || "#fff",
                    }
                  : undefined
              }
            >
              {hero.heroButton1Text}
            </Link>
            <Link
              to={hero.heroButton2Href}
              className={
                hero.heroButton2Bg || hero.heroButton2TextColor
                  ? "inline-flex items-center justify-center px-6 py-3 font-semibold rounded-lg border transition-all duration-200 ease-in-out"
                  : "inline-flex items-center justify-center px-6 py-3 font-semibold rounded-lg border border-secondary-600 bg-white/5 backdrop-blur-sm text-secondary-100 transition-all duration-200 hover:bg-white/10 hover:border-secondary-400 hover:-translate-y-0.5"
              }
              style={
                hero.heroButton2Bg || hero.heroButton2TextColor
                  ? {
                      backgroundColor: hero.heroButton2Bg || undefined,
                      color: hero.heroButton2TextColor || "#f1f5f9",
                      borderColor: hero.heroButton2Bg ? "transparent" : undefined,
                    }
                  : undefined
              }
            >
              {hero.heroButton2Text}
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 bg-secondary-900">
      {/* ── Upcoming Shows (before Latest News) ── */}
      {!loading && shows.length > 0 && (
        <section className="container-max section-padding">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
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
                className="group inline-flex items-center gap-1.5 text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
              >
                View All Shows
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {shows.map((show) => (
                <motion.div key={show.id} variants={fadeUp}>
                  <Link
                    to={`/shows/${show.id}`}
                    className={`card block p-5 group transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-0.5 ${
                      isToday(show.date)
                        ? "ring-2 ring-primary-500 border-primary-500/50"
                        : ""
                    }`}
                  >
                    {show.thumbnail && (
                      <div className="h-40 -mx-5 -mt-5 mb-4 rounded-t-xl overflow-hidden bg-secondary-700">
                        <OptimizedImg
                          webpSrc={show.thumbnailWebp}
                          src={show.thumbnail}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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

      {/* ── Pinned / Latest Update ── */}
      {!loading && pinnedUpdate && (
        <section className="container-max section-padding">
          <div className="h-px bg-gradient-to-r from-transparent via-secondary-700 to-transparent -mt-12 sm:-mt-16 lg:-mt-20 mb-12 sm:mb-16 lg:mb-20" />
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={viewportOnce}
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-display font-bold text-secondary-100 mb-8"
            >
              Latest News
            </motion.h2>

            <motion.div
              variants={fadeUp}
              className="card p-6 sm:p-8 cursor-pointer transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-0.5"
              onClick={() => {
                setModalOpen(true);
                setMediaIdx(0);
              }}
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {pinnedUpdate.media?.[0] && (
                  <div className="sm:w-48 sm:h-36 flex-shrink-0 rounded-lg overflow-hidden bg-secondary-700">
                    {pinnedUpdate.media[0].type === "image" ? (
                      <OptimizedImg
                        webpSrc={pinnedUpdate.media[0].thumbnailWebp}
                        src={
                          pinnedUpdate.media[0].thumbnailUrl ||
                          pinnedUpdate.media[0].url
                        }
                        loading="lazy"
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
                  className="card p-6 text-center transition-all duration-300 hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-1 group"
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

      {/* ── Skeleton loading ── */}
      {loading && (
        <div className="container-max section-padding space-y-12">
          {/* Skeleton: Upcoming Shows */}
          <div>
            <div className="h-7 w-48 bg-secondary-700/50 rounded animate-pulse mb-8" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <SkeletonShowCard />
              <SkeletonShowCard />
              <SkeletonShowCard />
            </div>
          </div>
          {/* Skeleton: Latest News */}
          <div>
            <div className="h-px bg-gradient-to-r from-transparent via-secondary-700 to-transparent mb-12" />
            <div className="h-7 w-36 bg-secondary-700/50 rounded animate-pulse mb-8" />
            <SkeletonNewsCard />
          </div>
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
                          <OptimizedImg
                            webpSrc={pinnedUpdate.media[mediaIdx].mediumUrl}
                            src={pinnedUpdate.media[mediaIdx].url}
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
      </div>
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
