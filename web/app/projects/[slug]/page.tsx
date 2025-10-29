// web/app/projects/[slug]/page.tsx
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";

/* ----------------------------- Types ----------------------------- */
type MemberLite = { slug: string; name?: string; avatarUrl?: string; role?: string };
type EventRef = { slug: string; name?: string };

type Project = {
    id: string;
    slug: string;
    title: string;
    description?: string;
    tags?: string[];
    techStack?: string[];
    imageUrl?: string;
    demoUrl?: string;
    repoUrl?: string;
    members?: MemberLite[];
    events?: EventRef[];
    gallery?: string[];
};

/* --------------------------- Fetch helpers --------------------------- */
async function fetchProject(slug: string): Promise<Project | null> {
    const candidates = [
        `/api/projects/${encodeURIComponent(slug)}`,
        `/api/project/${encodeURIComponent(slug)}`,
    ];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            return normalizeProject(json);
        } catch {}
    }
    return null;
}

async function fetchProjectSlugs(): Promise<string[]> {
    const candidates = ["/api/projects?size=999", "/api/projects"];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            const items: any[] = Array.isArray(json) ? json : json.items ?? [];
            return items.map((p: any) => String(p.slug ?? p.id ?? "")).filter(Boolean);
        } catch {}
    }
    return [];
}

function normalizeProject(p: any): Project {
    const slug = p.slug ?? p.id ?? "";
    const members: MemberLite[] = (p.members || p.contributors || []).map((m: any) => ({
        slug: m.slug ?? m.username ?? m.memberSlug ?? "",
        name: m.name ?? undefined,
        avatarUrl: m.avatarUrl ?? m.avatar ?? undefined,
        role: m.role ?? undefined,
    }));
    const events: EventRef[] = (p.events || []).map((e: any) => ({
        slug: e.slug ?? e.id ?? "",
        name: e.name ?? e.title ?? undefined,
    }));
    return {
        id: String(p.id ?? slug),
        slug,
        title: p.title ?? p.name ?? slug,
        description: p.description ?? p.summary ?? undefined,
        tags: p.tags ?? [],
        techStack: p.techStack ?? p.stack ?? [],
        imageUrl: p.imageUrl ?? p.cover ?? p.hero ?? undefined,
        demoUrl: p.demoUrl ?? p.demo ?? undefined,
        repoUrl: p.repoUrl ?? p.repository ?? p.repo ?? undefined,
        members,
        events,
        gallery: p.gallery ?? [],
    };
}

/* -------------------------- Next.js wiring -------------------------- */
export async function generateStaticParams() {
    const slugs = await fetchProjectSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: { slug: string };
}): Promise<Metadata> {
    const p = await fetchProject(params.slug);
    return {
        title: p ? `${p.title} – Project` : "Project",
        description: p?.description || "Project of United Minds",
    };
}

/* -------------------------------- Page -------------------------------- */
export default async function ProjectDetail({ params }: { params: { slug: string } }) {
    const p = await fetchProject(params.slug);
    if (!p) {
        return (
            <section className="section">
                <h1 className="h1">Project not found</h1>
                <Link href="/projects" className="underline underline-offset-4">← Back to all projects</Link>
            </section>
        );
    }

    return (
        <section className="section">
            <h1 className="h1">{p.title}</h1>
            {p.description && <p className="text-white/70">{p.description}</p>}

            <div className="mt-6 grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    {!!(p.imageUrl || p.gallery?.length) && (
                        <div className="rounded-xl overflow-hidden ring-1 ring-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.imageUrl || p.gallery?.[0]} alt={p.title} className="w-full h-auto" />
                        </div>
                    )}

                    {!!(p.members?.length) && (
                        <div>
                            <h2 className="h3">Contributors</h2>
                            <ul className="mt-2 grid sm:grid-cols-2 gap-2">
                                {p.members!.map((m) => (
                                    <li key={m.slug} className="row-card flex items-center gap-3">
                                        <Avatar name={m.name || m.slug} src={m.avatarUrl} size={40} />
                                        <div>
                                            <Link href={`/members/${m.slug}`} className="font-medium underline underline-offset-4">
                                                {m.name || m.slug}
                                            </Link>
                                            {m.role && <div className="text-xs text-white/60">{m.role}</div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {!!(p.events?.length) && (
                        <div>
                            <h2 className="h3">Events</h2>
                            <ul className="mt-2 space-y-2">
                                {p.events!.map((e) => (
                                    <li key={e.slug}>
                                        <Link href={`/events/${e.slug}`} className="underline underline-offset-4">
                                            {e.name || e.slug}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <aside className="space-y-4">
                    {!!(p.tags?.length || p.techStack?.length) && (
                        <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-3">
                            <div className="text-xs text-white/60 mb-2">Tags</div>
                            <div className="flex flex-wrap gap-2">
                                {[...(p.tags || []), ...(p.techStack || [])].map((t) => (
                                    <span key={t} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{t}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {!!(p.demoUrl || p.repoUrl) && (
                        <div className="rounded-xl ring-1 ring-white/10 bg-white/5 p-3 space-y-2">
                            {p.demoUrl && (
                                <a href={p.demoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                                    Live Demo →
                                </a>
                            )}
                            {p.repoUrl && (
                                <a href={p.repoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                                    Repository →
                                </a>
                            )}
                        </div>
                    )}
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/projects" className="underline underline-offset-4">← Back to all projects</Link>
            </div>
        </section>
    );
}

function Avatar({ name, src, size = 40 }: { name?: string; src?: string; size?: number }) {
    const initials = (name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || "User"} width={size} height={size} className="rounded-md object-cover ring-1 ring-white/10" />
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
