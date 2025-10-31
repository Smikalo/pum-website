// web/lib/api.ts
import { API_BASE } from "@/lib/config";

type Json = Record<string, any>;

async function fetchAuth(path: string, opts: RequestInit & { token: string }) {
    const bodyIsFormData = (typeof FormData !== "undefined") && (opts as any).body instanceof FormData;

    const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.token}`,
    };
    if (opts.headers) {
        for (const [k, v] of Object.entries(opts.headers as Record<string, string>)) {
            if (typeof v !== "undefined") headers[k] = v as any;
        }
    }
    if (!bodyIsFormData) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        credentials: "include",
        headers,
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

// --- NEW: CV upload (PDF) ---
export async function uploadCv(token: string, file: File) {
    const fd = new FormData();
    fd.append("cv", file);
    return fetchAuth("/api/account/cv", { method: "POST", token, body: fd as any });
}
