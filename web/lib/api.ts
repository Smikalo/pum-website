// web/lib/api.ts
import { API_BASE } from "@/lib/config";

type Json = Record<string, any>;

async function fetchAuth(path: string, opts: RequestInit & { token: string }) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        credentials: "include",
        headers: {
            ...(opts.headers || {}),
            Authorization: `Bearer ${opts.token}`,
            "Content-Type": (opts as any).body instanceof FormData ? undefined : "application/json",
        } as any,
    });
    if (!res.ok) {
        let msg = res.statusText;
        try {
            const j = await res.json();
            msg = j?.error || msg;
        } catch {}
        throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function getMyProfile(token: string) {
    return fetchAuth("/api/account/profile", { method: "GET", token });
}

export async function updateMyProfile(token: string, body: Json) {
    return fetchAuth("/api/account/profile", { method: "PUT", token, body: JSON.stringify(body) });
}

export async function uploadAvatar(token: string, file: File) {
    const fd = new FormData();
    fd.append("avatar", file);
    return fetchAuth("/api/account/avatar", { method: "POST", token, body: fd as any });
}
