/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { API_BASE } from "@/lib/config";

// Always fetch fresh data (no build-time seeds)
export const dynamic = "force-dynamic";

type Member = {
    id: string;
    slug: string;
    name: string;
    headline?: string | null;
    shortBio?: string | null;
    avatarUrl?: string | null;
    skills?: string[];
    techStack?: string[];
};

type Project = {
    id: string;
    slug: string;
    title: string;
    members?: { memberId?: string; memberSlug?: string }[];
    cover?: string | null;
    imageUrl?: string | null;
};

type Categories = {
    skills: { name: string; count: number }[];
    tech: { name: string; count: number }[];
};

const MAX_LIST_SIZE = 999;

// ---------- Helpers ----------
function uniq<T>(arr: T[]) {
    return Array.from(new Set(arr));
}

function csvToSet(csv?: string) {
    return new Set((csv || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean));
}

function setToCsv(set: Set<string>) {
    return Array.from(set).sort().join(",");
}

function withParams(base: string, params: URLSearchParams) {
    const url = new URL(base, "http://dummy"); // base is ignored; we only need .search
    params.forEach((v, k) => url.searchParams.set(k, v));
    return url.search;
}

async function fetchMembers(params: URLSearchParams) {
    const url = new URL("/api/members", API_BASE);
    params.forEach((v, k) => url.searchParams.set(k, v));
    url.searchParams.set("size", String(MAX_LIST_SIZE));
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load members");
    return (await res.json()) as { items: Member[]; page: number; size: number; total: number };
}

async function fetchCategories(): Promise<Categories> {
    const res = await fetch(`${API_BASE}/api/members/categories`, { cache: "no-store" });
    if (!res.ok) return { skills: [], tech: [] };
    return res.json();
}

async function fetchProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/api/projects?size=${MAX_LIST_SIZE}`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.items || []) as Project[];
}

// ---------- Page ----------
export default async function MembersPage({
                                              searchParams,
                                          }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const q = (typeof searchParams?.q === "string" ? searchParams?.q : "") || "";
    const view = (typeof searchParams?.view === "string" ? searchParams?.view : "list") as
        | "list"
        | "graph";

    // Parse filters (CSV)
    const selectedSkills = csvToSet(typeof searchParams?.skill === "string" ? searchParams?.skill : "");
    const selectedTech = csvToSet(typeof searchParams?.tech === "string" ? searchParams?.tech : "");

    // Build query for API
    const apiParams = new URLSearchParams();
    if (q) apiParams.set("q", q);
    if (selectedSkills.size) apiParams.set("skill", setToCsv(selectedSkills));
    if (selectedTech.size) apiParams.set("tech", setToCsv(selectedTech));

    // Fetch data (members are the primary data; projects only needed for graph)
    const [{ items: members, total }, categories, projects] = await Promise.all([
        fetchMembers(apiParams),
        fetchCategories(),
        view === "graph" ? fetchProjects() : Promise.resolve([] as Project[]),
    ]);

    // For graph view: show only projects connected to visible members
    const visibleMemberSlugs = new Set(members.map((m) => m.slug));
    const connectedProjects =
        view === "graph"
            ? projects.filter((p) => (p.members || []).some((m) => m.memberSlug && visibleMemberSlugs.has(m.memberSlug)))
            : [];

    // Build vocabularies from API (fallback to members rollup if category endpoint is empty)
    const allSkills =
        categories.skills?.length
            ? categories.skills
            : uniq(members.flatMap((m) => m.skills || [])).map((name) => ({
                name,
                count: members.filter((mm) => (mm.skills || []).includes(name)).length,
            }));

    const allTech =
        categories.tech?.length
            ? categories.tech
            : uniq(members.flatMap((m) => m.techStack || [])).map((name) => ({
                name,
                count: members.filter((mm) => (mm.techStack || []).includes(name)).length,
            }));

    // Helpers to create filter links (toggle behavior)
    function toggleParamCsv(
        key: "skill" | "tech",
        value: string,
        current: Set<string>
    ) {
        const next = new Set(current);
        if (next.has(value)) next.delete(value);
        else next.add(value);

        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (key === "skill") {
            if (next.size) params.set("skill", setToCsv(next));
            if (selectedTech.size) params.set("tech", setToCsv(selectedTech));
        } else {
            if (selectedSkills.size) params.set("skill", setToCsv(selectedSkills));
            if (next.size) params.set("tech", setToCsv(next));
        }
        if (view) params.set("view", view);
        return `/members${withParams("/members", params)}`;
    }

    function clearFiltersHref() {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (view) params.set("view", view);
        return `/members${withParams("/members", params)}`;
    }

    function setViewHref(nextView: "list" | "graph") {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (selectedSkills.size) params.set("skill", setToCsv(selectedSkills));
        if (selectedTech.size) params.set("tech", setToCsv(selectedTech));
        params.set("view", nextView);
        return `/members${withParams("/members", params)}`;
    }

    return (
        <section className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
                    <p className="text-white/60">
                        {total} {total === 1 ? "person" : "people"} found
                    </p>
                </div>

                {/* View switcher */}
                <div className="inline-flex rounded-xl overflow-hidden ring-1 ring-white/10">
                    <Link
                        href={setViewHref("list")}
                        className={`px-4 py-2 text-sm ${
                            view === "list" ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                    >
                        List
                    </Link>
                    <Link
                        href={setViewHref("graph")}
                        className={`px-4 py-2 text-sm ${
                            view === "graph" ? "bg-white/10" : "hover:bg-white/5"
                        }`}
                    >
                        Graph
                    </Link>
                </div>
            </div>

            {/* Search */}
            <form className="mb-6" action="/members" method="get">
                <div className="flex gap-3">
                    <input
                        type="text"
                        name="q"
                        placeholder="Search members by name, bio, headline…"
                        defaultValue={q}
                        className="w-full rounded-xl bg-white/5 px-4 py-2 outline-none ring-1 ring-white/10 placeholder-white/40"
                    />
                    {/* Preserve filters and view when submitting search */}
                    {selectedSkills.size > 0 && (
                        <input type="hidden" name="skill" value={setToCsv(selectedSkills)} />
                    )}
                    {selectedTech.size > 0 && (
                        <input type="hidden" name="tech" value={setToCsv(selectedTech)} />
                    )}
                    {view && <input type="hidden" name="view" value={view} />}
                    <button
                        className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
                        type="submit"
                    >
                        Search
                    </button>
                    {(selectedSkills.size || selectedTech.size || q) ? (
                        <Link
                            href="/members"
                            className="rounded-xl bg-white/0 px-3 py-2 text-sm hover:bg-white/10"
                        >
                            Reset
                        </Link>
                    ) : null}
                </div>
            </form>

            {/* Categories */}
            <div className="mb-8 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Skills</h2>
                        {selectedSkills.size ? (
                            <Link
                                href={clearFiltersHref()}
                                className="text-sm text-white/70 hover:underline"
                            >
                                Clear
                            </Link>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {allSkills.map(({ name, count }) => {
                            const active = selectedSkills.has(name);
                            return (
                                <Link
                                    key={name}
                                    href={toggleParamCsv("skill", name, selectedSkills)}
                                    className={`rounded-full border px-3 py-1 text-sm ${
                                        active
                                            ? "border-white/30 bg-white/10"
                                            : "border-white/10 hover:border-white/20"
                                    }`}
                                >
                                    {name} <span className="ml-1 text-white/50">{count}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Tech</h2>
                        {selectedTech.size ? (
                            <Link
                                href={clearFiltersHref()}
                                className="text-sm text-white/70 hover:underline"
                            >
                                Clear
                            </Link>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {allTech.map(({ name, count }) => {
                            const active = selectedTech.has(name);
                            return (
                                <Link
                                    key={name}
                                    href={toggleParamCsv("tech", name, selectedTech)}
                                    className={`rounded-full border px-3 py-1 text-sm ${
                                        active
                                            ? "border-white/30 bg-white/10"
                                            : "border-white/10 hover:border-white/20"
                                    }`}
                                >
                                    {name} <span className="ml-1 text-white/50">{count}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Content */}
            {view === "graph" ? (
                <GraphView members={members} projects={connectedProjects} query={q} />
            ) : (
                <ListView members={members} />
            )}
        </section>
    );
}

// ---------- Subviews ----------
function ListView({ members }: { members: Member[] }) {
    if (!members.length) {
        return (
            <div className="rounded-2xl border border-white/10 p-8 text-center text-white/70">
                No members match your filters.
            </div>
        );
    }

    return (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
                <li
                    key={m.id}
                    className="rounded-2xl border border-white/10 p-4 hover:border-white/20"
                >
                    <Link href={`/members/${m.slug}`} className="flex gap-4">
                        <img
                            src={m.avatarUrl || "/avatars/default.png"}
                            alt={m.name}
                            className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                        />
                        <div className="min-w-0">
                            <h3 className="truncate text-lg font-medium">{m.name}</h3>
                            {m.headline ? (
                                <p className="truncate text-sm text-white/70">{m.headline}</p>
                            ) : m.shortBio ? (
                                <p className="line-clamp-2 text-sm text-white/70">{m.shortBio}</p>
                            ) : null}
                            {(m.skills?.length || m.techStack?.length) && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {uniq([...(m.skills || []), ...(m.techStack || [])])
                                        .slice(0, 6)
                                        .map((chip) => (
                                            <span
                                                key={chip}
                                                className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/80"
                                            >
                        {chip}
                      </span>
                                        ))}
                                </div>
                            )}
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function GraphView({
                       members,
                       projects,
                       query,
                   }: {
    members: Member[];
    projects: Project[];
    query: string;
}) {
    // Lazy import to avoid build errors if the graph component moves
    // Expecting an existing component at "@/components/MembersGraph"
    // which accepts { members, projects, query }
    const MembersGraph = require("@/components/MembersGraph").default;

    return (
        <div className="rounded-2xl border border-white/10 p-4">
            <MembersGraph
                members={members.map((m) => ({
                    id: m.id,
                    slug: m.slug,
                    name: m.name,
                    skills: m.skills || [],
                    avatarUrl: m.avatarUrl || null,
                }))}
                projects={projects.map((p) => ({
                    id: p.id,
                    slug: p.slug,
                    title: p.title,
                    members: (p.members || []).map((r) => ({
                        memberId: r.memberId,
                        memberSlug: r.memberSlug,
                    })),
                }))}
                query={query}
            />
        </div>
    );
}
