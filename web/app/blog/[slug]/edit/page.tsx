export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;

import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { API_BASE } from "@/lib/config";
import { uploadBlogPhoto } from "@/lib/actions";
import { me as fetchMe } from "@/lib/authClient";
import BlogEditorForm from "@/components/BlogEditorForm";
import { tServer } from "@/lib/i18n-server";

type Blog = {
    id: string;
    slug: string;
    title: string;
    summary?: string | null;
    content?: string | null;
    cover?: string | null;
    imageUrl?: string | null;
    images?: string[];
    publishedAt?: string | null;
    tags?: string[];
    techStack?: string[];
    authors?: {
        slug: string;
        name: string;
        avatarUrl?: string | null;
        headline?: string | null;
        role?: string | null;
    }[];
    projectSlugs?: string[];
    eventSlugs?: string[];
};

function normArr(x: any): string[] {
    if (Array.isArray(x)) return x;
    if (typeof x === "string") {
        return x
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
}

function normalizeBlog(raw: any): Blog | null {
    if (!raw) return null;
    const b = raw.item ?? raw.data ?? raw;

    const images: string[] = Array.isArray(b.images)
        ? b.images
        : Array.isArray(b.photos)
            ? b.photos
            : [];
    const cover = b.cover ?? b.imageUrl ?? images[0] ?? null;

    const content =
        b.content ?? b.body ?? b.markdown ?? b.html ?? b.text ?? null;

    const authorsInput: any[] = Array.isArray(b.authors)
        ? b.authors
        : Array.isArray(b.author)
            ? b.author
            : [];

    const normalizeAuthor = (a: any) => {
        const m = a?.member ?? a ?? {};
        return {
            slug: m.slug ?? m.id ?? "",
            name: m.name ?? "",
            avatarUrl: m.avatarUrl ?? m.avatar ?? null,
            headline: m.headline ?? m.shortBio ?? null,
            role: a?.role ?? m.role ?? null,
        };
    };

    let eventSlugs: string[] = normArr(b.eventSlugs);
    if (!eventSlugs.length && Array.isArray(b.events)) {
        eventSlugs = (b.events as any[])
            .map((e) => e?.slug)
            .filter(
                (s): s is string =>
                    typeof s === "string" && s.trim().length > 0,
            )
            .map((s) => s.trim());
    }

    const blog: Blog = {
        id: String(b.id ?? b.slug ?? ""),
        slug: String(b.slug ?? b.id ?? ""),
        title: String(b.title ?? b.name ?? "Untitled"),
        summary: b.summary ?? null,
        content,
        cover,
        imageUrl: b.imageUrl ?? null,
        images,
        publishedAt: b.publishedAt ?? b.date ?? b.createdAt ?? null,
        tags: normArr(b.tags),
        techStack: normArr(b.techStack ?? b.tech),
        authors: authorsInput.map(normalizeAuthor),
        projectSlugs: normArr(b.projectSlugs),
        eventSlugs,
    };

    return blog;
}

async function fetchBlog(slug: string): Promise<Blog | null> {
    try {
        const url = new URL(`/api/blogs/${slug}`, API_BASE);
        const res = await fetch(url.toString(), {
            cache: "no-store",
        });

        if (!res.ok) {
            return null;
        }

        const json = await res.json();
        const blog = normalizeBlog(json);
        return blog;
    } catch {
        return null;
    }
}

function parseCsv(formData: FormData, key: string): string[] {
    const values = formData.getAll(key);
    const out: string[] = [];
    for (const v of values) {
        if (!v) continue;
        const parts = v.toString().split(",");
        for (const raw of parts) {
            const s = raw.trim();
            if (s && !out.includes(s)) out.push(s);
        }
    }
    return out;
}

function isNonEmptyFileLike(value: unknown): value is File {
    if (!value) return false;
    const file = value as any;
    if (typeof file.arrayBuffer !== "function") return false;
    const size = file.size;
    if (typeof size === "number" && size <= 0) return false;
    return true;
}

async function updateBlog(slug: string, formData: FormData) {
    "use server";

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
        redirect("/account");
    }

    const title = (formData.get("title") || "").toString().trim();
    const summary = (formData.get("summary") || "").toString().trim();
    const content = (formData.get("content") || "").toString().trim();
    const tags = parseCsv(formData, "tags");
    const techStack = parseCsv(formData, "techStack");
    const projectSlugs = parseCsv(formData, "projectSlugs");
    const eventSlugs = parseCsv(formData, "eventSlugs");
    const authorSlugs = parseCsv(formData, "authorSlugs");
    const publishedAtRaw = (formData.get("publishedAt") || "")
        .toString()
        .trim();

    const existingPhotosRaw = (formData.get("existingPhotos") || "")
        .toString();
    const existingPhotos = existingPhotosRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

    const headerExistingIndexRaw = (
        formData.get("headerExistingIndex") || ""
    )
        .toString()
        .trim();
    const headerNewIndexRaw = (formData.get("headerNewIndex") || "")
        .toString()
        .trim();

    const headerExistingIndex =
        headerExistingIndexRaw !== ""
            ? Number(headerExistingIndexRaw)
            : null;
    const headerNewIndex =
        headerNewIndexRaw !== "" ? Number(headerNewIndexRaw) : null;

    const uploadedPhotoUrls: string[] = [];
    const photoFiles = formData.getAll("photos");

    for (const f of photoFiles) {
        if (!isNonEmptyFileLike(f)) {
            continue;
        }

        const file = f as File;

        try {
            const result = await uploadBlogPhoto(token, file);
            const url = (result as any)?.url;
            if (url) uploadedPhotoUrls.push(url);
        } catch {
            throw new Error("Failed to upload one of the images");
        }
    }

    let allPhotos: string[] = [...existingPhotos, ...uploadedPhotoUrls];

    let coverUrl: string | null = null;

    if (
        headerExistingIndex !== null &&
        headerExistingIndex >= 0 &&
        headerExistingIndex < existingPhotos.length
    ) {
        coverUrl = existingPhotos[headerExistingIndex];
    } else if (
        headerNewIndex !== null &&
        headerNewIndex >= 0 &&
        headerNewIndex < uploadedPhotoUrls.length
    ) {
        coverUrl = uploadedPhotoUrls[headerNewIndex];
    } else if (existingPhotos.length) {
        coverUrl = existingPhotos[0];
    } else if (uploadedPhotoUrls.length) {
        coverUrl = uploadedPhotoUrls[0];
    }

    if (coverUrl) {
        const idx = allPhotos.indexOf(coverUrl);
        if (idx > 0) {
            allPhotos = [
                coverUrl,
                ...allPhotos.filter((u, i) => i !== idx),
            ];
        }
    }

    const body: any = {
        title: title || "Untitled",
        summary: summary || null,
        content: content || null,
        tags,
        techStack,
        photos: allPhotos,
        projectSlugs,
        eventSlugs,
        authorSlugs,
    };

    if (publishedAtRaw) {
        const d = new Date(publishedAtRaw);
        if (!Number.isNaN(d.getTime())) {
            body.publishedAt = d.toISOString();
        }
    }

    const res = await fetch(`${API_BASE}/api/blogs/${slug}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
    });

    if (!res.ok) {
        let msg = "Failed to update blog post";
        try {
            const json = await res.json();
            if (json?.error) msg = json.error;
        } catch {
            // ignore
        }
        throw new Error(msg);
    }

    const json = await res.json();
    const newSlug = json?.slug || slug;

    redirect(`/blog/${newSlug}`);
}

async function deleteBlog(slug: string, formData: FormData) {
    "use server";

    const confirmSlug = (formData.get("confirmSlug") || "")
        .toString()
        .trim();

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
        redirect("/account");
    }

    const res = await fetch(`${API_BASE}/api/blogs/${slug}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirmSlug }),
        cache: "no-store",
    });

    if (!res.ok) {
        let msg = "Failed to delete blog post";
        try {
            const json = await res.json();
            if (json?.error) msg = json.error;
        } catch {
            // ignore
        }
        throw new Error(msg);
    }

    redirect("/blog");
}

export default async function EditBlogPage({
                                               params,
                                           }: {
    params: { slug: string };
}) {
    const blog = await fetchBlog(params.slug);
    if (!blog) {
        notFound();
    }

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
        redirect("/account");
    }

    let canEdit = false;

    try {
        const meData: any = await fetchMe(token);
        const rawUser = meData?.user ?? null;
        const rawUserRoles = Array.isArray(rawUser?.roles)
            ? rawUser.roles
            : [];
        const rawRoles: string[] =
            typeof rawUserRoles[0] === "string"
                ? rawUserRoles
                : rawUserRoles.map((r: any) => r.role ?? r);

        const upperRoles = rawRoles
            .filter(Boolean)
            .map((r) => String(r).toUpperCase());

        const isAdminOrModerator = upperRoles.some(
            (r) => r === "ADMIN" || r === "MODERATOR",
        );

        const myMemberSlug: string | undefined =
            (rawUser?.member?.slug as string | undefined) ?? undefined;

        const authors = blog.authors || [];

        const mySlugNorm = myMemberSlug?.trim().toLowerCase() ?? null;
        const authorSlugsNorm = authors
            .map((a) => a.slug?.trim().toLowerCase())
            .filter((s): s is string => !!s);

        const isAuthor =
            !!mySlugNorm && authorSlugsNorm.includes(mySlugNorm);

        canEdit = isAdminOrModerator || isAuthor;
    } catch {
        canEdit = false;
    }

    if (!canEdit) {
        redirect(`/blog/${blog.slug}`);
    }

    const updateBlogWithSlug = updateBlog.bind(null, blog.slug);
    const deleteBlogWithSlug = deleteBlog.bind(null, blog.slug);

    return (
        <section className="section max-w-3xl">
            <header className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <p className="kicker">
                        {tServer("blog.edit.kicker")}
                    </p>
                    <h1 className="display text-2xl sm:text-3xl">
                        {tServer("blog.edit.title")}
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-white/70">
                        {tServer("blog.edit.subtitle")}
                    </p>
                </div>
                <Link
                    href={`/blog/${blog.slug}`}
                    className="text-sm text-white/70 underline underline-offset-4 hover:text-white"
                >
                    {tServer("blog.edit.viewLive")}
                </Link>
            </header>

            <div className="space-y-8">
                <BlogEditorForm
                    mode="edit"
                    initialBlog={blog}
                    onSubmit={updateBlogWithSlug}
                />

                <form
                    action={deleteBlogWithSlug}
                    className="card space-y-3 border border-red-500/40 bg-red-950/20 p-5"
                >
                    <h2 className="text-sm font-semibold text-red-300">
                        {tServer("blog.edit.danger.title")}
                    </h2>
                    <p className="text-xs text-red-100/80">
                        {tServer("blog.edit.danger.body")}
                    </p>
                    <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-red-200/80">
                            {tServer("blog.edit.danger.confirmLabel")}
                        </label>
                        <input
                            name="confirmSlug"
                            placeholder={blog.slug}
                            className="w-full rounded-lg border border-red-500/40 bg-black/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/60"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="rounded-lg border border-red-500/60 px-4 py-2 text-sm text-red-100 hover:bg-red-500/20"
                        >
                            {tServer(
                                "blog.edit.danger.deleteButton",
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
