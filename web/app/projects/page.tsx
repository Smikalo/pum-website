/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import { API_BASE } from "@/lib/config";

export const dynamic = "force-dynamic";

/* ---------- Types shaped for your UI ---------- */
type Project = {
    id?: string;
    slug: string;
    title: string;
    tags?: string[];
    techStack?: string[];
    members?: { memberId?: string; memberSlug?: string; role?: string }[];
    imageUrl?: string;
    // detail (optional)
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
};

/* ---------- Helpers (same behavior) ---------- */
function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}
function parseMulti(param?: string): string[] {
    if (!param) return [];
    return param.split(",").map((x) => x.trim()).filter(Boolean);
}
function includesAll(haystack: string[] | undefined, needles: string[]): boolean {
    if (!needles.length) return true;
    const h = new Set((haystack || []).map((s) => s.toLowerCase()));
    return needles.every((n) => h.has(n.toLowerCase()));
}
function matchesQuery(p: Project, q: string): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    const fields = [p.title || "", p.summary || "", ...(p.tags || []), ...(p.techStack || [])];
    return fields.some((f) => f.toLowerCase().includes(needle));
}
function highlight(text: string | undefined, q: string) {
    if (!text) return null;
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) =>
        re.test(p) ? (
            <mark key={i} className="px-0.5 rounded bg-yellow-300/30 text-yellow-200">
                {p}
            </mark>
        ) : (
            <span key={i}>{p}</span>
        ),
    );
}

/* ---------- API (no seeds) ---------- */
async function fetchApiProjects(): Promise<Project[]> {
    try {
        const res = await fetch(`${API_BASE}/api/projects?size=999`, { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const items: any[] = Array.isArray(json) ? json : json.items ?? [];
        return items.map(normalizeProject);
    } catch {
        return [];
    }
}
function normalizeProject(p: any): Project {
    return {
        id: p.id ?? p.slug,
        slug: p.slug,
        title: p.title ?? p.name,
        tags: p.tags ?? [],
        techStack: p.techStack ?? p.tech ?? [],
        members: (p.members ?? []).map((m: any) => ({
            memberId: m.memberId ?? m.id,
            memberSlug: m.memberSlug ?? m.slug,
            role: m.role,
        })),
        imageUrl: p.imageUrl ?? p.cover,
        summary: p.summary,
        description: p.description,
        year: typeof p.year === "number" ? p.year : undefined,
        cover: p.cover ?? p.imageUrl,
    };
}

/* ---------- Page ---------- */
export default async function ProjectsPage({
                                               searchParams,
                                           }: {
    searchParams?: { q?: string; tag?: string; tech?: string; sort?: string };
}) {
    const q = searchParams?.q || "";
    const tagsSel = parseMulti(searchParams?.tag);
    const techSel = parseMulti(searchParams?.tech);
    const sort = (searchParams?.sort || "newest") as "newest" | "az";

    const all = await fetchApiProjects();

    const allTags = uniq(all.flatMap((p) => p.tags || [])).sort();
    const allTech = uniq(all.flatMap((p) => p.techStack || [])).sort();

    const filtered = all
        .filter((p) => matchesQuery(p, q))
        .filter((p) => includesAll(p.tags, tagsSel))
        .filter((p) => includesAll(p.techStack, techSel))
        .sort((a, b) => {
            if (sort === "az") return (a.title || "").localeCompare(b.title || "");
            const ay = a.year ?? 0;
            const by = b.year ?? 0;
            if (ay === by) return (a.title || "").localeCompare(b.title || "");
            return by - ay;
        });

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">PROJECTS</p>
                <h1 className="display">Things we’ve built</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    Explore hackathon winners, MVPs, and experiments. Filter by tags or tech, and open a project to see team, events, and a demo.
                </p>
            </header>

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar placeholder="Search projects by title, summary, tag, tech…" paramKey="q" />
                </div>
                <div className="flex items-center gap-2">
                    {["newest", "az"].map((s) => {
                        const p = new URLSearchParams(searchParams as any);
                        p.set("sort", s);
                        const href = `/projects?${p.toString()}`;
                        const active = sort === s;
                        return (
                            <Link
                                key={s}
                                href={href}
                                className={`px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 ${
                                    active ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"
                                }`}
                            >
                                {s === "az" ? "A–Z" : "Newest"}
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
                        <MultiFilterChips base="/projects" params={{ q, tech: techSel.join(","), sort }} values={allTags} selected={tagsSel} name="tag" />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Tech stack</div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips base="/projects" params={{ q, tag: tagsSel.join(","), sort }} values={allTech} selected={techSel} name="tech" />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                    <Link key={p.slug} href={`/projects/${p.slug}`} className="card p-4 hover:bg-white/10 transition">
                        {p.imageUrl && (
                            <img
                                src={p.imageUrl}
                                alt={p.title}
                                className="w-full h-40 object-cover rounded-md ring-1 ring-white/10 mb-3"
                                loading="lazy"
                            />
                        )}
                        <div className="text-xs text-white/60">{p.year ?? ""}</div>
                        <div className="font-semibold text-lg line-clamp-2">{highlight(p.title, q)}</div>
                        {p.summary && <div className="mt-2 text-sm text-white/70 line-clamp-3">{highlight(p.summary, q)}</div>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {(p.tags || []).slice(0, 6).map((t) => (
                                <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                  {highlight(t, q)}
                </span>
                            ))}
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-8 text-sm text-white/60">
                Can’t find your idea? <Link href="/contact" className="underline underline-offset-4">Pitch us →</Link>
            </div>
        </section>
    );
}

function MultiFilterChips({
                              base,
                              params,
                              values,
                              selected,
                              name,
                          }: {
    base: string;
    params: Record<string, string>;
    values: string[];
    selected: string[];
    name: string;
}) {
    const makeHref = (nextSelected: string[]) => {
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
        if (nextSelected.length) p.set(name, nextSelected.join(","));
        const qs = p.toString();
        return `${base}${qs ? `?${qs}` : ""}`;
    };

    const toggle = (v: string) => {
        const exists = selected.includes(v);
        const next = exists ? selected.filter((s) => s !== v) : [...selected, v];
        return makeHref(next);
    };

    return (
        <>
            {selected.length ? (
                <Link href={makeHref([])} className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10">
                    Clear
                </Link>
            ) : null}
            {values.map((v) => (
                <Link
                    key={v}
                    href={toggle(v)}
                    className={`px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 ${
                        selected.includes(v) ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"
                    }`}
                >
                    {v}
                </Link>
            ))}
        </>
    );
}
