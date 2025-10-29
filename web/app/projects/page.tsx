// web/app/projects/page.tsx
import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import { API_BASE } from "@/lib/config";
import { SEED_PROJECTS, type Project as SeedProject } from "@/data/projects.seed";

// Keep the shape compatible with your members page expectations
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
};

function highlight(text: string, q: string) {
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
        techStack: p.techStack ?? p.stack ?? [],
        members:
            (p.members || p.contributors || []).map((x: any) => ({
                memberId: x.memberId ?? x.userId ?? undefined,
                memberSlug: x.memberSlug ?? x.slug ?? x.username ?? undefined,
                role: x.role ?? undefined,
            })) ?? [],
        imageUrl: p.imageUrl ?? p.cover ?? undefined,
        summary: p.summary,
        description: p.description,
        year: p.year ? Number(p.year) : undefined,
    };
}

function splitCSV(param?: string): string[] {
    if (!param) return [];
    return param.split(",").map((s) => s.trim()).filter(Boolean);
}

function includesAll(haystack: string[] | undefined, needles: string[]): boolean {
    if (!needles.length) return true;
    const h = new Set((haystack || []).map((s) => s.toLowerCase()));
    return needles.every((n) => h.has(n.toLowerCase()));
}

function matchesQuery(p: Project, q: string): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    const fields = [p.title || "", ...(p.tags || []), ...(p.techStack || [])];
    return fields.some((f) => f.toLowerCase().includes(needle));
}

function mergeProjects(api: Project[], seeds: SeedProject[]): Project[] {
    const map = new Map<string, Project>();
    for (const p of api) map.set(p.slug, { ...p });
    for (const s of seeds) {
        const sn = normalizeProject(s);
        if (map.has(s.slug)) {
            const cur = map.get(s.slug)!;
            map.set(s.slug, {
                ...sn,
                ...cur, // API wins
                id: cur.id || sn.id,
                tags: Array.from(new Set([...(cur.tags || []), ...(sn.tags || [])])),
                techStack: Array.from(new Set([...(cur.techStack || []), ...(sn.techStack || [])])),
            });
        } else {
            map.set(s.slug, sn);
        }
    }
    return Array.from(map.values());
}

export default async function ProjectsPage({
                                               searchParams,
                                           }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const q = (searchParams?.q as string) || "";
    const tags = splitCSV(searchParams?.tags as string | undefined);
    const stack = splitCSV(searchParams?.stack as string | undefined);

    const api = await fetchApiProjects();
    const all = mergeProjects(api, SEED_PROJECTS);

    const filtered = all.filter((p) => matchesQuery(p, q) && includesAll(p.tags, tags) && includesAll(p.techStack, stack));

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">PROJECTS</p>
                <h1 className="display">What we’ve been building</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    Student-built products, hackathon winners and early-stage ventures. Filter by tags, tech and contributors.
                </p>
            </header>

            <div className="mb-6">
                <MembersSearchBar placeholder="Search projects, tags, tech…" paramKey="q" />
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((p) => (
                    <Link key={p.slug} href={`/projects/${p.slug}`} className="card hover:border-white/20">
                        <div className="aspect-video rounded-xl overflow-hidden bg-white/5 ring-1 ring-white/10">
                            {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full grid place-items-center text-white/40 text-sm">No cover</div>
                            )}
                        </div>
                        <div className="mt-3 font-semibold">{highlight(p.title, q)}</div>
                        {!!(p.tags?.length || p.techStack?.length) && (
                            <div className="mt-1 text-xs text-white/60 line-clamp-2">
                                {[...(p.tags || []), ...(p.techStack || [])].join(" • ")}
                            </div>
                        )}
                    </Link>
                ))}
            </div>
        </section>
    );
}
