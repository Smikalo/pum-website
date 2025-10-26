import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import { API_BASE } from "@/lib/config";
import { SEED_POSTS, type BlogPost } from "@/data/blog.seed";

type ApiPost = BlogPost;

// Try to read from either /api/blog or /api/posts if your backend adds it later.
async function fetchApiPosts(): Promise<ApiPost[]> {
    async function tryEndpoint(path: string) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) return [];
            const json = await res.json();
            // support either {items:[]} or an array
            return Array.isArray(json) ? json : (json.items ?? []);
        } catch {
            return [];
        }
    }
    const a = await tryEndpoint("/api/blog?size=999");
    if (a.length) return a;
    return tryEndpoint("/api/posts?size=999");
}

function dedupeBySlug<T extends { slug: string }>(arr: T[]) {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const x of arr) {
        if (!x.slug || seen.has(x.slug)) continue;
        seen.add(x.slug);
        out.push(x);
    }
    return out;
}

function highlight(text: string | undefined, q: string) {
    if (!text) return null;
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) => re.test(p) ? <mark key={i} className="px-0.5 rounded bg-yellow-300/30 text-yellow-200">{p}</mark> : <span key={i}>{p}</span>);
}

export default async function BlogPage({ searchParams }: { searchParams?: { q?: string; tag?: string } }) {
    const q = searchParams?.q || "";
    const tag = searchParams?.tag || "";

    const apiPosts = await fetchApiPosts();
    const posts = dedupeBySlug<BlogPost>([...SEED_POSTS, ...apiPosts]).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const tags = Array.from(new Set(posts.flatMap(p => p.tags || []))).sort();
    const filtered = posts.filter(p => {
        const matchesQ = !q || [p.title, p.summary, ...(p.tags||[])].some(f => f.toLowerCase().includes(q.toLowerCase()));
        const matchesTag = !tag || (p.tags||[]).includes(tag);
        return matchesQ && matchesTag;
    });

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">BLOG</p>
                <h1 className="display">Stories, wins & lab notes</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    Recent events, project write-ups and announcements from the PUM community.
                </p>
            </header>

            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar placeholder="Search posts by title, summary, or tag…" paramKey="q" />
                </div>
                <div className="flex items-center gap-2">
                    <TagChips tags={tags} selected={tag} params={{ q }} />
                </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                    <Link key={p.slug} href={`/blog/${p.slug}`} className="card p-4 hover:bg-white/10 transition">
                        {p.cover && (
                            <img src={p.cover} alt={p.title} className="w-full h-40 object-cover rounded-md ring-1 ring-white/10 mb-3" />
                        )}
                        <div className="text-xs text-white/60">{new Date(p.date).toLocaleDateString()}</div>
                        <div className="font-semibold text-lg line-clamp-2">{highlight(p.title, q)}</div>
                        <div className="mt-2 text-sm text-white/70 line-clamp-3">{highlight(p.summary, q)}</div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {(p.tags||[]).slice(0,6).map(t => (
                                <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{highlight(t, q)}</span>
                            ))}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

function TagChips({ tags, selected, params }: { tags: string[]; selected?: string; params: Record<string,string> }) {
    const makeHref = (tag?: string) => {
        const p = new URLSearchParams({ ...params });
        if (tag) p.set("tag", tag); else p.delete("tag");
        const qs = p.toString();
        return `/blog${qs ? `?${qs}` : ""}`;
    };
    return (
        <div className="flex flex-wrap gap-2">
            {selected ? (
                <Link href={makeHref("")} className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10">
                    Clear tag
                </Link>
            ) : null}
            {tags.map(t => (
                <Link key={t} href={makeHref(t)} className={`px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 ${selected===t ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"}`}>
                    {t}
                </Link>
            ))}
        </div>
    );
}
