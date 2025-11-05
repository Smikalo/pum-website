/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";

export const dynamic = "force-dynamic";

/* ----------------------- Tiny Markdown renderer ----------------------- */

function MarkdownPreview({ markdown }: { markdown: string }) {
    const src = (markdown || "").replace(/\r\n/g, "\n");

    function splitFenced(input: string): Array<{ type: "text" | "code"; content: string; lang?: string }> {
        const out: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
        const fence = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = fence.exec(input))) {
            if (m.index > lastIndex) out.push({ type: "text", content: input.slice(lastIndex, m.index) });
            out.push({ type: "code", content: m[2].replace(/\n$/, ""), lang: m[1] });
            lastIndex = fence.lastIndex;
        }
        if (lastIndex < input.length) out.push({ type: "text", content: input.slice(lastIndex) });
        return out;
    }

    function splitInline(text: string, re: RegExp): Array<string | { code: string }> {
        const out: Array<string | { code: string }> = [];
        let last = 0;
        let m: RegExpExecArray | null;
        const rx = new RegExp(re.source, "g");
        while ((m = rx.exec(text))) {
            if (m.index > last) out.push(text.slice(last, m.index));
            out.push({ code: m[1] });
            last = rx.lastIndex;
        }
        if (last < text.length) out.push(text.slice(last));
        return out;
    }

    function splitLinks(text: string): Array<string | { label: string; href: string }> {
        const out: Array<string | { label: string; href: string }> = [];
        const re = /\[([^\]]+)\]\(([^)]+)\)/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
            if (m.index > last) out.push(text.slice(last, m.index));
            out.push({ label: m[1], href: m[2] });
            last = re.lastIndex;
        }
        if (last < text.length) out.push(text.slice(last));
        return out;
    }

    function normalizeHref(href: string): string {
        if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) return href;
        return `https://${href}`;
    }

    function inline(text: string): React.ReactNode[] {
        if (!text) return [];
        const segments = splitInline(text, /`([^`]+)`/);
        return segments.flatMap((seg, idx) => {
            if (typeof seg !== "string") {
                return (
                    <code key={`code-${idx}`} className="px-1 rounded bg-white/10 text-white/90">
                        {seg.code}
                    </code>
                );
            }
            // links
            const withLinks = splitLinks(seg).flatMap((s, j) => {
                if (typeof s !== "string") {
                    const href = normalizeHref(s.href);
                    return (
                        <a
                            key={`a-${idx}-${j}`}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-4"
                        >
                            {s.label}
                        </a>
                    );
                }
                return s;
            });
            // bold
            const bolded = withLinks.flatMap((s, j) => {
                if (typeof s !== "string") return s;
                const parts = splitInline(s, /\*\*([^*]+)\*\*/);
                return parts.map((p, k) =>
                    typeof p === "string" ? (
                        p
                    ) : (
                        <strong key={`b-${idx}-${j}-${k}`} className="text-white">
                            {p.code}
                        </strong>
                    ),
                );
            });
            // italic
            const italicized = bolded.flatMap((s, j) => {
                if (typeof s !== "string") return s;
                const parts = splitInline(s, /\*([^*]+)\*/);
                return parts.map((p, k) =>
                    typeof p === "string" ? (
                        p
                    ) : (
                        <em key={`i-${idx}-${j}-${k}`} className="italic">
                            {p.code}
                        </em>
                    ),
                );
            });
            return italicized;
        });
    }

    function BlockText({ text }: { text: string }) {
        const lines = text.split("\n");
        const blocks: React.ReactNode[] = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (!line.trim()) {
                i++;
                continue;
            }
            const h = /^(#{1,3})\s+(.*)$/.exec(line);
            if (h) {
                const level = h[1].length;
                const content = h[2];
                blocks.push(
                    level === 1 ? (
                        <h3 key={`h-${i}`} className="text-2xl font-bold text-white mt-3">
                            {inline(content)}
                        </h3>
                    ) : level === 2 ? (
                        <h4 key={`h-${i}`} className="text-xl font-semibold text-white mt-2">
                            {inline(content)}
                        </h4>
                    ) : (
                        <h5 key={`h-${i}`} className="text-lg font-semibold text-white mt-2">
                            {inline(content)}
                        </h5>
                    ),
                );
                i++;
                continue;
            }
            if (/^\s*\d+\.\s+/.test(line)) {
                const items: React.ReactNode[] = [];
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                    const item = lines[i].replace(/^\s*\d+\.\s+/, "");
                    items.push(
                        <li key={`ol-${i}`} className="ml-4">
                            {inline(item)}
                        </li>,
                    );
                    i++;
                }
                blocks.push(
                    <ol key={`ol-block-${i}`} className="list-decimal pl-5 space-y-1">
                        {items}
                    </ol>,
                );
                continue;
            }
            if (/^\s*([-*+])\s+/.test(line)) {
                const items: React.ReactNode[] = [];
                while (i < lines.length && /^\s*([-*+])\s+/.test(lines[i])) {
                    const item = lines[i].replace(/^\s*([-*+])\s+/, "");
                    items.push(
                        <li key={`ul-${i}`} className="ml-4">
                            {inline(item)}
                        </li>,
                    );
                    i++;
                }
                blocks.push(
                    <ul key={`ul-block-${i}`} className="list-disc pl-5 space-y-1">
                        {items}
                    </ul>,
                );
                continue;
            }
            const paras: string[] = [];
            while (
                i < lines.length &&
                lines[i].trim() &&
                !/^(#{1,3})\s+/.test(lines[i]) &&
                !/^\s*\d+\.\s+/.test(lines[i]) &&
                !/^\s*([-*+])\s+/.test(lines[i])
                ) {
                paras.push(lines[i]);
                i++;
            }
            const paraText = paras.join(" ");
            blocks.push(
                <p key={`p-${i}`} className="text-white/85">
                    {inline(paraText)}
                </p>,
            );
        }
        return <>{blocks}</>;
    }

    const segments = splitFenced(src);
    if (!src.trim()) {
        return <p className="text-white/60 text-sm">No description yet.</p>;
    }
    return (
        <div className="space-y-3 leading-relaxed text-white/90">
            {segments.map((seg, i) =>
                seg.type === "code" ? (
                    <pre
                        key={`code-${i}`}
                        className="overflow-x-auto rounded-md bg-white/5 ring-1 ring-white/10 p-3 text-[13px] leading-relaxed"
                        aria-label={seg.lang ? `Code block (${seg.lang})` : "Code block"}
                    >
                        <code>{seg.content}</code>
                    </pre>
                ) : (
                    <BlockText key={`txt-${i}`} text={seg.content} />
                ),
            )}
        </div>
    );
}

/* ---------- Types ---------- */
type ProjectEvent = {
    slug: string;
    name?: string;
    dateStart?: string | null;
    dateEnd?: string | null;
    locationName?: string | null;
    description?: string | null;
    cover?: string | null;
    photos?: string[];
    tags?: string[];
};

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
    events?: ProjectEvent[];
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
    const eventsSource: any[] = Array.isArray(p.events)
        ? p.events
        : p.event
            ? [p.event]
            : [];

    const events: ProjectEvent[] = eventsSource.map((e: any) => {
        const photos: string[] = Array.isArray(e.photos) ? e.photos : [];
        const cover =
            e.cover ??
            e.imageUrl ??
            (photos.length > 0 ? photos[0] : null);

        return {
            slug: e.slug ?? e.id,
            name: e.name,
            dateStart: e.dateStart ?? e.startDate ?? null,
            dateEnd: e.dateEnd ?? e.endDate ?? null,
            locationName: e.locationName ?? e.location_name ?? null,
            description: e.description ?? e.summary ?? null,
            cover,
            photos,
            tags: Array.isArray(e.tags) ? e.tags : [],
        };
    });

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
        events,
        // when coming from API, images[] matches "gallery" semantics; we keep them all here
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

/* ---------- Helpers ---------- */

function formatEventMeta(ev: ProjectEvent): string {
    const bits: string[] = [];

    if (ev.dateStart) {
        try {
            const d = new Date(ev.dateStart);
            if (!Number.isNaN(d.getTime())) {
                bits.push(d.toLocaleDateString());
            }
        } catch {
            // ignore
        }
    }
    if (ev.locationName) {
        bits.push(ev.locationName);
    }

    return bits.join(" • ");
}

function eventDescriptionSnippet(ev: ProjectEvent): string | null {
    if (!ev.description) return null;
    const plain = ev.description.replace(/\s+/g, " ").trim();
    if (!plain) return null;
    if (plain.length <= 160) return plain;
    return `${plain.slice(0, 157)}…`;
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

    const cover =
        project.cover ||
        project.imageUrl ||
        (project.gallery && project.gallery[0]) ||
        undefined;
    // Avoid repeating the header image inside the gallery
    const gallery =
        (project.gallery || []).filter((src) => src && src !== cover) ?? [];

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
                    <img
                        src={cover}
                        alt={project.title}
                        className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10"
                    />
                </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <article className="lg:col-span-3 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">About</h2>
                        {project.description ? (
                            <MarkdownPreview markdown={project.description} />
                        ) : project.summary ? (
                            <p className="text-white/80 leading-relaxed">{project.summary}</p>
                        ) : (
                            <p className="text-white/60">No description yet.</p>
                        )}

                        {project.techStack && project.techStack.length > 0 && (
                            <div className="mt-3">
                                <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                                    Tech stack
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {project.techStack.map((t) => (
                                        <span
                                            key={t}
                                            className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                        >
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(project.demoUrl || project.repoUrl) && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {project.demoUrl && (
                                    <a
                                        href={project.demoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-primary"
                                    >
                                        Live demo
                                    </a>
                                )}
                                {project.repoUrl && (
                                    <a
                                        href={project.repoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary"
                                    >
                                        Source code
                                    </a>
                                )}
                            </div>
                        )}
                    </div>

                    {project.events && project.events.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Connected events</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {project.events.map((ev, i) => {
                                    const coverUrl =
                                        ev.cover ||
                                        (ev.photos && ev.photos[0]) ||
                                        undefined;
                                    const meta = formatEventMeta(ev);
                                    const snippet = eventDescriptionSnippet(ev);

                                    return (
                                        <Link
                                            key={`${ev.slug}-${i}`}
                                            href={`/events/${ev.slug}`}
                                            className="flex gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                                        >
                                            {coverUrl ? (
                                                <img
                                                    src={coverUrl}
                                                    alt={ev.name || ev.slug}
                                                    className="w-32 h-24 object-cover rounded-md ring-1 ring-white/10 flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-32 h-24 rounded-md ring-1 ring-white/10 bg-white/5 flex items-center justify-center text-sm text-white/70 flex-shrink-0">
                                                    {(ev.name || ev.slug || "Event")
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-semibold leading-tight hover:underline">
                                                    {ev.name || ev.slug}
                                                </div>
                                                {meta && (
                                                    <div className="text-xs text-white/60 mt-0.5">
                                                        {meta}
                                                    </div>
                                                )}
                                                {snippet && (
                                                    <p className="mt-1 text-sm text-white/70 line-clamp-3">
                                                        {snippet}
                                                    </p>
                                                )}
                                                {ev.tags && ev.tags.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                                        {ev.tags.slice(0, 4).map((t) => (
                                                            <span
                                                                key={t}
                                                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10"
                                                            >
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {gallery && gallery.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {gallery.map((src, i) => (
                                    <img
                                        key={i}
                                        src={src}
                                        alt={`${project.title} photo ${i + 1}`}
                                        className="w-full h-32 object-cover rounded-md ring-1 ring-white/10"
                                    />
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
                                    <li
                                        key={`${m.slug || m.name || i}-${i}`}
                                        className="flex items-center gap-3"
                                    >
                                        <img
                                            src={m.avatarUrl || "/avatars/default.png"}
                                            alt={m.name || m.slug || "Member"}
                                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            {m.slug ? (
                                                <Link
                                                    href={`/members/${m.slug}`}
                                                    className="font-medium hover:underline"
                                                >
                                                    {m.name || m.slug}
                                                </Link>
                                            ) : (
                                                <span className="font-medium">
                                                    {m.name || "Unknown member"}
                                                </span>
                                            )}
                                            {m.role && (
                                                <div className="text-xs text-white/60">
                                                    {m.role}
                                                </div>
                                            )}
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
