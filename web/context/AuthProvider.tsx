"use client";

import React from "react";
import {
    login as apiLogin,
    refresh as apiRefresh,
    me as apiMe,
    logout as apiLogout,
} from "@/lib/authClient";
import { toImageSrc } from "@/lib/images";

type MemberLite = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
};

type User = {
    id: string;
    email: string;
    roles: string[];
    member?: MemberLite | null;
};

type AuthContextValue = {
    user: User | null;
    accessToken: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(
    undefined,
);

const ACCESS_TOKEN_COOKIE_NAME = "access_token";

/**
 * Store the current access token in a regular cookie so that
 * Next.js server actions (which run on the app domain) can read it
 * via `cookies().get("access_token")` and forward it as
 * `Authorization: Bearer <token>` to the API.
 *
 * This is separate from the HTTP-only refresh token the API sets.
 */
function setAccessTokenCookie(token: string | null) {
    if (typeof document === "undefined") return;

    if (!token) {
        // Clear cookie
        document.cookie = `${ACCESS_TOKEN_COOKIE_NAME}=; path=/; max-age=0`;
        return;
    }

    // Access tokens are short-lived (e.g. ~15–30 minutes).
    // Using 30 minutes here is fine – if the JWT expires earlier,
    // the API will reject it and the UI can handle that.
    const maxAgeSeconds = 60 * 30;

    document.cookie = `${ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(
        token,
    )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function normalizeUser(data: any): User {
    const m = data?.member;
    return {
        id: String(data?.id ?? ""),
        email: String(data?.email ?? ""),
        roles: Array.isArray(data?.roles)
            ? data.roles
            : Array.isArray(data?.roleNames)
                ? data.roleNames
                : [],
        member: m
            ? {
                slug: String(m.slug ?? m.id ?? ""),
                name: String(m.name ?? ""),
                avatarUrl: toImageSrc(m.avatarUrl ?? m.avatar ?? null),
                headline: m.headline ?? m.shortBio ?? null,
            }
            : null,
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [accessToken, setAccessToken] = React.useState<string | null>(null);
    const [user, setUser] = React.useState<User | null>(null);

    const silentRefresh = React.useCallback(async () => {
        try {
            const r = await apiRefresh();
            setAccessToken(r.accessToken);
            setAccessTokenCookie(r.accessToken);

            const me = await apiMe(r.accessToken);
            setUser(normalizeUser(me.user));
        } catch (err) {
            // console.warn("[AuthProvider] silent refresh failed", err);
            setAccessToken(null);
            setAccessTokenCookie(null);
            setUser(null);
        }
    }, []);

    // On mount, try to restore the session from the refresh token cookie
    React.useEffect(() => {
        silentRefresh();
    }, [silentRefresh]);

    const login = React.useCallback(
        async (email: string, password: string) => {
            const res = await apiLogin(email, password);
            setAccessToken(res.accessToken);
            setAccessTokenCookie(res.accessToken);
            setUser(normalizeUser(res.user));
        },
        [],
    );

    const logout = React.useCallback(async () => {
        try {
            await apiLogout();
        } finally {
            setAccessToken(null);
            setAccessTokenCookie(null);
            setUser(null);
        }
    }, []);

    const refresh = React.useCallback(async () => {
        await silentRefresh();
    }, [silentRefresh]);

    const value: AuthContextValue = {
        user,
        accessToken,
        login,
        logout,
        refresh,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = React.useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within <AuthProvider>");
    }
    return ctx;
}
