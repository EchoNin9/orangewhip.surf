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
}

const DEFAULT_HERO: HeroBranding = {
  heroTitle: "Orange Whip",
  heroTagline: "Industrial Surf",
  heroButton1Text: "Upcoming Shows",
  heroButton1Href: "/shows",
  heroButton2Text: "Listen Now",
  heroButton2Href: "/media",
  heroImageOpacity: 25,
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
      setBranding((prev) => ({ ...prev, heroImageUrl: "" }));
      setSuccess("Hero image uploaded. Refresh the homepage to see it.");
      // Refetch to get new presigned URL
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
    </main>
  );
}
