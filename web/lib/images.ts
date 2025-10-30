// web/lib/images.ts
import { API_BASE } from "@/lib/config";

/**
 * Convert a possibly relative image URL (e.g. "/uploads/avatars/x.webp")
 * into an absolute URL that the BROWSER can load (e.g. "http://localhost:3001/uploads/avatars/x.webp").
 */
export function toImageSrc(u?: string | null): string | null {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    // Ensure leading slash and prefix with API_BASE
    const path = u.startsWith("/") ? u : `/${u}`;
    return `${API_BASE}${path}`;
}
