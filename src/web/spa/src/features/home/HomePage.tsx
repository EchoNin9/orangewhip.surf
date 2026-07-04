import { useState, useEffect, Fragment, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { apiGet, apiPost } from "../../utils/api";
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
  palette?: string;
  showGrain?: boolean;
  marqueeItems?: string[];
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

/* ── Marquee strip (OW-6; items admin-editable via branding settings, OW-16) ── */
const MARQUEE_ITEMS = ['New single "Sundowner" out now', "Summer tour on sale", "Merch restocked"];

function Marquee({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  const half = [...items, ...items, ...items];
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

/* Spec sample tracklist — fallback until an album is saved in admin (OW-15) */
const FALLBACK_TRACKS: AlbumTrack[] = [
  { title: "Sundowner", duration: "3:24" },
  { title: "Riptide Radio", duration: "2:58" },
  { title: "Saltwater Sunday", duration: "4:11" },
  { title: "Neon Undertow", duration: "3:46" },
  { title: "Last Good Wave", duration: "5:02" },
];

interface AlbumTrack {
  title: string;
  duration: string;
  mediaId?: string;
}

interface Album {
  title: string;
  yearLabel: string;
  coverUrl: string;
  tracks: AlbumTrack[];
}

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
  const [album, setAlbum] = useState<Album | null>(null);

  /* GET /media is public; the API already filters private items for guests
     and returns newest first. */
  useEffect(() => {
    apiGet<{ items: HomeMediaItem[] }>("/media?type=video&limit=3")
      .then((r) => setVideos(r.items))
      .catch(() => {});
    apiGet<{ items: HomeMediaItem[] }>("/media?type=image&limit=6")
      .then((r) => setPhotos(r.items))
      .catch(() => {});
    apiGet<Album>("/album")
      .then(setAlbum)
      .catch(() => {});
  }, []);

  const albumTitle = album?.title || "Crème De La Mer";
  const yearLabel = album?.yearLabel || "2026 · Self-released";
  const coverUrl = album?.coverUrl || "";
  const tracks = album?.tracks?.length ? album.tracks : FALLBACK_TRACKS;

  const TRACK_ROW =
    "flex items-center gap-4 border-b border-ow-hairline px-2 py-3.5 transition-colors hover:bg-ow-surface";

  return (
    <section id="media" className="mx-auto w-full max-w-[1100px] px-7 py-14 font-grotesk">
      <h2 className="mb-10 font-anton text-[clamp(40px,7vw,84px)] uppercase leading-[0.92] text-ow-text">
        Media
      </h2>

      {/* ── 5a. Listen (album data admin-editable, OW-15) ── */}
      <Eyebrow>Listen</Eyebrow>
      <div className="grid gap-8 md:grid-cols-[minmax(0,300px)_1fr]">
        <div>
          <div className="ow-hatch aspect-square overflow-hidden rounded-2xl border border-ow-hairline">
            {coverUrl && (
              <img src={coverUrl} alt={`${albumTitle} album art`} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="mt-4 font-cooper text-[22px] font-semibold italic text-ow-accent">
            {albumTitle}
          </div>
          <div className="text-sm text-ow-dim">{yearLabel}</div>
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
          {tracks.map((t, i) => {
            const row = (
              <>
                <span className="font-anton text-[15px] text-ow-accent-3">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-ow-accent">▶</span>
                <span className="min-w-0 flex-1 truncate text-base font-semibold text-ow-text">{t.title}</span>
                <span className="text-sm tabular-nums text-ow-dim">{t.duration}</span>
              </>
            );
            return (
              <li key={i}>
                {t.mediaId ? (
                  <Link to={`/media/${t.mediaId}`} className={TRACK_ROW}>{row}</Link>
                ) : (
                  <div className={TRACK_ROW}>{row}</div>
                )}
              </li>
            );
          })}
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

/* ── About section (OW-11) ── */

const ABOUT_PILL =
  "rounded-full border-[1.5px] border-[oklch(0.95_0.015_80/0.3)] px-6 py-3 font-grotesk text-[13px] font-bold uppercase tracking-[0.06em] text-ow-text transition-colors hover:border-ow-accent";

function AboutSection() {
  return (
    <section id="about" className="mx-auto w-full max-w-[1100px] px-7 py-14 font-grotesk">
      <div className="grid items-center gap-10 md:grid-cols-[1fr_minmax(0,420px)]">
        <div>
          <h2 className="font-anton text-[clamp(40px,7vw,84px)] uppercase leading-[0.92] text-ow-text">
            The
            <br />
            <span className="text-ow-accent">Band</span>
          </h2>
          <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-ow-text">
            Orange Whip started in a damp East Van practice space chasing one thing: the sound
            of the last good wave before the fog rolls in. Equal parts surf twang, fuzz-pedal
            psych, and late-night garage swagger.
          </p>
          <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-ow-dim">
            Four records, a hundred sweaty rooms, and zero plans to slow down. Bring earplugs.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/press" className={ABOUT_PILL}>
              Press Kit
            </Link>
            <a href="mailto:hello@orangewhip.surf" className={ABOUT_PILL}>
              Booking
            </a>
          </div>
        </div>
        {/* ponytail: hatch placeholder until a real portrait is set (admin wiring is future scope) */}
        <div className="ow-hatch aspect-[4/5] rounded-[18px] border border-ow-hairline" />
      </div>
    </section>
  );
}

/* ── Mailing list (OW-12) ── */

function MailingListSection() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await apiPost("/subscribe", { email });
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1100px] px-7 py-14 font-grotesk">
      <div
        className="rounded-[24px] p-[clamp(32px,5vw,60px)] text-center text-ow-on-accent"
        style={{ background: "linear-gradient(135deg, var(--ow-accent), var(--ow-accent-2))" }}
      >
        {sent ? (
          <h2 className="font-anton text-[clamp(32px,5.5vw,60px)] uppercase leading-none">
            You're on the list ✦ See you out there
          </h2>
        ) : (
          <>
            <h2 className="font-anton text-[clamp(32px,5.5vw,60px)] uppercase leading-none">
              Don't miss a show
            </h2>
            <p className="mx-auto mt-3 max-w-[46ch] font-semibold opacity-80">
              Tour dates, new music, and first dibs on tickets — straight to your inbox.
            </p>
            <form onSubmit={submit} className="mx-auto mt-7 flex w-full max-w-[520px] flex-wrap justify-center gap-3">
              <label htmlFor="ow-subscribe-email" className="sr-only">
                Email address
              </label>
              <input
                id="ow-subscribe-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@earth.com"
                className="min-w-0 flex-1 basis-[260px] rounded-xl px-[18px] py-4 text-ow-text placeholder:text-ow-dimmer focus:outline-none focus:ring-2 focus:ring-ow-on-accent"
                style={{ background: "oklch(0.16 0.02 45 / 0.92)" }}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-ow-on-accent px-7 py-4 font-bold uppercase text-ow-text disabled:opacity-60"
              >
                {busy ? "…" : "Sign Up"}
              </button>
            </form>
            {failed && (
              <p className="mt-3 text-sm font-bold" role="alert">
                Something went wrong — try again in a minute.
              </p>
            )}
          </>
        )}
      </div>
    </section>
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
  palette: "sunset",
  showGrain: true,
  marqueeItems: MARQUEE_ITEMS,
};

export function HomePage() {
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
    <div className="relative bg-ow-bg" data-ow-palette={hero.palette ?? "sunset"}>
      {/* ── Hero (OW-5) — pinned; the rest of the page scrolls over it (OW-19) ── */}
      <section className="sticky top-0 z-0 -mt-[88px] h-[100svh] overflow-hidden">
        {/* Full-bleed photo layer — hidden entirely when no image is set */}
        {hero.heroImageUrl && (
          <div className="absolute inset-0 z-[1] overflow-hidden">
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

        <div className="relative z-10 mx-auto flex h-full max-w-[1240px] flex-col items-center justify-center px-7 pt-[88px] text-center">
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

      {/* Everything below scrolls over the pinned hero (OW-19) — opaque bg required.
          overflow-hidden stops the marquee's top margin collapsing through and
          opening a see-through gap. */}
      <div className="relative z-10 overflow-hidden bg-ow-bg">
      <PageChrome showGrain={hero.showGrain !== false} />

      {/* ── Marquee (OW-6, admin-editable OW-16) ── */}
      <Marquee items={hero.marqueeItems ?? MARQUEE_ITEMS} />

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

      {/* ── Latest News (moved between Show Dates and Media, OW-17) ── */}
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

      {/* ── Media (OW-8, OW-9) ── */}
      <MediaSection />

      {/* ── Merch (OW-10) ── */}
      <MerchSection />

      {/* ── About (OW-11) ── */}
      <AboutSection />

      {/* ── Mailing list (OW-12) ── */}
      <MailingListSection />

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
