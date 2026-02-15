import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeftIcon, PencilSquareIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { apiGet } from "../../utils/api";
import { useAuth, canManageMedia } from "../../shell/AuthContext";
import type { MediaItem, MediaFile } from "./MediaPage";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Audio waveform visualization                                       */
/* ------------------------------------------------------------------ */

function AudioWaveform({ src }: { src: string }) {
  // Generate pseudo-random bar heights for visual effect
  const bars = useMemo(
    () => Array.from({ length: 48 }, () => 20 + Math.random() * 80),
    [],
  );

  return (
    <div className="card p-6 sm:p-8">
      {/* Waveform bars */}
      <div className="flex items-end justify-center gap-[3px] h-32 mb-6">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className="w-1.5 sm:w-2 rounded-full bg-gradient-to-t from-primary-600 to-primary-400"
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: i * 0.015, duration: 0.4, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* HTML5 audio player */}
      <audio controls src={src} className="w-full" preload="metadata">
        Your browser does not support the audio element.
      </audio>
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
      <div className="card p-6 space-y-3">
        <div className="h-4 bg-secondary-700/50 rounded w-1/3" />
        <div className="h-4 bg-secondary-700/50 rounded w-1/4" />
        <div className="h-4 bg-secondary-700/50 rounded w-full" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Metadata row helper                                                */
/* ------------------------------------------------------------------ */

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-2 border-b border-secondary-700/50 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-secondary-500 font-semibold w-28 shrink-0">
        {label}
      </dt>
      <dd className="text-secondary-200 text-sm">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface MediaDetailItem extends MediaItem {
  dimensions?: string;
}

/* ------------------------------------------------------------------ */
/*  File gallery with navigation                                       */
/* ------------------------------------------------------------------ */

function FileGallery({ files, title }: { files: MediaFile[]; type: string; title: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = files[activeIdx];

  if (!active) return null;

  const isImage = active.contentType?.startsWith("image/");
  const isVideo = active.contentType?.startsWith("video/");

  return (
    <div className="space-y-3">
      {/* Main viewer */}
      <div className="relative rounded-xl overflow-hidden bg-secondary-800">
        {isImage && (
          <img
            src={active.url}
            alt={active.filename || title}
            className="w-full max-h-[70vh] object-contain mx-auto"
          />
        )}
        {isVideo && (
          <video
            src={active.url}
            controls
            className="w-full max-h-[70vh]"
            preload="metadata"
          />
        )}
        {!isImage && !isVideo && (
          <div className="flex items-center justify-center h-48 text-secondary-500">
            {active.filename}
          </div>
        )}

        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx((i) => (i > 0 ? i - 1 : files.length - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveIdx((i) => (i < files.length - 1 ? i + 1 : 0))}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Counter badge */}
        {files.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {activeIdx + 1} / {files.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {files.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {files.map((f, idx) => {
            const fIsImage = f.contentType?.startsWith("image/");
            const fIsVideo = f.contentType?.startsWith("video/");
            return (
              <button
                key={f.s3Key}
                onClick={() => setActiveIdx(idx)}
                className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  idx === activeIdx
                    ? "border-primary-500 ring-2 ring-primary-500/30"
                    : "border-secondary-700 hover:border-secondary-500"
                }`}
              >
                {fIsImage ? (
                  <img src={f.url} alt={f.filename} className="w-full h-full object-cover" />
                ) : fIsVideo ? (
                  <video
                    src={`${f.url}#t=0.1`}
                    muted
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary-800 text-secondary-500 text-[10px] text-center p-1">
                    {f.filename?.split(".").pop()?.toUpperCase()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const showEdit = canManageMedia(user);
  const [item, setItem] = useState<MediaDetailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<MediaDetailItem>(`/media?id=${id}`);
        if (!cancelled) setItem(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load media");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasMultipleFiles = item?.files && item.files.length > 1;

  return (
    <main className="container-max section-padding max-w-4xl">
      {/* Back link */}
      <Link
        to="/media"
        className="inline-flex items-center gap-2 text-secondary-400 hover:text-primary-400 transition-colors mb-8 text-sm"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Media
      </Link>

      {loading && <DetailSkeleton />}

      {error && (
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/media" className="btn-secondary text-sm">
            Back to Media
          </Link>
        </div>
      )}

      {!loading && !error && !item && (
        <div className="text-center py-16">
          <p className="text-secondary-400 text-lg mb-4">Media not found.</p>
          <Link to="/media" className="btn-secondary text-sm">
            Back to Media
          </Link>
        </div>
      )}

      {item && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-8"
        >
          {/* Title + Edit */}
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white">
              {item.title}
            </h1>
            {showEdit && (
              <Link
                to={`/admin/media?edit=${id}`}
                className="shrink-0 inline-flex items-center gap-1.5 text-sm text-secondary-400 hover:text-primary-400 transition-colors"
              >
                <PencilSquareIcon className="w-4 h-4" />
                Edit
              </Link>
            )}
          </div>

          {/* Multi-file gallery */}
          {hasMultipleFiles && (
            <FileGallery files={item.files!} type={item.type} title={item.title} />
          )}

          {/* Single-file player/viewer (legacy or single-file items) */}
          {!hasMultipleFiles && (
            <>
              {item.type === "image" && (
                <div className="rounded-xl overflow-hidden bg-secondary-800">
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full max-h-[70vh] object-contain mx-auto"
                  />
                </div>
              )}

              {item.type === "video" && (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video
                    src={item.url}
                    controls
                    className="w-full max-h-[70vh]"
                    preload="metadata"
                  />
                </div>
              )}

              {item.type === "audio" && (
                <>
                  {/* Show cover art if available */}
                  {item.thumbnail && (
                    <div className="rounded-xl overflow-hidden bg-secondary-800">
                      <img
                        src={item.thumbnail}
                        alt={`${item.title} cover art`}
                        className="w-full max-h-[50vh] object-contain mx-auto"
                      />
                    </div>
                  )}
                  {/* Audio player with waveform */}
                  <AudioWaveform src={item.url} />
                </>
              )}
            </>
          )}

          {/* Metadata panel */}
          <div className="card p-6">
            <h2 className="text-sm uppercase tracking-wider text-secondary-400 font-semibold mb-4">
              Details
            </h2>
            <dl className="divide-y divide-secondary-700/50">
              <MetaRow label="Title" value={item.title} />
              <MetaRow label="Format" value={item.format?.toUpperCase()} />
              <MetaRow label="Type" value={item.type.charAt(0).toUpperCase() + item.type.slice(1)} />
              <MetaRow label="Dimensions" value={item.dimensions} />
              <MetaRow
                label="File size"
                value={item.filesize != null ? formatBytes(item.filesize) : undefined}
              />
              {item.files && item.files.length > 1 && (
                <MetaRow label="Files" value={`${item.files.length} files`} />
              )}
              <MetaRow label="Added by" value={item.addedBy} />
              <MetaRow
                label="Added"
                value={
                  item.addedAt
                    ? new Date(item.addedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : undefined
                }
              />
            </dl>

            {/* AI Summary */}
            {item.aiSummary && (
              <div className="mt-6 pt-4 border-t border-secondary-700/50">
                <h3 className="text-xs uppercase tracking-wider text-secondary-500 font-semibold mb-2">
                  AI Summary
                </h3>
                <p className="text-secondary-200 text-sm leading-relaxed">{item.aiSummary}</p>
              </div>
            )}

            {/* Categories */}
            {item.categories && item.categories.length > 0 && (
              <div className="mt-6 pt-4 border-t border-secondary-700/50">
                <h3 className="text-xs uppercase tracking-wider text-secondary-500 font-semibold mb-2">
                  Categories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-3 py-1 text-xs font-medium bg-secondary-700/50 text-secondary-200 rounded-full"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </main>
  );
}
