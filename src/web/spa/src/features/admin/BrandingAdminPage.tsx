import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PhotoIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import { useAuth, canAdminister } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

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

const DEFAULT_HERO: HeroBranding = {
  heroTitle: "Orange Whip",
  heroTagline: "Industrial Surf",
  heroButton1Text: "Listen Now",
  heroButton1Href: "#media",
  heroButton2Text: "Shop Merch",
  heroButton2Href: "#merch",
  heroImageOpacity: 25,
  palette: "sunset",
  showGrain: true,
  marqueeItems: ['New single "Sundowner" out now', "Summer tour on sale", "Merch restocked"],
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function BrandingAdminPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState<HeroBranding>(DEFAULT_HERO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/login");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    apiGet<HeroBranding>("/branding")
      .then((data) => setBranding({ ...DEFAULT_HERO, ...data }))
      .catch(() => setError("Failed to load branding"))
      .finally(() => setLoading(false));
  }, []);

  if (isLoading || loading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canAdminister(user)) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          Only admin users can manage branding.
        </p>
      </div>
    );
  }

  const update = (partial: Partial<HeroBranding>) => {
    setBranding((prev) => ({ ...prev, ...partial }));
    setError(null);
    setSuccess(null);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPut("/branding", {
        heroTitle: branding.heroTitle,
        heroTagline: branding.heroTagline,
        heroButton1Text: branding.heroButton1Text,
        heroButton1Href: branding.heroButton1Href,
        heroButton2Text: branding.heroButton2Text,
        heroButton2Href: branding.heroButton2Href,
        heroImageOpacity: branding.heroImageOpacity ?? 25,
        heroButton1Bg: branding.heroButton1Bg ?? "",
        heroButton1TextColor: branding.heroButton1TextColor ?? "",
        heroButton2Bg: branding.heroButton2Bg ?? "",
        heroButton2TextColor: branding.heroButton2TextColor ?? "",
        palette: branding.palette ?? "sunset",
        showGrain: branding.showGrain ?? true,
        marqueeItems: (branding.marqueeItems ?? []).map((s) => s.trim()).filter(Boolean),
      });
      setSuccess("Branding saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const { uploadUrl, s3Key } = await apiPost<{
        uploadUrl: string;
        s3Key: string;
      }>("/branding/hero-image/upload", {
        filename: file.name,
        contentType: file.type,
      });
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");
      await apiPut("/branding", { heroImageS3Key: s3Key });
      setSuccess("Hero image uploaded.");
      // Refetch to get presigned URL and display the image
      const updated = await apiGet<HeroBranding>("/branding");
      setBranding((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm("Remove the hero background image?")) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiDelete("/branding/hero-image");
      setBranding((prev) => ({
        ...prev,
        heroImageUrl: "",
      }));
      setSuccess("Hero image removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="container-max section-padding">
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/admin"
          className="text-secondary-400 hover:text-primary-400 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <motion.h1
          className="text-4xl sm:text-5xl font-display font-bold text-gradient"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Branding
        </motion.h1>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-primary-500/10 border border-primary-500/30 text-primary-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8 max-w-2xl">
        {/* Hero Image */}
        <div className="card p-6">
          <h2 className="text-lg font-display font-bold text-secondary-100 mb-4">
            Hero Background Image
          </h2>
          <p className="text-sm text-secondary-400 mb-4">
            Image displayed behind the hero text. Use a high-resolution image for best results.
          </p>
          {branding.heroImageUrl ? (
            <div className="relative rounded-lg overflow-hidden bg-secondary-800 aspect-video mb-4">
              <img
                src={branding.heroImageUrl}
                alt="Hero background"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="btn-primary text-sm"
                >
                  {uploading ? "Uploading..." : "Replace Image"}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  disabled={deleting}
                  className="btn-secondary text-sm text-red-400 border-red-500/50 hover:border-red-500"
                >
                  {deleting ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-secondary-600 rounded-lg p-12 text-center cursor-pointer hover:border-primary-500/50 hover:bg-secondary-800/30 transition-colors"
            >
              <PhotoIcon className="w-12 h-12 text-secondary-500 mx-auto mb-3" />
              <p className="text-secondary-400">
                {uploading ? "Uploading..." : "Click to add hero image"}
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Hero Image Transparency */}
        <div className="card p-6">
          <h2 className="text-lg font-display font-bold text-secondary-100 mb-4">
            Hero Image Transparency
          </h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={branding.heroImageOpacity ?? 25}
              onChange={(e) =>
                update({ heroImageOpacity: parseInt(e.target.value, 10) })
              }
              className="flex-1 h-2 bg-secondary-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <span className="text-secondary-300 font-mono w-12">
              {branding.heroImageOpacity ?? 25}%
            </span>
          </div>
        </div>

        {/* Theme (OW-13) */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-display font-bold text-secondary-100 mb-4">
            Theme
          </h2>
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1">
              Color palette
            </label>
            <select
              value={branding.palette ?? "sunset"}
              onChange={(e) => update({ palette: e.target.value })}
              className="input-field sm:w-64"
            >
              <option value="sunset">Sunset (default)</option>
              <option value="acid-surf">Acid Surf</option>
              <option value="magenta-haze">Magenta Haze</option>
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-secondary-300">
            <input
              type="checkbox"
              checked={branding.showGrain ?? true}
              onChange={(e) => update({ showGrain: e.target.checked })}
              className="h-4 w-4 accent-primary-500"
            />
            Film-grain overlay
          </label>
        </div>

        {/* Marquee banner (OW-16) */}
        <div className="card p-6">
          <h2 className="text-lg font-display font-bold text-secondary-100 mb-1">
            Marquee Banner
          </h2>
          <p className="text-sm text-secondary-400 mb-4">
            One message per line. Leave empty to hide the strip.
          </p>
          <textarea
            value={(branding.marqueeItems ?? []).join("\n")}
            onChange={(e) => update({ marqueeItems: e.target.value.split("\n") })}
            rows={4}
            className="input-field font-mono text-sm"
            placeholder={'New single "Sundowner" out now'}
          />
        </div>

        {/* Hero Text */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-display font-bold text-secondary-100 mb-4">
            Hero Text
          </h2>
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={branding.heroTitle}
              onChange={(e) => update({ heroTitle: e.target.value })}
              className="input-field"
              placeholder="Orange Whip"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1">
              Tagline
            </label>
            <input
              type="text"
              value={branding.heroTagline}
              onChange={(e) => update({ heroTagline: e.target.value })}
              className="input-field"
              placeholder="Industrial Surf"
            />
          </div>
        </div>

        {/* Hero Buttons */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-display font-bold text-secondary-100 mb-4">
            Hero Buttons
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-secondary-300">
                Button 1 (primary)
              </label>
              <input
                type="text"
                value={branding.heroButton1Text}
                onChange={(e) => update({ heroButton1Text: e.target.value })}
                className="input-field"
                placeholder="Upcoming Shows"
              />
              <input
                type="text"
                value={branding.heroButton1Href}
                onChange={(e) => update({ heroButton1Href: e.target.value })}
                className="input-field"
                placeholder="/shows"
              />
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="color"
                  value={branding.heroButton1Bg || "#f97316"}
                  onChange={(e) => update({ heroButton1Bg: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-secondary-600"
                />
                <span className="text-xs text-secondary-500">Bg</span>
                <input
                  type="color"
                  value={branding.heroButton1TextColor || "#ffffff"}
                  onChange={(e) =>
                    update({ heroButton1TextColor: e.target.value })
                  }
                  className="w-10 h-10 rounded cursor-pointer border border-secondary-600"
                />
                <span className="text-xs text-secondary-500">Text</span>
                <button
                  type="button"
                  onClick={() =>
                    update({ heroButton1Bg: "", heroButton1TextColor: "" })
                  }
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  Default
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-secondary-300">
                Button 2 (secondary)
              </label>
              <input
                type="text"
                value={branding.heroButton2Text}
                onChange={(e) => update({ heroButton2Text: e.target.value })}
                className="input-field"
                placeholder="Listen Now"
              />
              <input
                type="text"
                value={branding.heroButton2Href}
                onChange={(e) => update({ heroButton2Href: e.target.value })}
                className="input-field"
                placeholder="/media"
              />
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="color"
                  value={branding.heroButton2Bg || "#334155"}
                  onChange={(e) => update({ heroButton2Bg: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-secondary-600"
                />
                <span className="text-xs text-secondary-500">Bg</span>
                <input
                  type="color"
                  value={branding.heroButton2TextColor || "#f1f5f9"}
                  onChange={(e) =>
                    update({ heroButton2TextColor: e.target.value })
                  }
                  className="w-10 h-10 rounded cursor-pointer border border-secondary-600"
                />
                <span className="text-xs text-secondary-500">Text</span>
                <button
                  type="button"
                  onClick={() =>
                    update({ heroButton2Bg: "", heroButton2TextColor: "" })
                  }
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  Default
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-secondary-500 mt-2">
            Leave colors empty to use default theme (orange primary, dark secondary).
          </p>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Branding"}
          </button>
          <Link to="/" className="btn-secondary">
            Preview Homepage
          </Link>
        </div>
      </form>

      {/* Featured album (OW-15) — separate save from branding */}
      <AlbumEditor />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Featured album editor (OW-15)                                      */
/* ------------------------------------------------------------------ */

interface AlbumTrack {
  title: string;
  duration: string;
  mediaId: string;
}

interface AlbumData {
  title: string;
  yearLabel: string;
  coverMediaId: string;
  tracks: AlbumTrack[];
}

interface MediaOption {
  id: string;
  title: string;
  type: string;
}

function AlbumEditor() {
  const [album, setAlbum] = useState<AlbumData>({
    title: "",
    yearLabel: "",
    coverMediaId: "",
    tracks: [],
  });
  const [mediaOpts, setMediaOpts] = useState<MediaOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<AlbumData>("/album")
      .then((a) =>
        setAlbum({
          title: a.title ?? "",
          yearLabel: a.yearLabel ?? "",
          coverMediaId: a.coverMediaId ?? "",
          tracks: (a.tracks ?? []).map((t) => ({
            title: t.title ?? "",
            duration: t.duration ?? "",
            mediaId: t.mediaId ?? "",
          })),
        }),
      )
      .catch(() => {});
    // ponytail: media <select> instead of a picker modal — same media library, far less code
    apiGet<{ items: MediaOption[] }>("/media?limit=100")
      .then((r) => setMediaOpts(r.items))
      .catch(() => {});
  }, []);

  const up = (patch: Partial<AlbumData>) => {
    setAlbum((prev) => ({ ...prev, ...patch }));
    setMsg(null);
    setErr(null);
  };

  const setTrack = (i: number, patch: Partial<AlbumTrack>) =>
    up({ tracks: album.tracks.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const moveTrack = (i: number, d: number) => {
    const t = [...album.tracks];
    const j = i + d;
    if (j < 0 || j >= t.length) return;
    [t[i], t[j]] = [t[j], t[i]];
    up({ tracks: t });
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await apiPut("/album", album);
      setMsg("Album saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save album");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6 space-y-4 max-w-2xl mt-8">
      <h2 className="text-lg font-display font-bold text-secondary-100">
        Featured Album
      </h2>
      <p className="text-sm text-secondary-400">
        Shown in the homepage Media › Listen section. Tracks linked to a media
        item become clickable.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-1">Title</label>
          <input
            type="text"
            value={album.title}
            onChange={(e) => up({ title: e.target.value })}
            className="input-field"
            placeholder="Crème De La Mer"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-300 mb-1">
            Year / label line
          </label>
          <input
            type="text"
            value={album.yearLabel}
            onChange={(e) => up({ yearLabel: e.target.value })}
            className="input-field"
            placeholder="2026 · Self-released"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">Cover art</label>
        <select
          value={album.coverMediaId}
          onChange={(e) => up({ coverMediaId: e.target.value })}
          className="input-field"
        >
          <option value="">None (hatch placeholder)</option>
          {mediaOpts
            .filter((m) => m.type === "image")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-2">Tracks</label>
        <div className="space-y-2">
          {album.tracks.map((t, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-right text-xs text-secondary-500 font-mono">
                {i + 1}
              </span>
              <input
                type="text"
                value={t.title}
                onChange={(e) => setTrack(i, { title: e.target.value })}
                className="input-field flex-1 min-w-[140px]"
                placeholder="Track title"
              />
              <input
                type="text"
                value={t.duration}
                onChange={(e) => setTrack(i, { duration: e.target.value })}
                className="input-field w-20"
                placeholder="3:24"
              />
              <select
                value={t.mediaId}
                onChange={(e) => setTrack(i, { mediaId: e.target.value })}
                className="input-field w-44"
              >
                <option value="">No media link</option>
                {mediaOpts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => moveTrack(i, -1)} disabled={i === 0}
                className="px-2 py-1 text-secondary-400 hover:text-white disabled:opacity-30">↑</button>
              <button type="button" onClick={() => moveTrack(i, 1)} disabled={i === album.tracks.length - 1}
                className="px-2 py-1 text-secondary-400 hover:text-white disabled:opacity-30">↓</button>
              <button
                type="button"
                onClick={() => up({ tracks: album.tracks.filter((_, j) => j !== i) })}
                className="px-2 py-1 text-secondary-400 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            up({ tracks: [...album.tracks, { title: "", duration: "", mediaId: "" }] })
          }
          className="btn-secondary text-sm mt-3"
        >
          Add Track
        </button>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}
      {msg && <p className="text-sm text-green-400">{msg}</p>}

      <button type="button" onClick={save} disabled={saving} className="btn-primary">
        {saving ? "Saving..." : "Save Album"}
      </button>
    </div>
  );
}
