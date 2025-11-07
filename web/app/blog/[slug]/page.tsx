export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "@/lib/config";
import { EditBlogButton } from "@/components/EditBlogButton";

type BlogAuthor = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
    role?: string | null;
};

type Blog = {
    id: string;
    slug: string;
    title: string;
    summary?: string;
    content?: string;
    cover?: string | null;
    imageUrl?: string | null;
    images?: string[];
    publishedAt?: string | null;
    tags?: string[];
    techStack?: string[];
    authors?: BlogAuthor[];
    projectSlugs?: string[];
};

type ProjectCard = {
    slug: string;
    title: string;
    cover?: string | null;
    year?: number | null;
};

function normalizeAuthor(a: any): BlogAuthor {
    const m = a?.member ?? a ?? {};
    return {
        slug: m.slug ?? m.id ?? "",
        name: m.name ?? "",
        avatarUrl: m.avatarUrl ?? m.avatar ?? null,
        headline: m.headline ?? m.shortBio ?? null,
        role: a?.role ?? m.role ?? null,
    };
}

function normalizeBlog(raw: any): Blog | null {
    if (!raw) return null;
    const b = raw.item ?? raw.data ?? raw;

    const images: string[] = Array.isArray(b.images) ? b.images : [];
    const cover = b.cover ?? b.imageUrl ?? images[0] ?? null;

    const content =
        b.content ?? b.body ?? b.markdown ?? b.html ?? b.text ?? undefined;

    const normArr = (x: any): string[] =>
        Array.isArray(x)
            ? x
            : typeof x === "string"
                ? x
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [];

    const authorsInput: any[] = Array.isArray(b.authors)
        ? b.authors
        : Array.isArray(b.author)
            ? b.author
            : [];

    return {
        id: String(b.id ?? b.slug ?? ""),
        slug: String(b.slug ?? b.id ?? ""),
        title: String(b.title ?? b.name ?? "Untitled"),
        summary: b.summary ?? undefined,
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
}

async function fetchBlog(slug: string): Promise<Blog | null> {
    try {
        const url = new URL(`/api/blogs/${slug}`, API_BASE);
        const res = await fetch(url.toString(), {
            cache: "no-store",
        });
        if (!res.ok) return null;
        const json = await res.json();
        return normalizeBlog(json);
    } catch {
        return null;
    }
}

async function fetchRelatedBlogs(blog: Blog): Promise<Blog[]> {
    try {
        const url = new URL("/api/blogs", API_BASE);

        if (blog.tags && blog.tags.length > 0) {
            url.searchParams.set("tag", blog.tags.slice(0, 3).join(","));
        } else if (blog.authors && blog.authors.length > 0) {
            url.searchParams.set(
                "author",
                blog.authors
                    .map((a) => a.slug)
                    .filter(Boolean)
                    .join(","),
            );
        } else {
            return [];
        }

        url.searchParams.set("size", "4");

        const res = await fetch(url.toString(), {
            cache: "no-store",
        });
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json.items) ? json.items : [];
        const related = items
            .map(normalizeBlog)
            .filter((b: any): b is Blog => !!b)
            .filter((b: { slug: string }) => b.slug !== blog.slug);
        return related;
    } catch {
        return [];
    }
}

// 🔍 Fetch project metadata (title, cover, year) for the related project slugs
async function fetchProjectsForSlugs(
    slugs: string[],
): Promise<ProjectCard[]> {
    if (!slugs.length) return [];

    try {
        const url = new URL("/api/projects", API_BASE);
        // Reuse the “list projects” endpoint and filter client-side
        url.searchParams.set("size", "200");

        const res = await fetch(url.toString(), {
            cache: "no-store",
        });
        if (!res.ok) return [];

        const json = await res.json();
        const items: any[] = Array.isArray(json.items) ? json.items : [];

        const slugSet = new Set(slugs);
        const projects: ProjectCard[] = items
            .filter((p) => p && slugSet.has(p.slug))
            .map((p) => ({
                slug: p.slug,
                title: p.title ?? p.slug,
                cover:
                    Array.isArray(p.photos) && p.photos.length
                        ? p.photos[0]
                        : p.cover ?? null,
                year:
                    typeof p.year === "number"
                        ? p.year
                        : p.year
                            ? Number(p.year)
                            : null,
            }));

        // Keep the order from the original slugs array
        const bySlug = new Map(projects.map((p) => [p.slug, p]));
        return slugs
            .map((slug) => bySlug.get(slug))
            .filter((p): p is ProjectCard => !!p);
    } catch {
        return [];
    }
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: { slug: string };
}): Promise<Metadata> {
    const b = await fetchBlog(params.slug);
    return {
        title: b ? `${b.title} – PUM Blog` : "Blog – PUM",
        description:
            b?.summary ||
            (b?.content
                ? String(b.content).slice(0, 140)
                : "PUM blog post"),
    };
}

export default async function BlogDetailPage({
                                                 params,
                                             }: {
    params: { slug: string };
}) {
    const b = await fetchBlog(params.slug);

    if (!b) {
        return (
            <section className="section">
                <h1 className="display">Post not found</h1>
                <p className="mt-4">
                    <Link
                        href="/blog"
                        className="underline underline-offset-4"
                    >
                        Back to blog
                    </Link>
                </p>
            </section>
        );
    }

    const relatedPosts = await fetchRelatedBlogs(b);
    const cover = b.cover || b.imageUrl;
    const images = b.images || [];
    const authorSlugs =
        b.authors?.map((a) => a.slug).filter(Boolean) ?? [];
    const relatedProjectSlugs = b.projectSlugs ?? [];

    // ✅ Load project metadata for nicer cards
    const relatedProjects = await fetchProjectsForSlugs(
        relatedProjectSlugs,
    );

    // Fallback: any slugs that didn't come back from the API
    const slugsWithCards = new Set(
        relatedProjects.map((p) => p.slug),
    );
    const fallbackProjectSlugs = relatedProjectSlugs.filter(
        (slug) => !slugsWithCards.has(slug),
    );

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">BLOG</p>
                <h1 className="display">{b.title}</h1>
                <div className="mt-2 text-white/70 text-sm flex flex-wrap gap-3 items-center">
                    {b.publishedAt && (
                        <span>
                            {new Date(
                                b.publishedAt,
                            ).toLocaleDateString()}
                        </span>
                    )}
                    {b.tags && b.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                            {b.tags.map((t) => (
                                <span
                                    key={t}
                                    className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                >
                                    {t}
                                </span>
                            ))}
                        </span>
                    )}
                </div>

                {b.authors && b.authors.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3 items-center">
                        {b.authors.map((m, idx) => (
                            <Link
                                key={`${m.slug}-${idx}`}
                                href={`/members/${m.slug}`}
                                className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/10 hover:bg-white/10"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={
                                        m.avatarUrl ||
                                        "/avatars/default.png"
                                    }
                                    alt={m.name}
                                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                                />
                                <div className="min-w-0">
                                    <div className="text-xs font-medium">
                                        {m.name}
                                    </div>
                                    <div className="text-[11px] text-white/60 truncate">
                                        {m.role === "CREATOR"
                                            ? "Creator"
                                            : m.headline ||
                                            m.role ||
                                            ""}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </header>

            {cover && (
                <div className="mb-8">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={cover}
                        alt={b.title}
                        className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10"
                    />
                </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <article className="lg:col-span-3 space-y-6">
                    <div className="card p-5">
                        {b.summary && (
                            <p className="text-white/80 text-sm mb-4">
                                {b.summary}
                            </p>
                        )}

                        {b.content ? (
                            <div className="prose prose-invert max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                >
                                    {b.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-white/60">
                                No content yet.
                            </p>
                        )}

                        {b.techStack && b.techStack.length > 0 && (
                            <div className="mt-6">
                                <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                                    Tech stack
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {b.techStack.map((t) => (
                                        <span
                                            key={t}
                                            className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                        >
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {images.length > 1 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">
                                Gallery
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {images.map((src, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={i}
                                        src={src}
                                        alt={`${b.title} photo ${
                                            i + 1
                                        }`}
                                        className="w-full h-32 object-cover rounded-md ring-1 ring-white/10"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="lg:col-span-2 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">
                            Authors
                        </h2>
                        {b.authors && b.authors.length ? (
                            <ul className="space-y-3">
                                {b.authors.map((m, i) => (
                                    <li
                                        key={`${m.slug}-${i}`}
                                        className="flex items-center gap-3"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={
                                                m.avatarUrl ||
                                                "/avatars/default.png"
                                            }
                                            alt={m.name}
                                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            <Link
                                                href={`/members/${m.slug}`}
                                                className="font-medium hover:underline"
                                            >
                                                {m.name}
                                            </Link>
                                            {m.role && (
                                                <div className="text-xs text-white/60">
                                                    {m.role ===
                                                    "CREATOR"
                                                        ? "Creator"
                                                        : m.role}
                                                </div>
                                            )}
                                            {m.headline && (
                                                <div className="text-xs text-white/60 truncate">
                                                    {m.headline}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-white/60">
                                No authors listed.
                            </p>
                        )}
                    </div>

                    {/* ⭐ Related projects as cards */}
                    {(relatedProjects.length > 0 ||
                        fallbackProjectSlugs.length > 0) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">
                                Related projects
                            </h2>
                            <div className="grid gap-3">
                                {relatedProjects.map((proj) => (
                                    <Link
                                        key={proj.slug}
                                        href={`/projects/${proj.slug}`}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 hover:border-white/20 transition"
                                    >
                                        {proj.cover && (
                                            <div className="h-10 w-10 rounded-md overflow-hidden ring-1 ring-white/10 flex-shrink-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={proj.cover}
                                                    alt={proj.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        {!proj.cover && (
                                            <div className="h-10 w-10 rounded-md bg-black/40 ring-1 ring-white/10 flex items-center justify-center text-[11px] text-white/60 flex-shrink-0">
                                                PRJ
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium truncate">
                                                {proj.title}
                                            </div>
                                            <div className="text-[11px] text-white/60 truncate">
                                                {proj.year
                                                    ? `${proj.year} · ${proj.slug}`
                                                    : proj.slug}
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[11px] text-white/60">
                                            View →
                                        </span>
                                    </Link>
                                ))}

                                {/* Fallback cards for any slugs with no project data */}
                                {fallbackProjectSlugs.map((slug) => (
                                    <Link
                                        key={slug}
                                        href={`/projects/${slug}`}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 hover:border-white/20 transition"
                                    >
                                        <div className="h-10 w-10 rounded-md bg-black/40 ring-1 ring-white/10 flex items-center justify-center text-[11px] text-white/60 flex-shrink-0">
                                            PRJ
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium truncate">
                                                {slug}
                                            </div>
                                            <div className="text-[11px] text-white/60 truncate">
                                                View project
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[11px] text-white/60">
                                            View →
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {relatedPosts.length > 0 && (
                <section className="mt-10 border-t border-white/10 pt-6">
                    <h2 className="text-lg font-semibold mb-4">
                        More like this
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {relatedPosts.map((post) => (
                            <Link
                                key={post.slug}
                                href={`/blog/${post.slug}`}
                                className="card p-4 flex flex-col hover:ring-1 hover:ring-white/20"
                            >
                                {post.cover && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={post.cover}
                                        alt={post.title}
                                        className="w-full h-28 object-cover rounded-md mb-3 ring-1 ring-white/10"
                                    />
                                )}
                                <h3 className="text-sm font-semibold mb-1">
                                    {post.title}
                                </h3>
                                {post.publishedAt && (
                                    <p className="text-[11px] text-white/60">
                                        {new Date(
                                            post.publishedAt,
                                        ).toLocaleDateString()}
                                    </p>
                                )}
                                {post.tags &&
                                    post.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {post.tags
                                                .slice(0, 3)
                                                .map((t) => (
                                                    <span
                                                        key={t}
                                                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                        </div>
                                    )}
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            <div className="mt-8 flex justify-between items-center">
                <Link
                    href="/blog"
                    className="underline underline-offset-4"
                >
                    ← Back to all posts
                </Link>

                {/* Only shows if user is an author, moderator, or admin */}
                <EditBlogButton slug={b.slug} authorSlugs={authorSlugs} />
            </div>
        </section>
    );
}
