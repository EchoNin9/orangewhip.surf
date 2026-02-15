import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet, apiPut } from "../../utils/api";
import { useAuth, hasRole, type UserRole } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Profile {
  email: string;
  displayName: string;
  bio: string;
  role: UserRole;
  groups: string[];
  customGroups: string[];
}

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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /* Form fields */
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

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
        setBio(p.bio || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user, authLoading, navigate]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await apiPut<Profile>("/profile", { displayName, bio });
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

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-secondary-300 mb-1.5">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="input-field resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>

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
            <div className="flex items-center gap-1">
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
