'use client';

import React from "react";
import * as auth from "@/lib/authClient";

type UserInfo = {
    id: string;
    email: string;
    roles: string[];
    member: { slug: string; name: string; avatarUrl: string | null } | null;
};

type AuthContextType = {
    user: UserInfo | null;
    accessToken: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<UserInfo | null>(null);
    const [accessToken, setAccessToken] = React.useState<string | null>(null);

    const scheduleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    function scheduleRefresh() {
        if (scheduleRef.current) clearTimeout(scheduleRef.current);
        // refresh ~12 minutes after login (access token is 15 min)
        scheduleRef.current = setTimeout(async () => {
            try {
                const r = await auth.refresh();
                setAccessToken(r.accessToken);
            } catch {
                setAccessToken(null);
                setUser(null);
            }
        }, 12 * 60 * 1000);
    }

    const doLogin = React.useCallback(async (email: string, password: string) => {
        const r = await auth.login(email, password);
        setAccessToken(r.accessToken);
        setUser(r.user);
        scheduleRefresh();
    }, []);

    const doLogout = React.useCallback(async () => {
        try { await auth.logout(); } finally {
            setUser(null);
            setAccessToken(null);
            if (scheduleRef.current) clearTimeout(scheduleRef.current);
        }
    }, []);

    // Silent sign-in on first mount
    React.useEffect(() => {
        (async () => {
            try {
                const r = await auth.refresh();
                setAccessToken(r.accessToken);
                const me = await auth.me(r.accessToken);
                setUser(me.user);
                scheduleRefresh();
            } catch {
                // not signed in — nothing to do
            }
        })();
        return () => { if (scheduleRef.current) clearTimeout(scheduleRef.current); };
    }, []);

    const value: AuthContextType = { user, accessToken, login: doLogin, logout: doLogout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = React.useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
