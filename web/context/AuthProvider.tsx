"use client";

import React from "react";
import { login as apiLogin, refresh as apiRefresh, me as apiMe, logout as apiLogout } from "@/lib/authClient";
import { toImageSrc } from "@/lib/images";

type MemberLite = { slug: string; name: string; avatarUrl: string | null; focusArea?: string | null };
type User = { id: string; email: string; roles: string[]; member: MemberLite | null };

type AuthContextType = {
    user: User | null;
    accessToken: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextType>({} as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = React.useState<User | null>(null);
    const [accessToken, setAccessToken] = React.useState<string | null>(null);

    const normalizeUser = (u: any): User => {
        if (!u) return null as any;
        const member = u.member
            ? { ...u.member, avatarUrl: toImageSrc(u.member.avatarUrl) }
            : null;
        return { ...u, member };
    };

    const silentRefresh = React.useCallback(async () => {
        try {
            const r = await apiRefresh();
            setAccessToken(r.accessToken);
            const me = await apiMe(r.accessToken);
            setUser(normalizeUser(me.user));
        } catch {
            setUser(null);
            setAccessToken(null);
        }
    }, []);

    React.useEffect(() => { silentRefresh(); }, [silentRefresh]);

    const login = async (email: string, password: string) => {
        const r = await apiLogin(email, password);
        setAccessToken(r.accessToken);
        setUser(normalizeUser(r.user));
    };

    const logout = async () => {
        await apiLogout();
        setUser(null);
        setAccessToken(null);
    };

    return <AuthContext.Provider value={{ user, accessToken, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => React.useContext(AuthContext);
