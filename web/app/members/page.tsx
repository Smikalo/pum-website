// web/app/members/page.tsx
import React from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/config";
import MembersGraph from "@/components/MembersGraph";
import MembersSearchBar from "@/components/MembersSearchBar";
import { SEED_MEMBERS, type Member as SeedMember } from "@/data/members.seed";
import { SEED_PROJECTS, type Project as SeedProject } from "@/data/projects.seed";

type Member = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string;
    skills?: string[];
    techStack?: string[];
    avatarUrl?: string;

    // details (optional; kept for compatibility with other pages)
    longBio?: string;
    badges?: string[];
    links?: Record<string, string>;
    projects?: Array<{ projectId?: string; projectSlug?: string; role?: string; contribution?: string }>;
};

// IMPORTANT: rename to avoid clashing with MembersGraph's internal `Project` type.
type ProjectData = {
    id: string; // required (we ensure it below)
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
    techStack?: string[];
    tags?: string[];
    imageUrl?: string;

    // optional detail fields (kept for compatibility with other pages)
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
};

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
        id, // ensure string
        slug,
        title: p.title ?? p.name ?? slug,
        tags: p.tags ?? [],
        techStack: p.techStack ?? p.stack ?? [],
        imageUrl: p.imageUrl ?? p.cover ?? undefined,
        members: (p.members || p.contributors || []).map((x: any) => ({
            memberId: x.memberId ?? x.userId ?? undefined,
            memberSlug: x.memberSlug ?? x.slug ?? x.username ?? undefined,
        })),
        summary: p.summary,
        description: p.description,
        year: p.year ? Number(p.year) : undefined,
        cover: p.cover,
    };
}

function normalizeMember(m: any): Member {
    const slug: string = m.slug ?? m.id ?? "";
    return {
        id: String(m.id ?? slug),
        slug,
        name: m.name ?? slug,
        shortBio: m.shortBio ?? m.headline ?? "",
        skills: m.skills ?? m.expertise ?? m.tags ?? [],
        techStack: m.techStack ?? m.stack ?? [],
        avatarUrl: m.avatarUrl ?? m.avatar ?? undefined,
        longBio: m.longBio ?? m.bio ?? "",
        badges: m.badges ?? [],
        links: m.links ?? {},
        projects: (m.projects || m.contributions || []).map((x: any) => ({
            projectId: x.projectId ?? x.id ?? undefined,
            projectSlug: x.projectSlug ?? x.slug ?? undefined,
            role: x.role ?? undefined,
            contribution: x.contribution ?? undefined,
        })),
    };
}

function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
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

function matchesQueryMember(m: Member, q: string): boolean {
    if (!q) return true;
    const n = q.toLowerCase();
    const fields: string[] = [
        m.name || "",
        m.shortBio || "",
        ...(m.skills || []),
        ...(m.techStack || []),
        ...(m.badges || []),
    ];
    return fields.some((f) => f.toLowerCase().includes(n));
}

function niceSkillLabel(s: string) {
    const dk: Record<string, string> = {
        "ml": "Machine Learning",
        "ai": "AI",
        "pm": "Product Management",
        "fe": "Frontend",
        "be": "Backend",
        "ux": "UX / Design",
    };
    return dk[s] || s;
}

function highlight(text: string | undefined, q: string) {
    if (!text) return null;
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    return (text as string).split(re).map((part, i) =>
        re.test(part) ? (
            <mark key={i} className="px-0.5 rounded bg-yellow-300/30 text-yellow-200">
                {part}
            </mark>
        ) : (
            <span key={i}>{part}</span>
        ),
    );
}

function bucketBy<T>(arr: T[], getKey: (x: T) => string) {
    const map = new Map<string, T[]>();
    for (const x of arr) {
        const k = getKey(x);
        if (!k) continue;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(x);
    }
    return map;
}

function mergeMembers(api: Member[], seeds: SeedMember[]): Member[] {
    const map = new Map<string, Member>();
    for (const m of api) map.set(m.slug, { ...m });
    for (const s of seeds) {
        const sn = normalizeMember(s);
        if (map.has(s.slug)) {
            const cur = map.get(s.slug)!;
            map.set(s.slug, {
                ...sn,
                ...cur, // API wins
                id: cur.id || sn.id, // keep required id
                skills: uniq([...(cur.skills || []), ...(sn.skills || [])]),
                techStack: uniq([...(cur.techStack || []), ...(sn.techStack || [])]),
                badges: uniq([...(cur.badges || []), ...(sn.badges || [])]),
            });
        } else {
            map.set(s.slug, sn);
        }
    }
    return Array.from(map.values());
}

function mergeProjects(api: ProjectData[], seeds: SeedProject[]): ProjectData[] {
    const uniqArr = <T,>(arr: T[]) => Array.from(new Set(arr));
    const map = new Map<string, ProjectData>();
    for (const p of api) map.set(p.slug, { ...p });
    for (const s of seeds) {
        const sn = normalizeProject(s);
        if (map.has(s.slug)) {
            const cur = map.get(s.slug)!;
            map.set(s.slug, {
                ...sn,
                ...cur, // API wins
                id: cur.id || sn.id, // keep required id
                tags: uniqArr([...(cur.tags || []), ...(sn.tags || [])]),
                techStack: uniqArr([...(cur.techStack || []), ...(sn.techStack || [])]),
            });
        } else {
            map.set(s.slug, sn);
        }
    }
    return Array.from(map.values());
}

export default async function MembersPage({
                                              searchParams,
                                          }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    // read all query params
    const q = (searchParams?.q as string) || "";
    const skillList = splitCSV(searchParams?.skill as string | undefined);
    const techList = splitCSV(searchParams?.tech as string | undefined);
    const view = (searchParams?.view as string) || "list";

    // Fetch API + merge with seeds to keep legacy slugs working & fill gaps
    const [{ items: apiMembers }, apiProjects] = await Promise.all([fetchAllMembers(), fetchApiProjects()]);
    const members = mergeMembers(apiMembers.map(normalizeMember), SEED_MEMBERS);
    const projectsMerged = mergeProjects(apiProjects, SEED_PROJECTS);

    // searchable collections
    const allSkills = uniq(members.flatMap((m) => m.skills || [])).sort();
    const allTech = uniq(members.flatMap((m) => m.techStack || [])).sort();

    const filtered = members.filter(
        (m) => matchesQueryMember(m, q) && includesAll(m.skills, skillList) && includesAll(m.techStack, techList),
    );

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
                    {/* LIVE search bar (debounced router.replace) */}
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

            {/* Filters (stackable per category) */}
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

            {/* Views */}
            {view === "graph" ? (
                <div className="mb-10">
                    <MembersGraph members={filtered} projects={projectsMerged} />
                </div>
            ) : view === "groups" ? (
                <MembersGroups members={filtered} q={q} />
            ) : (
                <MembersList members={filtered} q={q} />
            )}
        </section>
    );
}

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
    labelize?: (v: string) => string;
}) {
    const makeHref = (nextSelected: string[]) => {
        const qs = new URLSearchParams({ ...params, [name]: nextSelected.join(",") });
        return `${base}?${qs.toString()}`;
    };

    const toggleHref = (v: string) => {
        const exists = selected.includes(v);
        const next = exists ? selected.filter((s) => s !== v) : [...selected, v];
        return makeHref(next);
    };

    return (
        <>
            {/* Clear all in this category */}
            {selected.length ? (
                <Link href={makeHref([])} className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10">
                    Clear
                </Link>
            ) : null}
            {values.map((v) => (
                <Link
                    key={v}
                    href={toggleHref(v)}
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

function MembersList({ members, q }: { members: Member[]; q: string }) {
    // bucket by first letter of name
    const buckets = bucketBy(
        members.slice().sort((a, b) => a.name.localeCompare(b.name)),
        (m) => (m.name || "#").charAt(0).toUpperCase(),
    );
    const letters = Array.from(buckets.keys()).sort();

    return (
        <div className="space-y-10">
            {letters.map((letter) => (
                <div key={letter}>
                    <div className="text-sm text-white/50 font-mono">{letter}</div>
                    <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {buckets.get(letter)!.map((m) => (
                            <Link key={m.slug} href={`/members/${m.slug}`} className="card p-4 hover:bg-white/10 transition">
                                <div className="flex items-center gap-3">
                                    <Avatar name={m.name} src={m.avatarUrl} size={36} />
                                    <div>
                                        <div className="font-semibold">{highlight(m.name, q)}</div>
                                        <div className="text-xs text-white/60 line-clamp-2">{highlight(m.shortBio, q)}</div>
                                        {!!m.badges?.length && (
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                {m.badges.slice(0, 3).map((b) => (
                                                    <span key={b} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 ring-1 ring-white/10">
                                                        {b}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
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

function MembersGroups({ members, q }: { members: Member[]; q: string }) {
    // bucket by major skill (first skill in the list)
    const buckets = bucketBy(
        members.slice().sort((a, b) => a.name.localeCompare(b.name)),
        (m) => (m.skills && m.skills[0]) || "",
    );

    const skills = Array.from(buckets.keys())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return (
        <div className="space-y-10">
            {skills.map((skill) => {
                const arr = buckets.get(skill)!;
                return (
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
                );
            })}
        </div>
    );
}

function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
    const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={name}
            width={size}
            height={size}
            className="rounded-md object-cover ring-1 ring-white/10"
        />
    ) : (
        <div
            className="rounded-md grid place-items-center bg-white/10 ring-1 ring-white/10 text-white/80"
            style={{ width: size, height: size }}
            aria-hidden
        >
            <span className="text-xs">{initials}</span>
        </div>
    );
}
