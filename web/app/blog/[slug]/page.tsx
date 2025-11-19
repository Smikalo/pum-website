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
import { tServer } from "@/lib/i18n-server";

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
    eventSlugs?: string[];
};

type ProjectCard = {
    slug: string;
    title: string;
    cover?: string | null;
    year?: number | null;
};

type EventCard = {
    slug: string;
    title: string;
    cover?: string | null;
    date?: string | null;
};

/* ------------------------- Raw API shapes ------------------------- */

type RawBlogAuthorMember = {
    slug?: string;
    id?: string;
    name?: string;
    avatarUrl?: string | null;
    avatar?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    role?: string | null;
};

type RawBlogAuthor = {
    member?: RawBlogAuthorMember | null;
    slug?: string;
    id?: string;
    name?: string;
    avatarUrl?: string | null;
    avatar?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    role?: string | null;
};

type RawBlogEvent = {
    slug?: string | null;
};

type RawBlog = {
    id?: string | number;
    slug?: string | number;
    title?: string;
    name?: string;
    summary?: string | null;
    content?: string | null;
    body?: string | null;
    markdown?: string | null;
    html?: string | null;
    text?: string | null;
    cover?: string | null;
    imageUrl?: string | null;
    images?: string[];
    photos?: string[];
    publishedAt?: string | null;
    date?: string | null;
    createdAt?: string | null;
    tags?: string[] | string;
    techStack?: string[] | string;
    tech?: string[] | string;
    authors?: RawBlogAuthor[];
    author?: RawBlogAuthor[];
    projectSlugs?: string[] | string;
    eventSlugs?: string[] | string;
    events?: RawBlogEvent[];
};

type RawBlogContainer = {
    item?: RawBlog;
    data?: RawBlog;
} & RawBlog;

type RawProject = {
    slug?: string;
    title?: string;
    photos?: string[];
    cover?: string | null;
    year?: number | string | null;
};

type RawEventSummary = {
    slug?: string;
    title?: string;
    name?: string;
    photos?: string[];
    cover?: string | null;
    date?: string | null;
    startsAt?: string | null;
    publishedAt?: string | null;
    createdAt?: unknown;
};

/* ------------------------- Helpers ------------------------- */

function normalizeAuthor(a: RawBlogAuthor): BlogAuthor {
    const m: RawBlogAuthorMember = a.member ?? (a as RawBlogAuthorMember) ?? {};
    return {
        slug: m.slug ?? m.id ?? "",
        name: m.name ?? "",
        avatarUrl: m.avatarUrl ?? m.avatar ?? null,
        headline: m.headline ?? m.shortBio ?? null,
        role: a.role ?? m.role ?? null,
    };
}

function normArr(x: unknown): string[] {
    if (Array.isArray(x)) {
        return x
            .map((s) => String(s))
            .map((s) => s.trim())
            .filter(Boolean);
    }

    if (typeof x === "string") {
        return x
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    return [];
}

function normalizeBlog(raw: unknown): Blog | null {
    if (!raw) return null;
    const container = raw as RawBlogContainer;
    const b: RawBlog =
        container.item !== undefined
            ? container.item
            : container.data !== undefined
                ? container.data
                : container;

    const images: string[] = Array.isArray(b.images)
        ? b.images
        : Array.isArray(b.photos)
            ? b.photos
            : [];
    const cover = b.cover ?? b.imageUrl ?? images[0] ?? null;

    const content =
        b.content ?? b.body ?? b.markdown ?? b.html ?? b.text ?? undefined;

    const authorsInput: RawBlogAuthor[] = Array.isArray(b.authors)
        ? b.authors
        : Array.isArray(b.author)
            ? b.author
            : [];

    let eventSlugs: string[] = normArr(b.eventSlugs);
    if (!eventSlugs.length && Array.isArray(b.events)) {
        eventSlugs = b.events
            .map((e) => e?.slug ?? null)
            .filter(
                (s): s is string =>
                    typeof s === "string" && s.trim().length > 0,
            )
            .map((s) => s.trim());
    }

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
        eventSlugs,
    };
}

/* ------------------------- Data fetching ------------------------- */

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
                blog.authors.map((a) => a.slug).filter(Boolean).join(","),
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
            .filter((b: Blog | null): b is Blog => !!b)
            .filter((b: Blog) => b.slug !== blog.slug);
        return related;
    } catch {
        return [];
    }
}

async function fetchProjectsForSlugs(slugs: string[]): Promise<ProjectCard[]> {
    if (!slugs.length) return [];

    try {
        const url = new URL("/api/projects", API_BASE);
        url.searchParams.set("size", "200");

        const res = await fetch(url.toString(), {
            cache: "no-store",
        });
        if (!res.ok) return [];

        const json = await res.json();
        const items = (Array.isArray(json.items)
            ? json.items
            : []) as RawProject[];

        const slugSet = new Set(slugs);
        const projects: ProjectCard[] = items
            .filter((p) => p && p.slug && slugSet.has(p.slug))
            .map((p) => ({
                slug: p.slug as string,
                title: p.title ?? p.slug ?? "",
                cover:
                    Array.isArray(p.photos) && p.photos.length
                        ? p.photos[0]
                        : p.cover ?? null,
                year:
                    typeof p.year === "number"
                        ? p.year
                        : typeof p.year === "string"
                            ? Number(p.year)
                            : null,
            }));

        const bySlug = new Map(projects.map((p) => [p.slug, p]));
        return slugs
            .map((slug) => bySlug.get(slug))
            .filter((p): p is ProjectCard => !!p);
    } catch {
        return [];
    }
}

async function fetchEventsForSlugs(slugs: string[]): Promise<EventCard[]> {
    if (!slugs.length) return [];

    try {
        const url = new URL("/api/events", API_BASE);
        url.searchParams.set("size", "200");

        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return [];

        const json = await res.json();
        const items = (Array.isArray(json.items)
            ? json.items
            : []) as RawEventSummary[];

        const slugSet = new Set(slugs);
        const events: EventCard[] = items
            .filter((e) => e && e.slug && slugSet.has(e.slug))
            .map((e) => ({
                slug: e.slug as string,
                title: e.title ?? e.name ?? (e.slug as string),
                cover:
                    Array.isArray(e.photos) && e.photos.length
                        ? e.photos[0]
                        : e.cover ?? null,
                date:
                    e.date ??
                    e.startsAt ??
                    e.publishedAt ??
                    (typeof e.createdAt === "string" ? e.createdAt : null),
            }));

        const bySlug = new Map(events.map((ev) => [ev.slug, ev]));
        return slugs
            .map((slug) => bySlug.get(slug))
            .filter((ev): ev is EventCard => !!ev);
    } catch {
        return [];
    }
}

/* ------------------------- Page & metadata ------------------------- */

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
                <h1 className="display">
                    {tServer("blog.detail.notFound.title")}
                </h1>
                <p className="mt-4">
                    <Link
                        href="/blog"
                        className="underline underline-offset-4"
                    >
                        {tServer("blog.detail.notFound.back")}
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
    const relatedEventSlugs = b.eventSlugs ?? [];

    const [relatedProjects, relatedEvents] = await Promise.all([
        fetchProjectsForSlugs(relatedProjectSlugs),
        fetchEventsForSlugs(relatedEventSlugs),
    ]);

    const slugsWithProjectCards = new Set(
        relatedProjects.map((p) => p.slug),
    );
    const slugsWithEventCards = new Set(
        relatedEvents.map((e) => e.slug),
    );
    const fallbackProjectSlugs = relatedProjectSlugs.filter(
        (slug) => !slugsWithProjectCards.has(slug),
    );
    const fallbackEventSlugs = relatedEventSlugs.filter(
        (slug) => !slugsWithEventCards.has(slug),
    );

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">{tServer("blog.detail.kicker")}</p>
                <h1 className="display">{b.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/70">
                    {b.publishedAt && (
                        <span>
                            {new Date(b.publishedAt).toLocaleDateString()}
                        </span>
                    )}
                    {b.tags && b.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                            {b.tags.map((t) => (
                                <span
                                    key={t}
                                    className="rounded-full bg-white/5 px-2 py-1 text-[11px] ring-1 ring-white/10"
                                >
                                    {t}
                                </span>
                            ))}
                        </span>
                    )}
                </div>

                {b.authors && b.authors.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
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
                                    className="h-7 w-7 rounded-full object-cover ring-1 ring-white/10"
                                />
                                <div className="min-w-0">
                                    <div className="text-xs font-medium">
                                        {m.name}
                                    </div>
                                    <div className="truncate text-[11px] text-white/60">
                                        {m.role === "CREATOR"
                                            ? tServer(
                                                "blog.detail.author.creatorRole",
                                            )
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
                        className="h-80 w-full rounded-xl object-cover ring-1 ring-white/10"
                    />
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-5">
                <article className="space-y-6 lg:col-span-3">
                    <div className="card p-5">
                        {b.summary && (
                            <p className="mb-4 text-sm text-white/80">
                                {b.summary}
                            </p>
                        )}

                        {b.content ? (
                            <div className="prose prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {b.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-white/60">
                                {tServer(
                                    "blog.detail.noContentFallback",
                                )}
                            </p>
                        )}

                        {b.techStack && b.techStack.length > 0 && (
                            <div className="mt-6">
                                <div className="mb-2 text-xs uppercase tracking-widest text-white/60">
                                    {tServer(
                                        "blog.detail.techStack.label",
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {b.techStack.map((t) => (
                                        <span
                                            key={t}
                                            className="rounded-full bg.white/5 px-2 py-1 text-[11px] ring-1 ring-white/10"
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
                            <h2 className="mb-3 text-lg font-semibold">
                                {tServer("blog.detail.gallery.title")}
                            </h2>
                            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                                {images.map((src, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        key={i}
                                        src={src}
                                        alt={`${b.title} photo ${i + 1}`}
                                        className="h-32 w-full rounded-md object-cover ring-1 ring-white/10"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="space-y-6 lg:col-span-2">
                    <div className="card p-5">
                        <h2 className="mb-2 text-lg font-semibold">
                            {tServer("blog.detail.authors.title")}
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
                                            className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
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
                                                    {m.role === "CREATOR"
                                                        ? tServer(
                                                            "blog.detail.author.creatorRole",
                                                        )
                                                        : m.role}
                                                </div>
                                            )}
                                            {m.headline && (
                                                <div className="truncate text-xs text-white/60">
                                                    {m.headline}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-white/60">
                                {tServer(
                                    "blog.detail.authors.empty",
                                )}
                            </p>
                        )}
                    </div>

                    {(relatedProjects.length > 0 ||
                        fallbackProjectSlugs.length > 0) && (
                        <div className="card p-5">
                            <h2 className="mb-2 text-lg font-semibold">
                                {tServer(
                                    "blog.detail.relatedProjects.title",
                                )}
                            </h2>
                            <div className="grid gap-3">
                                {relatedProjects.map((proj) => (
                                    <Link
                                        key={proj.slug}
                                        href={`/projects/${proj.slug}`}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-white/20 hover:bg-white/10"
                                    >
                                        {proj.cover ? (
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={proj.cover}
                                                    alt={proj.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-black/40 text-[11px] text-white/60 ring-1 ring-white/10">
                                                {tServer(
                                                    "blog.detail.relatedProjects.projectBadge",
                                                )}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="truncate text-xs font-medium">
                                                {proj.title}
                                            </div>
                                            <div className="truncate text-[11px] text-white/60">
                                                {proj.year
                                                    ? `${proj.year} · ${proj.slug}`
                                                    : proj.slug}
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[11px] text-white/60">
                                            {tServer(
                                                "blog.detail.relatedProjects.viewLabel",
                                            )}{" "}
                                            →
                                        </span>
                                    </Link>
                                ))}

                                {fallbackProjectSlugs.map((slug) => (
                                    <Link
                                        key={slug}
                                        href={`/projects/${slug}`}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-white/20 hover:bg-white/10"
                                    >
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-black/40 text-[11px] text-white/60 ring-1 ring-white/10">
                                            {tServer(
                                                "blog.detail.relatedProjects.projectBadge",
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-xs font-medium">
                                                {slug}
                                            </div>
                                            <div className="truncate text-[11px] text-white/60">
                                                {tServer(
                                                    "blog.detail.relatedProjects.viewProjectFallback",
                                                )}
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[11px] text-white/60">
                                            {tServer(
                                                "blog.detail.relatedProjects.viewLabel",
                                            )}{" "}
                                            →
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {(relatedEvents.length > 0 ||
                        fallbackEventSlugs.length > 0) && (
                        <div className="card p-5">
                            <h2 className="mb-2 text-lg font-semibold">
                                {tServer(
                                    "blog.detail.relatedEvents.title",
                                )}
                            </h2>
                            <div className="grid gap-3">
                                {relatedEvents.map((ev) => (
                                    <Link
                                        key={ev.slug}
                                        href={`/events/${ev.slug}`}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-white/20 hover:bg-white/10"
                                    >
                                        {ev.cover ? (
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/10">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={ev.cover}
                                                    alt={ev.title}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-black/40 text-[11px] text-white/60 ring-1 ring-white/10">
                                                {tServer(
                                                    "blog.detail.relatedEvents.eventBadge",
                                                )}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="truncate text-xs font-medium">
                                                {ev.title}
                                            </div>
                                            <div className="truncate text-[11px] text-white/60">
                                                {ev.date
                                                    ? new Date(
                                                        ev.date,
                                                    ).toLocaleDateString()
                                                    : ev.slug}
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[11px] text-white/60">
                                            {tServer(
                                                "blog.detail.relatedEvents.viewLabel",
                                            )}{" "}
                                            →
                                        </span>
                                    </Link>
                                ))}

                                {fallbackEventSlugs.map((slug) => (
                                    <Link
                                        key={slug}
                                        href={`/events/${slug}`}
                                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:border-white/20 hover:bg-white/10"
                                    >
                                        <div className="flex h-10 w-10 flex-shrink-0 items.center justify-center rounded-md bg-black/40 text-[11px] text.white/60 ring-1 ring-white/10">
                                            {tServer(
                                                "blog.detail.relatedEvents.eventBadge",
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="truncate text-xs font-medium">
                                                {slug}
                                            </div>
                                            <div className="truncate text-[11px] text-white/60">
                                                {tServer(
                                                    "blog.detail.relatedEvents.viewEventFallback",
                                                )}
                                            </div>
                                        </div>
                                        <span className="ml-auto text-[11px] text-white/60">
                                            {tServer(
                                                "blog.detail.relatedEvents.viewLabel",
                                            )}{" "}
                                            →
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
                    <h2 className="mb-4 text-lg font-semibold">
                        {tServer("blog.detail.moreLikeThis.title")}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {relatedPosts.map((post) => (
                            <Link
                                key={post.slug}
                                href={`/blog/${post.slug}`}
                                className="card flex flex-col p-4 hover:ring-1 hover:ring-white/20"
                            >
                                {post.cover && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={post.cover}
                                        alt={post.title}
                                        className="mb-3 h-28 w-full rounded-md object-cover ring-1 ring-white/10"
                                    />
                                )}
                                <h3 className="mb-1 text-sm font-semibold">
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
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {post.tags
                                                .slice(0, 3)
                                                .map((t) => (
                                                    <span
                                                        key={t}
                                                        className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] ring-1 ring-white/10"
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

            <div className="mt-8 flex items-center justify-between">
                <Link
                    href="/blog"
                    className="underline underline-offset-4"
                >
                    {tServer("blog.detail.backToAll")}
                </Link>

                <EditBlogButton slug={b.slug} authorSlugs={authorSlugs} />
            </div>
        </section>
    );
}
