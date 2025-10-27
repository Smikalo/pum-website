import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";
import { SEED_PROJECTS, type Project as SeedProject } from "@/data/projects.seed";
import { SEED_MEMBERS, type Member } from "@/data/members.seed";
import { SEED_EVENTS } from "@/data/events.seed";

// Pre-generate seed slugs for stability; still fetch at runtime for fresh data.
// Docs: generateStaticParams + Dynamic Routes. :contentReference[oaicite:1]{index=1}
export async function generateStaticParams() {
    return SEED_PROJECTS.map((p) => ({ slug: p.slug }));
}

// Metadata (server-only). Docs: generateMetadata. :contentReference[oaicite:2]{index=2}
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const p = await getProjectBySlug(params.slug);
    return {
        title: p ? `${p.title} – PUM Projects` : "Project – PUM",
        description: p?.summary || p?.description || "PUM project",
    };
}

type Project = {
    id?: string;
    slug: string;
    title: string;
    tags?: string[];
    techStack?: string[];
    members?: { memberId?: string; memberSlug?: string; role?: string }[];
    imageUrl?: string;
    // detail
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
    demoUrl?: string;
    repoUrl?: string;
    events?: { slug: string; name?: string }[];
    gallery?: string[];
};

type MemberLite = {
    slug: string;
    name: string;
    avatarUrl?: string;
    avatar?: string;
    headline?: string;
};

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
        demoUrl: p.demoUrl,
        repoUrl: p.repoUrl,
        events: (p.events ?? []).map((e: any) => ({ slug: e.slug ?? e.id, name: e.name })),
        gallery: p.gallery ?? [],
    };
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
                ...cur,
                tags: Array.from(new Set([...(cur.tags || []), ...(sn.tags || [])])),
                techStack: Array.from(new Set([...(cur.techStack || []), ...(sn.techStack || [])])),
                members: cur.members?.length ? cur.members : sn.members,
                imageUrl: cur.imageUrl || sn.imageUrl,
                cover: cur.cover || sn.cover,
                summary: cur.summary || sn.summary,
                description: cur.description || sn.description,
                year: cur.year ?? sn.year,
                demoUrl: cur.demoUrl || sn.demoUrl,
                repoUrl: cur.repoUrl || sn.repoUrl,
                events: cur.events?.length ? cur.events : sn.events,
                gallery: cur.gallery?.length ? cur.gallery : sn.gallery,
            });
        } else {
            map.set(s.slug, sn);
        }
    }
    return Array.from(map.values());
}

async function getProjectBySlug(slug: string): Promise<Project | null> {
    const api = await fetchApiProjects();
    const merged = mergeProjects(api, SEED_PROJECTS);
    return merged.find((p) => p.slug === slug) ?? null;
}

async function getMergedMembers(): Promise<MemberLite[]> {
    try {
        const res = await fetch(`${API_BASE}/api/members?size=999`, { cache: "no-store" });
        const json = res.ok ? await res.json() : { items: [] };
        const apiMembers: any[] = Array.isArray(json) ? json : json.items ?? [];
        const apiLite: MemberLite[] = apiMembers.map((m) => ({
            slug: m.slug ?? m.id,
            name: m.name,
            avatarUrl: m.avatarUrl ?? m.avatar ?? m.photo ?? m.image,
            headline: m.headline ?? m.shortBio,
        }));

        // seeds
        const seedLite: MemberLite[] = SEED_MEMBERS.map((m) => ({
            slug: m.slug,
            name: m.name,
            avatarUrl: m.avatarUrl ?? m.avatar,
            avatar: m.avatar,
            headline: m.headline ?? m.shortBio,
        }));

        const map = new Map<string, MemberLite>();
        for (const m of [...apiLite, ...seedLite]) {
            if (!m.slug) continue;
            if (!map.has(m.slug)) map.set(m.slug, m);
            else map.set(m.slug, { ...m, ...map.get(m.slug)! });
        }
        return Array.from(map.values());
    } catch {
        // seeds-only fallback
        return SEED_MEMBERS.map((m) => ({
            slug: m.slug,
            name: m.name,
            avatarUrl: m.avatarUrl ?? m.avatar,
            avatar: m.avatar,
            headline: m.headline ?? m.shortBio,
        }));
    }
}

export default async function ProjectDetailPage({ params }: { params: { slug: string } }) {
    const project = await getProjectBySlug(params.slug);

    if (!project) {
        return (
            <section className="section">
                <h1 className="display">Project not found</h1>
                <p className="mt-4">
                    <Link href="/projects" className="underline underline-offset-4">
                        Back to projects
                    </Link>
                </p>
            </section>
        );
    }

    const members = await getMergedMembers();
    const membersBySlug = new Map(members.map((m) => [m.slug, m]));
    const eventBySlug = new Map(SEED_EVENTS.map((e) => [e.slug, e]));

    const cover = project.cover || project.imageUrl;

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">PROJECT</p>
                <h1 className="display">{project.title}</h1>
                <div className="mt-2 text-white/70 text-sm">
                    {project.year ? `${project.year} • ` : ""}
                    {(project.tags || []).join(" • ")}
                </div>
            </header>

            {cover && (
                <div className="mb-6">
                    <img src={cover} alt={project.title} className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10" />
                </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <article className="lg:col-span-3 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">About</h2>
                        {project.description || project.summary ? (
                            <p className="text-white/80 leading-relaxed">
                                {project.description || project.summary}
                            </p>
                        ) : (
                            <p className="text-white/60">No description yet.</p>
                        )}

                        {(project.techStack && project.techStack.length > 0) && (
                            <div className="mt-3">
                                <div className="text-xs uppercase tracking-widest text-white/60 mb-2">Tech stack</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {project.techStack.map((t) => (
                                        <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                      {t}
                    </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(project.demoUrl || project.repoUrl) && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {project.demoUrl && (
                                    <a href={project.demoUrl} target="_blank" rel="noreferrer" className="btn-primary">
                                        Live demo
                                    </a>
                                )}
                                {project.repoUrl && (
                                    <a href={project.repoUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                                        Source code
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {(project.events && project.events.length > 0) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Connected events</h2>
                            <ul className="space-y-2">
                                {project.events.map((ev) => {
                                    const full = eventBySlug.get(ev.slug);
                                    return (
                                        <li key={ev.slug}>
                                            <Link href={`/events/${ev.slug}`} className="hover:underline">
                                                {full?.name || ev.name || ev.slug}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}

                    {(project.gallery && project.gallery.length > 0) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {project.gallery.map((src, i) => (
                                    <img key={i} src={src} alt={`${project.title} photo ${i + 1}`} className="w-full h-32 object-cover rounded-md ring-1 ring-white/10" />
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="lg:col-span-2 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">Team</h2>
                        {project.members?.length ? (
                            <ul className="space-y-3">
                                {project.members.map((ref, i) => {
                                    const s = (ref.memberSlug ||
                                        // optional fallback: if only memberId is provided and matches a seed slug
                                        ref.memberId) as string;
                                    const m = s ? membersBySlug.get(s) : undefined;
                                    return (
                                        <li key={`${s}-${i}`} className="flex items-center gap-3">
                                            <img
                                                src={m?.avatarUrl || m?.avatar || "/avatars/default.png"}
                                                alt={m?.name || s || "Member"}
                                                className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                            />
                                            <div className="min-w-0">
                                                {m ? (
                                                    <Link href={`/members/${m.slug}`} className="font-medium hover:underline">
                                                        {m.name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium">{s || "Unknown member"}</span>
                                                )}
                                                {ref.role && <div className="text-xs text-white/60">{ref.role}</div>}
                                                {m?.headline && <div className="text-xs text-white/60 truncate">{m.headline}</div>}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="text-white/60">Team coming soon.</p>
                        )}
                    </div>
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/projects" className="underline underline-offset-4">
                    ← Back to all projects
                </Link>
            </div>
        </section>
    );
}
