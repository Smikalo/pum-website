// web/app/blog/page.tsx
import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import { API_BASE } from "@/lib/config";
import { SEED_POSTS, type BlogPost } from "@/data/blog.seed";

/**
 * Normalize any API post into our seed BlogPost shape.
 * The seed type expects: id, slug, title, summary, contentHtml, cover?, author?, tags?, date
 */
function normalizeApiPostToBlog(p: any): BlogPost {
    const slug = String(p?.slug ?? p?.id ?? "");
    const title = String(p?.title ?? slug);
    const summary = String(p?.summary ?? p?.excerpt ?? p?.description ?? "");
    const contentHtml = String(
        p?.contentHtml ?? p?.content ?? p?.bodyHtml ?? p?.body ?? "" // leave empty for list page if not provided
    );
    const cover: string | undefined = p?.cover ?? p?.image ?? undefined;
    const author: string | undefined = p?.author ?? p?.by ?? p?.authorSlug ?? undefined;
    const tags: string[] = Array.isArray(p?.tags) ? p.tags : [];
    const date = String(p?.date ?? p?.publishedAt ?? p?.createdAt ?? "");

    return {
        id: String(p?.id ?? slug),
        slug,
        title,
        summary,
        contentHtml,
        cover,
        tags,
        date,
    };
}

async function fetchApiPosts(): Promise<BlogPost[]> {
    async function tryEndpoint(path: string): Promise<BlogPost[]> {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) return [];
            const json = await res.json();
            const items: any[] = Array.isArray(json) ? json : json.items ?? [];
            return items.map(normalizeApiPostToBlog);
        } catch {
            return [];
        }
    }
    // prefer /api/blog, then alias /api/posts
    const first = await tryEndpoint("/api/blog?size=999");
    if (first.length) return first;
    return await tryEndpoint("/api/posts?size=999");
}

function dedupeBySlug<T extends { slug: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of arr) {
        if (!item.slug || seen.has(item.slug)) continue;
        seen.add(item.slug);
        out.push(item);
    }
    return out;
}

function matchesQuery(p: BlogPost, q: string): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    const fields = [p.title || "", p.summary || "", ...(p.tags || [])];
    return fields.some((f) => f.toLowerCase().includes(needle));
}

function highlight(text: string, q: string) {
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    return text.split(re).map((part, i) =>
        re.test(part) ? (
            <mark key={i} className="px-1 rounded bg-yellow-300/30 text-yellow-200">
                {part}
            </mark>
        ) : (
            <span key={i}>{part}</span>
        )
    );
}

export default async function BlogPage({
                                           searchParams,
                                       }: {
    searchParams?: { q?: string; tag?: string };
}) {
    const q = searchParams?.q || "";
    const tag = searchParams?.tag || "";

    // Merge API + seeds, then sort desc by date
    const apiPosts = await fetchApiPosts();
    const posts = dedupeBySlug<BlogPost>([...SEED_POSTS, ...apiPosts]).sort((a, b) => {
        const toMs = (d?: string) => (d ? new Date(d).getTime() : 0);
        return toMs(b.date) - toMs(a.date);
    });

    const filtered = posts.filter(
        (p) =>
            matchesQuery(p, q) &&
            (!tag || (p.tags || []).map((t) => t.toLowerCase()).includes(tag.toLowerCase()))
    );

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">BLOG</p>
                <h1 className="display">Stories from the community</h1>
                <p className="mt-3 text-white/70 max-w-2xl">News, postmortems and behind-the-scenes write-ups.</p>
            </header>

            <MembersSearchBar placeholder="Search posts, tags…" paramKey="q" />

            <div className="mt-8 grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((post) => (
                    <Link key={post.slug} href={`/blog/${post.slug}`} className="card hover:border-white/20">
                        <div className="aspect-video rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10">
                            {post.cover ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={post.cover} alt={post.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full grid place-items-center text-white/40 text-sm">No cover</div>
                            )}
                        </div>
                        <div className="mt-3 font-semibold">{highlight(post.title, q)}</div>
                        <div className="text-xs text-white/60 line-clamp-2">{highlight(post.summary || "", q)}</div>
                        {!!post.tags?.length && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {post.tags.map((t) => (
                                    <Link
                                        key={t}
                                        href={`/blog?tag=${encodeURIComponent(t)}`}
                                        className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {t}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}
