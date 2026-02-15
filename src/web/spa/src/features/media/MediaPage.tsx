import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Tab } from "@headlessui/react";
import { MagnifyingGlassIcon, PlayIcon } from "@heroicons/react/24/solid";
import { motion } from "framer-motion";
import { apiGet, searchCache } from "../../utils/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type MediaType = "audio" | "video" | "image";

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  url: string;
  thumbnail?: string;
  format?: string;
  filesize?: number;
  addedBy?: string;
  addedAt?: string;
  aiSummary?: string;
  categories?: string[];
}

interface Category {
  id: string;
  name: string;
}

interface MediaListResponse {
  items: MediaItem[];
  total: number;
  nextToken?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cacheKey(type: string, search: string, category: string, page: number): string {
  return `media_${type}_${search}_${category}_${page}`;
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-40 bg-secondary-700/50" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-secondary-700/50 rounded w-3/4" />
        <div className="h-3 bg-secondary-700/50 rounded w-1/2" />
        <div className="h-3 bg-secondary-700/50 rounded w-full" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Media card                                                         */
/* ------------------------------------------------------------------ */

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35 },
  }),
};

function MediaCard({ item, index }: { item: MediaItem; index: number }) {
  return (
    <motion.div custom={index} variants={cardVariants} initial="hidden" animate="visible">
      <Link
        to={`/media/${item.id}`}
        className="card block overflow-hidden group hover:border-primary-500/60 transition-colors"
      >
        {/* Thumbnail */}
        <div className="relative h-40 bg-secondary-800 overflow-hidden">
          {item.thumbnail ? (
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-secondary-600">
              {item.type === "audio" ? (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                </svg>
              ) : item.type === "video" ? (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
                </svg>
              ) : (
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              )}
            </div>
          )}

          {/* Audio play overlay */}
          {item.type === "audio" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center shadow-lg">
                <PlayIcon className="w-6 h-6 text-white ml-0.5" />
              </div>
            </div>
          )}

          {/* Format badge */}
          {item.format && (
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-secondary-900/80 text-secondary-200 text-xs font-medium rounded">
              {item.format.toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors truncate">
            {item.title}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-secondary-400">
            {item.filesize != null && <span>{formatBytes(item.filesize)}</span>}
            {item.addedBy && <span>by {item.addedBy}</span>}
            {item.addedAt && (
              <span>
                {new Date(item.addedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
          {item.aiSummary && (
            <p className="mt-2 text-xs text-secondary-300 line-clamp-2">{item.aiSummary}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const TABS: { label: string; type: MediaType }[] = [
  { label: "Audio", type: "audio" },
  { label: "Video", type: "video" },
  { label: "Images", type: "image" },
];

const PAGE_SIZE = 10;

export default function MediaPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Load categories once
  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [activeTab, debouncedSearch, category]);

  // Fetch media
  const fetchMedia = useCallback(async () => {
    const type = TABS[activeTab].type;
    const key = cacheKey(type, debouncedSearch, category, page);

    // Check cache
    const cached = searchCache.get<MediaListResponse>(key);
    if (cached) {
      if (page === 1) {
        setItems(cached.items);
      } else {
        setItems((prev) => [...prev, ...cached.items]);
      }
      setTotal(cached.total);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let path = `/media?type=${type}&limit=${PAGE_SIZE}&page=${page}`;
      if (debouncedSearch) path += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (category) path += `&category=${encodeURIComponent(category)}`;

      const data = await apiGet<MediaListResponse>(path);
      searchCache.set(key, data);

      if (page === 1) {
        setItems(data.items);
      } else {
        setItems((prev) => [...prev, ...data.items]);
      }
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, category, page]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const hasMore = items.length < total;

  return (
    <main className="container-max section-padding">
      <motion.h1
        className="text-4xl sm:text-5xl font-display font-bold text-gradient mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Media
      </motion.h1>

      {/* Tabs */}
      <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
        <Tab.List className="flex gap-1 bg-secondary-800/50 rounded-xl p-1 mb-8 max-w-sm">
          {TABS.map((tab) => (
            <Tab
              key={tab.type}
              className={({ selected }) =>
                `flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors outline-none ${
                  selected
                    ? "bg-primary-500 text-white shadow"
                    : "text-secondary-400 hover:text-white hover:bg-secondary-700/50"
                }`
              }
            >
              {tab.label}
            </Tab>
          ))}
        </Tab.List>
      </Tab.Group>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary-400" />
          <input
            type="text"
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-field sm:w-48"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Loading skeletons */}
      {loading && items.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchMedia} className="btn-secondary text-sm">
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-20">
          <svg className="mx-auto w-16 h-16 text-secondary-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          <p className="text-secondary-400 text-lg">
            No {TABS[activeTab].label.toLowerCase()} found.
          </p>
        </div>
      )}

      {/* Grid */}
      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((item, i) => (
              <MediaCard key={item.id} item={item} index={i} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={loading}
                className="btn-secondary text-sm"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
