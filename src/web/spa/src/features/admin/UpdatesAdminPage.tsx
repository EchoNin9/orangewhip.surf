import { useState, useEffect, Fragment, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition, Switch } from "@headlessui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import {
  useAuth,
  canManageMedia,
  canAdminister,
} from "../../shell/AuthContext";

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
  updatedAt?: string;
  visible: boolean;
  pinned: boolean;
  media?: MediaItem[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function UpdatesAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Form state */
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visible, setVisible] = useState(true);
  const [attachedMedia, setAttachedMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  /* Media picker */
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  /* Delete confirm */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  /* ── Fetch updates ── */
  const fetchUpdates = () => {
    setLoading(true);
    apiGet<Update[]>("/updates?all=true")
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setUpdates(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && canManageMedia(user)) fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Permission check ── */
  if (authLoading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canManageMedia(user)) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          You need at least band-level access to manage updates.
        </p>
      </div>
    );
  }

  /* ── Form helpers ── */

  function openCreateForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setVisible(true);
    setAttachedMedia([]);
    setFormOpen(true);
  }

  function openEditForm(u: Update) {
    setEditingId(u.id);
    setTitle(u.title);
    setContent(u.content);
    setVisible(u.visible);
    setAttachedMedia(u.media || []);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        title,
        content,
        visible,
        mediaIds: attachedMedia.map((m) => m.id),
      };

      if (editingId) {
        await apiPut(`/updates?id=${editingId}`, body);
      } else {
        await apiPost("/updates", body);
      }
      setFormOpen(false);
      fetchUpdates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save update");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleVisibility(u: Update) {
    try {
      await apiPut(`/updates?id=${u.id}`, { visible: !u.visible });
      fetchUpdates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to toggle visibility");
    }
  }

  async function pinUpdate(u: Update) {
    try {
      await apiPut(`/updates?id=${u.id}`, { pinned: true });
      fetchUpdates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to pin update");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/updates?id=${deleteId}`);
      setDeleteId(null);
      fetchUpdates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete update");
    }
  }

  /* ── Media picker ── */

  async function openMediaPicker() {
    setMediaPickerOpen(true);
    setMediaLoading(true);
    try {
      const data = await apiGet<MediaItem[]>("/media");
      setAvailableMedia(data);
    } catch {
      setAvailableMedia([]);
    } finally {
      setMediaLoading(false);
    }
  }

  function toggleMediaSelection(item: MediaItem) {
    setAttachedMedia((prev) => {
      const exists = prev.find((m) => m.id === item.id);
      if (exists) return prev.filter((m) => m.id !== item.id);
      return [...prev, item];
    });
  }

  function removeAttachedMedia(id: string) {
    setAttachedMedia((prev) => prev.filter((m) => m.id !== id));
  }

  /* ── Render ── */

  return (
    <main className="container-max section-padding">
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          className="text-4xl font-display font-bold text-gradient"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Updates Management
        </motion.h1>
        <button onClick={openCreateForm} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> New Update
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : updates.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">
          No updates yet. Create your first one!
        </p>
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <div
              key={u.id}
              className={`card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
                u.pinned ? "border-primary-500/40 ring-1 ring-primary-500/20" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-display font-bold text-secondary-100 truncate">
                    {u.title}
                  </h3>
                  {u.pinned && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">
                      Pinned
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      u.visible
                        ? "bg-green-500/20 text-green-400"
                        : "bg-secondary-600/30 text-secondary-500"
                    }`}
                  >
                    {u.visible ? "Visible" : "Hidden"}
                  </span>
                </div>
                <p className="text-sm text-secondary-500 truncate">
                  {u.content}
                </p>
                <p className="text-xs text-secondary-600 mt-1">
                  {formatDate(u.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEditForm(u)}
                  title="Edit"
                  className="p-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleVisibility(u)}
                  title={u.visible ? "Hide" : "Show"}
                  className="p-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 transition-colors"
                >
                  {u.visible ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => pinUpdate(u)}
                  title="Pin to front page"
                  className={`p-2 rounded-lg transition-colors ${
                    u.pinned
                      ? "text-primary-400 bg-primary-500/10"
                      : "text-secondary-400 hover:text-primary-400 hover:bg-secondary-700"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </button>
                {canAdminister(user) && (
                  <button
                    onClick={() => setDeleteId(u.id)}
                    title="Delete"
                    className="p-2 rounded-lg text-secondary-400 hover:text-red-400 hover:bg-secondary-700 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Form Modal ── */}
      <Transition appear show={formOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            // Guard: don't let HeadlessUI's stacked-dialog close propagation
            // dismiss the form when the media picker is open / closing.
            if (!mediaPickerOpen) setFormOpen(false);
          }}
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
                <Dialog.Panel className="w-full max-w-lg card p-6">
                  <Dialog.Title className="text-xl font-display font-bold text-secondary-100 mb-6">
                    {editingId ? "Edit Update" : "New Update"}
                  </Dialog.Title>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                        Title
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-field"
                        placeholder="Update title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                        Content
                      </label>
                      <textarea
                        required
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={5}
                        className="input-field resize-none"
                        placeholder="What's new?"
                      />
                    </div>

                    {/* Visibility toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary-300">
                        Visible to public
                      </span>
                      <Switch
                        checked={visible}
                        onChange={setVisible}
                        className={`${
                          visible ? "bg-primary-500" : "bg-secondary-600"
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                      >
                        <span
                          className={`${
                            visible ? "translate-x-6" : "translate-x-1"
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>

                    {/* Attached media */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-secondary-300">
                          Media
                        </span>
                        <button
                          type="button"
                          onClick={openMediaPicker}
                          className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                        >
                          Browse Media
                        </button>
                      </div>
                      {attachedMedia.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {attachedMedia.map((m) => (
                            <div
                              key={m.id}
                              className="relative w-20 h-20 rounded-lg overflow-hidden bg-secondary-700 group"
                            >
                              {m.type === "image" ? (
                                <img
                                  src={m.thumbnailUrl || m.url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-secondary-400 text-xs">
                                  {m.type}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeAttachedMedia(m.id)}
                                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XMarkIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-secondary-500">
                          No media attached
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setFormOpen(false)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn-primary text-sm"
                      >
                        {submitting
                          ? "Saving..."
                          : editingId
                            ? "Save Changes"
                            : "Create Update"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ── Media Picker Modal ── */}
      <Transition appear show={mediaPickerOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[60]"
          onClose={() => setMediaPickerOpen(false)}
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
            <div className="fixed inset-0 bg-black/60" />
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
                <Dialog.Panel className="w-full max-w-2xl card p-6">
                  <Dialog.Title className="text-lg font-display font-bold text-secondary-100 mb-4">
                    Select Media
                  </Dialog.Title>

                  {mediaLoading ? (
                    <div className="text-center py-10">
                      <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : availableMedia.length === 0 ? (
                    <p className="text-secondary-400 text-sm text-center py-10">
                      No media available. Upload media in Media Management first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto scrollbar-thin">
                      {availableMedia.map((item) => {
                        const isSelected = attachedMedia.some(
                          (m) => m.id === item.id,
                        );
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleMediaSelection(item)}
                            className={`relative aspect-square rounded-lg overflow-hidden bg-secondary-700 border-2 transition-colors ${
                              isSelected
                                ? "border-primary-500"
                                : "border-transparent hover:border-secondary-500"
                            }`}
                          >
                            {item.type === "image" ? (
                              <img
                                src={item.thumbnailUrl || item.url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-secondary-400 text-xs">
                                {item.type}
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-primary-500/30 flex items-center justify-center">
                                <svg
                                  className="w-6 h-6 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end mt-4">
                    <button
                      type="button"
                      onClick={() => setMediaPickerOpen(false)}
                      className="btn-primary text-sm"
                    >
                      Done ({attachedMedia.length} selected)
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ── Delete Confirmation ── */}
      <Transition appear show={deleteId !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setDeleteId(null)}
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
            <div className="fixed inset-0 bg-black/70" />
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
                <Dialog.Panel className="w-full max-w-sm card p-6 text-center">
                  <Dialog.Title className="text-lg font-display font-bold text-secondary-100 mb-3">
                    Delete Update?
                  </Dialog.Title>
                  <p className="text-sm text-secondary-400 mb-6">
                    This action cannot be undone.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </main>
  );
}
