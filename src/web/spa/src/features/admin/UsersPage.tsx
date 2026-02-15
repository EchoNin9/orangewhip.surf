import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import {
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiDelete } from "../../utils/api";
import { useAuth, canManageUsers, canAdminister, type UserRole } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ManagedUser {
  userId: string;
  username: string;          /* Cognito Username (used for API calls) */
  email: string;
  displayName?: string;
  groups: string[];          /* Cognito groups */
  customGroups: string[];    /* DynamoDB custom groups */
  markedForDeletion?: boolean;
  createdAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ALL_COGNITO_ROLES: UserRole[] = ["admin", "manager", "editor", "band"];

const roleBadgeClass: Record<string, string> = {
  admin: "bg-red-500/20 text-red-400",
  manager: "bg-purple-500/20 text-purple-400",
  editor: "bg-blue-500/20 text-blue-400",
  band: "bg-primary-500/20 text-primary-400",
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function UsersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Delete confirm */
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  /* Add to group dialog */
  const [groupTarget, setGroupTarget] = useState<ManagedUser | null>(null);
  const [groupType, setGroupType] = useState<"cognito" | "custom">("cognito");
  const [groupName, setGroupName] = useState("");
  const [availableCustomGroups, setAvailableCustomGroups] = useState<string[]>(
    [],
  );

  /* Auth guard */
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  /* Fetch users */
  const fetchUsers = () => {
    setLoading(true);
    apiGet<ManagedUser[]>("/admin/users")
      .then((data) =>
        setUsers(
          data.map((u) => ({
            ...u,
            username: u.username || u.userId,
            groups: u.groups ?? [],
            customGroups: u.customGroups ?? [],
          })),
        ),
      )
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user && canManageUsers(user)) {
      fetchUsers();
      /* Also fetch available custom groups for the group assignment UI */
      apiGet<{ id: string; name: string }[]>("/admin/groups")
        .then((gs) => setAvailableCustomGroups(gs.map((g) => g.name)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* Roles available for assignment (managers cannot see/assign admin) */
  const cognitoRoles = user && canAdminister(user)
    ? ALL_COGNITO_ROLES
    : ALL_COGNITO_ROLES.filter((r) => r !== "admin");

  /* Permission */
  if (authLoading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !canManageUsers(user)) {
    return (
      <div className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          Manager access or above required to manage users.
        </p>
      </div>
    );
  }

  /* ── Actions ── */

  async function addCognitoGroup(u: ManagedUser, role: string) {
    try {
      await apiPost(`/admin/users/${u.username}/groups`, {
        type: "cognito",
        group: role,
      });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add group");
    }
  }

  async function removeCognitoGroup(u: ManagedUser, role: string) {
    try {
      await apiDelete(
        `/admin/users/${encodeURIComponent(u.username)}/groups/${encodeURIComponent(role)}?type=cognito`,
      );
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove group");
    }
  }

  async function addCustomGroup(u: ManagedUser, group: string) {
    try {
      await apiPost(`/admin/users/${u.username}/groups`, {
        type: "custom",
        group,
      });
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add custom group");
    }
  }

  async function removeCustomGroup(u: ManagedUser, group: string) {
    try {
      await apiDelete(
        `/admin/users/${encodeURIComponent(u.username)}/groups/${encodeURIComponent(group)}?type=custom`,
      );
      fetchUsers();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to remove custom group",
      );
    }
  }

  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    try {
      if (canAdminister(user!)) {
        await apiDelete(`/admin/users/${deleteTarget.username}`);
      } else {
        await apiPost(`/admin/users/${deleteTarget.username}/mark-for-deletion`, {});
      }
      setDeleteTarget(null);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  async function unmarkForDeletion(u: ManagedUser) {
    try {
      await apiDelete(`/admin/users/${encodeURIComponent(u.username)}/mark-for-deletion`);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unmark");
    }
  }

  function openGroupDialog(u: ManagedUser, type: "cognito" | "custom") {
    setGroupTarget(u);
    setGroupType(type);
    setGroupName("");
  }

  async function handleAddGroup() {
    if (!groupTarget || !groupName) return;
    if (groupType === "cognito") {
      await addCognitoGroup(groupTarget, groupName);
    } else {
      await addCustomGroup(groupTarget, groupName);
    }
    setGroupTarget(null);
  }

  return (
    <main className="container-max section-padding">
      <motion.h1
        className="text-4xl font-display font-bold text-gradient mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Users
      </motion.h1>

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
      ) : users.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">No users found.</p>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.userId} className="card p-5">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheckIcon className="w-5 h-5 text-primary-500" />
                    <span className="font-display font-bold text-secondary-100">
                      {u.displayName || u.email}
                    </span>
                    {u.markedForDeletion && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                        Marked for deletion
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-secondary-500">{u.email}</p>
                  <p className="text-xs text-secondary-600 mt-0.5">
                    ID: {u.userId}
                  </p>
                </div>

                {/* Cognito groups */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
                      Roles
                    </span>
                    <button
                      onClick={() => openGroupDialog(u, "cognito")}
                      className="p-0.5 text-primary-400 hover:text-primary-300 transition-colors"
                      title="Add role"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.groups.length === 0 ? (
                      <span className="text-xs text-secondary-600">None</span>
                    ) : (
                      u.groups.map((g) => (
                        <span
                          key={g}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            roleBadgeClass[g] ||
                            "bg-secondary-600/30 text-secondary-400"
                          }`}
                        >
                          {g}
                          <button
                            onClick={() => removeCognitoGroup(u, g)}
                            className="hover:text-red-400 transition-colors"
                            title={`Remove ${g}`}
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Custom groups */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-secondary-500">
                      Groups
                    </span>
                    <button
                      onClick={() => openGroupDialog(u, "custom")}
                      className="p-0.5 text-primary-400 hover:text-primary-300 transition-colors"
                      title="Add to group"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.customGroups.length === 0 ? (
                      <span className="text-xs text-secondary-600">None</span>
                    ) : (
                      u.customGroups.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-secondary-700 text-secondary-300 px-2 py-0.5 rounded"
                        >
                          {g}
                          <button
                            onClick={() => removeCustomGroup(u, g)}
                            className="hover:text-red-400 transition-colors"
                            title={`Remove from ${g}`}
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {u.markedForDeletion && (
                    <button
                      onClick={() => unmarkForDeletion(u)}
                      title="Unmark for deletion"
                      className="p-2 rounded-lg text-secondary-400 hover:text-primary-400 hover:bg-secondary-700 transition-colors"
                    >
                      Unmark
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteTarget(u)}
                    title={canAdminister(user!) ? "Delete user" : "Mark for deletion"}
                    className="p-2 rounded-lg text-secondary-400 hover:text-red-400 hover:bg-secondary-700 transition-colors"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Group Dialog ── */}
      <Transition appear show={groupTarget !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setGroupTarget(null)}
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
                  <Dialog.Title className="text-lg font-display font-bold text-secondary-100 mb-4">
                    {groupType === "cognito"
                      ? "Add Cognito Role"
                      : "Add to Custom Group"}
                  </Dialog.Title>

                  <p className="text-sm text-secondary-400 mb-4">
                    User:{" "}
                    <span className="text-secondary-200">
                      {groupTarget?.displayName || groupTarget?.email}
                    </span>
                  </p>

                  {groupType === "cognito" ? (
                    <div className="space-y-2 mb-6">
                      {cognitoRoles.filter(
                        (r) => !groupTarget?.groups.includes(r),
                      ).map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setGroupName(role);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            groupName === role
                              ? "bg-primary-500/20 text-primary-400 border border-primary-500/40"
                              : "bg-secondary-800 text-secondary-300 hover:bg-secondary-700 border border-transparent"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                      {cognitoRoles.filter(
                        (r) => !groupTarget?.groups.includes(r),
                      ).length === 0 && (
                        <p className="text-sm text-secondary-500">
                          User already has all roles.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 mb-6">
                      {availableCustomGroups
                        .filter(
                          (g) => !groupTarget?.customGroups.includes(g),
                        )
                        .map((g) => (
                          <button
                            key={g}
                            onClick={() => setGroupName(g)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              groupName === g
                                ? "bg-primary-500/20 text-primary-400 border border-primary-500/40"
                                : "bg-secondary-800 text-secondary-300 hover:bg-secondary-700 border border-transparent"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      {availableCustomGroups.filter(
                        (g) => !groupTarget?.customGroups.includes(g),
                      ).length === 0 && (
                        <p className="text-sm text-secondary-500">
                          No available groups to add.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setGroupTarget(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddGroup}
                      disabled={!groupName}
                      className="btn-primary text-sm"
                    >
                      Add
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* ── Delete / Mark for Deletion Confirmation ── */}
      <Transition appear show={deleteTarget !== null} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setDeleteTarget(null)}
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
                    {canAdminister(user!) ? "Delete User?" : "Mark for Deletion?"}
                  </Dialog.Title>
                  <p className="text-sm text-secondary-400 mb-2">
                    {canAdminister(user!)
                      ? "This will permanently remove:"
                      : "This will mark the user for deletion. An admin must confirm to permanently remove:"}
                  </p>
                  <p className="text-sm font-semibold text-secondary-200 mb-6">
                    {deleteTarget?.displayName || deleteTarget?.email}
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDeleteUser}
                      className="inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-sm transition-colors"
                    >
                      {canAdminister(user!) ? "Delete User" : "Mark for Deletion"}
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
