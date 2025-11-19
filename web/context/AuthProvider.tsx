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
    /** optional legacy field still read in some components */
    roleNames?: string[];
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

function setAccessTokenCookie(token: string | null) {
    if (typeof document === "undefined") return;

    if (!token) {
        document.cookie = `${ACCESS_TOKEN_COOKIE_NAME}=; path=/; max-age=0`;
        return;
    }

    const maxAgeSeconds = 60 * 30;

    document.cookie = `${ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(
        token,
    )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

type ApiMemberLite = {
    slug?: unknown;
    id?: unknown;
    name?: unknown;
    avatarUrl?: unknown;
    avatar?: unknown;
    headline?: unknown;
    shortBio?: unknown;
};

type ApiUserLike = {
    id?: unknown;
    email?: unknown;
    roles?: unknown;
    roleNames?: unknown;
    member?: unknown;
};

function normalizeUser(data: unknown): User {
    const src = (data ?? {}) as ApiUserLike;

    const rawRoles =
        Array.isArray(src.roles) && src.roles.length
            ? src.roles
            : Array.isArray(src.roleNames)
                ? src.roleNames
                : [];

    const roles = rawRoles
        .map((r) => (typeof r === "string" ? r : null))
        .filter((r): r is string => r !== null);

    const roleNames =
        Array.isArray(src.roleNames) && src.roleNames.length
            ? src.roleNames.filter((r): r is string => typeof r === "string")
            : undefined;

    let member: MemberLite | null = null;
    if (src.member && typeof src.member === "object") {
        const m = src.member as ApiMemberLite;
        const slug = String(m.slug ?? m.id ?? "");
        const name =
            typeof m.name === "string"
                ? m.name
                : m.name != null
                    ? String(m.name)
                    : "";
        const avatarInput =
            typeof m.avatarUrl === "string"
                ? m.avatarUrl
                : typeof m.avatar === "string"
                    ? m.avatar
                    : null;
        const headline =
            typeof m.headline === "string"
                ? m.headline
                : typeof m.shortBio === "string"
                    ? m.shortBio
                    : null;

        member = {
            slug,
            name,
            avatarUrl: toImageSrc(avatarInput),
            headline,
        };
    }

    return {
        id: src.id != null ? String(src.id) : "",
        email: src.email != null ? String(src.email) : "",
        roles,
        roleNames,
        member,
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
        } catch (_err: unknown) {
            setAccessToken(null);
            setAccessTokenCookie(null);
            setUser(null);
        }
    }, []);

    React.useEffect(() => {
        void silentRefresh();
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
