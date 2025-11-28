// web/lib/api.ts
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
 * - Logs details when something goes wrong
 */
async function fetchAuth<TResponse = unknown>(
    path: string,
    opts: AuthFetchOptions,
): Promise<TResponse> {
    const { token, headers: initHeaders, ...rest } = opts;

    const headers = new Headers(initHeaders ?? undefined);
    headers.set("Authorization", `Bearer ${token}`);

    if (!isFormData(rest.body) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const url = `${API_BASE}${path}`;
    let res: Response;

    try {
        // eslint-disable-next-line no-console
        console.log("[lib/api] fetchAuth request", {
            path,
            url,
            method: rest.method ?? "GET",
        });

        res = await fetch(url, {
            ...rest,
            credentials: "include",
            headers,
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[lib/api] network error", {
            path,
            url,
            apiBase: API_BASE,
            error: err,
        });
        throw new Error("Network error. Check API_BASE, server status, and CORS.");
    }

    if (!res.ok) {
        let msg = res.statusText;
        let parsedBody: unknown = null;

        try {
            parsedBody = await res.json();
            if (parsedBody && typeof parsedBody === "object" && "error" in parsedBody) {
                const { error } = parsedBody as { error?: unknown };
                if (typeof error === "string" && error.trim().length > 0) {
                    msg = error;
                }
            }
        } catch {
            // ignore JSON parse error
        }

        // eslint-disable-next-line no-console
        console.error("[lib/api] HTTP error", {
            path,
            url,
            status: res.status,
            statusText: res.statusText,
            body: parsedBody,
        });

        throw new Error(msg || `HTTP ${res.status}`);
    }

    try {
        const json = (await res.json()) as TResponse;
        // eslint-disable-next-line no-console
        console.log("[lib/api] fetchAuth success", { path, url });
        return json;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[lib/api] failed to parse JSON", {
            path,
            url,
            error: err,
        });
        throw new Error("Failed to parse response JSON.");
    }
}

/**
 * Helper to ensure we always send a filename with file uploads.
 * This avoids Multer seeing `originalname = undefined`.
 */
function appendFileWithName(fd: FormData, field: string, file: File, fallbackBaseName: string) {
    const candidate = typeof file.name === "string" ? file.name.trim() : "";
    const baseName = candidate.length > 0 ? candidate : fallbackBaseName;
    fd.append(field, file, baseName);
}

/** Minimal shape for uploads that return a URL. */
export type UploadPhotoResponse = {
    url: string | null;
};

/** Shape of the profile object returned by the backend. */
export interface AccountProfileApi {
    id?: string | number;
    slug?: string;
    name?: string;
    headline?: string | null;
    shortBio?: string | null;
    markdown?: string | null;
    links?: Record<string, string> | null;
    avatarUrl?: string | null;
    focusArea?: string | null;
    skills?: string[] | null;
    techStack?: string[] | null;
    cvUrl?: string | null;
}

/** Response wrapper for "my profile" endpoints. */
export interface AccountProfileResponse {
    profile: AccountProfileApi;
}

/** Response for CV upload. */
export interface UploadCvResponse {
    url?: string | null;
    extractedSkills?: string[];
    extractedTech?: string[];
}

/** Minimal shape for create/update endpoints that return a slug. */
export type SlugResponse = {
    slug: string;
};

/* ---------------------------- Account / Me ---------------------------- */

export async function getMyProfile(token: string): Promise<AccountProfileResponse> {
    return fetchAuth<AccountProfileResponse>("/api/account/profile", {
        method: "GET",
        token,
    });
}

export async function updateMyProfile(
    token: string,
    body: Json,
): Promise<AccountProfileResponse> {
    return fetchAuth<AccountProfileResponse>("/api/account/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

export async function uploadAvatar(token: string, file: File): Promise<UploadPhotoResponse> {
    const fd = new FormData();
    appendFileWithName(fd, "avatar", file, "avatar");
    return fetchAuth<UploadPhotoResponse>("/api/account/avatar", {
        method: "POST",
        token,
        body: fd,
    });
}

// CV upload (PDF) for current user
export async function uploadCv(token: string, file: File): Promise<UploadCvResponse> {
    const fd = new FormData();
    appendFileWithName(fd, "cv", file, "cv");
    return fetchAuth<UploadCvResponse>("/api/account/cv", {
        method: "POST",
        token,
        body: fd,
    });
}

/* ----------------------------- Event files ---------------------------- */

// Upload a single event photo file; returns { url }
export async function uploadEventPhoto(
    token: string,
    file: File,
): Promise<UploadPhotoResponse> {
    const fd = new FormData();
    appendFileWithName(fd, "photo", file, "event-photo");
    return fetchAuth<UploadPhotoResponse>("/api/uploads/event-photo", {
        method: "POST",
        token,
        body: fd,
    });
}

/* ---------------------------- Project files --------------------------- */

// Upload a single project photo file; returns { url }
export async function uploadProjectPhoto(
    token: string,
    file: File,
): Promise<UploadPhotoResponse> {
    const fd = new FormData();
    appendFileWithName(fd, "photo", file, "project-photo");
    return fetchAuth<UploadPhotoResponse>("/api/uploads/project-photo", {
        method: "POST",
        token,
        body: fd,
    });
}

/* ------------------------------ Blog files ---------------------------- */

/**
 * Upload a single blog photo file; returns { url }.
 *
 * Differences vs other upload helpers:
 * - Uses raw fetch instead of fetchAuth so we can handle 400 "No file uploaded" gracefully.
 */
export async function uploadBlogPhoto(
    token: string,
    file: File,
): Promise<{ url: string | null }> {
    const fd = new FormData();
    appendFileWithName(fd, "photo", file, "blog-photo");

    const url = `${API_BASE}/api/uploads/blog-photo`;
    let res: Response;

    try {
        // eslint-disable-next-line no-console
        console.log("[lib/api] uploadBlogPhoto request", {
            url,
        });

        res = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
                Authorization: `Bearer ${token}`,
                // DO NOT set Content-Type; let fetch/FormData set the boundary
            },
            body: fd,
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[lib/api] uploadBlogPhoto network error", {
            url,
            error: err,
        });
        throw new Error("Network error while uploading blog photo");
    }

    if (!res.ok) {
        let parsed: unknown;
        try {
            parsed = await res.json();
        } catch {
            // eslint-disable-next-line no-console
            console.error("[lib/api] uploadBlogPhoto HTTP error (no JSON body)", {
                url,
                status: res.status,
            });
            throw new Error(`Failed to upload blog photo (HTTP ${res.status})`);
        }

        if (parsed && typeof parsed === "object" && "error" in parsed) {
            const { error } = parsed as { error?: unknown };

            if (error === "No file uploaded") {
                // eslint-disable-next-line no-console
                console.warn("[lib/api] uploadBlogPhoto: backend says 'No file uploaded'", {
                    url,
                });
                return { url: null };
            }

            if (typeof error === "string" && error.trim().length > 0) {
                // eslint-disable-next-line no-console
                console.error("[lib/api] uploadBlogPhoto backend error", {
                    url,
                    status: res.status,
                    error,
                });
                throw new Error(error);
            }
        }

        // eslint-disable-next-line no-console
        console.error("[lib/api] uploadBlogPhoto HTTP error", {
            url,
            status: res.status,
            body: parsed,
        });

        throw new Error(`Failed to upload blog photo (HTTP ${res.status})`);
    }

    const data: unknown = await res.json();
    if (!data || typeof data !== "object" || !("url" in data)) {
        // eslint-disable-next-line no-console
        console.warn("[lib/api] uploadBlogPhoto: unexpected response shape", {
            url,
            data,
        });
        return { url: null };
    }

    const { url: photoUrl } = data as { url?: unknown };
    return {
        url: typeof photoUrl === "string" ? photoUrl : null,
    };
}

/* ------------------------------ Events CRUD --------------------------- */

// Create event (JSON; photos already uploaded separately)
export async function createEvent(token: string, body: Json): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>("/api/events", {
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
): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>(`/api/events/${slug}`, {
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
): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>(`/api/events/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

/* ----------------------------- Projects CRUD -------------------------- */

// Create project (JSON; photos already uploaded separately)
export async function createProject(token: string, body: Json): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>("/api/projects", {
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
): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>(`/api/projects/${slug}`, {
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
): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>(`/api/projects/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

/* ------------------------------ Blogs CRUD ---------------------------- */

export async function createBlog(token: string, body: Json): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>("/api/blogs", {
        method: "POST",
        token,
        body: JSON.stringify(body),
    });
}

export async function updateBlog(
    token: string,
    slug: string,
    body: Json,
): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>(`/api/blogs/${slug}`, {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

// Delete blog (requires slug confirmation on backend)
export async function deleteBlog(
    token: string,
    slug: string,
    confirmSlug: string,
): Promise<SlugResponse> {
    return fetchAuth<SlugResponse>(`/api/blogs/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

/* ----------------------------- Members admin -------------------------- */

// Update another member's profile (admin/mod only, backend-enforced)
export async function updateMemberProfile(token: string, slug: string, body: Json) {
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
export async function uploadMemberCv(token: string, slug: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "cv", file, "cv");
    return fetchAuth(`/api/members/${slug}/cv`, {
        method: "POST",
        token,
        body: fd,
    });
}

// Upload a member's avatar (admin/mod member-admin page; image)
export async function uploadMemberAvatar(token: string, slug: string, file: File) {
    const fd = new FormData();
    appendFileWithName(fd, "avatar", file, "avatar");
    return fetchAuth(`/api/members/${slug}/avatar`, {
        method: "POST",
        token,
        body: fd,
    });
}
