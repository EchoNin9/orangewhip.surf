import { useState, useEffect, Fragment, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import {
  PlusIcon,
  TrashIcon,
  KeyIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiDelete } from "../../utils/api";
import { useAuth, canAdminister } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ApiKey {
  id: string;
  label: string;
  partialKey: string;
  createdBy: string;
  createdAt: string;
}

interface CreateKeyResponse {
  id: string;
  label: string;
  fullKey: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ApiKeysPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Create form */
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  /* Newly created key display */
  const [newKey, setNewKey] = useState<CreateKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  /* Revoke confirm */
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  /* Auth guard */
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  /* Fetch keys */
  const fetchKeys = () => {
    setLoading(true);
    apiGet<ApiKey[]>("/admin/api-keys")
      .then(setKeys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && canAdminister(user)) fetchKeys();
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

  if (!user || !canAdminister(user)) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          Only admins can manage API keys.
        </p>
      </div>
    );
  }

  /* ── Actions ── */

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const result = await apiPost<CreateKeyResponse>("/admin/api-keys", {
        label,
      });
      setNewKey(result);
      setCreateOpen(false);
      setLabel("");
      fetchKeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await apiDelete(`/admin/api-keys?id=${revokeTarget.id}`);
      setRevokeTarget(null);
      fetchKeys();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <main className="container-max section-padding">
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          className="text-4xl font-display font-bold text-gradient"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          API Keys
        </motion.h1>
        <button
          onClick={() => {
            setCreateOpen(true);
            setLabel("");
          }}
          className="btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" /> New Key
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

      {/* ── Newly created key banner ── */}
      {newKey && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-sm font-semibold text-green-400 mb-2">
            API Key Created &mdash; copy it now! You won&rsquo;t see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-secondary-800 text-secondary-100 px-3 py-2 rounded-lg font-mono break-all">
              {newKey.fullKey}
            </code>
            <button
              onClick={copyKey}
              className="p-2 rounded-lg bg-secondary-700 hover:bg-secondary-600 text-secondary-300 transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-5 h-5 text-green-400" />
              ) : (
                <ClipboardDocumentIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-xs text-secondary-500 mt-2 hover:text-secondary-300 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">
          No API keys yet. Create one to get started!
        </p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <KeyIcon className="w-4 h-4 text-primary-500" />
                  <h3 className="text-base font-display font-bold text-secondary-100">
                    {k.label}
                  </h3>
                </div>
                <p className="text-sm text-secondary-500 font-mono">
                  {k.partialKey}
                </p>
                <p className="text-xs text-secondary-600 mt-1">
                  Created by {k.createdBy} &middot; {formatDate(k.createdAt)}
                </p>
              </div>

              <button
                onClick={() => setRevokeTarget(k)}
                title="Revoke key"
                className="p-2 rounded-lg text-secondary-400 hover:text-red-400 hover:bg-secondary-700 transition-colors flex-shrink-0"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Key Dialog ── */}
      <Transition appear show={createOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setCreateOpen(false)}
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
                <Dialog.Panel className="w-full max-w-sm card p-6">
                  <Dialog.Title className="text-xl font-display font-bold text-secondary-100 mb-6">
                    Create API Key
                  </Dialog.Title>

                  <form onSubmit={handleCreate} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                        Label
                      </label>
                      <input
                        type="text"
                        required
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        className="input-field"
                        placeholder="e.g. CI/CD Pipeline"
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setCreateOpen(false)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className="btn-primary text-sm"
                      >
                        {creating ? "Creating..." : "Create Key"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ── Revoke Confirmation ── */}
      <Transition appear show={revokeTarget !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setRevokeTarget(null)}
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
                    Revoke API Key?
                  </Dialog.Title>
                  <p className="text-sm text-secondary-400 mb-1">
                    This will permanently disable:
                  </p>
                  <p className="text-sm font-semibold text-secondary-200 mb-6">
                    {revokeTarget?.label}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setRevokeTarget(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmRevoke}
                      className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-sm transition-colors"
                    >
                      Revoke
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
