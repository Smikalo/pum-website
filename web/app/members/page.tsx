/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import {API_BASE} from "@/lib/config";
import MembersGraph from "@/components/MembersGraph";
import MembersSearchBar from "@/components/MembersSearchBar";
import {toImageSrc} from "@/lib/images";
import {tServer} from "@/lib/i18n-server";
import {checkMatches, highlight, includesAll, parseMulti, uniq,} from "@/lib/list-utils";
import MultiFilterChips from "@/components/MultiFilterChips";
import PageCtaCard from "@/components/PageCtaCard";
import Avatar from "@/components/Avatar";
import TagChip from "@/components/TagChip";

export const dynamic = "force-dynamic";

/** ------------------------------------------------------------
 *  Types (API → UI)
 *  ------------------------------------------------------------ */
type ApiListMember = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string | null;
    skills?: (string | null)[] | null;
    techStack?: (string | null)[] | null;
    avatarUrl?: string | null;

    /** ✅ Source of truth for categorization & color */
    focusArea?: string | null;

    // Possible legacy extras
    expertise?: (string | null)[] | null;
    specialty?: string | null;
    specialtyArea?: string | null;
};

type UiMember = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string;
    skills: string[]; // informational only; DOES NOT drive category/color
    techStack: string[];
    avatarUrl?: string; // normalized, never null
    focusArea?: string; // <- drives category + graph color
};

type ApiProjectMember = {
    memberId?: string | null;
    id?: string | null;
    memberSlug?: string | null;
    slug?: string | null;
};

type ApiProject = {
    id?: string | null;
    slug?: string | null;
    title?: string | null;
    name?: string | null;
    tags?: (string | null)[] | null;
    techStack?: (string | null)[] | null;
    tech?: (string | null)[] | null;
    imageUrl?: string | null;
    cover?: string | null;
    members?: ApiProjectMember[] | null;
};

type UiProject = {
    id: string;
    slug: string;
    title: string;
    tags: string[];
    techStack: string[];
    members: { memberId?: string; memberSlug?: string }[];
    imageUrl?: string;
};

/** ------------------------------------------------------------
 *  Utilities
 *  ------------------------------------------------------------ */
function isString(x: unknown): x is string {
    return typeof x === "string" && x.trim().length > 0;
}

function matchesQuery(m: UiMember, q: string): boolean {
    return checkMatches(q, [
        m.name || "",
        m.shortBio || "",
        ...(m.skills || []),
        ...(m.techStack || []),
        m.focusArea || "",
    ]);
}

/** normalize any image-like value to a proper src (never null) */
function toImageOrUndef(v?: string | null): string | undefined {
    if (!isString(v)) return undefined;
    const r = toImageSrc(v);
    return isString(r) ? r : undefined;
}

/** If the API doesn’t send focusArea, try common fallbacks */
function pickFocusArea(m: Partial<ApiListMember>): string | undefined {
    if (isString(m.focusArea)) return m.focusArea.trim();
    if (isString(m.specialty)) return m.specialty.trim();
    if (isString(m.specialtyArea)) return m.specialtyArea.trim();
    const firstExpertise = (m.expertise ?? []).filter(isString)[0];
    if (firstExpertise) return firstExpertise.trim();
    return undefined;
}

/** Keep focusArea first in the skills array so the graph color uses it */
function skillsWithFocusFirst(focus: string | undefined, skills: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    if (isString(focus)) {
        out.push(focus);
        seen.add(focus);
    }
    for (const s of skills) if (!seen.has(s)) out.push(s);
    return out;
}

/** ------------------------------------------------------------
 *  Fetchers (with logging)
 *  ------------------------------------------------------------ */
async function fetchAllMembers(): Promise<{ items: UiMember[]; total: number }> {
    const url = new URL("/api/members", API_BASE);
    url.searchParams.set("size", "999");
    const urlStr = url.toString();

    try {
        // eslint-disable-next-line no-console
        console.log("[members/page] fetching members", {
            apiBase: API_BASE,
            url: urlStr,
        });

        const res = await fetch(urlStr, { cache: "no-store" });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            // eslint-disable-next-line no-console
            console.error("[members/page] /api/members failed", {
                status: res.status,
                statusText: res.statusText,
                bodySnippet: body.slice(0, 500),
                apiBase: API_BASE,
                url: urlStr,
            });
            return { items: [], total: 0 };
        }

        const json = (await res.json()) as { items?: ApiListMember[]; total?: number };
        const rawItems: ApiListMember[] = Array.isArray(json.items) ? json.items : [];

        const items: UiMember[] = rawItems.map((m) => {
            const focusArea = pickFocusArea(m);
            const skills = (m.skills ?? []).filter(isString);
            const techStack = (m.techStack ?? []).filter(isString);
            return {
                id: m.id,
                slug: m.slug,
                name: m.name,
                shortBio: m.shortBio ?? undefined,
                skills: skillsWithFocusFirst(focusArea, skills),
                techStack,
                avatarUrl: toImageOrUndef(m.avatarUrl),
                focusArea,
            };
        });

        // eslint-disable-next-line no-console
        console.log("[members/page] fetched members OK", {
            count: items.length,
            total: json.total ?? items.length,
        });

        return { items, total: json.total ?? items.length };
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[members/page] unexpected error while fetching /api/members", {
            error: err,
            apiBase: API_BASE,
            url: urlStr,
        });
        return { items: [], total: 0 };
    }
}

function normalizeProject(p: ApiProject): UiProject {
    const slug = (p.slug ?? p.id ?? "") || "";
    const id = (p.id ?? slug) || slug;
    const title = (p.title ?? p.name ?? slug) || slug;

    const tags = (p.tags ?? []).filter(isString);
    const techStackSource = p.techStack ?? p.tech ?? [];
    const techStack = techStackSource.filter(isString);

    const members: UiProject["members"] = (p.members ?? []).map((m) => ({
        memberId: m.memberId ?? m.id ?? undefined,
        memberSlug: m.memberSlug ?? m.slug ?? undefined,
    }));

    const imageCandidate = p.imageUrl ?? p.cover ?? null;
    const imageUrl = toImageOrUndef(imageCandidate);

    return {
        id,
        slug,
        title,
        tags,
        techStack,
        members,
        imageUrl,
    };
}

async function fetchApiProjects(): Promise<UiProject[]> {
    const url = new URL("/api/projects", API_BASE);
    url.searchParams.set("size", "999");
    const urlStr = url.toString();

    try {

        const res = await fetch(urlStr, { cache: "no-store" });
        if (!res.ok) {
            return [];
        }
        const json = (await res.json()) as { items?: ApiProject[] } | ApiProject[];
        const items: ApiProject[] = Array.isArray(json)
            ? json
            : Array.isArray(json.items)
                ? json.items
                : [];

        return items.map(normalizeProject);
    } catch (err) {
        return [];
    }
}

/** ------------------------------------------------------------
 *  Page
 *  ------------------------------------------------------------ */
export default async function MembersPage({
                                              searchParams,
                                          }: {
    searchParams?: { q?: string; skill?: string; tech?: string; view?: string };
}) {
    const q = searchParams?.q || "";
    const focusFilter = parseMulti(searchParams?.skill);
    const techFilter = parseMulti(searchParams?.tech);
    const view = (searchParams?.view || "list") as "list" | "graph" | "groups";

    const [membersRes, apiProjects] = await Promise.all([fetchAllMembers(), fetchApiProjects()]);

    const allMembers = membersRes.items;

    const allFocusAreas = uniq(allMembers.map((m) => m.focusArea).filter(isString)).sort();
    const allTech = uniq(allMembers.flatMap((m) => m.techStack)).sort();

    const filteredMembers = allMembers.filter(
        (m) =>
            includesAll(m.focusArea ? [m.focusArea] : [], focusFilter) &&
            includesAll(m.techStack, techFilter) &&
            matchesQuery(m, q),
    );
    const total = filteredMembers.length;

    const visibleSlugs = new Set(filteredMembers.map((m) => m.slug));
    const filteredProjects = apiProjects.filter((p) =>
        (p.members || []).some((r) => r.memberSlug && visibleSlugs.has(r.memberSlug)),
    );

    type MembersGraphProps = React.ComponentProps<typeof MembersGraph>;
    type GraphMember = MembersGraphProps["members"][number];
    type GraphProject = MembersGraphProps["projects"][number];

    const graphMembers: MembersGraphProps["members"] = filteredMembers.map(
        (m): GraphMember => {
            const skillsForGraph = skillsWithFocusFirst(
                m.focusArea,
                (m.skills || []).filter(isString),
            );
            return {
                id: m.id,
                slug: m.slug,
                name: m.name,
                skills: skillsForGraph,
                techStack: m.techStack,
                avatarUrl: m.avatarUrl,
                avatar: m.avatarUrl,
                imageUrl: m.avatarUrl,
                photoUrl: m.avatarUrl,
            };
        },
    );

    const graphProjects: MembersGraphProps["projects"] = filteredProjects.map(
        (p): GraphProject => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            members: (p.members ?? []).map((m) => ({
                memberId: m.memberId,
                memberSlug: m.memberSlug,
            })),
            techStack: p.techStack,
            tags: p.tags,
            imageUrl: p.imageUrl,
        }),
    );

    return (
        <section className="section">
            <PageCtaCard
                kicker={tServer("members.list.kicker")}
                title={tServer("members.list.title")}
                description={tServer("members.list.subtitle")}
            />

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar
                        placeholder={tServer("members.list.search.placeholder")}
                        paramKey="q"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {(["list", "graph", "groups"] as const).map((v) => (
                        <Link
                            key={v}
                            href={`/members?${new URLSearchParams({
                                q,
                                ...(focusFilter.length
                                    ? { skill: focusFilter.join(",") }
                                    : {}),
                                ...(techFilter.length
                                    ? { tech: techFilter.join(",") }
                                    : {}),
                                view: v,
                            }).toString()}`}
                            className={`px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 ${
                                view === v
                                    ? "bg-white text-black font-semibold"
                                    : "bg-white/5 hover:bg-white/10"
                            }`}
                        >
                            {v === "list"
                                ? tServer("members.list.view.list")
                                : v === "graph"
                                    ? tServer("members.list.view.graph")
                                    : tServer("members.list.view.groups")}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="mb-8 grid md:grid-cols-2 gap-3">
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                        {tServer("members.list.filter.focusArea.label")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/members"
                            params={{ q, tech: techFilter.join(","), view }}
                            values={allFocusAreas}
                            selected={focusFilter}
                            name="skill"
                            clearLabel={tServer("members.list.filter.clear")}
                        />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                        {tServer("members.list.filter.tech.label")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/members"
                            params={{ q, skill: focusFilter.join(","), view }}
                            values={allTech}
                            selected={techFilter}
                            name="tech"
                            clearLabel={tServer("members.list.filter.clear")}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {view === "graph" ? (
                <MembersGraph members={graphMembers} projects={graphProjects} query={q} />
            ) : view === "groups" ? (
                <GroupsView members={filteredMembers} q={q} />
            ) : (
                <ListView members={filteredMembers} total={total} q={q} />
            )}

            {/* CTA to contact page */}
            <div className="mt-10">
                <div className="card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            {tServer("members.list.cta.title")}
                        </h2>
                        <p className="text-sm text-white/70 max-w-xl">
                            {tServer("members.list.cta.body")}
                        </p>
                    </div>
                    <Link
                        href="/contact"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition"
                    >
                        {tServer("members.list.cta.button")}
                        <span aria-hidden className="ml-1">
                            →
                        </span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

/** ------------------------------------------------------------
 *  Presentational helpers
 *  ------------------------------------------------------------ */

function ListView({ members, total, q }: { members: UiMember[]; total: number; q: string }) {
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
                                <div className="font-semibold text-lg">
                                    {highlight(m.name, q)}
                                </div>
                                {m.focusArea && (
                                    <div className="mt-1">
                                        <TagChip>
                                            {m.focusArea}
                                        </TagChip>
                                    </div>
                                )}
                                {m.shortBio ? (
                                    <div className="text-sm text-white/70 mt-1 line-clamp-3">
                                        {highlight(m.shortBio, q)}
                                    </div>
                                ) : null}
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

function GroupsView({
                        members,
                        q,
                    }: {
    members: UiMember[];
    q: string;
}) {
    const buckets: Record<string, UiMember[]> = {};
    for (const m of members) {
        const key = m.focusArea || tServer("members.list.groups.other");
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(m);
    }
    const groups = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    return (
        <div className="space-y-8">
            {groups.map(([focus, arr]) => (
                <div key={focus}>
                    <h3 className="text-xl font-bold mb-3">{highlight(focus, q)}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {arr.map((m) => (
                            <Link
                                key={m.slug}
                                href={`/members/${m.slug}`}
                                className="card p-4 hover:bg-white/10 transition"
                            >
                                <div className="flex items-center gap-3">
                                    <Avatar name={m.name} src={m.avatarUrl} size={36} />
                                    <div>
                                        <div className="font-semibold">
                                            {highlight(m.name, q)}
                                        </div>
                                        <div className="text-xs text-white/60 line-clamp-2">
                                            {highlight(m.shortBio, q)}
                                        </div>
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