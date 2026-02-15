/* ------------------------------------------------------------------ */
/*  API utility – wraps fetch with auth headers & caching             */
/* ------------------------------------------------------------------ */

// Window type extensions declared in vite-env.d.ts

/** Read the API base URL injected by config.js */
export function getApiBase(): string {
  const base = window.API_BASE_URL;
  if (!base) throw new Error('API_BASE_URL is not configured. Ensure config.js is loaded.');
  return base.replace(/\/+$/, '');
}

/**
 * Promise wrapper around auth.js getIdToken callback.
 * Uses ID token (not access token) because it contains cognito:groups,
 * which the API needs for role-based authorization.
 */
export function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!window.auth) {
      resolve(null);
      return;
    }
    window.auth.getIdToken((err, token) => {
      if (err || !token) {
        resolve(null);
      } else {
        resolve(token);
      }
    });
  });
}

/** Core fetch wrapper — attaches Authorization header when available */
export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const token = await getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach impersonation headers if present (set by ImpersonationContext)
  const impersonateUser = sessionStorage.getItem('ows_impersonate_user');
  const impersonateRole = sessionStorage.getItem('ows_impersonate_role');
  if (impersonateUser) headers['X-Impersonate-User'] = impersonateUser;
  if (impersonateRole) headers['X-Impersonate-Role'] = impersonateRole;

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

/** Typed HTTP helpers */
export function apiGet<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'GET' });
}

export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = unknown>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}

/* ------------------------------------------------------------------ */
/*  Search cache – localStorage with 5-minute TTL                     */
/* ------------------------------------------------------------------ */

const CACHE_PREFIX = 'ows_search_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export const searchCache = {
  get<T = unknown>(key: string): T | null {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (Date.now() - entry.ts > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set<T = unknown>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = { data, ts: Date.now() };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  },

  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  },
};

/* ------------------------------------------------------------------ */
/*  Error class                                                       */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}
