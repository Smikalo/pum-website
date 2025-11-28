// web/lib/authClient.ts
import { API_BASE } from "@/lib/config";
import { getCsrfToken } from "@/lib/csrf";

export async function login(email: string, password: string) {
    const csrf = await getCsrfToken();
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrf || "",
        },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Login failed");
    }
    return res.json();
}

export async function refresh() {
    const csrf = await getCsrfToken();
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf || "" },
    });
    if (!res.ok) throw new Error("Not authenticated");
    return res.json();
}

export async function me(accessToken: string) {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch profile");
    return res.json();
}

export async function logout() {
    const csrf = await getCsrfToken();
    const res = await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf || "" },
    });
    if (!res.ok) throw new Error("Logout failed");
    return res.json();
}