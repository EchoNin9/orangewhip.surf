import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import { useAuth, hasRole, canEditContent } from "../../shell/AuthContext";
import type { Show } from "../shows/ShowsPage";
import type { MediaItem } from "../media/MediaPage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Venue {
  id: string;
  name: string;
  address?: string;
  info?: string;
  website?: string;
}

interface ShowFormData {
  title: string;
  date: string;
  description: string;
  venueId: string;
  mediaIds: string[];
  thumbnailMediaId: string;
}

const emptyForm: ShowFormData = {
  title: "",
  date: "",
  description: "",
  venueId: "",
  mediaIds: [],
  thumbnailMediaId: "",
};

/* ------------------------------------------------------------------ */
/*  Media Picker Modal                                                 */
/* ------------------------------------------------------------------ */

function MediaPickerModal({
  selectedIds,
  onSelect,
  onClose,
}: {
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  useEffect(() => {
    apiGet<MediaItem[]>("/media?limit=50")
      .then((items) => setMedia(items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onSelect(Array.from(selected));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-secondary-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-secondary-700">
          <h3 className="text-lg font-display font-bold text-white">Select Media</h3>
          <button onClick={onClose} className="text-secondary-400 hover:text-white">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-secondary-700/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : media.length === 0 ? (
            <p className="text-center text-secondary-400 py-8">No media available.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                    selected.has(m.id)
                      ? "border-primary-500 ring-2 ring-primary-500/30"
                      : "border-transparent hover:border-secondary-500"
                  }`}
                >
                  {m.thumbnail ? (
                    <img src={m.thumbnail} alt={m.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary-700 flex items-center justify-center text-secondary-500">
                      <PhotoIcon className="w-8 h-8" />
                    </div>
                  )}
                  {selected.has(m.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-secondary-700">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className="btn-primary text-sm">
            Confirm ({selected.size})
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Show Form                                                          */
/* ------------------------------------------------------------------ */

function ShowForm({
  initial,
  venues,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: ShowFormData;
  venues: Venue[];
  onSave: (data: ShowFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ShowFormData>(initial);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");

  const update = (partial: Partial<ShowFormData>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    try {
      const { uploadUrl: presigned, mediaId } = await apiPost<{
        uploadUrl: string;
        mediaId: string;
      }>("/media/upload", {
        filename: uploadFile.name,
        contentType: uploadFile.type,
      });
      await fetch(presigned, {
        method: "PUT",
        body: uploadFile,
        headers: { "Content-Type": uploadFile.type },
      });
      update({ mediaIds: [...form.mediaIds, mediaId] });
      setUploadFile(null);
    } catch {
      alert("Upload failed");
    }
  };

  const handleUrlImport = async () => {
    if (!uploadUrl.trim()) return;
    try {
      const { mediaId } = await apiPost<{ mediaId: string }>("/media/import-from-url", {
        url: uploadUrl.trim(),
      });
      update({ mediaIds: [...form.mediaIds, mediaId] });
      setUploadUrl("");
    } catch {
      alert("Import failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          className="input-field"
          required
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">Date</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => update({ date: e.target.value })}
          className="input-field"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          className="input-field min-h-[120px] resize-y"
          rows={4}
        />
      </div>

      {/* Venue (optional) */}
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">
          Venue <span className="text-secondary-500 font-normal">(optional)</span>
        </label>
        <select
          value={form.venueId}
          onChange={(e) => update({ venueId: e.target.value })}
          className="input-field"
        >
          <option value="">No venue selected</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <Link
          to="/admin/venues"
          className="mt-2 text-sm text-primary-400 hover:text-primary-300 transition-colors inline-flex items-center gap-1"
        >
          <PlusIcon className="w-4 h-4" />
          Manage Venues
        </Link>
      </div>

      {/* Media */}
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-2">Attached Media</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {form.mediaIds.length === 0 && (
            <p className="text-xs text-secondary-500">No media attached.</p>
          )}
          {form.mediaIds.map((mid) => (
            <span
              key={mid}
              className="inline-flex items-center gap-1 px-2 py-1 bg-secondary-700/50 rounded text-xs text-secondary-300"
            >
              {mid.slice(0, 8)}...
              <button
                type="button"
                onClick={() =>
                  update({ mediaIds: form.mediaIds.filter((x) => x !== mid) })
                }
                className="text-secondary-500 hover:text-red-400"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowMediaPicker(true)}
            className="btn-secondary text-xs"
          >
            <PhotoIcon className="w-4 h-4 mr-1" />
            Pick from Library
          </button>
        </div>

        {/* Direct upload */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="text-xs text-secondary-300 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-secondary-700 file:text-secondary-200 hover:file:bg-secondary-600"
            />
            {uploadFile && (
              <button type="button" onClick={handleFileUpload} className="btn-primary text-xs !px-3 !py-1">
                Upload
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="Or paste a URL..."
              value={uploadUrl}
              onChange={(e) => setUploadUrl(e.target.value)}
              className="input-field text-xs flex-1"
            />
            {uploadUrl && (
              <button type="button" onClick={handleUrlImport} className="btn-primary text-xs !px-3 !py-1">
                Import
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail */}
      {form.mediaIds.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-1">
            Thumbnail (select from attached media)
          </label>
          <select
            value={form.thumbnailMediaId}
            onChange={(e) => update({ thumbnailMediaId: e.target.value })}
            className="input-field"
          >
            <option value="">Auto-select</option>
            {form.mediaIds.map((mid) => (
              <option key={mid} value={mid}>
                {mid.slice(0, 12)}...
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? "Saving..." : "Save Show"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>

      {/* Media picker modal */}
      <AnimatePresence>
        {showMediaPicker && (
          <MediaPickerModal
            selectedIds={form.mediaIds}
            onSelect={(ids) => update({ mediaIds: ids })}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
      </AnimatePresence>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ShowsAdminPage() {
  const { user } = useAuth();
  const [shows, setShows] = useState<Show[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingShow, setEditingShow] = useState<Show | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const isAdmin = hasRole(user, "admin");
  const isEditor = canEditContent(user);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [showsData, venuesData] = await Promise.all([
        apiGet<Show[]>("/shows"),
        apiGet<Venue[]>("/venues"),
      ]);
      setShows(showsData);
      setVenues(venuesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isEditor) {
    return (
      <main className="container-max section-padding text-center">
        <p className="text-secondary-400 text-lg">You don't have permission to manage shows.</p>
        <Link to="/" className="btn-secondary text-sm mt-4 inline-block">
          Go Home
        </Link>
      </main>
    );
  }

  const handleCreate = async (data: ShowFormData) => {
    setSaving(true);
    try {
      await apiPost("/shows", data);
      setMode("list");
      await fetchData();
    } catch {
      alert("Failed to create show");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: ShowFormData) => {
    if (!editingShow) return;
    setSaving(true);
    try {
      await apiPut(`/shows?id=${editingShow.id}`, data);
      setMode("list");
      setEditingShow(null);
      await fetchData();
    } catch {
      alert("Failed to update show");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/shows?id=${id}`);
      setConfirmDelete(null);
      await fetchData();
    } catch {
      alert("Failed to delete show");
    }
  };

  const startEdit = (show: Show) => {
    setEditingShow(show);
    setMode("edit");
  };

  return (
    <main className="container-max section-padding">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-white">Manage Shows</h1>
        {mode === "list" && (
          <button onClick={() => setMode("create")} className="btn-primary text-sm">
            <PlusIcon className="w-4 h-4 mr-1 inline" />
            New Show
          </button>
        )}
      </div>

      {error && (
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchData} className="btn-secondary text-sm">
            Retry
          </button>
        </div>
      )}

      {/* Create / Edit form */}
      {(mode === "create" || mode === "edit") && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 mb-8"
        >
          <h2 className="text-xl font-display font-bold text-white mb-6">
            {mode === "create" ? "Create New Show" : `Edit: ${editingShow?.title}`}
          </h2>
          <ShowForm
            initial={
              mode === "edit" && editingShow
                ? {
                    title: editingShow.title,
                    date: editingShow.date.slice(0, 10),
                    description: editingShow.description ?? "",
                    venueId: editingShow.venueId ?? "",
                    mediaIds: editingShow.mediaIds ?? editingShow.media?.map((m) => m.id).filter(Boolean) ?? [],
                    thumbnailMediaId: editingShow.thumbnailMediaId ?? "",
                  }
                : emptyForm
            }
            venues={venues}
            onSave={mode === "create" ? handleCreate : handleUpdate}
            onCancel={() => {
              setMode("list");
              setEditingShow(null);
            }}
            isSaving={saving}
          />
        </motion.div>
      )}

      {/* Shows list */}
      {mode === "list" && !loading && (
        <div className="space-y-3">
          {shows.length === 0 && (
            <p className="text-secondary-400 text-center py-12">
              No shows yet. Create your first one!
            </p>
          )}
          {shows.map((show) => (
            <motion.div
              key={show.id}
              layout
              className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary-700 shrink-0">
                {show.thumbnail ? (
                  <img src={show.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-secondary-500">
                    <PhotoIcon className="w-6 h-6" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{show.title}</h3>
                <p className="text-sm text-secondary-400">
                  {new Date(show.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  &middot; {show.venue?.name}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(show)}
                  className="p-2 rounded-lg text-secondary-400 hover:text-primary-400 hover:bg-secondary-700/50 transition-colors"
                  title="Edit"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </button>
                {isAdmin && (
                  <>
                    {confirmDelete === show.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(show.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 text-xs text-secondary-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(show.id)}
                        className="p-2 rounded-lg text-secondary-400 hover:text-red-400 hover:bg-secondary-700/50 transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-lg bg-secondary-700/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary-700/50 rounded w-1/3" />
                <div className="h-3 bg-secondary-700/50 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
