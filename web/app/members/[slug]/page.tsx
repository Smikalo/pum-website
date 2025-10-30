/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import type { Metadata } from "next";
import { toImageSrc } from "@/lib/images";

export const dynamic = "force-dynamic";

/* ------------------------------ Types ------------------------------ */
/** Raw API shape (can contain nulls in arrays) */
type ApiMember = {
    id: string;
    slug: string;
    name: string;
    avatar?: string | null;
    avatarUrl?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    bio?: string | null;
    location?: string | null;
    links?: Record<string, string> | null;
    photos?: (string | null)[] | null;
    skills?: (string | null)[] | null;
    techStack?: (string | null)[] | null;
    expertise?: (string | null)[] | null;

    projects?: {
        slug: string;
        name?: string | null;
        title?: string | null;
        role?: string | null;
        year?: number | null;
        cover?: string | null;
        summary?: string | null;
        tech?: (string | null)[] | null;
        techStack?: (string | null)[] | null;
        imageUrl?: string | null;
    }[];

    events?: {
        slug: string;
        name?: string | null;
        role?: string | null;
        dateStart?: string | null;
        dateEnd?: string | null;
    }[];
};

/** UI-normalized member (no nulls in arrays) */
type UiMember = {
    id: string;
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    bio?: string | null;
    location?: string | null;
    links: Record<string, string>;
    photos: string[];
    skills: string[];
    techStack: string[];
    expertise: string[];

    projects: {
        slug: string;
        title: string;
        role?: string | null;
        year?: number | null;
        cover?: string | undefined;
        summary?: string | null;
        tech: string[];
    }[];

    events: {
        slug: string;
        name: string;
        role?: string | null;
        dateStart?: string | null;
        dateEnd?: string | null;
    }[];
};

/* ---------------------------- Small utils ---------------------------- */
const isString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** normalize any image-like value to a usable src (undefined if bad) */
function toImageOrUndef(v?: string | null): string | undefined {
    if (!isString(v)) return undefined;
    const out = toImageSrc(v);
    return isString(out) ? out : undefined;
}

/* ---------------------------- Fetch helpers ---------------------------- */
async function getMemberBySlug(slug: string): Promise<UiMember | null> {
    const res = await fetch(`${API_BASE}/api/members/${slug}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load member");

    const m = (await res.json()) as ApiMember;

    // avatar
    const avatarSrc = toImageOrUndef(m.avatarUrl ?? m.avatar) ?? null;

    // arrays → string[] (filter out null/empty)
    const photos = (m.photos ?? []).filter(isString).map((p) => toImageSrc(p)).filter(isString);
    const skills = (m.skills ?? []).filter(isString);
    const techStack = (m.techStack ?? []).filter(isString);
    const expertise = (m.expertise ?? []).filter(isString);

    // projects (normalize cover + tech)
    const projects =
        (m.projects ?? []).map((p) => ({
            slug: p.slug,
            title: (p.title ?? p.name ?? p.slug) || p.slug,
            role: p.role ?? null,
            year: typeof p.year === "number" ? p.year : p.year ?? null,
            cover: toImageOrUndef(p.cover) ?? toImageOrUndef(p.imageUrl),
            summary: p.summary ?? null,
            tech: (p.techStack ?? p.tech ?? []).filter(isString),
        })) ?? [];

    // events
    const events =
        (m.events ?? []).map((e) => ({
            slug: e.slug,
            name: (e.name ?? e.slug) || e.slug,
            role: e.role ?? null,
            dateStart: e.dateStart ?? null,
            dateEnd: e.dateEnd ?? null,
        })) ?? [];

    return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        avatarUrl: avatarSrc,
        headline: m.headline ?? null,
        shortBio: m.shortBio ?? null,
        bio: m.bio ?? null,
        location: m.location ?? null,
        links: m.links ?? {},
        photos,
        skills,
        techStack,
        expertise,
        projects,
        events,
    };
}

/* ------------------------- Dynamic metadata ------------------------- */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const member = await getMemberBySlug(params.slug);
    return {
        title: member ? `${member.name} – PUM` : "Member – PUM",
        description: member?.headline || member?.bio || "PUM member profile",
    };
}

/* -------------------------------- Page -------------------------------- */
export default async function MemberDetailPage({ params }: { params: { slug: string } }) {
    const member = await getMemberBySlug(params.slug);

    if (!member) {
        return (
            <section className="section">
                <h1 className="display">Member not found</h1>
                <p className="mt-4">
                    <Link href="/members" className="underline underline-offset-4">
                        Back to members
                    </Link>
                </p>
            </section>
        );
    }

    const avatar = member.avatarUrl || "/avatars/default.png";
    const linkItems = makeLinkItems(member.links || {});

    return (
        <section className="section">
            <header className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                <img src={avatar} alt={member.name} className="w-28 h-28 rounded-full object-cover ring-2 ring-white/10" />
                <div className="flex-1">
                    <p className="kicker">MEMBER</p>
                    <h1 className="display">{member.name}</h1>
                    {member.headline && <p className="text-white/70 mt-1">{member.headline}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {member.expertise.map((x) => (
                            <span key={x} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                {x}
              </span>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {linkItems.length ? (
                        linkItems.map((l) => (
                            <a key={l.href} className="btn-secondary" href={l.href} target={l.external ? "_blank" : undefined} rel="noreferrer">
                                {l.label}
                            </a>
                        ))
                    ) : (
                        <Link className="btn-primary" href="/contact">
                            Contact
                        </Link>
                    )}
                </div>
            </header>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* Left column */}
                <div className="lg:col-span-3 space-y-6">
                    {(member.bio || member.shortBio) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">About</h2>
                            <MarkdownView markdown={member.bio ?? member.shortBio ?? ""} />
                        </div>
                    )}

                    {member.projects.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Projects</h2>
                            <div className="space-y-4">
                                {member.projects.map((p) => (
                                    <div key={p.slug} className="flex gap-3">
                                        {p.cover && <img src={p.cover} alt={p.title} className="w-36 h-24 object-cover rounded-md ring-1 ring-white/10" />}
                                        <div>
                                            <div className="font-semibold">{p.title}</div>
                                            {(p.role || p.year) && (
                                                <div className="text-xs text-white/60">
                                                    {p.role ? `Role: ${p.role}` : ""}
                                                    {p.role && p.year ? " • " : ""}
                                                    {p.year ? `Year: ${p.year}` : ""}
                                                </div>
                                            )}
                                            {p.summary && <div className="text-sm text-white/80 mt-1">{p.summary}</div>}
                                            {!!p.tech.length && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {p.tech.map((t) => (
                                                        <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                              {t}
                            </span>
                                                    ))}
                                                </div>
                                            )}
                                            {p.slug && (
                                                <div className="mt-1">
                                                    <Link href={`/projects/${p.slug}`} className="text-xs underline underline-offset-4">
                                                        Open project →
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {member.photos.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {member.photos.map((src, i) => (
                                    <img key={i} src={src} alt={`${member.name} photo ${i + 1}`} className="w-full h-32 object-cover rounded-md ring-1 ring-white/10" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column */}
                <aside className="lg:col-span-2 space-y-6">
                    {member.location && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Location</h2>
                            <div className="text-white/80">{member.location}</div>
                        </div>
                    )}

                    {member.skills.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Skills</h2>
                            <div className="flex flex-wrap gap-1.5">
                                {member.skills.map((s) => (
                                    <span key={s} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                    {s}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {member.techStack.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Tech stack</h2>
                            <div className="flex flex-wrap gap-1.5">
                                {member.techStack.map((s) => (
                                    <span key={s} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                    {s}
                  </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {member.events.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Events</h2>
                            <ul className="space-y-2">
                                {member.events.map((ev) => (
                                    <li key={ev.slug} className="flex items-start gap-3">
                                        <span className="mt-1 inline-block w-2 h-2 rounded-full bg-cyan-300 ring-1 ring-white/50 shadow-[0_0_12px_rgba(56,189,248,.9)]" />
                                        <div>
                                            <Link href={`/events/${ev.slug}`} className="font-medium hover:underline">
                                                {ev.name}
                                            </Link>
                                            {(ev.dateStart || ev.dateEnd) && (
                                                <div className="text-xs text-white/60">
                                                    {ev.dateStart ? new Date(ev.dateStart).toLocaleDateString() : ""}
                                                    {ev.dateStart && ev.dateEnd ? " – " : ""}
                                                    {ev.dateEnd ? new Date(ev.dateEnd).toLocaleDateString() : ""}
                                                </div>
                                            )}
                                            {ev.role && <div className="text-xs text-white/70">Role: {ev.role}</div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/members" className="underline underline-offset-4">
                    ← Back to all members
                </Link>
            </div>
        </section>
    );
}

/* ----------------------------- Markdown renderer ----------------------------- */
/**
 * Lightweight, dependency-free Markdown renderer that supports:
 * - Headings (#, ##, ###)
 * - Paragraphs
 * - Bold (**text**) and italic (*text*)
 * - Inline code (`code`)
 * - Links [label](url)
 * - Unordered (-, *) and ordered (1.) lists
 * - Fenced code blocks ```lang ... ```
 */
function MarkdownView({ markdown }: { markdown: string }) {
    const src = (markdown || "").replace(/\r\n/g, "\n");
    const segments = splitFenced(src);

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

        // Headings
        const hMatch = /^(#{1,3})\s+(.*)$/.exec(line);
        if (hMatch) {
            const level = hMatch[1].length;
            const content = hMatch[2];
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

        // Ordered list
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

        // Unordered list
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

        // Paragraph
        const paraLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^(#{1,3})\s+/.test(lines[i]) &&
            !/^\s*\d+\.\s+/.test(lines[i]) &&
            !/^\s*([-*+])\s+/.test(lines[i])
            ) {
            paraLines.push(lines[i]);
            i++;
        }
        const paraText = paraLines.join(" ");
        blocks.push(
            <p key={`p-${i}`} className="text-white/85">
                {inline(paraText)}
            </p>,
        );
    }

    return <>{blocks}</>;
}

/** Inline markdown: **bold**, *italic*, `code`, [label](url) */
function inline(text: string): React.ReactNode[] {
    if (!text) return [];

    // code
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
        const linkified = splitLinks(seg).flatMap((s, j) => {
            if (typeof s !== "string") {
                const href = normalizeHref(s.href);
                return (
                    <a key={`a-${idx}-${j}`} href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {s.label}
                    </a>
                );
            }
            return s;
        });

        // bold **text**
        const bolded = linkified.flatMap((s, j) => {
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

        // italic *text*
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

/* ----------------------------- Link helpers ----------------------------- */
function makeLinkItems(links: Record<string, string>) {
    const order = ["website", "github", "linkedin", "twitter", "x", "email"];
    const entries = Object.entries(links || {}).filter(([, v]) => !!v);

    const normalized = entries.map(([k, v]) => {
        const key = k.toLowerCase();
        let href = v.trim();
        let label = labelForKey(key);
        let external = true;

        if (key === "email" || href.startsWith("mailto:")) {
            href = href.startsWith("mailto:") ? href : `mailto:${href}`;
            external = false;
            label = "Email";
        } else if (!/^https?:\/\//i.test(href)) {
            href = `https://${href}`;
        }

        return { key, href, label, external };
    });

    normalized.sort((a, b) => {
        const ai = order.indexOf(a.key);
        const bi = order.indexOf(b.key);
        if (ai === -1 && bi === -1) return a.key.localeCompare(b.key);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    return normalized;
}

function labelForKey(key: string) {
    switch (key) {
        case "github":
            return "GitHub";
        case "linkedin":
            return "LinkedIn";
        case "website":
            return "Website";
        case "twitter":
        case "x":
            return "Twitter";
        case "email":
            return "Email";
        default:
            return key[0].toUpperCase() + key.slice(1);
    }
}
