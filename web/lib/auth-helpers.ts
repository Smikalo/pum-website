import { useAuth } from "@/context/AuthProvider";

export type AuthUserLike = any;

/**
 * Safely wraps useAuth to avoid crashes if the context is missing.
 * Returns { user: null } if useAuth throws or returns null/undefined.
 */
export function useSafeAuth() {
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const ctx = useAuth();
        return ctx || { user: null, accessToken: null };
    } catch {
        return { user: null, accessToken: null };
    }
}

/**
 * Normalizes roles from a user object (supports both user.roles and user.roleNames).
 * Returns an array of role strings.
 */
export function getRoles(user: AuthUserLike): string[] {
    if (!user) return [];
    return Array.isArray(user?.roles)
        ? user.roles
        : Array.isArray(user?.roleNames)
            ? user.roleNames
            : [];
}