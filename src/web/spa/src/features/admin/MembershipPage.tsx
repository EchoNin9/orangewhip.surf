import { useState, useEffect, Fragment, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition, Switch } from "@headlessui/react";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserGroupIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/api";
import { useAuth, hasRole } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface GroupMember {
  userId: string;
  email: string;
  displayName?: string;
}

interface CustomGroup {
  id: string;
  name: string;
  description: string;
  selfJoin: boolean;
  memberCount: number;
  members?: GroupMember[];
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function MembershipPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<CustomGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Form */
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selfJoin, setSelfJoin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  /* Expanded group (show members) */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  /* Delete */
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* Auth guard */
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  /* Fetch groups */
  const fetchGroups = () => {
    setLoading(true);
    apiGet<CustomGroup[]>("/admin/groups")
      .then(setGroups)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && hasRole(user, "manager")) fetchGroups();
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

  if (!user || !hasRole(user, "manager")) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          You need manager access or above to manage groups.
        </p>
      </div>
    );
  }

  /* ── Form helpers ── */

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setSelfJoin(false);
    setFormOpen(true);
  }

  function openEdit(g: CustomGroup) {
    setEditingId(g.id);
    setName(g.name);
    setDescription(g.description);
    setSelfJoin(g.selfJoin);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = { name, description, selfJoin };
      if (editingId) {
        await apiPut(`/admin/groups?id=${editingId}`, body);
      } else {
        await apiPost("/admin/groups", body);
      }
      setFormOpen(false);
      fetchGroups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/admin/groups?id=${deleteId}`);
      setDeleteId(null);
      fetchGroups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete group");
    }
  }

  async function toggleExpanded(g: CustomGroup) {
    if (expandedId === g.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(g.id);
    if (!g.members) {
      setMembersLoading(true);
      try {
        const members = await apiGet<GroupMember[]>(
          `/admin/groups/${g.id}/members`,
        );
        setGroups((prev) =>
          prev.map((grp) =>
            grp.id === g.id ? { ...grp, members } : grp,
          ),
        );
      } catch {
        /* ignore — members not loadable */
      } finally {
        setMembersLoading(false);
      }
    }
  }

  return (
    <main className="container-max section-padding">
      <div className="flex items-center justify-between mb-8">
        <motion.h1
          className="text-4xl font-display font-bold text-gradient"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Membership
        </motion.h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-5 h-5" /> New Group
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

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">
          No custom groups yet. Create one to get started!
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.id} className="card overflow-hidden">
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <UserGroupIcon className="w-5 h-5 text-primary-500" />
                    <h3 className="text-base font-display font-bold text-secondary-100">
                      {g.name}
                    </h3>
                    {g.selfJoin && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">
                        Self-Join
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-secondary-400">{g.description}</p>
                  <p className="text-xs text-secondary-500 mt-1">
                    {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleExpanded(g)}
                    title="View members"
                    className="p-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 transition-colors"
                  >
                    {expandedId === g.id ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(g)}
                    title="Edit"
                    className="p-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(g.id)}
                    title="Delete"
                    className="p-2 rounded-lg text-secondary-400 hover:text-red-400 hover:bg-secondary-700 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded members list */}
              {expandedId === g.id && (
                <div className="border-t border-secondary-700 p-4 bg-secondary-800/30">
                  {membersLoading ? (
                    <p className="text-sm text-secondary-500 text-center py-4">
                      Loading members...
                    </p>
                  ) : !g.members || g.members.length === 0 ? (
                    <p className="text-sm text-secondary-500 text-center py-4">
                      No members in this group.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {g.members.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center gap-3 text-sm"
                        >
                          <div className="w-7 h-7 rounded-full bg-secondary-700 flex items-center justify-center text-xs font-bold text-secondary-300">
                            {(m.displayName || m.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="text-secondary-200">
                              {m.displayName || m.email}
                            </span>
                            {m.displayName && (
                              <span className="text-secondary-500 ml-2">
                                {m.email}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Form Modal ── */}
      <Transition appear show={formOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setFormOpen(false)}
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
                <Dialog.Panel className="w-full max-w-md card p-6">
                  <Dialog.Title className="text-xl font-display font-bold text-secondary-100 mb-6">
                    {editingId ? "Edit Group" : "New Group"}
                  </Dialog.Title>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                        Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field"
                        placeholder="Group name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-300 mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="input-field resize-none"
                        placeholder="What is this group for?"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-secondary-300">
                          Allow Self-Join
                        </span>
                        <p className="text-xs text-secondary-500 mt-0.5">
                          Users can join this group themselves
                        </p>
                      </div>
                      <Switch
                        checked={selfJoin}
                        onChange={setSelfJoin}
                        className={`${
                          selfJoin ? "bg-primary-500" : "bg-secondary-600"
                        } relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                      >
                        <span
                          className={`${
                            selfJoin ? "translate-x-6" : "translate-x-1"
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </Switch>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setFormOpen(false)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn-primary text-sm"
                      >
                        {submitting
                          ? "Saving..."
                          : editingId
                            ? "Save Changes"
                            : "Create Group"}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ── Delete Confirmation ── */}
      <Transition appear show={deleteId !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setDeleteId(null)}
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
                    Delete Group?
                  </Dialog.Title>
                  <p className="text-sm text-secondary-400 mb-6">
                    All members will be removed from this group.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setDeleteId(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-sm transition-colors"
                    >
                      Delete
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
