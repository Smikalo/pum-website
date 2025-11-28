/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import MembersSearchBar from "@/components/MembersSearchBar";
import { API_BASE } from "@/lib/config";
import NewProjectButton from "@/components/NewProjectButton";
import { tServer } from "@/lib/i18n-server";
import { uniq, parseMulti, includesAll, checkMatches, highlight } from "@/lib/list-utils";
import MultiFilterChips from "@/components/MultiFilterChips";
import PageCtaCard from "@/components/PageCtaCard";

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
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
};

/* ---------- API shapes ---------- */
type ApiProjectMember = {
    memberId?: string | null;
    id?: string | null;
    memberSlug?: string | null;
    slug?: string | null;
    role?: string | null;
};

type ApiProjectListItem = {
    id?: string | null;
    slug: string;
    title?: string | null;
    name?: string | null;
    tags?: (string | null)[] | null;
    techStack?: (string | null)[] | null;
    tech?: (string | null)[] | null;
    members?: ApiProjectMember[] | null;
    imageUrl?: string | null;
    cover?: string | null;
    summary?: string | null;
    description?: string | null;
    year?: number | null;
};

/* ---------- Helpers ---------- */
function matchesQuery(p: Project, q: string): boolean {
    return checkMatches(q, [
        p.title || "",
        p.summary || "",
        ...(p.tags || []),
        ...(p.techStack || [])
    ]);
}

function isString(x: unknown): x is string {
    return typeof x === "string";
}

/* ---------- API ---------- */
async function fetchApiProjects(): Promise<Project[]> {
    try {
        const res = await fetch(`${API_BASE}/api/projects?size=999`, {
            cache: "no-store",
        });
        if (!res.ok) return [];
        const json = (await res.json()) as { items?: ApiProjectListItem[] } | ApiProjectListItem[];
        const items: ApiProjectListItem[] = Array.isArray(json) ? json : json.items ?? [];
        return items.map(normalizeProject);
    } catch {
        return [];
    }
}

function normalizeProject(p: ApiProjectListItem): Project {
    const tags = (p.tags ?? []).filter(isString);
    const techStackSource = p.techStack ?? p.tech ?? [];
    const techStack = techStackSource.filter(isString);

    const members: Project["members"] = (p.members ?? []).map((m) => ({
        memberId: m.memberId ?? m.id ?? undefined,
        memberSlug: m.memberSlug ?? m.slug ?? undefined,
        role: m.role ?? undefined,
    }));

    return {
        id: p.id ?? p.slug,
        slug: p.slug,
        title: p.title ?? p.name ?? p.slug,
        tags,
        techStack,
        members,
        imageUrl: p.imageUrl ?? p.cover ?? undefined,
        summary: p.summary ?? undefined,
        description: p.description ?? undefined,
        year: typeof p.year === "number" ? p.year : undefined,
        cover: p.cover ?? p.imageUrl ?? undefined,
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
            if (sort === "az")
                return (a.title || "").localeCompare(b.title || "");
            const ay = a.year ?? 0;
            const by = b.year ?? 0;
            if (ay === by)
                return (a.title || "").localeCompare(b.title || "");
            return by - ay;
        });

    return (
        <section className="section">
            <PageCtaCard
                kicker={tServer("projects.list.kicker")}
                title={tServer("projects.list.title")}
                description={tServer("projects.list.subtitle")}
                cta={<NewProjectButton />}
            />

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar
                        placeholder={tServer(
                            "projects.list.search.placeholder",
                        )}
                        paramKey="q"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {(["newest", "az"] as const).map((s) => {
                        const p = new URLSearchParams();
                        if (q) p.set("q", q);
                        if (tagsSel.length) p.set("tag", tagsSel.join(","));
                        if (techSel.length) p.set("tech", techSel.join(","));
                        p.set("sort", s);
                        const href = `/projects?${p.toString()}`;
                        const active = sort === s;
                        const label =
                            s === "az"
                                ? tServer("projects.list.sort.az")
                                : tServer("projects.list.sort.newest");
                        return (
                            <Link
                                key={s}
                                href={href}
                                className={`px-3 py-2 rounded-lg text-sm ring-1 ring-white/10 ${
                                    active
                                        ? "bg-white text-black font-semibold"
                                        : "bg-white/5 hover:bg-white/10"
                                }`}
                            >
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Filters */}
            <div className="mb-8 grid md:grid-cols-2 gap-3">
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                        {tServer("projects.list.filter.tags.label")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/projects"
                            params={{
                                q,
                                tech: techSel.join(","),
                                sort,
                            }}
                            values={allTags}
                            selected={tagsSel}
                            name="tag"
                            clearLabel={tServer("projects.list.filter.clear")}
                        />
                    </div>
                </div>
                <div className="card p-3">
                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                        {tServer("projects.list.filter.tech.label")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <MultiFilterChips
                            base="/projects"
                            params={{
                                q,
                                tag: tagsSel.join(","),
                                sort,
                            }}
                            values={allTech}
                            selected={techSel}
                            name="tech"
                            clearLabel={tServer("projects.list.filter.clear")}
                        />
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                    <Link
                        key={p.slug}
                        href={`/projects/${p.slug}`}
                        className="card p-4 hover:bg-white/10 transition"
                    >
                        {p.imageUrl && (
                            <img
                                src={p.imageUrl}
                                alt={p.title}
                                className="w-full h-40 object-cover rounded-md ring-1 ring-white/10 mb-3"
                                loading="lazy"
                            />
                        )}
                        <div className="text-xs text-white/60">
                            {p.year ?? ""}
                        </div>
                        <div className="font-semibold text-lg line-clamp-2">
                            {highlight(p.title, q)}
                        </div>
                        {p.summary && (
                            <div className="mt-2 text-sm text-white/70 line-clamp-3">
                                {highlight(p.summary, q)}
                            </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {(p.tags || [])
                                .slice(0, 6)
                                .map((t) => (
                                    <span
                                        key={t}
                                        className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                    >
                                        {highlight(t, q)}
                                    </span>
                                ))}
                        </div>
                    </Link>
                ))}
            </div>

            {/* CTA */}
            <div className="mt-10">
                <div className="card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">
                            {tServer("projects.list.cta.title")}
                        </h2>
                        <p className="text-sm text-white/70 max-w-xl">
                            {tServer("projects.list.cta.body")}
                        </p>
                    </div>
                    <Link
                        href="/contact"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition"
                    >
                        {tServer("projects.list.cta.button")}
                        <span aria-hidden className="ml-1">
                            →
                        </span>
                    </Link>
                </div>
            </div>
        </section>
    );
}