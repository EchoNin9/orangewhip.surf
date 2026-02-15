import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet, ApiError } from "../../utils/api";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PublicProfile {
  displayName: string;
  userHandle: string;
  about: string;
  profilePhotoUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PublicProfilePage() {
  const { identifier } = useParams<{ identifier: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"private" | "not_found" | null>(null);

  useEffect(() => {
    if (!identifier) {
      setError("not_found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    apiGet<PublicProfile>(`/profile/${encodeURIComponent(identifier)}`)
      .then((p) => {
        setProfile(p);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setError("private");
          } else {
            setError("not_found");
          }
        } else {
          setError("not_found");
        }
      })
      .finally(() => setLoading(false));
  }, [identifier]);

  if (loading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error === "private") {
    return (
      <main className="container-max section-padding">
        <motion.div
          className="max-w-xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card p-8">
            <p className="text-secondary-200 text-lg">
              This user&apos;s profile is private.
            </p>
            <p className="text-secondary-500 text-sm mt-2">
              They&apos;ve chosen not to share their profile publicly.
            </p>
            <Link
              to="/"
              className="inline-block mt-6 btn-secondary text-sm"
            >
              Back to Home
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  if (error === "not_found" || !profile) {
    return (
      <main className="container-max section-padding">
        <motion.div
          className="max-w-xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="card p-8">
            <p className="text-secondary-200 text-lg">Profile not found.</p>
            <Link
              to="/"
              className="inline-block mt-6 btn-secondary text-sm"
            >
              Back to Home
            </Link>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="container-max section-padding">
      <motion.div
        className="max-w-2xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="card p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {profile.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt={profile.displayName || profile.userHandle}
                className="w-24 h-24 rounded-full object-cover border-2 border-secondary-700"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-secondary-700 flex items-center justify-center">
                <span className="text-3xl font-display font-bold text-secondary-500">
                  {(profile.displayName || profile.userHandle || "?").charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-display font-bold text-gradient">
                {profile.displayName || profile.userHandle || "Anonymous"}
              </h1>
              {profile.userHandle && profile.userHandle !== profile.displayName && (
                <p className="text-secondary-400 text-sm mt-1">@{profile.userHandle}</p>
              )}
              {profile.about && (
                <p className="mt-4 text-secondary-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {profile.about}
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
