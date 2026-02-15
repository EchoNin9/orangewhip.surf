/// <reference types="vite/client" />

interface Window {
  API_BASE_URL?: string;
  COGNITO_USER_POOL_ID?: string;
  COGNITO_CLIENT_ID?: string;
  CATEGORIES_CACHE_KEY?: string;
  getCategoriesFromCache?: () => { id: string; name: string }[];
  saveCategoriesToCache?: (cats: unknown[]) => void;
  auth?: {
    getAccessToken: (cb: (err: Error | null, token?: string) => void) => void;
    getIdToken: (cb: (err: Error | null, token?: string) => void) => void;
    isAuthenticated: (cb: (err: Error | null, authed?: boolean) => void) => void;
    signIn: (email: string, password: string, cb: (err: Error | null, result?: unknown) => void) => void;
    signUp: (email: string, password: string, cb: (err: Error | null, result?: unknown) => void) => void;
    confirmSignUp: (email: string, code: string, cb: (err: Error | null, result?: unknown) => void) => void;
    signOut: () => void;
    getUserInfo?: () => { sub: string; email: string; groups: string[]; emailVerified: boolean } | null;
    getGroups?: () => string[];
  };
}
