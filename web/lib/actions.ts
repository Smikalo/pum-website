// ./web/lib/actions.ts
import { API_BASE } from "@/lib/config";

type Json = Record<string, any>;

function isFormData(body: any): body is FormData {
    return typeof FormData !== "undefined" && body instanceof FormData;
}

/**
 * Generic authenticated fetch that:
 * - Adds Authorization header
 * - Sets JSON Content-Type when body is not FormData
 * - Throws on non-2xx with best-effort error message
 */
async function fetchAuth(
    path: string,
    opts: RequestInit & { token: string },
) {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${opts.token}`,
    };

    // Only set JSON Content-Type when not sending FormData
    if (!isFormData((opts as any).body)) {
        headers["Content-Type"] = "application/json";
    }

    // Keep any caller-provided headers
    if (opts.headers) {
        for (const [k, v] of Object.entries(
            opts.headers as Record<string, string>,
        )) {
            if (typeof v !== "undefined") headers[k] = v as any;
        }
    }

    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            ...opts,
            credentials: "include",
            headers,
        });
    } catch (e) {
        // Connection/CORS/network
        throw new Error(
            "Network error. Check API_BASE, server status, and CORS.",
        );
    }

    if (!res.ok) {
        let msg = res.statusText;
        try {
            const j = await res.json();
            msg = (j as any)?.error || msg;
        } catch {
            // ignore JSON parse error
        }
        throw new Error(msg || `HTTP ${res.status}`);
    }

    return res.json();
}

/**
 * Helper to ensure we always send a filename with file uploads.
 * This avoids Multer seeing `originalname = undefined`.
 */
function appendFileWithName(
    fd: FormData,
    field: string,
    file: File,
    fallbackBaseName: string,
) {
    const anyFile = file as any;

    let baseName =
        typeof anyFile.name === "string" && anyFile.name.trim().length
            ? anyFile.name.trim()
            : fallbackBaseName;

    // If there is no extension, just leave it as-is; backend usually doesn't rely on extension.
    fd.append(field, file as any, baseName);
}

/* ---------------------------- Account / Me ---------------------------- */

export async function getMyProfile(token: string) {
    return fetchAuth("/api/account/profile", { method: "GET", token });
}

export async function updateMyProfile(token: string, body: Json) {
    return fetchAuth("/api/account/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

export async function uploadAvatar(token: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "avatar", file, "avatar");
    return fetchAuth("/api/account/avatar", {
        method: "POST",
        token,
        body: fd as any,
    });
}

// CV upload (PDF) for current user
export async function uploadCv(token: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "cv", file, "cv");
    return fetchAuth("/api/account/cv", {
        method: "POST",
        token,
        body: fd as any,
    });
}

/* ----------------------------- Event files ---------------------------- */

// Upload a single event photo file; returns { url }
export async function uploadEventPhoto(token: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "photo", file, "event-photo");
    return fetchAuth("/api/uploads/event-photo", {
        method: "POST",
        token,
        body: fd as any,
    });
}

/* ---------------------------- Project files --------------------------- */

// Upload a single project photo file; returns { url }
export async function uploadProjectPhoto(token: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "photo", file, "project-photo");
    return fetchAuth("/api/uploads/project-photo", {
        method: "POST",
        token,
        body: fd as any,
    });
}

/* ------------------------------ Events CRUD --------------------------- */

// Create event (JSON; photos already uploaded separately)
export async function createEvent(token: string, body: Json) {
    return fetchAuth("/api/events", {
        method: "POST",
        token,
        body: JSON.stringify(body),
    });
}

// Update event (JSON; photos already uploaded separately)
export async function updateEvent(
    token: string,
    slug: string,
    body: Json,
) {
    return fetchAuth(`/api/events/${slug}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

// Delete event (requires slug confirmation on backend)
export async function deleteEvent(
    token: string,
    slug: string,
    confirmSlug: string,
) {
    return fetchAuth(`/api/events/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

/* ----------------------------- Projects CRUD -------------------------- */

// Create project (JSON; photos already uploaded separately)
export async function createProject(token: string, body: Json) {
    return fetchAuth("/api/projects", {
        method: "POST",
        token,
        body: JSON.stringify(body),
    });
}

// Update project (JSON; photos already uploaded separately)
export async function updateProject(
    token: string,
    slug: string,
    body: Json,
) {
    return fetchAuth(`/api/projects/${slug}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

// Delete project (requires slug confirmation on backend)
export async function deleteProject(
    token: string,
    slug: string,
    confirmSlug: string,
) {
    return fetchAuth(`/api/projects/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

/* ----------------------------- Members admin -------------------------- */

// Update another member's profile (admin/mod only, backend-enforced)
export async function updateMemberProfile(
    token: string,
    slug: string,
    body: Json,
) {
    return fetchAuth(`/api/members/${slug}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

// Delete a member (admin/mod only, backend-enforced; requires slug confirmation)
export async function deleteMember(
    token: string,
    slug: string,
    confirmSlug: string,
) {
    return fetchAuth(`/api/members/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

// Upload a member's CV (admin/mod member-admin page; PDF)
export async function uploadMemberCv(
    token: string,
    slug: string,
    file: File,
) {
    const fd = new FormData();
    appendFileWithName(fd, "cv", file, "cv");
    return fetchAuth(`/api/members/${slug}/cv`, {
        method: "POST",
        token,
        body: fd as any,
    });
}

// Upload a member's avatar (admin/mod member-admin page; image)
export async function uploadMemberAvatar(
    token: string,
    slug: string,
    file: File,
) {
    const fd = new FormData();
    appendFileWithName(fd, "avatar", file, "avatar");
    return fetchAuth(`/api/members/${slug}/avatar`, {
        method: "POST",
        token,
        body: fd as any,
    });
}

/* ------------------------------ Blogs ------------------------------ */

// Create blog (JSON; images already uploaded separately as URLs)
export async function createBlog(token: string, body: Json) {
    return fetchAuth("/api/blogs", {
        method: "POST",
        token,
        body: JSON.stringify(body),
    });
}

// Update blog (JSON; images already uploaded separately as URLs)
export async function updateBlog(
    token: string,
    slug: string,
    body: Json,
) {
    return fetchAuth(`/api/blogs/${slug}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

/**
 * Upload a single blog photo file; returns { url }.
 *
 * Differences vs other upload helpers:
 * - Uses raw fetch instead of fetchAuth so we can:
 *   - Look at status codes directly
 *   - Treat `400 { error: "No file uploaded" }` as a soft "no-op" instead of
 *     throwing and breaking the entire blog save.
 */
export async function uploadBlogPhoto(token: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "photo", file, "blog-photo");

    let res: Response;
    try {
        res = await fetch(`${API_BASE}/api/uploads/blog-photo`, {
            method: "POST",
            credentials: "include",
            headers: {
                Authorization: `Bearer ${token}`,
                // DO NOT set Content-Type here; let fetch / FormData set boundary
            },
            body: fd as any,
        });
    } catch (e) {
        throw new Error("Network error while uploading blog photo");
    }

    if (!res.ok) {
        // Try to parse JSON error to detect "No file uploaded"
        try {
            const data: any = await res.json();

            if (data?.error === "No file uploaded") {
                // This is the "empty file field" / placeholder case.
                // We treat it as a no-op instead of an error.
                return { url: null as string | null };
            }

            throw new Error(data?.error || `HTTP ${res.status}`);
        } catch (err) {
            // If parsing JSON fails or anything else goes wrong, throw a generic error.
            if (err instanceof Error) {
                throw new Error(
                    `Failed to upload blog photo: ${err.message}`,
                );
            }
            throw new Error(
                `Failed to upload blog photo (HTTP ${res.status})`,
            );
        }
    }

    return res.json();
}
