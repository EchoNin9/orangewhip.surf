import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Promise wrappers for window.auth callbacks                        */
/* ------------------------------------------------------------------ */

function promiseSignIn(email: string, password: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!window.auth) return reject(new Error("Auth SDK not loaded"));
    window.auth.signIn(email, password, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function promiseSignUp(email: string, password: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!window.auth) return reject(new Error("Auth SDK not loaded"));
    window.auth.signUp(email, password, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function promiseConfirmSignUp(email: string, code: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!window.auth) return reject(new Error("Auth SDK not loaded"));
    window.auth.confirmSignUp(email, code, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

type Tab = "signin" | "signup";
type Step = "form" | "confirm";

export function AuthPage() {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchTab(t: Tab) {
    setTab(t);
    setStep("form");
    setError(null);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await promiseSignIn(email, password);
      await refreshAuth();
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await promiseSignUp(email, password);
      setStep("confirm");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await promiseConfirmSignUp(email, code);
      /* After confirmation, sign in automatically */
      await promiseSignIn(email, password);
      await refreshAuth();
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container-max section-padding flex justify-center">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* ── Tab toggle ── */}
        <div className="flex rounded-lg bg-secondary-800 p-1 mb-8">
          {(["signin", "signup"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                tab === t
                  ? "bg-primary-500 text-white shadow"
                  : "text-secondary-400 hover:text-secondary-200"
              }`}
            >
              {t === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Sign In form ── */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-5">
            <h2 className="text-2xl font-display font-bold text-secondary-100">
              Welcome Back
            </h2>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter your password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* ── Sign Up form ── */}
        {tab === "signup" && step === "form" && (
          <form onSubmit={handleSignUp} className="space-y-5">
            <h2 className="text-2xl font-display font-bold text-secondary-100">
              Create Account
            </h2>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Re-enter password"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        )}

        {/* ── Confirmation code ── */}
        {tab === "signup" && step === "confirm" && (
          <form onSubmit={handleConfirm} className="space-y-5">
            <h2 className="text-2xl font-display font-bold text-secondary-100">
              Confirm Your Email
            </h2>
            <p className="text-sm text-secondary-400">
              We sent a verification code to <strong className="text-secondary-200">{email}</strong>.
              Enter it below to activate your account.
            </p>
            <div>
              <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input-field text-center tracking-widest text-lg"
                placeholder="000000"
                maxLength={6}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
