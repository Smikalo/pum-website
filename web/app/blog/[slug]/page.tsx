// web/app/blog/[slug]/page.tsx
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";

type BlogPost = {
    id?: string;
    slug: string;
    title: string;
    content?: string;
    excerpt?: string;
    cover?: string;
    author?: string;
    tags?: string[];
    date?: string;
};

function normalize(p: any): BlogPost {
    const slug = p.slug ?? p.id ?? "";
    return {
        id: String(p.id ?? slug),
        slug,
        title: p.title ?? slug,
        content: p.content ?? p.body ?? "",
        excerpt: p.excerpt ?? p.summary ?? "",
        cover: p.cover ?? p.image ?? undefined,
        author: p.author ?? p.by ?? undefined,
        tags: p.tags ?? [],
        date: p.date ?? p.publishedAt ?? undefined,
    };
}

async function fetchPost(slug: string): Promise<BlogPost | null> {
    const candidates = [
        `/api/blog/${encodeURIComponent(slug)}`,
        `/api/posts/${encodeURIComponent(slug)}`,
    ];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            return normalize(json);
        } catch {}
    }
    return null;
}

async function fetchSlugs(): Promise<string[]> {
    const candidates = ["/api/blog?size=999", "/api/posts?size=999"];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            const items: any[] = Array.isArray(json) ? json : json.items ?? [];
            return items.map((p: any) => String(p.slug ?? p.id ?? "")).filter(Boolean);
        } catch {}
    }
    return [];
}

export async function generateStaticParams() {
    const slugs = await fetchSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const p = await fetchPost(params.slug);
    return {
        title: p ? `${p.title} – Blog` : "Blog post",
        description: p?.excerpt || "PUM Blog",
    };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
    const p = await fetchPost(params.slug);
    if (!p) {
        return (
            <section className="section">
                <h1 className="h1">Post not found</h1>
                <Link href="/blog" className="underline underline-offset-4">← Back to all posts</Link>
            </section>
        );
    }

    return (
        <section className="section">
            <h1 className="h1">{p.title}</h1>
            {!!p.tags?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                        <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                            {t}
                        </Link>
                    ))}
                </div>
            )}

            {p.cover && (
                <div className="mt-6 rounded-xl overflow-hidden ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.cover} alt={p.title} className="w-full h-auto" />
                </div>
            )}

            {!!p.content && (
                <article className="prose prose-invert mt-6" dangerouslySetInnerHTML={{ __html: p.content }} />
            )}

            <div className="mt-8">
                <Link href="/blog" className="underline underline-offset-4">← Back to all posts</Link>
            </div>
        </section>
    );
}
