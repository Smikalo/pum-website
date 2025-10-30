// app/blogs/page.tsx
import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import { API_BASE } from "@/lib/config";

type BlogCard = {
    id?: string;
    slug: string;
    title: string;
    summary?: string;
    cover?: string | null;
    imageUrl?: string | null;
    publishedAt?: string | null;
    tags?: string[];
    techStack?: string[];
    authors?: { slug: string; name: string; avatarUrl?: string | null; headline?: string | null; role?: string | null }[];
};

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }
function parseMulti(param?: string){ return (param||"").split(",").map(s=>s.trim()).filter(Boolean); }

function matchesQuery(b: BlogCard, q: string){
    if (!q) return true;
    const n = q.toLowerCase();
    const fields = [b.title||"", b.summary||"", ...(b.tags||[]), ...(b.techStack||[])];
    return fields.some(f => f.toLowerCase().includes(n));
}
function includesAll(hay: string[]|undefined, needles: string[]){ if(!needles.length) return true; const h=new Set((hay||[]).map(s=>s.toLowerCase())); return needles.every(n=>h.has(n.toLowerCase())); }

function highlight(text: string | undefined, q: string) {
    if (!text) return null;
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) => re.test(p)
        ? <mark key={i} className="px-0.5 rounded bg-yellow-300/30 text-yellow-200">{p}</mark>
        : <span key={i}>{p}</span>);
}

async function fetchApiBlogs(): Promise<BlogCard[]> {
    try {
        const res = await fetch(`${API_BASE}/api/blogs?size=999`, { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const items: any[] = Array.isArray(json) ? json : json.items ?? [];
        return items.map(b => ({
            id: b.id, slug: b.slug, title: b.title, summary: b.summary,
            cover: b.cover || b.imageUrl, imageUrl: b.imageUrl, publishedAt: b.publishedAt,
            tags: b.tags || [], techStack: b.techStack || [], authors: b.authors || [],
        }));
    } catch { return []; }
}

export default async function BlogsPage({ searchParams }: { searchParams?: { q?: string; tag?: string; tech?: string; sort?: string } }) {
    const q = searchParams?.q || "";
    const tagsSel = parseMulti(searchParams?.tag);
    const techSel = parseMulti(searchParams?.tech);
    const sort = (searchParams?.sort || "newest") as "newest" | "az";

    const all = await fetchApiBlogs();

    const allTags = uniq(all.flatMap(b => b.tags||[])).sort();
    const allTech = uniq(all.flatMap(b => b.techStack||[])).sort();

    const filtered = all
        .filter(b => matchesQuery(b, q))
        .filter(b => includesAll(b.tags, tagsSel))
        .filter(b => includesAll(b.techStack, techSel))
        .sort((a,b) => {
            if (sort === "az") return (a.title||"").localeCompare(b.title||"");
            const ad = a.publishedAt ? +new Date(a.publishedAt) : 0;
            const bd = b.publishedAt ? +new Date(b.publishedAt) : 0;
            if (ad === bd) return (a.title||"").localeCompare(b.title||"");
            return bd - ad;
        });

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">BLOG</p>
                <h1 className="display">Stories & insights</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    Read recaps, deep dives and updates from the PUM community.
                </p>
            </header>

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar placeholder="Search blog posts by title, summary, tag, tech…" paramKey="q" />
                </div>
                <div className="flex items-center gap-2">
                    {["newest","az"].map(s=>{
                        const p = new URLSearchParams(searchParams as any);
                        p.set("sort", s);
                        const href = `/blog?${p.toString()}`;
                        const active = sort===s;
                        return (
                            <Link key={s} href={href}
                                  className={`px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 ${active ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"}`}>
                                {s==="az" ? "A–Z" : "Newest"}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="mb-8 grid md:grid-cols-2 gap-3">
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Tags</div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips base="/blog" params={{ q, tech: techSel.join(","), sort }} values={allTags} selected={tagsSel} name="tag" />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Tech stack</div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips base="/blog" params={{ q, tag: tagsSel.join(","), sort }} values={allTech} selected={techSel} name="tech" />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(b=>(
                    <Link key={b.slug} href={`/blog/${b.slug}`} className="card p-4 hover:bg-white/10 transition">
                        {b.cover && (
                            <img src={b.cover} alt={b.title} className="w-full h-40 object-cover rounded-md ring-1 ring-white/10 mb-3" loading="lazy" />
                        )}
                        <div className="text-xs text-white/60">
                            {b.publishedAt ? new Date(b.publishedAt).toLocaleDateString() : ""}
                        </div>
                        <div className="font-semibold text-lg line-clamp-2">{highlight(b.title, q)}</div>
                        {b.summary && <div className="mt-2 text-sm text-white/70 line-clamp-3">{highlight(b.summary, q)}</div>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {(b.tags||[]).slice(0,6).map(t=>(
                                <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{highlight(t, q)}</span>
                            ))}
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}

function MultiFilterChips({
                              base, params, values, selected, name
                          }:{
    base:string; params:Record<string,string>; values:string[]; selected:string[]; name:string;
}) {
    const makeHref = (nextSelected:string[])=>{
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k,v])=> v && p.set(k,v));
        if (nextSelected.length) p.set(name, nextSelected.join(","));
        const qs = p.toString(); return `${base}${qs ? `?${qs}` : ""}`;
    };
    const toggle = (v:string)=>{
        const exists = selected.includes(v);
        const next = exists ? selected.filter(s=>s!==v) : [...selected, v];
        return makeHref(next);
    };
    return (
        <>
            {selected.length ? (
                <Link href={makeHref([])} className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10">Clear</Link>
            ) : null}
            {values.map(v=>(
                <Link key={v} href={toggle(v)}
                      className={`px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 ${selected.includes(v) ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"}`}>
                    {v}
                </Link>
            ))}
        </>
    );
}
