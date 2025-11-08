import { API_BASE } from "@/lib/config";

type Json = Record<string, any>;

function isFormData(body: any): body is FormData {
    return typeof FormData !== "undefined" && body instanceof FormData;
}

async function fetchAuth(path: string, opts: RequestInit & { token: string }) {
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
    return fetchAuth("/api/account/profile", {
        method: "PUT",
        token,
        body: JSON.stringify(body),
    });
}

export async function uploadAvatar(token: string, file: File) {
    const fd = new FormData();
    fd.append("avatar", file);
    return fetchAuth("/api/account/avatar", {
        method: "POST",
        token,
        body: fd as any,
    });
}

// CV upload (PDF) for current user
export async function uploadCv(token: string, file: File) {
    const fd = new FormData();
    fd.append("cv", file);
    return fetchAuth("/api/account/cv", {
        method: "POST",
        token,
        body: fd as any,
    });
}

// Upload a single event photo file; returns { url }
export async function uploadEventPhoto(token: string, file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    return fetchAuth("/api/uploads/event-photo", {
        method: "POST",
        token,
        body: fd as any,
    });
}

// Upload a single project photo file; returns { url }
export async function uploadProjectPhoto(token: string, file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    return fetchAuth("/api/uploads/project-photo", {
        method: "POST",
        token,
        body: fd as any,
    });
}

// Upload a single blog photo file; returns { url }
export async function uploadBlogPhoto(token: string, file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    return fetchAuth("/api/uploads/blog-photo", {
        method: "POST",
        token,
        body: fd as any,
    });
}

// Create event (JSON; photos already uploaded separately)
export async function createEvent(token: string, body: Json) {
    return fetchAuth("/api/events", {
        method: "POST",
        token,
        body: JSON.stringify(body),
    });
}

// Update event (JSON; photos already uploaded separately)
export async function updateEvent(token: string, slug: string, body: Json) {
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

// Create blog (JSON; photos already uploaded separately)
export async function createBlog(token: string, body: Json) {
    return fetchAuth("/api/blogs", {
        method: "POST",
        token,
        body: JSON.stringify(body),
    });
}

// Update blog (JSON; photos already uploaded separately)
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

// Delete blog (requires slug confirmation on backend)
export async function deleteBlog(
    token: string,
    slug: string,
    confirmSlug: string,
) {
    return fetchAuth(`/api/blogs/${slug}`, {
        method: "DELETE",
        token,
        body: JSON.stringify({ confirmSlug }),
    });
}

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
    fd.append("cv", file);
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
    fd.append("avatar", file);
    return fetchAuth(`/api/members/${slug}/avatar`, {
        method: "POST",
        token,
        body: fd as any,
    });
}
