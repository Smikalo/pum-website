import { API_BASE } from "@/lib/config";

export type Json = Record<string, unknown>;

function isFormData(body: unknown): body is FormData {
    return typeof FormData !== "undefined" && body instanceof FormData;
}

type AuthFetchOptions = Omit<RequestInit, "headers"> & {
    token: string;
    headers?: HeadersInit;
};

/**
 * Generic authenticated fetch that:
 * - Adds Authorization header
 * - Sets JSON Content-Type when body is not FormData
 * - Throws on non-2xx with best-effort error message
 */
async function fetchAuth<TResponse = unknown>(
    path: string,
    opts: AuthFetchOptions,
): Promise<TResponse> {
    const { token, headers: initHeaders, ...rest } = opts;

    const headers = new Headers(initHeaders ?? undefined);
    headers.set("Authorization", `Bearer ${token}`);

    // Only set JSON Content-Type when not sending FormData
    if (!isFormData(rest.body) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            ...rest,
            credentials: "include",
            headers,
        });
    } catch {
        // Connection/CORS/network
        throw new Error(
            "Network error. Check API_BASE, server status, and CORS.",
        );
    }

    if (!res.ok) {
        let msg = res.statusText;

        try {
            const data: unknown = await res.json();
            if (data && typeof data === "object" && "error" in data) {
                const { error } = data as { error?: unknown };
                if (typeof error === "string" && error.trim().length > 0) {
                    msg = error;
                }
            }
        } catch {
            // ignore JSON parse error
        }

        throw new Error(msg || `HTTP ${res.status}`);
    }

    return (await res.json()) as TResponse;
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
    const candidate =
        typeof file.name === "string" ? file.name.trim() : "";
    const baseName = candidate.length > 0 ? candidate : fallbackBaseName;

    // If there is no extension, just leave it as-is; backend usually doesn't rely on extension.
    fd.append(field, file, baseName);
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
        body: fd,
    });
}

// CV upload (PDF) for current user
export async function uploadCv(token: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "cv", file, "cv");
    return fetchAuth("/api/account/cv", {
        method: "POST",
        token,
        body: fd,
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
        body: fd,
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
        body: fd,
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
        body: fd,
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
        body: fd,
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
export async function uploadBlogPhoto(
    token: string,
    file: File,
): Promise<{ url: string | null }> {
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
            body: fd,
        });
    } catch {
        throw new Error("Network error while uploading blog photo");
    }

    if (!res.ok) {
        let parsed: unknown;
        try {
            parsed = await res.json();
        } catch {
            throw new Error(
                `Failed to upload blog photo (HTTP ${res.status})`,
            );
        }

        if (parsed && typeof parsed === "object" && "error" in parsed) {
            const { error } = parsed as { error?: unknown };

            if (error === "No file uploaded") {
                // This is the "empty file field" / placeholder case.
                // We treat it as a no-op instead of an error.
                return { url: null };
            }

            if (typeof error === "string" && error.trim().length > 0) {
                throw new Error(error);
            }
        }

        throw new Error(
            `Failed to upload blog photo (HTTP ${res.status})`,
        );
    }

    const data: unknown = await res.json();
    if (!data || typeof data !== "object" || !("url" in data)) {
        return { url: null };
    }

    const { url } = data as { url?: unknown };
    return {
        url: typeof url === "string" ? url : null,
    };
}
