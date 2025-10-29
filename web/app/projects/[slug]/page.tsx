/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";

export const dynamic = "force-dynamic";

/* ---------- Types ---------- */
type Project = {
    id?: string;
    slug: string;
    title: string;
    tags?: string[];
    techStack?: string[];
    members?: { slug?: string; name?: string; avatarUrl?: string; role?: string }[];
    imageUrl?: string;
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
    demoUrl?: string;
    repoUrl?: string;
    events?: { slug: string; name?: string }[];
    gallery?: string[];
};

/* ---------- API ---------- */
async function getProjectBySlug(slug: string): Promise<Project | null> {
    const res = await fetch(`${API_BASE}/api/projects/${slug}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load project");
    const p = await res.json();
    return normalizeProjectDetail(p);
}

function normalizeProjectDetail(p: any): Project {
    return {
        id: p.id ?? p.slug,
        slug: p.slug,
        title: p.title ?? p.name ?? p.slug,
        tags: p.tags ?? [],
        techStack: p.techStack ?? p.tech ?? [],
        members: (p.members ?? []).map((m: any) => ({
            slug: m.slug ?? m.memberSlug,
            name: m.name,
            avatarUrl: m.avatarUrl ?? m.avatar,
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
        gallery: Array.isArray(p.images) ? p.images : p.gallery ?? [],
    };
}

/* ---------- Metadata ---------- */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const p = await getProjectBySlug(params.slug);
    return {
        title: p ? `${p.title} – PUM Projects` : "Project – PUM",
        description: p?.summary || p?.description || "PUM project",
    };
}

/* ---------- Page ---------- */
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
                                {project.events.map((ev, i) => (
                                    <li key={`${ev.slug}-${i}`}>
                                        <Link href={`/events/${ev.slug}`} className="hover:underline">
                                            {ev.name || ev.slug}
                                        </Link>
                                    </li>
                                ))}
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
                                {project.members.map((m, i) => (
                                    <li key={`${m.slug || i}-${i}`} className="flex items-center gap-3">
                                        <img
                                            src={m.avatarUrl || "/avatars/default.png"}
                                            alt={m.name || m.slug || "Member"}
                                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            {m.slug ? (
                                                <Link href={`/members/${m.slug}`} className="font-medium hover:underline">
                                                    {m.name || m.slug}
                                                </Link>
                                            ) : (
                                                <span className="font-medium">{m.name || "Unknown member"}</span>
                                            )}
                                            {m.role && <div className="text-xs text-white/60">{m.role}</div>}
                                        </div>
                                    </li>
                                ))}
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
