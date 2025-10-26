import Link from "next/link";
import { API_BASE } from "../../lib/config";
import MembersGraph from "@/components/MembersGraph";

type Member = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string;
    skills?: string[];
    techStack?: string[];
};

type Project = {
    id: string;
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
    techStack?: string[];
    tags?: string[];
};

async function fetchMembers(params: Record<string, string | number | undefined> = {}) {
    const url = new URL("/api/members", API_BASE);
    Object.entries(params).forEach(([k,v])=>{
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
    // Use no-store to always reflect current filters
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

export default async function MembersPage({
                                              searchParams
                                          }: {
    searchParams?: { q?: string; skill?: string; tech?: string; view?: string }
}) {
    const q = searchParams?.q || "";
    const skill = searchParams?.skill || "";
    const tech = searchParams?.tech || "";
    const view = (searchParams?.view || "list") as "list" | "graph" | "groups";

    const [{ items, total }, allMembers, projects] = await Promise.all([
        fetchMembers({ q, skill, tech, size: 60 }),
        fetchAllMembers(),
        fetchProjects(),
    ]);

    const allSkills = uniq(allMembers.items.flatMap(m=>m.skills || [])).sort();
    const allTech = uniq(allMembers.items.flatMap(m=>m.techStack || [])).sort();

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
                <form className="flex-1" action="/members" method="get">
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Search members by name or bio…"
                        className="w-full px-4 py-3 rounded-xl bg-black/50 ring-1 ring-white/10 focus:outline-none focus:ring-white/30"
                    />
                    {/* Preserve active filters on search */}
                    {skill ? <input type="hidden" name="skill" value={skill} /> : null}
                    {tech ? <input type="hidden" name="tech" value={tech} /> : null}
                    {view ? <input type="hidden" name="view" value={view} /> : null}
                </form>

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
                    members={allMembers.items}
                    projects={projects.items}
                />
            ) : view === "groups" ? (
                <GroupsView members={items} />
            ) : (
                <ListView members={items} total={total} />
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
        // Remove empty params to keep URL clean
        for (const [k,val] of p.entries()) if (!val) p.delete(k);
        return `${base}?${p.toString()}`;
    };

    return (
        <>
            {/* Clear */}
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

function ListView({ members, total }: { members: Member[]; total: number }) {
    return (
        <>
            <div className="mb-3 text-sm text-white/60">{total} member{total===1?"":"s"} found</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((m)=>(
                    <Link key={m.slug} href={`/members/${m.slug}`} className="card p-5 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 transition">
                        <div className="font-semibold text-lg">{m.name}</div>
                        {m.shortBio ? <div className="text-sm text-white/70 mt-1">{m.shortBio}</div> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                            {(m.skills||[]).slice(0,3).map(s=>(
                                <span key={s} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{s}</span>
                            ))}
                        </div>
                        <div className="mt-3 text-xs text-white/50 truncate">
                            {(m.techStack||[]).join(" • ")}
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}

function GroupsView({ members }: { members: Member[] }) {
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
                    <h3 className="text-xl font-bold mb-3">{niceSkillLabel(skill)}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {arr.map((m)=>(
                            <Link key={m.slug} href={`/members/${m.slug}`} className="card p-4 hover:bg-white/10 transition">
                                <div className="font-semibold">{m.name}</div>
                                <div className="text-xs text-white/60">{m.shortBio}</div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
