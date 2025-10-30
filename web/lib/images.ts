import { API_BASE } from "@/lib/config";

export function toImageSrc(u?: string | null): string | null {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${API_BASE}${path}`;
}
