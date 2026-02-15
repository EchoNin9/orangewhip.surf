import { useState, useEffect, Fragment } from "react";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { apiGet } from "../../utils/api";

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

function truncate(text: string, maxLen = 160): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

/* ------------------------------------------------------------------ */
/*  Animation                                                         */
/* ------------------------------------------------------------------ */

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Update | null>(null);
  const [mediaIdx, setMediaIdx] = useState(0);

  useEffect(() => {
    apiGet<Update[]>("/updates")
      .then((data) => {
        /* newest first */
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setUpdates(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function openUpdate(u: Update) {
    setSelected(u);
    setMediaIdx(0);
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="container-max section-padding text-center">
        <p className="text-red-400">Failed to load updates: {error}</p>
      </div>
    );
  }

  return (
    <>
      <main className="container-max section-padding">
        <motion.h1
          className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Updates
        </motion.h1>

        {updates.length === 0 ? (
          <p className="text-secondary-400 text-center py-16">
            No updates yet. Check back soon!
          </p>
        ) : (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            {updates.map((u) => (
              <motion.div
                key={u.id}
                variants={fadeUp}
                className="card p-5 sm:p-6 cursor-pointer hover:border-primary-500/50 transition-colors"
                onClick={() => openUpdate(u)}
              >
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Thumbnail */}
                  {u.media?.[0] && (
                    <div className="sm:w-40 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-secondary-700">
                      {u.media[0].type === "image" ? (
                        <img
                          src={u.media[0].thumbnailUrl || u.media[0].url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-secondary-500">
                          <svg
                            className="w-8 h-8"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {u.pinned && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">
                          Pinned
                        </span>
                      )}
                      <span className="text-xs text-secondary-500">
                        {formatDate(u.createdAt)}
                      </span>
                    </div>

                    <h2 className="text-lg font-display font-bold text-secondary-100">
                      {u.title}
                    </h2>
                    <p className="mt-1.5 text-sm text-secondary-400">
                      {truncate(u.content)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* ── Detail Modal ── */}
      <Transition appear show={selected !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setSelected(null)}
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
                  {selected && (
                    <>
                      <div className="flex items-start justify-between mb-4">
                        <Dialog.Title className="text-2xl font-display font-bold text-secondary-100">
                          {selected.title}
                        </Dialog.Title>
                        <button
                          onClick={() => setSelected(null)}
                          className="p-1 text-secondary-400 hover:text-white transition-colors"
                        >
                          <XMarkIcon className="w-6 h-6" />
                        </button>
                      </div>

                      {/* Media carousel */}
                      {selected.media && selected.media.length > 0 && (
                        <div className="mb-6">
                          <div className="relative rounded-lg overflow-hidden bg-secondary-700 aspect-video">
                            {selected.media[mediaIdx].type === "image" ? (
                              <img
                                src={selected.media[mediaIdx].url}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            ) : selected.media[mediaIdx].type === "video" ? (
                              <video
                                src={selected.media[mediaIdx].url}
                                controls
                                className="w-full h-full"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <audio
                                  src={selected.media[mediaIdx].url}
                                  controls
                                />
                              </div>
                            )}
                          </div>

                          {selected.media.length > 1 && (
                            <div className="flex justify-center gap-2 mt-3">
                              {selected.media.map((_, i) => (
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
                        {selected.content}
                      </p>

                      <p className="mt-4 text-xs text-secondary-500">
                        {formatDate(selected.createdAt)}
                      </p>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
