import { useState, useEffect, Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { apiGet } from "../../utils/api";
import { useAuth, hasRole } from "../../shell/AuthContext";
import { socialLinks } from "../../shell/Header";
import { stagger, fadeUp, viewportOnce } from "../../utils/motion";
import { OptimizedImg } from "../../utils/OptimizedImg";
import { CATALOG } from "../store/catalog";
import { formatPrice } from "../store/useCart";
import { PageChrome } from "./PageChrome";

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

function monthOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

function dayOf(iso: string): number {
  return new Date(iso).getDate();
}

/** Same-page anchors get a plain <a>; routes get a router Link. */
function CtaLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return href.startsWith("#") ? (
    <a href={href} className={className}>{children}</a>
  ) : (
    <Link to={href} className={className}>{children}</Link>
  );
}

/* ── Marquee strip (OW-6) — CSS-only infinite loop, two identical halves ── */
const MARQUEE_ITEMS = ['New single "Sundowner" out now', "Summer tour on sale", "Merch restocked"];

function Marquee() {
  const half = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="relative z-10 my-[50px] overflow-hidden border-y border-ow-hairline bg-ow-accent py-3.5">
      <div className="ow-marquee flex w-max">
        {[0, 1].map((h) => (
          <div key={h} aria-hidden={h === 1} className="flex shrink-0 items-center">
            {half.map((item, i) => (
              <span
                key={i}
                className="flex items-center whitespace-nowrap font-anton text-2xl uppercase text-ow-on-accent"
              >
                <span className="px-6">{item}</span>
                <span className="opacity-40">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Media section (OW-8 Listen, OW-9 Watch + Photos) ── */

/** Eyebrow label + hairline rule that fills the remaining width (shared by 5a/5b/5c). */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <span className="shrink-0 font-grotesk text-[13px] font-bold uppercase tracking-[0.16em] text-ow-accent-3">
        {children}
      </span>
      <span className="h-px flex-1 bg-ow-hairline" />
    </div>
  );
}

function social(name: string): string {
  return socialLinks.find((s) => s.name === name)?.href ?? "#";
}

// ponytail: no album entity in the API — spec sample tracklist as static data until one exists
const TRACKS = [
  { n: "01", title: "Sundowner", time: "3:24" },
  { n: "02", title: "Riptide Radio", time: "2:58" },
  { n: "03", title: "Saltwater Sunday", time: "4:11" },
  { n: "04", title: "Neon Undertow", time: "3:46" },
  { n: "05", title: "Last Good Wave", time: "5:02" },
];

const STREAM_BTN =
  "flex-1 min-w-0 rounded-[11px] px-2 py-[11px] text-center font-grotesk text-xs font-bold uppercase";

interface HomeMediaItem {
  id: string;
  title: string;
  thumbnail?: string;
  thumbnailWebp?: string;
  addedAt?: string;
}

function MediaSection() {
  const [videos, setVideos] = useState<HomeMediaItem[]>([]);
  const [photos, setPhotos] = useState<HomeMediaItem[]>([]);

  /* GET /media is public; the API already filters private items for guests
     and returns newest first. */
  useEffect(() => {
    apiGet<{ items: HomeMediaItem[] }>("/media?type=video&limit=3")
      .then((r) => setVideos(r.items))
      .catch(() => {});
    apiGet<{ items: HomeMediaItem[] }>("/media?type=image&limit=6")
      .then((r) => setPhotos(r.items))
      .catch(() => {});
  }, []);

  return (
    <section id="media" className="mx-auto w-full max-w-[1100px] px-7 py-14 font-grotesk">
      <h2 className="mb-10 font-anton text-[clamp(40px,7vw,84px)] uppercase leading-[0.92] text-ow-text">
        Media
      </h2>

      {/* ── 5a. Listen ── */}
      <Eyebrow>Listen</Eyebrow>
      <div className="grid gap-8 md:grid-cols-[minmax(0,300px)_1fr]">
        <div>
          {/* ponytail: hatch placeholder until real album art exists */}
          <div className="ow-hatch aspect-square rounded-2xl border border-ow-hairline" />
          <div className="mt-4 font-cooper text-[22px] font-semibold italic text-ow-accent">
            Crème De La Mer
          </div>
          <div className="text-sm text-ow-dim">2026 · Self-released</div>
          <div className="mt-4 flex gap-2">
            <a href={social("Spotify")} target="_blank" rel="noreferrer" className={`${STREAM_BTN} bg-ow-accent text-ow-on-accent`}>
              Spotify
            </a>
            <a href={social("YouTube")} target="_blank" rel="noreferrer" className={`${STREAM_BTN} border border-ow-hairline bg-[oklch(0.95_0.015_80/0.08)] text-ow-text`}>
              Youtube
            </a>
            <a href={social("SoundCloud")} target="_blank" rel="noreferrer" className={`${STREAM_BTN} border border-ow-hairline bg-[oklch(0.95_0.015_80/0.08)] text-ow-text`}>
              Soundcloud
            </a>
          </div>
        </div>
        <ul>
          {TRACKS.map((t) => (
            <li key={t.n} className="flex items-center gap-4 border-b border-ow-hairline px-2 py-3.5 transition-colors hover:bg-ow-surface">
              <span className="font-anton text-[15px] text-ow-accent-3">{t.n}</span>
              <span className="text-ow-accent">▶</span>
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-ow-text">{t.title}</span>
              <span className="text-sm tabular-nums text-ow-dim">{t.time}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── 5b. Watch ── */}
      {videos.length > 0 && (
        <div className="mt-14">
          <Eyebrow>Watch</Eyebrow>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
            {videos.map((v) => (
              <Link key={v.id} to={`/media/${v.id}`} className="group block">
                <div className="ow-hatch relative aspect-video overflow-hidden rounded-[14px] border border-ow-hairline transition-colors group-hover:border-ow-accent">
                  {v.thumbnail && (
                    <OptimizedImg
                      webpSrc={v.thumbnailWebp}
                      src={v.thumbnail}
                      alt={v.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="grid h-[54px] w-[54px] place-items-center rounded-full border-[1.5px] border-white/70 bg-black/45 pl-1 text-ow-text backdrop-blur">
                      ▶
                    </span>
                  </div>
                  {/* ponytail: no duration field on media items yet — chip lands when the API grows one */}
                </div>
                <div className="mt-2.5 truncate text-base font-bold text-ow-text">{v.title}</div>
                {v.addedAt && <div className="text-[13px] text-ow-dim">{formatDate(v.addedAt)}</div>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 5c. Photos ── */}
      {photos.length > 0 && (
        <div className="mt-14">
          <Eyebrow>Photos</Eyebrow>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
            {photos.map((p) => (
              <Link
                key={p.id}
                to={`/media/${p.id}`}
                className="ow-hatch aspect-square overflow-hidden rounded-xl border border-ow-hairline transition-all hover:scale-[1.02] hover:border-ow-accent"
              >
                {p.thumbnail && (
                  <OptimizedImg
                    webpSrc={p.thumbnailWebp}
                    src={p.thumbnail}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link to="/media" className="mt-10 inline-block text-sm font-bold uppercase text-ow-accent">
        See all media →
      </Link>
    </section>
  );
}

/* ── Merch section (OW-10) ── */

function MerchSection() {
  // ponytail: the store's product listing IS the static CATALOG (server mirrors it for checkout)
  const products = CATALOG.slice(0, 4);
  if (products.length === 0) return null;

  return (
    <section id="merch" className="mx-auto w-full max-w-[1100px] px-7 py-14 font-grotesk">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-anton text-[clamp(40px,7vw,84px)] uppercase leading-[0.92] text-ow-text">
          Merch
        </h2>
        <Link to="/store" className="text-sm font-bold uppercase text-ow-accent">
          Visit full store →
        </Link>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[22px]">
        {products.map((p) => (
          <Link key={p.id} to={`/store/${p.slug}`} className="group block">
            <div className="ow-hatch relative aspect-square overflow-hidden rounded-2xl border border-ow-hairline transition-all duration-200 group-hover:-translate-y-1 group-hover:border-ow-accent">
              {p.hero_image && (
                // ponytail: catalog images are placeholder paths today — hide on 404, hatch shows through
                <img
                  src={p.hero_image}
                  alt={p.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
              {p.tag && (
                <span className="absolute left-3 top-3 rounded-full bg-ow-accent-3 px-2.5 py-1 text-[11px] font-bold uppercase text-ow-on-accent">
                  {p.tag}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-base font-bold text-ow-text">{p.title}</span>
              <span className="font-anton text-lg text-ow-accent">
                {formatPrice(p.price_cents, p.currency)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
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
  heroButton1Text: "Listen Now",
  heroButton1Href: "#media",
  heroButton2Text: "Shop Merch",
  heroButton2Href: "#merch",
  // ponytail: bundled default hero photo; empty admin value hides the photo layer (OW-13 wires upload)
  heroImageUrl: "/hero-surfer.jpg",
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
          .slice(0, 6);
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
    <div className="relative bg-ow-bg" data-ow-palette="sunset">
      <PageChrome />
      {/* ── Hero (OW-5) ── */}
      <section className="relative z-10 overflow-hidden -mt-[88px]">
        {/* Full-bleed photo layer — hidden entirely when no image is set */}
        {hero.heroImageUrl && (
          <div className="absolute inset-x-0 top-0 z-[1] h-[min(105vh,940px)] overflow-hidden">
            <img src={hero.heroImageUrl} alt="" className="h-full w-full object-cover" />
            {/* Legibility gradient — keep regardless of chosen image */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, oklch(0.16 0.018 45 / 0.45) 0%, oklch(0.16 0.018 45 / 0.62) 55%, oklch(0.16 0.018 45) 100%)",
              }}
            />
          </div>
        )}

        <div className="relative z-10 mx-auto flex max-w-[1240px] flex-col items-center px-7 pb-10 pt-[calc(88px+70px)] text-center">
          {/* Spinning sun behind the wordmark (outer div centers, inner rotates) */}
          <div className="absolute left-1/2 top-[38%] -z-[1] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] blur-2xl">
            <div
              className="ow-sun h-full w-full rounded-full"
              style={{
                background:
                  "conic-gradient(var(--ow-accent), var(--ow-accent-3), var(--ow-accent-2), var(--ow-accent))",
              }}
            />
          </div>

          {/* Eyebrow pill */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-ow-hairline bg-[oklch(0.95_0.015_80/0.07)] px-4 py-2 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-ow-accent-3 shadow-[0_0_10px_2px_var(--ow-accent-3)]" />
            <span className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-ow-text">
              Vancouver, BC · Surf-Psych Rock
            </span>
          </div>

          {/* Wordmark — one word per line */}
          <h1
            className="mt-6 font-cooper text-[clamp(64px,14vw,210px)] font-semibold italic leading-[0.92] text-ow-accent"
            style={{
              textShadow:
                "0.035em 0.045em 0 oklch(0.14 0.02 45), 0.06em 0.08em 0 oklch(0.14 0.02 45 / 0.5)",
            }}
          >
            {hero.heroTitle.split(" ").map((word, i, arr) => (
              <Fragment key={i}>
                {word}
                {i < arr.length - 1 && <br />}
              </Fragment>
            ))}
          </h1>

          {/* Lead */}
          <p className="mt-6 max-w-[560px] font-grotesk text-[clamp(16px,2.2vw,20px)] leading-relaxed text-[oklch(0.86_0.02_80)]">
            Reverb-drenched riffs and sunburnt melodies from the Pacific Northwest. Catch the
            wave live this summer.
          </p>

          {/* CTAs — labels/links come from branding settings; admin reconciliation in OW-13 */}
          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <CtaLink
              href={hero.heroButton1Href}
              className="rounded-full bg-ow-accent px-8 py-4 font-grotesk text-base font-bold uppercase tracking-[0.03em] text-ow-on-accent shadow-[0_14px_40px_-14px_var(--ow-accent)] transition-transform duration-200 hover:-translate-y-0.5 hover:scale-[1.02]"
            >
              {hero.heroButton1Text}
            </CtaLink>
            <CtaLink
              href={hero.heroButton2Href}
              className="rounded-full border-[1.5px] border-[oklch(0.95_0.015_80/0.3)] px-8 py-4 font-grotesk text-base font-bold uppercase tracking-[0.03em] text-ow-text transition-all duration-200 hover:-translate-y-0.5 hover:border-ow-accent-3"
            >
              {hero.heroButton2Text}
            </CtaLink>
          </div>

          {/* Next-show ribbon — hidden when no upcoming shows */}
          {!loading && shows[0] && (
            <div className="mt-10 flex w-full max-w-[760px] flex-wrap items-center gap-5 rounded-[18px] border border-ow-hairline bg-[oklch(0.95_0.015_80/0.05)] px-[22px] py-[18px] text-left backdrop-blur sm:flex-nowrap">
              <div className="text-center font-anton leading-[0.85]">
                <div className="text-[15px] uppercase tracking-[0.1em] text-ow-accent-3">
                  {monthOf(shows[0].date)}
                </div>
                <div className="text-[32px] text-ow-text">{dayOf(shows[0].date)}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-grotesk text-xs font-bold uppercase tracking-[0.16em] text-ow-dim">
                  Next Show
                </div>
                <div className="truncate font-grotesk text-lg font-bold text-ow-text">
                  {shows[0].venue?.name ?? "TBA"}
                </div>
                {shows[0].venue?.address && (
                  <div className="truncate font-grotesk text-sm text-ow-dim">
                    {shows[0].venue.address}
                  </div>
                )}
              </div>
              <a
                href="#shows"
                className="whitespace-nowrap rounded-full border border-ow-hairline-strong px-[18px] py-[11px] font-grotesk text-[12.5px] font-bold uppercase tracking-[0.08em] text-ow-text transition-colors hover:border-transparent hover:bg-ow-accent hover:text-ow-on-accent"
              >
                All Dates
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Marquee (OW-6) ── */}
      <Marquee />

      <div className="relative z-10">
      {/* ── Show Dates (OW-7) ── */}
      <section id="shows" className="relative z-10 mx-auto w-full max-w-[1100px] px-7 pb-14 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-anton text-[clamp(40px,7vw,84px)] uppercase leading-[0.92] text-ow-text">
            Show
            <br />
            <span className="text-ow-accent">Dates</span>
          </h2>
          <p className="max-w-[340px] font-grotesk text-[15px] text-ow-dim">
            Doors usually 8pm. Grab tickets early — most rooms are small and these go fast.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-0.5 overflow-hidden rounded-[18px] border border-ow-hairline">
          {!loading && shows.length === 0 && (
            <div className="bg-ow-surface px-6 py-5 font-grotesk text-ow-dim">
              No shows on the books — join the mailing list below.
            </div>
          )}
          {shows.map((show) => (
            <Link
              key={show.id}
              to={`/shows/${show.id}`}
              className="grid grid-cols-[72px_1fr_auto] items-center gap-3 bg-ow-surface px-4 py-5 transition-colors hover:bg-ow-surface-hover sm:grid-cols-[96px_1fr_auto] sm:gap-5 sm:px-6"
            >
              <div className="font-anton leading-[0.85]">
                <div className="text-[15px] uppercase tracking-[0.1em] text-ow-accent-3">
                  {monthOf(show.date)}
                </div>
                <div className="text-[32px] text-ow-text">{dayOf(show.date)}</div>
              </div>
              <div className="min-w-0">
                <div className="truncate font-grotesk text-lg font-bold text-ow-text">
                  {show.venue?.name ?? "TBA"}
                </div>
                <div className="truncate font-grotesk text-sm text-ow-dim">
                  {show.venue?.address}
                  {show.description ? ` · ${show.description}` : ""}
                </div>
              </div>
              {/* ponytail: unified orange Details pill by design — no ticket-state variants */}
              <span className="whitespace-nowrap rounded-full bg-ow-accent px-[18px] py-[11px] font-grotesk text-[12.5px] font-bold uppercase tracking-[0.08em] text-ow-on-accent">
                Details
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Media (OW-8, OW-9) ── */}
      <MediaSection />

      {/* ── Merch (OW-10) ── */}
      <MerchSection />

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
    </div>
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
