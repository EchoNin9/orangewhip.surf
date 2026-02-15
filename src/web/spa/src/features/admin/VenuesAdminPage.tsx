import { useState, useEffect, useCallback, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  MapPinIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "../../utils/api";
import { useAuth, canEditContent } from "../../shell/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Venue {
  id: string;
  name: string;
  address?: string;
  info?: string;
  website?: string;
}

interface VenueFormData {
  name: string;
  address: string;
  info: string;
  website: string;
}

const emptyForm: VenueFormData = {
  name: "",
  address: "",
  info: "",
  website: "",
};

/* ------------------------------------------------------------------ */
/*  Venue Form                                                         */
/* ------------------------------------------------------------------ */

function VenueForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: VenueFormData;
  onSave: (data: VenueFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<VenueFormData>(initial);

  const update = (partial: Partial<VenueFormData>) =>
    setForm((prev) => ({ ...prev, ...partial }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">
          Venue Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          className="input-field"
          placeholder="e.g. The Fillmore"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">
          Address
        </label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => update({ address: e.target.value })}
          className="input-field"
          placeholder="123 Main St, City, State"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">
          Additional Info
        </label>
        <textarea
          value={form.info}
          onChange={(e) => update({ info: e.target.value })}
          className="input-field min-h-[80px] resize-y"
          rows={3}
          placeholder="Capacity, parking, load-in notes..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-secondary-300 mb-1">
          Website
        </label>
        <input
          type="url"
          value={form.website}
          onChange={(e) => update({ website: e.target.value })}
          className="input-field"
          placeholder="https://venue-website.com"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isSaving} className="btn-primary">
          {isSaving ? "Saving..." : "Save Venue"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function VenuesAdminPage() {
  const { user } = useAuth();
  const isEditor = canEditContent(user);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Venue[]>("/venues");
      setVenues(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load venues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  if (!isEditor) {
    return (
      <main className="container-max section-padding text-center">
        <p className="text-secondary-400 text-lg">
          You don't have permission to manage venues.
        </p>
        <Link to="/" className="btn-secondary text-sm mt-4 inline-block">
          Go Home
        </Link>
      </main>
    );
  }

  const handleCreate = async (data: VenueFormData) => {
    setSaving(true);
    try {
      await apiPost("/venues", {
        name: data.name.trim(),
        address: data.address.trim() || undefined,
        info: data.info.trim() || undefined,
        website: data.website.trim() || undefined,
      });
      setMode("list");
      await fetchVenues();
    } catch (err) {
      let msg = "Failed to create venue";
      if (err instanceof ApiError) {
        try {
          const parsed = JSON.parse(err.body || "{}");
          msg = parsed.error ? `Venue creation failed: ${parsed.error}` : msg;
        } catch {
          msg = err.body ? `Venue creation failed: ${err.body}` : msg;
        }
      }
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (data: VenueFormData) => {
    if (!editingVenue) return;
    setSaving(true);
    try {
      await apiPut(`/venues`, {
        id: editingVenue.id,
        name: data.name.trim(),
        address: data.address.trim() || undefined,
        info: data.info.trim() || undefined,
        website: data.website.trim() || undefined,
      });
      setMode("list");
      setEditingVenue(null);
      await fetchVenues();
    } catch {
      alert("Failed to update venue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/venues?id=${id}`);
      setConfirmDelete(null);
      await fetchVenues();
    } catch {
      alert("Failed to delete venue");
    }
  };

  const startEdit = (venue: Venue) => {
    setEditingVenue(venue);
    setMode("edit");
  };

  return (
    <main className="container-max section-padding">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold text-white">
          Manage Venues
        </h1>
        {mode === "list" && (
          <button
            onClick={() => setMode("create")}
            className="btn-primary text-sm"
          >
            <PlusIcon className="w-4 h-4 mr-1 inline" />
            New Venue
          </button>
        )}
      </div>

      {error && (
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchVenues} className="btn-secondary text-sm">
            Retry
          </button>
        </div>
      )}

      {/* Create / Edit form */}
      <AnimatePresence mode="wait">
        {(mode === "create" || mode === "edit") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="card p-6 mb-8"
          >
            <h2 className="text-xl font-display font-bold text-white mb-6">
              {mode === "create"
                ? "Create New Venue"
                : `Edit: ${editingVenue?.name}`}
            </h2>
            <VenueForm
              initial={
                mode === "edit" && editingVenue
                  ? {
                      name: editingVenue.name,
                      address: editingVenue.address ?? "",
                      info: editingVenue.info ?? "",
                      website: editingVenue.website ?? "",
                    }
                  : emptyForm
              }
              onSave={mode === "create" ? handleCreate : handleUpdate}
              onCancel={() => {
                setMode("list");
                setEditingVenue(null);
              }}
              isSaving={saving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Venues list */}
      {mode === "list" && !loading && (
        <div className="space-y-3">
          {venues.length === 0 && (
            <p className="text-secondary-400 text-center py-12">
              No venues yet. Create your first one!
            </p>
          )}
          {venues.map((venue) => (
            <motion.div
              key={venue.id}
              layout
              className="card p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-lg bg-secondary-700 flex items-center justify-center shrink-0">
                <MapPinIcon className="w-6 h-6 text-primary-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">
                  {venue.name}
                </h3>
                {venue.address && (
                  <p className="text-sm text-secondary-400 truncate">
                    {venue.address}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {venue.website && (
                    <a
                      href={venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-400 hover:text-primary-300 inline-flex items-center gap-1"
                    >
                      <GlobeAltIcon className="w-3 h-3" />
                      Website
                    </a>
                  )}
                  {venue.info && (
                    <span className="text-xs text-secondary-500 truncate max-w-[200px]">
                      {venue.info}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(venue)}
                  className="p-2 rounded-lg text-secondary-400 hover:text-primary-400 hover:bg-secondary-700/50 transition-colors"
                  title="Edit"
                >
                  <PencilSquareIcon className="w-5 h-5" />
                </button>
                {confirmDelete === venue.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(venue.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-2 py-1 text-xs text-secondary-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(venue.id)}
                    className="p-2 rounded-lg text-secondary-400 hover:text-red-400 hover:bg-secondary-700/50 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="card p-4 flex items-center gap-4 animate-pulse"
            >
              <div className="w-12 h-12 rounded-lg bg-secondary-700/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary-700/50 rounded w-1/3" />
                <div className="h-3 bg-secondary-700/50 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
