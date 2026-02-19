import { useState, useEffect, useRef, useCallback, Fragment, type FormEvent, type DragEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Tab, Dialog, Transition } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloudArrowUpIcon,
  LinkIcon,
  TrashIcon,
  PencilSquareIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  TagIcon,
  PhotoIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import { useAuth, hasRole, canManageMedia, canAdminister } from "../../shell/AuthContext";
import type { MediaFile } from "../media/MediaPage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MediaType = "audio" | "video" | "image";

interface Category {
  id: string;
  name: string;
}

/** A file queued for upload (local) */
interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string | null;
  uploading: boolean;
  uploaded: boolean;
  s3Key: string;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const MAX_FILES = 15;

function detectType(file: File): MediaType {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "image";
}

function detectTypeFromUrl(url: string): MediaType {
  const lower = url.toLowerCase();
  if (/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/.test(lower)) return "audio";
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/.test(lower)) return "video";
  return "image";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isVisualFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function generateFileId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/*  Edit Media types                                                   */
/* ------------------------------------------------------------------ */

interface EditMediaItem {
  id: string;
  title: string;
  type: MediaType;
  mediaType?: string;
  url: string;
  thumbnail?: string;
  thumbnailKey?: string;
  format?: string;
  filesize?: number;
  categories?: string[];
  public?: boolean;
  files?: MediaFile[];
}

/* ------------------------------------------------------------------ */
/*  Upload Tab                                                         */
/* ------------------------------------------------------------------ */

function UploadTab({ categories }: { categories: Category[] }) {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("image");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [thumbIdx, setThumbIdx] = useState<number>(0); // index into queue for thumbnail
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [success, setSuccess] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      queue.forEach((q) => {
        if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect type from first file added
  useEffect(() => {
    if (queue.length > 0 && !title) {
      const first = queue[0].file;
      setTitle(first.name.replace(/\.[^.]+$/, ""));
    }
    if (queue.length > 0) {
      setType(detectType(queue[0].file));
    }
  }, [queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview URL on paste/enter
  useEffect(() => {
    if (mode !== "url" || !url.trim()) return;
    setType(detectTypeFromUrl(url));
  }, [url, mode]);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = MAX_FILES - queue.length;
    if (remaining <= 0) return;
    const toAdd = arr.slice(0, remaining);
    const newItems: QueuedFile[] = toAdd.map((f) => ({
      id: generateFileId(),
      file: f,
      previewUrl: isVisualFile(f) ? URL.createObjectURL(f) : null,
      uploading: false,
      uploaded: false,
      s3Key: "",
      error: null,
    }));
    setQueue((prev) => [...prev, ...newItems]);
    setMode("file");
  };

  const removeFile = (id: string) => {
    setQueue((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      const next = prev.filter((q) => q.id !== id);
      // Reset thumb index if it's now out of bounds
      setThumbIdx((ti) => (ti >= next.length ? 0 : ti));
      return next;
    });
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const toggleCat = (id: string) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleUpload = async () => {
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      if (mode === "url" && url.trim()) {
        const { mediaId } = await apiPost<{ mediaId: string }>("/media/import-from-url", {
          url: url.trim(),
          title: title.trim() || undefined,
          mediaType: type,
          categories: selectedCats,
          public: isPublic,
        });
        setSuccess({ id: mediaId });
        setUrl("");
        setTitle("");
        setSelectedCats([]);
        setIsPublic(true);
        return;
      }

      // File mode: upload all files, then create one media record
      if (queue.length === 0) return;

      // 1) Get a single mediaId for this group
      const firstFile = queue[0].file;
      const { mediaId } = await apiPost<{
        uploadUrl: string;
        mediaId: string;
        s3Key: string;
      }>("/media/upload", {
        filename: firstFile.name,
        mediaType: type,
        contentType: firstFile.type,
      });

      // 2) Upload each file to S3
      const uploadedFiles: { s3Key: string; filename: string; contentType: string; filesize: number }[] = [];

      for (let i = 0; i < queue.length; i++) {
        const q = queue[i];
        setUploadProgress(`Uploading ${i + 1} of ${queue.length}: ${q.file.name}`);

        // Get presigned URL for each file (reuse mediaId)
        const { uploadUrl, s3Key } = await apiPost<{
          uploadUrl: string;
          mediaId: string;
          s3Key: string;
        }>("/media/upload", {
          filename: q.file.name,
          mediaType: type,
          contentType: q.file.type,
          mediaId, // pass same mediaId so files are grouped
        });

        // PUT to S3
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: q.file,
          headers: { "Content-Type": q.file.type },
        });
        if (!putRes.ok) {
          throw new Error(`S3 upload failed for ${q.file.name} (${putRes.status})`);
        }

        uploadedFiles.push({
          s3Key,
          filename: q.file.name,
          contentType: q.file.type,
          filesize: q.file.size,
        });

        // Mark file as uploaded in queue
        setQueue((prev) =>
          prev.map((item) => (item.id === q.id ? { ...item, uploaded: true, s3Key } : item)),
        );
      }

      setUploadProgress("Creating media record...");

      // 3) Determine thumbnail: only use image files as thumbnail source.
      //    Video/audio s3Keys can't be rendered in <img> — the thumb Lambda
      //    will async-generate thumbnails for those via MediaConvert.
      const chosenFile = uploadedFiles[thumbIdx] || uploadedFiles[0];
      const thumbnailKey =
        chosenFile && chosenFile.contentType.startsWith("image/")
          ? chosenFile.s3Key
          : (uploadedFiles.find((f) => f.contentType.startsWith("image/"))?.s3Key || "");

      // 4) Create media record with files array
      await apiPost("/media", {
        id: mediaId,
        title: title.trim() || firstFile.name,
        mediaType: type,
        format: firstFile.name.split(".").pop() || "",
        filesize: uploadedFiles.reduce((sum, f) => sum + f.filesize, 0),
        s3Key: uploadedFiles[0]?.s3Key || "",
        thumbnailKey,
        files: uploadedFiles,
        categories: selectedCats,
        public: isPublic,
      });

      setSuccess({ id: mediaId });

      // Reset form
      queue.forEach((q) => { if (q.previewUrl) URL.revokeObjectURL(q.previewUrl); });
      setQueue([]);
      setUrl("");
      setTitle("");
      setSelectedCats([]);
      setIsPublic(true);
      setThumbIdx(0);
      setUploadProgress("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="upload-mode"
            checked={mode === "file"}
            onChange={() => setMode("file")}
            className="accent-primary-500"
          />
          <CloudArrowUpIcon className="w-4 h-4 text-secondary-400" />
          <span className="text-sm text-secondary-200">Choose Files</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="upload-mode"
            checked={mode === "url"}
            onChange={() => setMode("url")}
            className="accent-primary-500"
          />
          <LinkIcon className="w-4 h-4 text-secondary-400" />
          <span className="text-sm text-secondary-200">From URL</span>
        </label>
      </div>

      {/* File mode */}
      {mode === "file" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragging
                ? "border-primary-500 bg-primary-500/10"
                : "border-secondary-600 hover:border-secondary-500"
            }`}
          >
            <CloudArrowUpIcon className="mx-auto w-10 h-10 text-secondary-500 mb-3" />
            <p className="text-secondary-300 text-sm mb-1">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-secondary-500 text-xs mb-3">
              Up to {MAX_FILES} images/videos per media item ({queue.length}/{MAX_FILES})
            </p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
              disabled={queue.length >= MAX_FILES}
              className="text-xs text-secondary-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-secondary-700 file:text-secondary-200 hover:file:bg-secondary-600 cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* File queue grid */}
          {queue.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-2">
                Files ({queue.length}/{MAX_FILES})
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {queue.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`relative group rounded-lg overflow-hidden bg-secondary-800 border-2 transition-colors ${
                      idx === thumbIdx
                        ? "border-primary-500 ring-2 ring-primary-500/30"
                        : "border-secondary-700"
                    }`}
                  >
                    {/* Preview */}
                    <div className="aspect-square flex items-center justify-center">
                      {q.previewUrl && q.file.type.startsWith("image/") ? (
                        <img
                          src={q.previewUrl}
                          alt={q.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : q.previewUrl && q.file.type.startsWith("video/") ? (
                        <video
                          src={`${q.previewUrl}#t=0.1`}
                          muted
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-secondary-500 text-xs text-center p-2">
                          {q.file.name}
                        </div>
                      )}
                    </div>

                    {/* Thumb badge */}
                    {idx === thumbIdx && (
                      <div className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                        THUMB
                      </div>
                    )}

                    {/* Uploaded check */}
                    {q.uploaded && (
                      <div className="absolute top-1 right-7 bg-green-500 text-white rounded-full p-0.5">
                        <CheckIcon className="w-3 h-3" />
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeFile(q.id)}
                      disabled={uploading}
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>

                    {/* Filename + size */}
                    <div className="px-1.5 py-1 bg-secondary-800/90">
                      <p className="text-[10px] text-secondary-300 truncate">{q.file.name}</p>
                      <p className="text-[10px] text-secondary-500">{formatBytes(q.file.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thumbnail selector */}
          {queue.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1">
                <PhotoIcon className="w-4 h-4 inline mr-1" />
                Thumbnail
              </label>
              <select
                value={thumbIdx}
                onChange={(e) => setThumbIdx(Number(e.target.value))}
                className="input-field"
              >
                <option value={0}>Auto (first file)</option>
                {queue.map((q, idx) => (
                  <option key={q.id} value={idx}>
                    {q.file.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* URL mode */}
      {mode === "url" && (
        <div>
          <input
            type="url"
            placeholder="https://example.com/media-file.jpg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="input-field"
          />
        </div>
      )}

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder="Media title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-1">
            Type (auto-detected)
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MediaType)}
            className="input-field"
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>
        </div>
      </div>

      {/* Categories multi-select */}
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-2">Categories</label>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && (
            <p className="text-xs text-secondary-500">No categories defined yet.</p>
          )}
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCat(cat.id)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                selectedCats.includes(cat.id)
                  ? "border-primary-500 bg-primary-500/20 text-primary-300"
                  : "border-secondary-600 text-secondary-400 hover:border-secondary-500"
              }`}
            >
              <TagIcon className="w-3 h-3" />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Public toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          className={`relative w-10 h-6 rounded-full transition-colors ${
            isPublic ? "bg-primary-500" : "bg-secondary-600"
          }`}
          onClick={() => setIsPublic((p) => !p)}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              isPublic ? "left-5" : "left-1"
            }`}
          />
        </div>
        <span className="text-sm text-secondary-200">Public</span>
      </label>

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={uploading || (mode === "file" && queue.length === 0) || (mode === "url" && !url.trim())}
        className="btn-primary"
      >
        {uploading ? uploadProgress || "Uploading..." : `Upload${queue.length > 1 ? ` (${queue.length} files)` : ""}`}
      </button>

      {/* Success */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card p-4 border-green-500/30 bg-green-900/20"
          >
            <p className="text-green-400 text-sm flex items-center gap-2">
              <CheckIcon className="w-5 h-5" />
              Media uploaded successfully!
            </p>
            <Link
              to={`/media/${success.id}`}
              className="text-primary-400 hover:text-primary-300 text-sm mt-2 inline-block"
            >
              View media item &rarr;
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-500/30 bg-red-900/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Categories Tab                                                     */
/* ------------------------------------------------------------------ */

function CategoriesTab() {
  const { user } = useAuth();
  const isManager = hasRole(user, "manager");

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiGet<Category[]>("/categories");
      setCategories(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  if (!isManager) {
    return (
      <div className="text-center py-12">
        <p className="text-secondary-400">Only managers and admins can manage categories.</p>
      </div>
    );
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const cat = await apiPost<Category>("/categories", { name: newName.trim() });
      setCategories((prev) => [...prev, cat]);
      setNewName("");
    } catch {
      alert("Failed to create category");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiPut(`/categories?id=${id}`, { name: editName.trim() });
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: editName.trim() } : c)));
      setEditingId(null);
    } catch {
      alert("Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      await apiDelete(`/categories?id=${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to delete category");
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  return (
    <div className="space-y-6">
      {/* Add new */}
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          type="text"
          placeholder="New category name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="input-field flex-1"
        />
        <button type="submit" disabled={saving || !newName.trim()} className="btn-primary text-sm">
          <PlusIcon className="w-4 h-4 mr-1 inline" />
          Add
        </button>
      </form>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-secondary-700/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <p className="text-secondary-400 text-center py-8">No categories yet.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="card px-4 py-3 flex items-center gap-3"
            >
              {editingId === cat.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(cat.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleUpdate(cat.id)}
                    disabled={saving}
                    className="p-1.5 rounded text-green-400 hover:bg-secondary-700/50"
                  >
                    <CheckIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded text-secondary-400 hover:bg-secondary-700/50"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <TagIcon className="w-4 h-4 text-primary-400 shrink-0" />
                  <span className="text-secondary-200 flex-1">{cat.name}</span>
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 rounded text-secondary-400 hover:text-primary-400 hover:bg-secondary-700/50 transition-colors"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-1.5 rounded text-secondary-400 hover:text-red-400 hover:bg-secondary-700/50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MediaAdminPage() {
  const { user } = useAuth();
  const canMedia = canManageMedia(user);
  const isManager = hasRole(user, "manager");
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);

  /* ── Edit modal state (lives in parent, pre-filled before open) ── */
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<EditMediaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<MediaType>("image");
  const [editCats, setEditCats] = useState<string[]>([]);
  const [editPublic, setEditPublic] = useState(true);
  const [editFiles, setEditFiles] = useState<MediaFile[]>([]);
  const [editThumbKey, setEditThumbKey] = useState<string>("");
  const [editNewFiles, setEditNewFiles] = useState<QueuedFile[]>([]);
  const [editAudioThumbFile, setEditAudioThumbFile] = useState<File | null>(null);
  const [editAudioThumbPreview, setEditAudioThumbPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);
  const editAudioThumbRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  /* ── Open edit modal — pre-fill state THEN open ── */
  function openEditModal(item: EditMediaItem) {
    setEditItem(item);
    setEditTitle(item.title || "");
    setEditType(item.type || (item.mediaType as MediaType) || "image");
    setEditCats(item.categories || []);
    setEditPublic(item.public !== false);
    setEditFiles(item.files || []);
    setEditThumbKey(item.thumbnailKey || "");
    setEditNewFiles([]);
    setEditAudioThumbFile(null);
    setEditAudioThumbPreview(null);
    setEditError(null);
    setEditSaving(false);
    setEditOpen(true);
  }

  /* ── Auto-open edit modal from URL param ?edit=<id> ── */
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    setEditLoading(true);
    apiGet<EditMediaItem>(`/media?id=${editId}`)
      .then((item) => {
        openEditModal(item);
      })
      .catch(() => {
        // Item not found — clear param silently
        setSearchParams((prev) => { prev.delete("edit"); return prev; }, { replace: true });
      })
      .finally(() => setEditLoading(false));
    // Run only when the edit param changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("edit")]);

  function closeEditModal() {
    setEditOpen(false);
    setEditItem(null);
    // Clean up new file previews
    editNewFiles.forEach((q) => { if (q.previewUrl) URL.revokeObjectURL(q.previewUrl); });
    setEditNewFiles([]);
    if (editAudioThumbPreview) URL.revokeObjectURL(editAudioThumbPreview);
    setEditAudioThumbFile(null);
    setEditAudioThumbPreview(null);
    setSearchParams((prev) => { prev.delete("edit"); return prev; }, { replace: true });
  }

  function addEditFiles(files: FileList | File[]) {
    const totalCurrent = editFiles.length + editNewFiles.length;
    const remaining = MAX_FILES - totalCurrent;
    if (remaining <= 0) return;
    const arr = Array.from(files).slice(0, remaining);
    const newItems: QueuedFile[] = arr.map((f) => ({
      id: generateFileId(),
      file: f,
      previewUrl: isVisualFile(f) ? URL.createObjectURL(f) : null,
      uploading: false,
      uploaded: false,
      s3Key: "",
      error: null,
    }));
    setEditNewFiles((prev) => [...prev, ...newItems]);
  }

  function removeExistingFile(s3Key: string) {
    setEditFiles((prev) => prev.filter((f) => f.s3Key !== s3Key));
    // If removed file was the thumbnail, auto-select new one
    if (editThumbKey === s3Key) {
      const remaining = editFiles.filter((f) => f.s3Key !== s3Key);
      setEditThumbKey(remaining[0]?.s3Key || "");
    }
  }

  function removeNewFile(id: string) {
    setEditNewFiles((prev) => {
      const item = prev.find((q) => q.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((q) => q.id !== id);
    });
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setEditSaving(true);
    setEditError(null);

    try {
      // 1) Upload any new files to S3
      const uploadedNewFiles: MediaFile[] = [];
      for (const q of editNewFiles) {
        const { uploadUrl, s3Key } = await apiPost<{
          uploadUrl: string;
          mediaId: string;
          s3Key: string;
        }>("/media/upload", {
          filename: q.file.name,
          mediaType: editType,
          contentType: q.file.type,
          mediaId: editItem.id,
        });

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: q.file,
          headers: { "Content-Type": q.file.type },
        });
        if (!putRes.ok) {
          throw new Error(`Upload failed for ${q.file.name} (${putRes.status})`);
        }

        uploadedNewFiles.push({
          s3Key,
          url: "", // will be enriched by API
          filename: q.file.name,
          contentType: q.file.type,
          filesize: q.file.size,
        });
      }

      // 2) Combine existing + new files
      const allFiles = [
        ...editFiles.map((f) => ({
          s3Key: f.s3Key,
          filename: f.filename,
          contentType: f.contentType,
          filesize: f.filesize,
        })),
        ...uploadedNewFiles.map((f) => ({
          s3Key: f.s3Key,
          filename: f.filename,
          contentType: f.contentType,
          filesize: f.filesize,
        })),
      ];

      // 3) Determine thumbnail
      let thumbKey = editThumbKey;

      // For audio: handle cover art removal
      if (editType === "audio" && thumbKey === "__remove__") {
        thumbKey = "";
      }

      // For audio: upload cover art if a new file was chosen
      if (editType === "audio" && editAudioThumbFile) {
        const { uploadUrl, s3Key: coverKey } = await apiPost<{
          uploadUrl: string;
          s3Key: string;
        }>("/media/thumbnail-upload", {
          mediaId: editItem.id,
          filename: editAudioThumbFile.name,
        });
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: editAudioThumbFile,
          headers: { "Content-Type": editAudioThumbFile.type },
        });
        if (!putRes.ok) {
          throw new Error(`Cover art upload failed (${putRes.status})`);
        }
        thumbKey = coverKey;
      }

      // For image/video with multiple files: thumbnail is mandatory
      if (editType !== "audio" && allFiles.length > 1) {
        // Only image s3Keys are valid thumbnails
        const imageFileKeys = new Set(
          allFiles.filter((f) => f.contentType?.startsWith("image/")).map((f) => f.s3Key),
        );
        const isValidThumb =
          thumbKey &&
          (imageFileKeys.has(thumbKey) ||
            thumbKey.startsWith("thumbnails/"));

        if (!isValidThumb) {
          // Try auto-selecting first image
          const firstImage = allFiles.find((f) => f.contentType?.startsWith("image/"));
          if (firstImage) {
            thumbKey = firstImage.s3Key;
          } else {
            setEditError("Please add at least one image file or select a thumbnail.");
            setEditSaving(false);
            return;
          }
        }
      }

      // Fallback: pick first image file if no explicit thumb
      if (!thumbKey && allFiles.length > 0) {
        const firstImage = allFiles.find((f) => f.contentType?.startsWith("image/"));
        if (firstImage) thumbKey = firstImage.s3Key;
      }

      // 4) Save
      await apiPut(`/media?id=${editItem.id}`, {
        id: editItem.id,
        title: editTitle.trim(),
        mediaType: editType,
        categories: editCats,
        public: editPublic,
        files: allFiles,
        thumbnailKey: thumbKey,
      });

      closeEditModal();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEditSaving(false);
    }
  }

  function toggleEditCat(id: string) {
    setEditCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  const editTotalFiles = editFiles.length + editNewFiles.length;

  if (!canMedia) {
    return (
      <main className="container-max section-padding text-center">
        <p className="text-secondary-400 text-lg">You don't have permission to manage media.</p>
        <Link to="/" className="btn-secondary text-sm mt-4 inline-block">
          Go Home
        </Link>
      </main>
    );
  }

  // Build tabs list conditionally
  const tabs = [
    { label: "Upload", key: "upload" },
    ...(isManager ? [{ label: "Categories", key: "categories" }] : []),
  ];

  return (
    <main className="container-max section-padding">
      <h1 className="text-3xl font-display font-bold text-white mb-8">Manage Media</h1>

      {/* Loading indicator for edit fetch */}
      {editLoading && (
        <div className="text-center py-4 mb-4">
          <div className="inline-block w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary-400 text-sm mt-2">Loading media item...</p>
        </div>
      )}

      <Tab.Group>
        <Tab.List className="flex gap-1 bg-secondary-800/50 rounded-xl p-1 mb-8 max-w-xs">
          {tabs.map((tab) => (
            <Tab
              key={tab.key}
              className={({ selected }) =>
                `flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors outline-none ${
                  selected
                    ? "bg-primary-500 text-white shadow"
                    : "text-secondary-400 hover:text-white hover:bg-secondary-700/50"
                }`
              }
            >
              {tab.label}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels>
          <Tab.Panel>
            <UploadTab categories={categories} />
          </Tab.Panel>
          {isManager && (
            <Tab.Panel>
              <CategoriesTab />
            </Tab.Panel>
          )}
        </Tab.Panels>
      </Tab.Group>

      {/* ── Edit Media Modal ── */}
      <Transition appear show={editOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeEditModal}>
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
                <Dialog.Panel className="w-full max-w-2xl card p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <Dialog.Title className="text-xl font-display font-bold text-secondary-100">
                      Edit Media
                    </Dialog.Title>
                    {canAdminister(user) && editItem && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editItem || !confirm("Delete this media item permanently?")) return;
                          try {
                            await apiDelete(`/media?id=${editItem.id}`);
                            closeEditModal();
                          } catch (err) {
                            setEditError(err instanceof Error ? err.message : "Failed to delete");
                          }
                        }}
                        disabled={editSaving}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleEditSubmit} className="space-y-5">
                    {/* ── Audio Cover Art section ── */}
                    {editType === "audio" && (
                      <div>
                        <label className="block text-sm font-medium text-secondary-300 mb-2">
                          <PhotoIcon className="w-4 h-4 inline mr-1" />
                          Cover Art
                        </label>
                        <div className="flex items-start gap-4">
                          {/* Current or new cover preview */}
                          <div className="w-32 h-32 rounded-lg overflow-hidden bg-secondary-800 border-2 border-secondary-700 shrink-0 flex items-center justify-center">
                            {editAudioThumbPreview ? (
                              <img
                                src={editAudioThumbPreview}
                                alt="New cover art"
                                className="w-full h-full object-cover"
                              />
                            ) : editItem?.thumbnail ? (
                              <img
                                src={editItem.thumbnail}
                                alt="Current cover art"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="text-center text-secondary-500">
                                <svg className="w-8 h-8 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                                </svg>
                                <span className="text-[10px]">No cover</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => editAudioThumbRef.current?.click()}
                              disabled={editSaving}
                              className="btn-secondary text-sm inline-flex items-center gap-2"
                            >
                              <CloudArrowUpIcon className="w-4 h-4" />
                              {editItem?.thumbnail || editAudioThumbFile ? "Replace" : "Upload"} Cover Art
                            </button>
                            {(editAudioThumbFile || editItem?.thumbnail) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (editAudioThumbPreview) URL.revokeObjectURL(editAudioThumbPreview);
                                  setEditAudioThumbFile(null);
                                  setEditAudioThumbPreview(null);
                                  setEditThumbKey("__remove__");
                                }}
                                disabled={editSaving}
                                className="block text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Remove cover art
                              </button>
                            )}
                            {editAudioThumbFile && (
                              <p className="text-xs text-primary-400">
                                New: {editAudioThumbFile.name}
                              </p>
                            )}
                            <input
                              ref={editAudioThumbRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  if (editAudioThumbPreview) URL.revokeObjectURL(editAudioThumbPreview);
                                  setEditAudioThumbFile(f);
                                  setEditAudioThumbPreview(URL.createObjectURL(f));
                                  setEditThumbKey(""); // will be set on save
                                }
                                e.target.value = "";
                              }}
                              className="hidden"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Existing files grid (image/video only) ── */}
                    {editType !== "audio" && (editFiles.length > 0 || editNewFiles.length > 0) && (
                      <div>
                        <label className="block text-sm font-medium text-secondary-300 mb-2">
                          Files ({editTotalFiles}/{MAX_FILES})
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                          {editFiles.map((f) => {
                            const isThumb = editThumbKey === f.s3Key;
                            const isImage = f.contentType?.startsWith("image/");
                            const isVideo = f.contentType?.startsWith("video/");
                            return (
                              <div
                                key={f.s3Key}
                                className={`relative group rounded-lg overflow-hidden bg-secondary-800 border-2 transition-colors ${
                                  isImage ? "cursor-pointer" : ""
                                } ${
                                  isThumb
                                    ? "border-primary-500 ring-2 ring-primary-500/30"
                                    : "border-secondary-700 hover:border-secondary-500"
                                }`}
                                onClick={() => {
                                  if (isImage) setEditThumbKey(f.s3Key);
                                }}
                              >
                                <div className="aspect-square flex items-center justify-center">
                                  {isImage && f.url ? (
                                    <img
                                      src={f.url}
                                      alt={f.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : isVideo && f.url ? (
                                    <video
                                      src={`${f.url}#t=0.1`}
                                      muted
                                      preload="metadata"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="text-secondary-500 text-xs text-center p-2">
                                      {f.filename || "file"}
                                    </div>
                                  )}
                                </div>
                                {isThumb && (
                                  <div className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                                    THUMB
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={(ev) => { ev.stopPropagation(); removeExistingFile(f.s3Key); }}
                                  disabled={editSaving}
                                  className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <XMarkIcon className="w-3 h-3" />
                                </button>
                                <div className="px-1.5 py-1 bg-secondary-800/90">
                                  <p className="text-[10px] text-secondary-300 truncate">
                                    {f.filename || f.s3Key.split("/").pop()}
                                  </p>
                                  {f.filesize > 0 && (
                                    <p className="text-[10px] text-secondary-500">
                                      {formatBytes(f.filesize)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* New files queued for upload */}
                          {editNewFiles.map((q) => (
                            <div
                              key={q.id}
                              className="relative group rounded-lg overflow-hidden bg-secondary-800 border-2 border-dashed border-primary-500/50"
                            >
                              <div className="aspect-square flex items-center justify-center">
                                {q.previewUrl && q.file.type.startsWith("image/") ? (
                                  <img
                                    src={q.previewUrl}
                                    alt={q.file.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : q.previewUrl && q.file.type.startsWith("video/") ? (
                                  <video
                                    src={`${q.previewUrl}#t=0.1`}
                                    muted
                                    preload="metadata"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="text-secondary-500 text-xs text-center p-2">
                                    {q.file.name}
                                  </div>
                                )}
                              </div>
                              <div className="absolute top-1 left-1 bg-primary-500/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                NEW
                              </div>
                              <button
                                type="button"
                                onClick={() => removeNewFile(q.id)}
                                disabled={editSaving}
                                className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                              <div className="px-1.5 py-1 bg-secondary-800/90">
                                <p className="text-[10px] text-secondary-300 truncate">{q.file.name}</p>
                                <p className="text-[10px] text-secondary-500">{formatBytes(q.file.size)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No files yet for image/video — show message */}
                    {editType !== "audio" && editFiles.length === 0 && editNewFiles.length === 0 && (
                      <div className="text-center py-4 text-secondary-500 text-sm">
                        No files attached. Add files below.
                      </div>
                    )}

                    {/* Add more files (image/video only) */}
                    {editType !== "audio" && editTotalFiles < MAX_FILES && (
                      <div>
                        <button
                          type="button"
                          onClick={() => editFileRef.current?.click()}
                          disabled={editSaving}
                          className="btn-secondary text-sm inline-flex items-center gap-2"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Add Files ({editTotalFiles}/{MAX_FILES})
                        </button>
                        <input
                          ref={editFileRef}
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={(e) => {
                            if (e.target.files) addEditFiles(e.target.files);
                            e.target.value = "";
                          }}
                          className="hidden"
                        />
                      </div>
                    )}

                    {/* Thumbnail selector dropdown (image/video items only) */}
                    {editType !== "audio" && editTotalFiles > 1 && (() => {
                      const imageOptions = editFiles.filter((f) => f.contentType?.startsWith("image/"));
                      const hasGenerated = editThumbKey.startsWith("thumbnails/");
                      const isMandatory = editTotalFiles > 1;
                      return (
                        <div>
                          <label className="block text-sm font-medium text-secondary-300 mb-1">
                            <PhotoIcon className="w-4 h-4 inline mr-1" />
                            Thumbnail
                            {isMandatory && <span className="text-red-400 ml-1">*</span>}
                          </label>
                          <select
                            value={editThumbKey}
                            onChange={(e) => setEditThumbKey(e.target.value)}
                            className={`input-field ${isMandatory && !editThumbKey ? "border-red-500/50" : ""}`}
                            required={isMandatory}
                          >
                            {!isMandatory && <option value="">Auto (first image)</option>}
                            {isMandatory && !editThumbKey && (
                              <option value="" disabled>-- Select a thumbnail --</option>
                            )}
                            {hasGenerated && (
                              <option value={editThumbKey}>Current generated thumbnail</option>
                            )}
                            {imageOptions.map((f) => (
                              <option key={f.s3Key} value={f.s3Key}>
                                {f.filename || f.s3Key.split("/").pop()}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-secondary-500 mt-1">
                            {imageOptions.length > 0
                              ? "Click an image above or use this dropdown. Only image files can be thumbnails."
                              : "Add at least one image file to use as a thumbnail."}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1">Title</label>
                      <input
                        type="text"
                        required
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="input-field"
                        placeholder="Media title"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1">Type</label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as MediaType)}
                        className="input-field"
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="audio">Audio</option>
                      </select>
                    </div>

                    {/* Categories */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-2">Categories</label>
                      <div className="flex flex-wrap gap-2">
                        {categories.length === 0 && (
                          <p className="text-xs text-secondary-500">No categories defined yet.</p>
                        )}
                        {categories.map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleEditCat(cat.id)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-full border transition-colors ${
                              editCats.includes(cat.id)
                                ? "border-primary-500 bg-primary-500/20 text-primary-300"
                                : "border-secondary-600 text-secondary-400 hover:border-secondary-500"
                            }`}
                          >
                            <TagIcon className="w-3 h-3" />
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Public toggle */}
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        className={`relative w-10 h-6 rounded-full transition-colors ${
                          editPublic ? "bg-primary-500" : "bg-secondary-600"
                        }`}
                        onClick={() => setEditPublic((p) => !p)}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            editPublic ? "left-5" : "left-1"
                          }`}
                        />
                      </div>
                      <span className="text-sm text-secondary-200">Public</span>
                    </label>

                    {/* Error */}
                    {editError && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {editError}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeEditModal}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button type="submit" disabled={editSaving} className="btn-primary text-sm">
                        {editSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </main>
  );
}
