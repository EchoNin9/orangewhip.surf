import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { apiGet, getToken } from '@/utils/api';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type UserRole = 'admin' | 'manager' | 'editor' | 'band' | 'guest';

export interface AuthUser {
  userId: string;
  email: string;
  groups: string[];
  role: UserRole;
  customGroups: string[];
  displayName: string;
  userHandle?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signOut: () => void;
  refreshAuth: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Role helpers                                                      */
/* ------------------------------------------------------------------ */

const ROLE_HIERARCHY: readonly UserRole[] = [
  'guest',
  'band',
  'editor',
  'manager',
  'admin',
] as const;

/** Map Cognito group names to a single resolved role (highest wins). */
export function mapGroupsToRole(groups: string[]): UserRole {
  const groupSet = new Set(groups.map((g) => g.toLowerCase()));
  if (groupSet.has('admin')) return 'admin';
  if (groupSet.has('manager')) return 'manager';
  if (groupSet.has('editor')) return 'editor';
  if (groupSet.has('band')) return 'band';
  return 'guest';
}

/** Check whether `user` meets the minimum role requirement. */
export function hasRole(user: AuthUser | null, minRole: UserRole): boolean {
  if (!user) return minRole === 'guest';
  const userIdx = ROLE_HIERARCHY.indexOf(user.role);
  const minIdx = ROLE_HIERARCHY.indexOf(minRole);
  return userIdx >= minIdx;
}

/** Check whether the user belongs to a custom (DynamoDB) group. */
export function isInGroup(user: AuthUser | null, groupName: string): boolean {
  if (!user) return false;
  return user.customGroups.includes(groupName);
}

/* Convenience permission helpers */
export const canManageMedia = (user: AuthUser | null): boolean => hasRole(user, 'band');
export const canEditContent = (user: AuthUser | null): boolean => hasRole(user, 'editor');
export const canAdminister = (user: AuthUser | null): boolean => hasRole(user, 'admin');
/** Managers can manage users (except admin visibility/assignment); admins have full access. */
export const canManageUsers = (user: AuthUser | null): boolean => hasRole(user, 'manager');
/** True if user is in any Cognito group (band, editor, manager, admin). */
export const isMember = (user: AuthUser | null): boolean => hasRole(user, 'band');

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  signOut: () => {},
  refreshAuth: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

// Window.auth type declared in vite-env.d.ts

interface MeResponse {
  userId: string;
  email: string;
  groups: string[];
  customGroups: string[];
  displayName: string;
  userHandle?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Build an AuthUser from the /me endpoint (or token decode fallback). */
  const bootstrap = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setUser(null);
        return;
      }

      // Try fetching full profile from the API
      try {
        const me = await apiGet<MeResponse>('/me');
        const groups = me.groups ?? [];
        setUser({
          userId: me.userId,
          email: me.email,
          groups,
          role: mapGroupsToRole(groups),
          customGroups: me.customGroups ?? [],
          displayName: me.displayName || me.email,
          userHandle: me.userHandle ?? "",
        });
      } catch {
        // /me not available – fall back to token info
        const info = window.auth?.getUserInfo?.();
        if (info) {
          const groups = info.groups ?? [];
          setUser({
            userId: info.sub,
            email: info.email,
            groups,
            role: mapGroupsToRole(groups),
            customGroups: [],
            displayName: info.email,
            userHandle: "",
          });
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for auth.js to be available
    if (!window.auth) {
      setIsLoading(false);
      return;
    }

    window.auth.isAuthenticated((err, authed) => {
      if (err || !authed) {
        setIsLoading(false);
        return;
      }
      bootstrap();
    });
  }, [bootstrap]);

  const signOut = useCallback(() => {
    window.auth?.signOut();
    setUser(null);
  }, []);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    await bootstrap();
  }, [bootstrap]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
