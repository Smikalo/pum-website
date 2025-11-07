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

    const images: string[] = Array.isArray(b.images) ? b.images : [];
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
    };

    console.log("[EditBlogPage] normalizeBlog result", {
        input: b,
        normalized: {
            id: blog.id,
            slug: blog.slug,
            title: blog.title,
            authors: blog.authors,
            projectSlugs: blog.projectSlugs,
        },
    });

    return blog;
}

async function fetchBlog(slug: string): Promise<Blog | null> {
    console.log("[EditBlogPage] fetchBlog start", { slug });

    try {
        const url = new URL(`/api/blogs/${slug}`, API_BASE);
        const res = await fetch(url.toString(), {
            cache: "no-store",
        });

        if (!res.ok) {
            console.warn("[EditBlogPage] fetchBlog non-OK response", {
                slug,
                status: res.status,
            });
            return null;
        }

        const json = await res.json();
        const blog = normalizeBlog(json);

        console.log("[EditBlogPage] fetchBlog success", {
            slug: blog?.slug,
            authorSlugs: (blog?.authors || []).map((a) => a.slug),
            projectSlugs: blog?.projectSlugs,
        });

        return blog;
    } catch (err) {
        console.error("[EditBlogPage] fetchBlog error", { slug, err });
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

// Only treat real non-empty File objects as files
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

    console.log("[EditBlogPage] updateBlog action invoked", { slug });

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    console.log("[EditBlogPage] updateBlog cookie check", {
        slug,
        hasToken: !!token,
    });

    if (!token) {
        console.warn(
            "[EditBlogPage] updateBlog: no token, redirecting to /account",
            { slug },
        );
        redirect("/account");
    }

    const title = (formData.get("title") || "").toString().trim();
    const summary = (formData.get("summary") || "").toString().trim();
    const content = (formData.get("content") || "").toString().trim();
    const tags = parseCsv(formData, "tags");
    const techStack = parseCsv(formData, "techStack");
    const projectSlugs = parseCsv(formData, "projectSlugs");
    const authorSlugs = parseCsv(formData, "authorSlugs");
    const publishedAtRaw = (formData.get("publishedAt") || "")
        .toString()
        .trim();

    const existingPhotosRaw = (formData.get("existingPhotos") || "").toString();
    const existingPhotos = existingPhotosRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

    const headerExistingIndexRaw = (formData.get("headerExistingIndex") || "")
        .toString()
        .trim();
    const headerNewIndexRaw = (formData.get("headerNewIndex") || "")
        .toString()
        .trim();

    const headerExistingIndex =
        headerExistingIndexRaw !== "" ? Number(headerExistingIndexRaw) : null;
    const headerNewIndex =
        headerNewIndexRaw !== "" ? Number(headerNewIndexRaw) : null;

    // Upload only *non-empty* newly attached photos
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
        } catch (err) {
            console.error("[updateBlog] failed to upload blog photo", err);
            throw new Error("Failed to upload one of the images");
        }
    }

    let allPhotos: string[] = [...existingPhotos, ...uploadedPhotoUrls];

    // Choose cover: prefer explicit selection; fall back to first photo
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
            allPhotos = [coverUrl, ...allPhotos.filter((u, i) => i !== idx)];
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
        authorSlugs,
    };

    if (publishedAtRaw) {
        const d = new Date(publishedAtRaw);
        if (!Number.isNaN(d.getTime())) {
            body.publishedAt = d.toISOString();
        }
    }

    console.log("[EditBlogPage] updateBlog sending PUT", {
        slug,
        hasPhotos: allPhotos.length > 0,
        tagCount: tags.length,
        techStackCount: techStack.length,
        authorSlugsCount: authorSlugs.length,
        projectSlugsCount: projectSlugs.length,
    });

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
        console.error("[EditBlogPage] updateBlog failed", {
            slug,
            status: res.status,
            msg,
        });
        throw new Error(msg);
    }

    const json = await res.json();
    const newSlug = json?.slug || slug;

    console.log("[EditBlogPage] updateBlog success, redirecting", {
        oldSlug: slug,
        newSlug,
    });

    redirect(`/blog/${newSlug}`);
}

async function deleteBlog(slug: string, formData: FormData) {
    "use server";

    console.log("[EditBlogPage] deleteBlog action invoked", { slug });

    const confirmSlug = (formData.get("confirmSlug") || "")
        .toString()
        .trim();

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    console.log("[EditBlogPage] deleteBlog cookie check", {
        slug,
        hasToken: !!token,
        confirmSlug,
    });

    if (!token) {
        console.warn(
            "[EditBlogPage] deleteBlog: no token, redirecting to /account",
            { slug },
        );
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
        console.error("[EditBlogPage] deleteBlog failed", {
            slug,
            status: res.status,
            msg,
        });
        throw new Error(msg);
    }

    console.log("[EditBlogPage] deleteBlog success, redirecting to /blog", {
        slug,
    });

    redirect("/blog");
}

export default async function EditBlogPage({
                                               params,
                                           }: {
    params: { slug: string };
}) {
    console.log("[EditBlogPage] page start", { slug: params.slug });

    const blog = await fetchBlog(params.slug);
    if (!blog) {
        console.warn("[EditBlogPage] blog not found, calling notFound()", {
            slug: params.slug,
        });
        notFound();
    }

    console.log("[EditBlogPage] blog loaded", {
        slug: blog.slug,
        authorSlugs: (blog.authors || []).map((a) => a.slug),
        projectSlugs: blog.projectSlugs,
    });

    const cookieStore = cookies();
    const token = cookieStore.get("access_token")?.value;

    console.log("[EditBlogPage] cookie access_token present?", {
        slug: blog.slug,
        hasToken: !!token,
    });

    if (!token) {
        console.warn(
            "[EditBlogPage] no token on page load, redirecting to /account",
            { slug: blog.slug },
        );
        redirect("/account");
    }

    // 🔒 Enforce: only blog author(s), moderators, or admins can edit.
    let canEdit = false;

    try {
        console.log("[EditBlogPage] fetching /api/auth/me for permission check", {
            slug: blog.slug,
        });

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

        console.log("[EditBlogPage] permission check", {
            slug: blog.slug,
            rawRoles,
            upperRoles,
            isAdminOrModerator,
            myMemberSlug,
            authorSlugsNorm,
            isAuthor,
            canEdit,
        });
    } catch (err) {
        console.error(
            "[EditBlogPage] failed to determine edit permissions",
            err,
        );
        canEdit = false;
    }

    if (!canEdit) {
        console.warn(
            "[EditBlogPage] canEdit=false, redirecting to detail view",
            { slug: blog.slug },
        );
        redirect(`/blog/${blog.slug}`);
    }

    const updateBlogWithSlug = updateBlog.bind(null, blog.slug);
    const deleteBlogWithSlug = deleteBlog.bind(null, blog.slug);

    console.log("[EditBlogPage] rendering editor UI", {
        slug: blog.slug,
    });

    return (
        <section className="section max-w-3xl">
            <header className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <p className="kicker">BLOG</p>
                    <h1 className="display text-2xl sm:text-3xl">
                        Edit blog post
                    </h1>
                    <p className="mt-2 text-white/70 text-sm max-w-xl">
                        Update the content and metadata of this post.
                    </p>
                </div>
                <Link
                    href={`/blog/${blog.slug}`}
                    className="text-sm underline underline-offset-4 text-white/70 hover:text-white"
                >
                    View live
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
                    className="card p-5 space-y-3 border border-red-500/40 bg-red-950/20"
                >
                    <h2 className="text-sm font-semibold text-red-300">
                        Danger zone
                    </h2>
                    <p className="text-xs text-red-100/80">
                        Deleting this post is permanent and cannot be undone.
                    </p>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-red-200/80 mb-1">
                            Type the slug to confirm
                        </label>
                        <input
                            name="confirmSlug"
                            placeholder={blog.slug}
                            className="w-full rounded-lg bg-black/40 border border-red-500/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/60"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg border border-red-500/60 text-sm text-red-100 hover:bg-red-500/20"
                        >
                            Delete post
                        </button>
                    </div>
                </form>
            </div>
        </section>
    );
}
