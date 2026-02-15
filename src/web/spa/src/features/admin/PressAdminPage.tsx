import { useState, useEffect, Fragment, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition, Switch } from "@headlessui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import { useAuth, canEditContent, canAdminister } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface FileAttachment {
  id: string;
  filename: string;
  url: string;
  s3Key?: string;
}

interface ExternalLink {
  url: string;
  label: string;
}

interface PressCard {
  id: string;
  title: string;
  description: string;
  public: boolean;
  pinned: boolean;
  createdAt: string;
  attachments: FileAttachment[];
  links: ExternalLink[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function uploadAttachment(file: File): Promise<FileAttachment> {
  const { uploadUrl, fileUrl, fileId, s3Key } = await apiPost<{
    uploadUrl: string;
    fileUrl: string;
    fileId: string;
    s3Key: string;
  }>("/press/upload-url", {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
  });

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
  }

  return { id: fileId, filename: file.name, url: fileUrl, s3Key: s3Key ?? "" };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PressAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState<PressCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Form */
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Delete */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* Auth guard */
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  /* Fetch */
  const fetchCards = () => {
    setLoading(true);
    apiGet<PressCard[]>("/press?all=true")
      .then((data) => {
        const normalised = (data ?? []).map((c) => ({
          ...c,
          attachments: c.attachments ?? (c as { fileAttachments?: FileAttachment[] }).fileAttachments ?? [],
          links: c.links ?? [],
        }));
        const sorted = normalised.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setCards(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && canEditContent(user)) fetchCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* Permission */
  if (authLoading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canEditContent(user)) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          You need editor access or above to manage press materials.
        </p>
      </div>
    );
  }

  /* ── Form helpers ── */

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setIsPublic(true);
    setAttachments([]);
    setLinks([]);
    setFormOpen(true);
  }

  function openEdit(card: PressCard) {
    setEditingId(card.id);
    setTitle(card.title);
    setDescription(card.description);
    setIsPublic(card.public);
    setAttachments(card.attachments || []);
    setLinks(card.links || []);
    setFormOpen(true);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: FileAttachment[] = [];
      for (const file of Array.from(files)) {
        const att = await uploadAttachment(file);
        uploaded.push(att);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to upload attachment",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function addLink() {
    setLinks((prev) => [...prev, { url: "", label: "" }]);
  }

  function updateLink(idx: number, field: keyof ExternalLink, value: string) {
    setLinks((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    );
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        title,
        description,
        public: isPublic,
        fileAttachments: attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          s3Key: a.s3Key,
        })),
        links: links.filter((l) => l.url.trim()),
      };

      if (editingId) {
        await apiPut(`/press?id=${editingId}`, body);
      } else {
        await apiPost("/press", body);
      }
      setFormOpen(false);
      fetchCards();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save press card",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePin(card: PressCard) {
    try {
      await apiPut(`/press?id=${card.id}`, { pinned: !card.pinned });
      fetchCards();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update pin");
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/press?id=${deleteId}`);
      setDeleteId(null);
      fetchCards();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete press card",
      );
    }
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
          Press Management
        </motion.h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> New Card
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
      ) : cards.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">
          No press cards yet. Create your first one!
        </p>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className={`card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
                card.pinned
                  ? "border-primary-500/40 ring-1 ring-primary-500/20"
                  : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-base font-display font-bold text-secondary-100 truncate">
                    {card.title}
                  </h3>
                  {card.pinned && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">
                      Pinned
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      card.public
                        ? "bg-green-500/20 text-green-400"
                        : "bg-secondary-600/30 text-secondary-500"
                    }`}
                  >
                    {card.public ? "Public" : "Private"}
                  </span>
                </div>
                <p className="text-sm text-secondary-500 truncate">
                  {card.description}
                </p>
                <p className="text-xs text-secondary-600 mt-1">
                  {formatDate(card.createdAt)} &middot;{" "}
                  {(card.attachments ?? []).length} file(s) &middot;{" "}
                  {(card.links ?? []).length} link(s)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(card)}
                  title="Edit"
                  className="p-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => togglePin(card)}
                  title={card.pinned ? "Unpin (remove featured)" : "Pin (feature)"}
                  className={`p-2 rounded-lg transition-colors ${
                    card.pinned
                      ? "text-primary-400 bg-primary-500/10"
                      : "text-secondary-400 hover:text-primary-400 hover:bg-secondary-700"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </button>
                {canAdminister(user) && (
                  <button
                    onClick={() => setDeleteId(card.id)}
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
          onClose={() => setFormOpen(false)}
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
                <Dialog.Panel className="w-full max-w-lg card p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
                  <Dialog.Title className="text-xl font-display font-bold text-secondary-100 mb-6">
                    {editingId ? "Edit Press Card" : "New Press Card"}
                  </Dialog.Title>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Title */}
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
                        placeholder="Press card title"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                        Description
                      </label>
                      <textarea
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="input-field resize-none"
                        placeholder="Describe this press material"
                      />
                    </div>

                    {/* Public toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary-300">
                        Public
                      </span>
                      <Switch
                        checked={isPublic}
                        onChange={setIsPublic}
                        className={`${
                          isPublic ? "bg-primary-500" : "bg-secondary-600"
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                      >
                        <span
                          className={`${
                            isPublic ? "translate-x-6" : "translate-x-1"
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>

                    {/* File Attachments */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-secondary-300">
                          File Attachments
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                          className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
                        >
                          <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                          {uploading ? "Uploading..." : "Upload Files"}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                      </div>

                      {attachments.length > 0 ? (
                        <div className="space-y-1.5">
                          {attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between bg-secondary-800 rounded-lg px-3 py-2"
                            >
                              <span className="text-sm text-secondary-300 truncate">
                                {att.filename}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAttachment(att.id)}
                                className="p-1 text-secondary-500 hover:text-red-400 transition-colors"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-secondary-500">
                          No files attached
                        </p>
                      )}
                    </div>

                    {/* External Links */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-secondary-300">
                          External Links
                        </span>
                        <button
                          type="button"
                          onClick={addLink}
                          className="text-xs text-primary-400 hover:text-primary-300 font-medium flex items-center gap-1"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Add Link
                        </button>
                      </div>

                      {links.length > 0 ? (
                        <div className="space-y-2">
                          {links.map((link, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2"
                            >
                              <input
                                type="url"
                                value={link.url}
                                onChange={(e) =>
                                  updateLink(idx, "url", e.target.value)
                                }
                                placeholder="https://..."
                                className="input-field text-sm !py-2 flex-1"
                              />
                              <input
                                type="text"
                                value={link.label}
                                onChange={(e) =>
                                  updateLink(idx, "label", e.target.value)
                                }
                                placeholder="Label"
                                className="input-field text-sm !py-2 w-32"
                              />
                              <button
                                type="button"
                                onClick={() => removeLink(idx)}
                                className="p-1.5 text-secondary-500 hover:text-red-400 transition-colors"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-secondary-500">
                          No links added
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
                            : "Create Card"}
                      </button>
                    </div>
                  </form>
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
                    Delete Press Card?
                  </Dialog.Title>
                  <p className="text-sm text-secondary-400 mb-6">
                    This will permanently remove the card and its attachments.
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
