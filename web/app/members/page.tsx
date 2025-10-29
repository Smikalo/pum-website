/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import MembersGraph from "@/components/MembersGraph";
import MembersSearchBar from "@/components/MembersSearchBar";

export const dynamic = "force-dynamic";

/* ---------- Types matching your existing UI ---------- */
type Member = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string;
    skills?: string[];
    techStack?: string[];
    avatarUrl?: string;
};

type ProjectData = {
    id: string; // required
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
    techStack?: string[];
    tags?: string[];
    imageUrl?: string;

    // optional detail fields
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
};

/* ---------- API helpers (no seeds, API-only) ---------- */
async function fetchAllMembers() {
    const url = new URL("/api/members", API_BASE);
    url.searchParams.set("size", "999");
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load members");
    return res.json() as Promise<{ items: Member[]; total: number }>;
}

async function fetchApiProjects(): Promise<ProjectData[]> {
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

function normalizeProject(p: any): ProjectData {
    const slug: string = p.slug ?? p.id ?? "";
    const id: string = (p.id ?? slug) as string;
    return {
        id,
        slug,
        title: p.title ?? p.name ?? slug,
        tags: p.tags ?? [],
        techStack: p.techStack ?? p.tech ?? [],
        members: (p.members ?? []).map((m: any) => ({
            memberId: m.memberId ?? m.id,
            memberSlug: m.memberSlug ?? m.slug,
        })),
        imageUrl: p.imageUrl ?? p.cover,
        summary: p.summary,
        description: p.description,
        year: typeof p.year === "number" ? p.year : undefined,
        cover: p.cover ?? p.imageUrl,
    };
}

/* ---------- Local helpers (preserve old behavior) ---------- */
function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}
function niceSkillLabel(s: string) {
    const m: Record<string, string> = {
        frontend: "Frontend",
        backend: "Backend",
        fullstack: "Full-stack",
        ml: "ML",
        ai: "AI",
        business: "Business",
        management: "Management",
        design: "Design",
        data: "Data",
    };
    return m[s.toLowerCase()] || s;
}
function parseMulti(param?: string): string[] {
    if (!param) return [];
    return param.split(",").map((x) => x.trim()).filter(Boolean);
}
// AND logic for tag categories
function includesAll(haystack: string[] | undefined, needles: string[]): boolean {
    if (!needles.length) return true;
    const h = new Set((haystack || []).map((s) => s.toLowerCase()));
    return needles.every((n) => h.has(n.toLowerCase()));
}
// Case-insensitive substring over name/bio/tags
function matchesQuery(m: Member, q: string): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    const fields: string[] = [m.name || "", m.shortBio || "", ...(m.skills || []), ...(m.techStack || [])];
    return fields.some((f) => f.toLowerCase().includes(needle));
}
// highlight utility for server components
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

/* ---------- Page (same UI/UX, API data only) ---------- */
export default async function MembersPage({
                                              searchParams,
                                          }: {
    searchParams?: { q?: string; skill?: string; tech?: string; view?: string };
}) {
    const q = searchParams?.q || "";
    const skillList = parseMulti(searchParams?.skill);
    const techList = parseMulti(searchParams?.tech);
    const view = (searchParams?.view || "list") as "list" | "graph" | "groups";

    // API-only data
    const [allMembersRes, apiProjects] = await Promise.all([fetchAllMembers(), fetchApiProjects()]);

    const allMembers: Member[] = allMembersRes.items;
    const allProjects: ProjectData[] = apiProjects;

    // Build vocabularies from API results
    const allSkills = uniq(allMembers.flatMap((m) => m.skills || [])).sort();
    const allTech = uniq(allMembers.flatMap((m) => m.techStack || [])).sort();

    // Preserve server-side filtering semantics
    const filteredMembers = allMembers.filter(
        (m) => includesAll(m.skills, skillList) && includesAll(m.techStack, techList) && matchesQuery(m, q),
    );
    const total = filteredMembers.length;

    // Graph: limit projects to those touching visible members
    const visibleSlugs = new Set(filteredMembers.map((m) => m.slug));
    const filteredProjects = allProjects.filter((p) =>
        (p.members || []).some((r) => {
            const slug = r.memberSlug || filteredMembers.find((mm) => mm.id === r.memberId)?.slug;
            return !!slug && visibleSlugs.has(slug);
        }),
    );

    // Match MembersGraph prop contract exactly
    type MembersGraphProps = React.ComponentProps<typeof MembersGraph>;
    const graphProjects: MembersGraphProps["projects"] = filteredProjects.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        members: p.members?.map((m) => ({ memberId: m.memberId, memberSlug: m.memberSlug })) ?? [],
        techStack: p.techStack ?? [],
        tags: p.tags ?? [],
        imageUrl: p.imageUrl,
    }));

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">PEOPLE</p>
                <h1 className="display">Meet the minds behind PUM</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    We’re a collective of initiative TUM students shipping production-grade prototypes, hackathon winners and
                    startups. Browse by expertise, tech, or explore our network graph to see who built what.
                </p>
            </header>

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar placeholder="Search members by name, bio, expertise, tech…" paramKey="q" />
                </div>
                <div className="flex items-center gap-2">
                    {["list", "graph", "groups"].map((v) => (
                        <Link
                            key={v}
                            href={`/members?${new URLSearchParams({
                                q,
                                ...(skillList.length ? { skill: skillList.join(",") } : {}),
                                ...(techList.length ? { tech: techList.join(",") } : {}),
                                view: v,
                            }).toString()}`}
                            className={`px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 ${
                                view === v ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"
                            }`}
                        >
                            {v === "list" ? "List" : v === "graph" ? "Graph" : "Groups"}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="mb-8 grid md:grid-cols-2 gap-3">
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Expertise</div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/members"
                            params={{ q, tech: techList.join(","), view }}
                            values={allSkills}
                            selected={skillList}
                            name="skill"
                            labelize={niceSkillLabel}
                        />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Tech stack</div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/members"
                            params={{ q, skill: skillList.join(","), view }}
                            values={allTech}
                            selected={techList}
                            name="tech"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {view === "graph" ? (
                <MembersGraph members={filteredMembers} projects={graphProjects} query={q} />
            ) : view === "groups" ? (
                <GroupsView members={filteredMembers} q={q} />
            ) : (
                <ListView members={filteredMembers} total={total} q={q} />
            )}
        </section>
    );
}

/* ---------- Small presentational helpers (unchanged look) ---------- */
function MultiFilterChips({
                              base,
                              params,
                              values,
                              selected,
                              name,
                              labelize,
                          }: {
    base: string;
    params: Record<string, string>;
    values: string[];
    selected: string[];
    name: string;
    labelize?: (s: string) => string;
}) {
    const makeHref = (nextSelected: string[]) => {
        const p = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v) p.set(k, v);
        });
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
                    {labelize ? labelize(v) : v}
                </Link>
            ))}
        </>
    );
}

function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
    const initials = name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    return src ? (
        <img src={src} alt={name} className="rounded-full object-cover ring-1 ring-white/10" style={{ width: size, height: size }} />
    ) : (
        <div
            className="rounded-full grid place-items-center bg-white/10 ring-1 ring-white/10 text-white/80"
            style={{ width: size, height: size }}
            aria-hidden
        >
            <span className="text-xs">{initials}</span>
        </div>
    );
}

function ListView({ members, total, q }: { members: Member[]; total: number; q: string }) {
    return (
        <>
            <div className="mb-3 text-sm text-white/60">
                {total} member{total === 1 ? "" : "s"} found
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((m) => (
                    <Link
                        key={m.slug}
                        href={`/members/${m.slug}`}
                        className="card p-5 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 transition"
                    >
                        <div className="flex items-start gap-3">
                            <Avatar name={m.name} src={m.avatarUrl} size={44} />
                            <div className="min-w-0">
                                <div className="font-semibold text-lg">{highlight(m.name, q)}</div>
                                {m.shortBio ? <div className="text-sm text-white/70 mt-1 line-clamp-3">{highlight(m.shortBio, q)}</div> : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(m.skills || []).slice(0, 3).map((s) => (
                                        <span key={s} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                      {highlight(s, q)}
                    </span>
                                    ))}
                                </div>
                                <div className="mt-3 text-xs text-white/50 truncate">
                                    {(m.techStack || []).map((t, i) => (
                                        <span key={t}>
                      {highlight(t, q)}
                                            {i < (m.techStack?.length || 0) - 1 ? " • " : ""}
                    </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}

function GroupsView({ members, q }: { members: Member[]; q: string }) {
    const buckets: Record<string, Member[]> = {};
    for (const m of members) {
        const key = (m.skills && m.skills[0]) || "other";
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(m);
    }
    const groups = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    return (
        <div className="space-y-8">
            {groups.map(([skill, arr]) => (
                <div key={skill}>
                    <h3 className="text-xl font-bold mb-3">{highlight(niceSkillLabel(skill), q)}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {arr.map((m) => (
                            <Link key={m.slug} href={`/members/${m.slug}`} className="card p-4 hover:bg-white/10 transition">
                                <div className="flex items-center gap-3">
                                    <Avatar name={m.name} src={m.avatarUrl} size={36} />
                                    <div>
                                        <div className="font-semibold">{highlight(m.name, q)}</div>
                                        <div className="text-xs text-white/60 line-clamp-2">{highlight(m.shortBio, q)}</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
