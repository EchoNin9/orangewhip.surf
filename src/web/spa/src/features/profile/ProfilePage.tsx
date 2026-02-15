import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CameraIcon } from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut } from "../../utils/api";
import { useAuth, hasRole, type UserRole } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Profile {
  email: string;
  displayName: string;
  bio: string;
  about?: string;
  userHandle?: string;
  profilePublic?: boolean;
  profilePhotoUrl?: string;
  profilePhotoKey?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  role: UserRole;
  groups: string[];
  customGroups: string[];
}

/* User handle: letters, numbers, spaces, dashes, underscores */
const USER_HANDLE_REGEX = /^[a-zA-Z0-9 _-]*$/;

/* ------------------------------------------------------------------ */
/*  Role badge colours                                                */
/* ------------------------------------------------------------------ */

const roleBadgeClass: Record<UserRole, string> = {
  admin: "bg-red-500/20 text-red-400",
  manager: "bg-purple-500/20 text-purple-400",
  editor: "bg-blue-500/20 text-blue-400",
  band: "bg-primary-500/20 text-primary-400",
  guest: "bg-secondary-600/30 text-secondary-400",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  editor: "Editor",
  band: "Band Member",
  guest: "Guest",
};

const ROLE_HIERARCHY: UserRole[] = ["guest", "band", "editor", "manager", "admin"];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* Form fields */
  const [displayName, setDisplayName] = useState("");
  const [userHandle, setUserHandle] = useState("");
  const [about, setAbout] = useState("");
  const [profilePublic, setProfilePublic] = useState(false);
  const [profilePhotoKey, setProfilePhotoKey] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    apiGet<Profile>("/profile")
      .then((p) => {
        setProfile(p);
        setDisplayName(p.displayName || "");
        setUserHandle(p.userHandle || "");
        setAbout(p.about ?? p.bio ?? "");
        setProfilePublic(p.profilePublic ?? false);
        setProfilePhotoKey(p.profilePhotoKey || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading, navigate]);

  function handleUserHandleChange(value: string) {
    if (USER_HANDLE_REGEX.test(value)) {
      setUserHandle(value);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    setPhotoUploading(true);
    setError(null);
    try {
      const { uploadUrl, s3Key } = await apiPost<{ uploadUrl: string; s3Key: string }>(
        "/profile/photo-upload",
        { filename: file.name }
      );
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload failed");
      setProfilePhotoKey(s3Key);
      setProfile((p) => (p ? { ...p, profilePhotoKey: s3Key } : null));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await apiPut<Profile>("/profile", {
        displayName,
        userHandle: userHandle.trim(),
        about,
        profilePublic,
        profilePhotoKey: profilePhotoKey || undefined,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const photoUrl = profile?.profilePhotoUrl || "";
  const handleSlug = userHandle.trim().toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-");
  const publicProfileLink = handleSlug ? `/profile/${encodeURIComponent(handleSlug)}` : null;

  return (
    <main className="container-max section-padding">
      <motion.div
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-display font-bold text-gradient mb-8">
          Profile
        </h1>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            Profile saved successfully!
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Profile photo */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-secondary-700 border-2 border-secondary-600 flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-display font-bold text-secondary-500">
                    {(displayName || user.email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                <CameraIcon className="w-8 h-8 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
            <div>
              <p className="text-sm text-secondary-300">
                {photoUploading ? "Uploading..." : "Click to change photo"}
              </p>
              <p className="text-xs text-secondary-500 mt-1">
                JPG, PNG, WebP or GIF. Max 5MB.
              </p>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              readOnly
              value={profile?.email || user.email}
              className="input-field opacity-60 cursor-not-allowed"
            />
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field"
              placeholder="Your display name"
            />
          </div>

          {/* User handle */}
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1.5">
              User Handle
            </label>
            <input
              type="text"
              value={userHandle}
              onChange={(e) => handleUserHandleChange(e.target.value)}
              className="input-field"
              placeholder="e.g. john-doe or John Doe"
            />
            <p className="text-xs text-secondary-500 mt-1">
              Letters, numbers, spaces, dashes, underscores. Used for your profile URL.
            </p>
            {publicProfileLink && profilePublic && (
              <Link
                to={publicProfileLink}
                className="text-xs text-primary-400 hover:text-primary-300 mt-1 inline-block"
              >
                View public profile →
              </Link>
            )}
          </div>

          {/* About */}
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1.5">
              About
            </label>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          {/* Profile public toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={profilePublic}
                onChange={(e) => setProfilePublic(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary-700 peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500" />
              <span className="ms-3 text-sm font-medium text-secondary-300">
                Public profile
              </span>
            </label>
            <span className="text-xs text-secondary-500">
              {profilePublic
                ? "Others can view your profile at /profile/your-handle"
                : "Your profile is private"}
            </span>
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        {/* ── Last logged in ── */}
        {(profile?.lastLoginAt || profile?.lastLoginIp) && (
          <div className="mt-10 pt-8 border-t border-secondary-800">
            <h2 className="text-xl font-display font-bold text-secondary-100 mb-4">
              Last Logged In
            </h2>
            <p className="text-sm text-secondary-400">
              {profile.lastLoginAt && (
                <span>
                  {new Date(profile.lastLoginAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
              {profile.lastLoginIp && (
                <span>
                  {profile.lastLoginAt ? " from " : ""}
                  <span className="font-mono text-secondary-500">{profile.lastLoginIp}</span>
                </span>
              )}
            </p>
          </div>
        )}

        {/* ── Role & groups ── */}
        <div className="mt-10 pt-8 border-t border-secondary-800">
          <h2 className="text-xl font-display font-bold text-secondary-100 mb-4">
            Role &amp; Groups
          </h2>

          {/* Role badge */}
          <div className="mb-6">
            <span className="text-sm text-secondary-400 mr-3">Your role:</span>
            <span
              className={`inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded ${
                roleBadgeClass[profile?.role || user.role]
              }`}
            >
              {ROLE_LABELS[profile?.role || user.role]}
            </span>
          </div>

          {/* Role hierarchy */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-secondary-300 mb-3">
              Role Hierarchy
            </h3>
            <div className="flex flex-wrap items-center gap-1">
              {ROLE_HIERARCHY.map((r, idx) => {
                const isCurrent = r === (profile?.role || user.role);
                const isBelow = hasRole(user, r);
                return (
                  <div key={r} className="flex items-center gap-1">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        isCurrent
                          ? "bg-primary-500 text-white font-bold"
                          : isBelow
                            ? "bg-secondary-700 text-secondary-300"
                            : "bg-secondary-800/50 text-secondary-600"
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </span>
                    {idx < ROLE_HIERARCHY.length - 1 && (
                      <span className="text-secondary-600 text-xs">&rarr;</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cognito groups */}
          {(profile?.groups || user.groups)?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-secondary-300 mb-3">
                Cognito Groups
              </h3>
              <div className="flex flex-wrap gap-2">
                {(profile?.groups || user.groups).map((g) => (
                  <span
                    key={g}
                    className="text-xs bg-secondary-700 text-secondary-300 px-2.5 py-1 rounded"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom groups */}
          {(profile?.customGroups || user.customGroups).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-secondary-300 mb-3">
                Custom Groups
              </h3>
              <div className="flex flex-wrap gap-2">
                {(profile?.customGroups || user.customGroups).map((g) => (
                  <span
                    key={g}
                    className="text-xs bg-secondary-700 text-secondary-300 px-2.5 py-1 rounded"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
