// app/blogs/[slug]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";

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
    authors?: {
        slug: string;
        name: string;
        avatarUrl?: string | null;
        headline?: string | null;
        role?: string | null;
    }[];
};

function normalizeAuthor(a: any) {
    // Accept both flat author objects and nested { member: {...}, role }
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

    // Some APIs wrap the object as {item} or {data}
    const b = raw.item ?? raw.data ?? raw;

    const images: string[] = Array.isArray(b.images) ? b.images : [];
    const cover = b.cover ?? b.imageUrl ?? images[0] ?? null;

    // Content can come as content / body / markdown / html etc.
    const content =
        b.content ??
        b.body ??
        b.markdown ??
        b.html ??
        b.text ??
        undefined;

    // Tags & tech may arrive as strings or arrays
    const normArr = (x: any) =>
        Array.isArray(x) ? x : typeof x === "string" ? x.split(",").map((s) => s.trim()).filter(Boolean) : [];

    const authorsInput: any[] =
        Array.isArray(b.authors)
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
    };
}

async function fetchBlog(slug: string): Promise<Blog | null> {
    try {
        const url = new URL(`/api/blogs/${slug}`, API_BASE);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return null;
        const json = await res.json();
        return normalizeBlog(json);
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const b = await fetchBlog(params.slug);
    return {
        title: b ? `${b.title} – PUM Blog` : "Blog – PUM",
        description: b?.summary || (b?.content ? String(b.content).slice(0, 140) : "PUM blog post"),
    };
}

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
    const b = await fetchBlog(params.slug);

    if (!b) {
        return (
            <section className="section">
                <h1 className="display">Post not found</h1>
                <p className="mt-4">
                    <Link href="/blog" className="underline underline-offset-4">
                        Back to blog
                    </Link>
                </p>
            </section>
        );
    }

    const cover = b.cover || b.imageUrl;

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">BLOG</p>
                <h1 className="display">{b.title}</h1>
                <div className="mt-2 text-white/70 text-sm">
                    {b.publishedAt ? new Date(b.publishedAt).toLocaleDateString() : ""}
                    {b.tags && b.tags.length ? <> • {b.tags.join(" • ")}</> : null}
                </div>
            </header>

            {cover && (
                <div className="mb-6">
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
                        <h2 className="text-lg font-semibold mb-2">Post</h2>
                        {b.content ? (
                            <div className="prose prose-invert max-w-none">
                                {/* Keep simple: render plain text/markdown-as-text to preserve your current UI.
                   Swap with a Markdown renderer later if you want rich formatting. */}
                                <pre className="whitespace-pre-wrap font-sans text-white/80">{b.content}</pre>
                            </div>
                        ) : b.summary ? (
                            <p className="text-white/80 leading-relaxed">{b.summary}</p>
                        ) : (
                            <p className="text-white/60">No content yet.</p>
                        )}

                        {b.techStack && b.techStack.length > 0 && (
                            <div className="mt-3">
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

                    {b.images && b.images.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {b.images.map((src, i) => (
                                    <img
                                        key={i}
                                        src={src}
                                        alt={`${b.title} photo ${i + 1}`}
                                        className="w-full h-32 object-cover rounded-md ring-1 ring-white/10"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="lg:col-span-2 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">Authors</h2>
                        {b.authors && b.authors.length ? (
                            <ul className="space-y-3">
                                {b.authors.map((m, i) => (
                                    <li key={`${m.slug}-${i}`} className="flex items-center gap-3">
                                        <img
                                            src={m.avatarUrl || "/avatars/default.png"}
                                            alt={m.name}
                                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            <Link href={`/members/${m.slug}`} className="font-medium hover:underline">
                                                {m.name}
                                            </Link>
                                            {m.role && <div className="text-xs text-white/60">{m.role}</div>}
                                            {m.headline && <div className="text-xs text-white/60 truncate">{m.headline}</div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-white/60">No authors listed.</p>
                        )}
                    </div>
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/blog" className="underline underline-offset-4">
                    ← Back to all posts
                </Link>
            </div>
        </section>
    );
}
