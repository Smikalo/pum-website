import React from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/config";
import MembersGraph from "@/components/MembersGraph";
import MembersSearchBar from "@/components/MembersSearchBar";

type Member = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string;
    skills?: string[];
    techStack?: string[];
    avatarUrl?: string; // NEW
};

type Project = {
    id: string;
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
    techStack?: string[];
    tags?: string[];
    imageUrl?: string; // NEW (cover image)
};

async function fetchMembers(params: Record<string, string | number | undefined> = {}) {
    const url = new URL("/api/members", API_BASE);
    Object.entries(params).forEach(([k,v])=>{
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load members");
    return res.json() as Promise<{ items: Member[]; total: number; page: number; size: number }>;
}

async function fetchAllMembers() {
    return fetchMembers({ size: 999 });
}

async function fetchProjects() {
    const res = await fetch(`${API_BASE}/api/projects?size=999`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load projects");
    return res.json() as Promise<{ items: Project[] }>;
}

function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

function niceSkillLabel(s: string) {
    const m: Record<string,string> = {
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

// highlight utility for server components
function highlight(text: string | undefined, q: string) {
    if (!text) return null;
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) =>
        re.test(p) ? (
            <mark key={i} className="px-0.5 rounded bg-yellow-300/30 text-yellow-200">{p}</mark>
        ) : (
            <span key={i}>{p}</span>
        )
    );
}

export default async function MembersPage({
                                              searchParams
                                          }: {
    searchParams?: { q?: string; skill?: string; tech?: string; view?: string }
}) {
    const q = searchParams?.q || "";
    const skill = searchParams?.skill || "";
    const tech = searchParams?.tech || "";
    const view = (searchParams?.view || "list") as "list" | "graph" | "groups";

    const [{ items, total }, allMembers, projectsRaw] = await Promise.all([
        fetchMembers({ q, skill, tech, size: 60 }),
        fetchAllMembers(),
        fetchProjects(),
    ]);

    // Filters for chips
    const allSkills = uniq(allMembers.items.flatMap(m=>m.skills || [])).sort();
    const allTech = uniq(allMembers.items.flatMap(m=>m.techStack || [])).sort();

    // For the graph, only show filtered members + projects that connect to them
    const visibleMembers = items;
    const visibleSlugs = new Set(visibleMembers.map(m=>m.slug));
    const filteredProjects = projectsRaw.items.filter(p =>
        (p.members || []).some(r => {
            const slug = r.memberSlug || allMembers.items.find(mm => mm.id === r.memberId)?.slug;
            return !!slug && visibleSlugs.has(slug);
        })
    );

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">PEOPLE</p>
                <h1 className="display">Meet the minds behind PUM</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    We’re a collective of initiative TUM students shipping production-grade prototypes, hackathon winners and startups.
                    Browse by expertise, tech, or explore our network graph to see who built what.
                </p>
            </header>

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    {/* LIVE search bar (debounced router.replace) */}
                    <MembersSearchBar
                        placeholder="Search members by name, bio, skills…"
                        paramKey="q"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {["list","graph","groups"].map(v=>(
                        <Link
                            key={v}
                            href={`/members?${new URLSearchParams({ q, skill, tech, view: v}).toString()}`}
                            className={`px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 ${view===v? "bg-white text-black font-semibold":"bg-white/5 hover:bg-white/10"}`}
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
                        <FilterChips
                            base="/members"
                            params={{ q, tech, view }}
                            values={allSkills}
                            active={skill}
                            name="skill"
                            labelize={niceSkillLabel}
                        />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Tech stack</div>
                    <div className="flex flex-wrap gap-2">
                        <FilterChips
                            base="/members"
                            params={{ q, skill, view }}
                            values={allTech}
                            active={tech}
                            name="tech"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {view === "graph" ? (
                <MembersGraph
                    members={visibleMembers}
                    projects={filteredProjects}
                    query={q} // for highlight in tooltip
                />
            ) : view === "groups" ? (
                <GroupsView members={visibleMembers} q={q} />
            ) : (
                <ListView members={visibleMembers} total={total} q={q} />
            )}
        </section>
    );
}

function FilterChips({
                         base,
                         params,
                         values,
                         active,
                         name,
                         labelize,
                     }: {
    base: string;
    params: Record<string, string>;
    values: string[];
    active?: string;
    name: string;
    labelize?: (s: string)=>string;
}) {
    const makeHref = (v?: string) => {
        const p = new URLSearchParams({ ...params, [name]: v || "" });
        for (const [k,val] of p.entries()) if (!val) p.delete(k);
        return `${base}?${p.toString()}`;
    };

    return (
        <>
            {active ? (
                <Link href={makeHref("")} className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10">
                    Clear
                </Link>
            ) : null}
            {values.map((v)=>(
                <Link
                    key={v}
                    href={makeHref(v)}
                    className={`px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 ${active===v ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"}`}
                >
                    {labelize ? labelize(v) : v}
                </Link>
            ))}
        </>
    );
}

function Avatar({ name, src, size=40 }: { name: string; src?: string; size?: number }) {
    const initials = name.split(" ").map(s=>s[0]).slice(0,2).join("").toUpperCase();
    return src ? (
        <img
            src={src}
            alt={name}
            className="rounded-full object-cover ring-1 ring-white/10"
            style={{ width: size, height: size }}
        />
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
            <div className="mb-3 text-sm text-white/60">{total} member{total===1?"":"s"} found</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((m)=>(
                    <Link key={m.slug} href={`/members/${m.slug}`} className="card p-5 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 transition">
                        <div className="flex items-start gap-3">
                            <Avatar name={m.name} src={m.avatarUrl} size={44} />
                            <div className="min-w-0">
                                <div className="font-semibold text-lg">{highlight(m.name, q)}</div>
                                {m.shortBio ? <div className="text-sm text-white/70 mt-1 line-clamp-3">{highlight(m.shortBio, q)}</div> : null}
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(m.skills||[]).slice(0,3).map(s=>(
                                        <span key={s} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{highlight(s, q)}</span>
                                    ))}
                                </div>
                                <div className="mt-3 text-xs text-white/50 truncate">
                                    {(m.techStack||[]).map((t, i)=>(
                                        <span key={t}>
                      {highlight(t, q)}{i < (m.techStack?.length||0)-1 ? " • " : ""}
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
    const groups = Object.entries(buckets).sort(([a],[b])=>a.localeCompare(b));
    return (
        <div className="space-y-8">
            {groups.map(([skill, arr])=>(
                <div key={skill}>
                    <h3 className="text-xl font-bold mb-3">{highlight(niceSkillLabel(skill), q)}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {arr.map((m)=>(
                            <Link key={m.slug} href={`/members/${m.slug}`} className="card p-4 hover:bg-white/10 transition">
                                <div className="flex items-center gap-3">
                                    <Avatar name={m.name} src={m.avatarUrl} size={36}/>
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
