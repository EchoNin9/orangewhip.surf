import { useState, useEffect, useRef, useCallback, type FormEvent, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { Tab } from "@headlessui/react";
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
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import { useAuth, hasRole, canManageMedia } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MediaType = "audio" | "video" | "image";

interface Category {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Upload Tab                                                         */
/* ------------------------------------------------------------------ */

function UploadTab({ categories }: { categories: Category[] }) {
  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("image");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Generate preview when file changes
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    setType(detectType(file));
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));

    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreview(null);
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview URL on paste/enter
  useEffect(() => {
    if (mode !== "url" || !url.trim()) {
      setPreview(null);
      return;
    }
    setType(detectTypeFromUrl(url));
    setPreview(url);
  }, [url, mode]);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      setMode("file");
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
      if (mode === "file" && file) {
        // 1) Get presigned URL
        const { uploadUrl, mediaId, s3Key } = await apiPost<{
          uploadUrl: string;
          mediaId: string;
          s3Key: string;
        }>("/media/upload", {
          filename: file.name,
          contentType: file.type,
        });

        // 2) PUT directly to S3
        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        // 3) Create media record in DynamoDB
        await apiPost("/media", {
          id: mediaId,
          title: title.trim() || file.name,
          mediaType: type,
          format: file.name.split(".").pop() || "",
          filesize: file.size,
          s3Key,
          categories: selectedCats,
          public: isPublic,
        });

        setSuccess({ id: mediaId });
      } else if (mode === "url" && url.trim()) {
        const { mediaId } = await apiPost<{ mediaId: string }>("/media/import-from-url", {
          url: url.trim(),
          title: title.trim() || undefined,
          mediaType: type,
          categories: selectedCats,
          public: isPublic,
        });
        setSuccess({ id: mediaId });
      }

      // Reset form
      setFile(null);
      setUrl("");
      setTitle("");
      setSelectedCats([]);
      setIsPublic(true);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
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
          <span className="text-sm text-secondary-200">Choose File</span>
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
          <p className="text-secondary-300 text-sm mb-3">
            Drag & drop a file here, or click to browse
          </p>
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs text-secondary-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-secondary-700 file:text-secondary-200 hover:file:bg-secondary-600 cursor-pointer"
          />
          {file && (
            <p className="mt-3 text-xs text-secondary-400">
              {file.name} ({formatBytes(file.size)})
            </p>
          )}
        </div>
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

      {/* Preview */}
      {preview && (
        <div className="rounded-xl overflow-hidden bg-secondary-800 max-w-sm">
          {type === "image" && (
            <img src={preview} alt="Preview" className="w-full max-h-48 object-contain" />
          )}
          {type === "video" && (
            <video src={preview} className="w-full max-h-48" controls muted />
          )}
          {type === "audio" && <audio src={preview} controls className="w-full p-4" />}
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
        disabled={uploading || (mode === "file" && !file) || (mode === "url" && !url.trim())}
        className="btn-primary"
      >
        {uploading ? "Uploading..." : "Upload"}
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

  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

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
    </main>
  );
}
