// app/members/[slug]/page.tsx
/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import type { Metadata } from "next";
import { toImageSrc } from "@/lib/images";
import EditMemberButton from "@/components/EditMemberButton";
import { tServer } from "@/lib/i18n-server";
import Avatar from "@/components/Avatar";
import TagChip from "@/components/TagChip";
import SimpleMarkdown from "@/components/SimpleMarkdown";

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
    cvUrl?: string | null;
    isAdminMember?: boolean | null;

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
    cvUrl?: string | null;
    isAdminMember: boolean;

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
const isString = (v: unknown): v is string =>
    typeof v === "string" && v.trim().length > 0;

/** normalize any image-like value to a usable src (undefined if bad) */
function toImageOrUndef(v?: string | null): string | undefined {
    if (!isString(v)) return undefined;
    const out = toImageSrc(v);
    return isString(out) ? out : undefined;
}

/* ---------------------------- Fetch helpers ---------------------------- */
async function getMemberBySlug(slug: string): Promise<UiMember | null> {
    const res = await fetch(`${API_BASE}/api/members/${slug}`, {
        cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load member");

    const m = (await res.json()) as ApiMember;

    // avatar
    const avatarSrc = toImageOrUndef(m.avatarUrl ?? m.avatar) ?? null;

    // arrays → string[] (filter out null/empty)
    const photos = (m.photos ?? [])
        .filter(isString)
        .map((p) => toImageSrc(p))
        .filter(isString);
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
        cvUrl: m.cvUrl ?? null,
        isAdminMember: !!m.isAdminMember,
        projects,
        events,
    };
}

/* ------------------------- Dynamic metadata ------------------------- */
export async function generateMetadata({
                                           params,
                                       }: {
    params: { slug: string };
}): Promise<Metadata> {
    const member = await getMemberBySlug(params.slug);
    return {
        title: member
            ? tServer("memberDetail.metadata.title").replace(
                "{name}",
                member.name,
            )
            : tServer("memberDetail.metadata.fallbackTitle"),
        description:
            member?.headline ||
            member?.bio ||
            tServer("memberDetail.metadata.fallbackDescription"),
    };
}

/* -------------------------------- Page -------------------------------- */
export default async function MemberDetailPage({
                                                   params,
                                               }: {
    params: { slug: string };
}) {
    const member = await getMemberBySlug(params.slug);

    if (!member) {
        return (
            <section className="section">
                <h1 className="display">
                    {tServer("memberDetail.notFound.title")}
                </h1>
                <p className="mt-4">
                    <Link
                        href="/members"
                        className="underline underline-offset-4"
                    >
                        {tServer("memberDetail.notFound.back")}
                    </Link>
                </p>
            </section>
        );
    }

    const avatarSrc = member.avatarUrl || undefined;
    const linkItems = makeLinkItems(member.links || {});

    return (
        <section className="section">
            <header className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                <Avatar name={member.name} src={avatarSrc} size={112} className="ring-2 ring-white/10" />
                <div className="flex-1">
                    <p className="kicker">
                        {tServer("memberDetail.kicker")}
                    </p>
                    <h1 className="display">{member.name}</h1>
                    {member.headline && (
                        <p className="text-white/70 mt-1">
                            {member.headline}
                        </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {member.expertise.map((x) => (
                            <TagChip key={x}>
                                {x}
                            </TagChip>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <EditMemberButton
                        slug={member.slug}
                        isAdminMember={member.isAdminMember}
                    />
                    <div className="flex flex-wrap gap-2">
                        {linkItems.length ? (
                            linkItems.map((l) => (
                                <a
                                    key={l.href}
                                    className="btn-secondary"
                                    href={l.href}
                                    target={
                                        l.external ? "_blank" : undefined
                                    }
                                    rel="noreferrer"
                                >
                                    {l.label}
                                </a>
                            ))
                        ) : (
                            <Link
                                className="btn-primary"
                                href="/contact"
                            >
                                {tServer("memberDetail.cta.contact")}
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* Left column */}
                <div className="lg:col-span-3 space-y-6">
                    {(member.bio || member.shortBio) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">
                                {tServer("memberDetail.about.title")}
                            </h2>
                            <SimpleMarkdown
                                markdown={
                                    member.bio ??
                                    member.shortBio ??
                                    ""
                                }
                            />
                        </div>
                    )}

                    {member.projects.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">
                                {tServer("memberDetail.projects.title")}
                            </h2>
                            <div className="space-y-4">
                                {member.projects.map((p) => (
                                    <div
                                        key={p.slug}
                                        className="flex gap-3"
                                    >
                                        {p.cover && (
                                            <img
                                                src={p.cover}
                                                alt={p.title}
                                                className="w-36 h-24 object-cover rounded-md ring-1 ring-white/10"
                                            />
                                        )}
                                        <div>
                                            <div className="font-semibold">
                                                {p.title}
                                            </div>
                                            {(p.role || p.year) && (
                                                <div className="text-xs text-white/60">
                                                    {p.role
                                                        ? tServer(
                                                            "memberDetail.projects.roleLabel",
                                                        ).replace(
                                                            "{role}",
                                                            p.role || "",
                                                        )
                                                        : ""}
                                                    {p.role &&
                                                    p.year
                                                        ? " • "
                                                        : ""}
                                                    {p.year
                                                        ? tServer(
                                                            "memberDetail.projects.yearLabel",
                                                        ).replace(
                                                            "{year}",
                                                            String(
                                                                p.year,
                                                            ),
                                                        )
                                                        : ""}
                                                </div>
                                            )}
                                            {p.summary && (
                                                <div className="text-sm text-white/80 mt-1">
                                                    {p.summary}
                                                </div>
                                            )}
                                            {!!p.tech.length && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {p.tech.map(
                                                        (t) => (
                                                            <TagChip key={t}>
                                                                {t}
                                                            </TagChip>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                            {p.slug && (
                                                <div className="mt-1">
                                                    <Link
                                                        href={`/projects/${p.slug}`}
                                                        className="text-xs underline underline-offset-4"
                                                    >
                                                        {tServer(
                                                            "memberDetail.projects.openProject",
                                                        )}
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
                            <h2 className="text-lg font-semibold mb-3">
                                {tServer("memberDetail.gallery.title")}
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {member.photos.map((src, i) => (
                                    <img
                                        key={i}
                                        src={src}
                                        alt={tServer(
                                            "memberDetail.gallery.photoAlt",
                                        )
                                            .replace(
                                                "{name}",
                                                member.name,
                                            )
                                            .replace(
                                                "{index}",
                                                String(i + 1),
                                            )}
                                        className="w-full h-32 object-cover rounded-md ring-1 ring-white/10"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CV viewer (inline) */}
                    {member.cvUrl && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">
                                {tServer("memberDetail.cv.title")}
                            </h2>
                            <div className="mb-3">
                                <a
                                    href={member.cvUrl}
                                    className="btn-secondary"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {tServer(
                                        "memberDetail.cv.downloadLabel",
                                    )}
                                </a>
                            </div>
                            <div className="w-full rounded-md ring-1 ring-white/10 overflow-hidden bg-white/5">
                                <iframe
                                    src={`${member.cvUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                                    className="w-full h-[70vh] bg-black"
                                    title={tServer("memberDetail.cv.iframeTitle")}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column */}
                <aside className="lg:col-span-2 space-y-6">
                    {member.location && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">
                                {tServer("memberDetail.location.title")}
                            </h2>
                            <div className="text-white/80">
                                {member.location}
                            </div>
                        </div>
                    )}

                    {member.skills.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">
                                {tServer("memberDetail.skills.title")}
                            </h2>
                            <div className="flex flex-wrap gap-1.5">
                                {member.skills.map((s) => (
                                    <TagChip key={s}>
                                        {s}
                                    </TagChip>
                                ))}
                            </div>
                        </div>
                    )}

                    {member.techStack.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">
                                {tServer(
                                    "memberDetail.techStack.title",
                                )}
                            </h2>
                            <div className="flex flex-wrap gap-1.5">
                                {member.techStack.map((s) => (
                                    <TagChip key={s}>
                                        {s}
                                    </TagChip>
                                ))}
                            </div>
                        </div>
                    )}

                    {member.events.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">
                                {tServer("memberDetail.events.title")}
                            </h2>
                            <ul className="space-y-2">
                                {member.events.map((ev) => (
                                    <li
                                        key={ev.slug}
                                        className="flex items-start gap-3"
                                    >
                                        <span className="mt-1 inline-block w-2 h-2 rounded-full bg-cyan-300 ring-1 ring-white/50 shadow-[0_0_12px_rgba(56,189,248,.9)]" />
                                        <div>
                                            <Link
                                                href={`/events/${ev.slug}`}
                                                className="font-medium hover:underline"
                                            >
                                                {ev.name}
                                            </Link>
                                            {(ev.dateStart ||
                                                ev.dateEnd) && (
                                                <div className="text-xs text-white/60">
                                                    {ev.dateStart
                                                        ? new Date(
                                                            ev.dateStart,
                                                        ).toLocaleDateString()
                                                        : ""}
                                                    {ev.dateStart &&
                                                    ev.dateEnd
                                                        ? " – "
                                                        : ""}
                                                    {ev.dateEnd
                                                        ? new Date(
                                                            ev.dateEnd,
                                                        ).toLocaleDateString()
                                                        : ""}
                                                </div>
                                            )}
                                            {ev.role && (
                                                <div className="text-xs text-white/70">
                                                    {tServer(
                                                        "memberDetail.events.roleLabel",
                                                    ).replace(
                                                        "{role}",
                                                        ev.role,
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>

            <div className="mt-8">
                <Link
                    href="/members"
                    className="underline underline-offset-4"
                >
                    {tServer("memberDetail.backToAll")}
                </Link>
            </div>
        </section>
    );
}

/* ----------------------------- Link helpers ----------------------------- */
function makeLinkItems(links: Record<string, string>) {
    const order = ["website", "github", "linkedin", "twitter", "x", "email"];
    const entries = Object.entries(links || {}).filter(([, v]) => !!v);

    const normalized = entries.map(([k, v]) => {
        const key = k.toLowerCase();
        let href = v.trim();
        let label =
            labelForKey(key); // localized below where appropriate
        let external = true;

        if (key === "email" || href.startsWith("mailto:")) {
            href = href.startsWith("mailto:")
                ? href
                : `mailto:${href}`;
            external = false;
            label = tServer("memberDetail.links.email");
        } else if (!/^https?:\/\//i.test(href)) {
            href = `https://${href}`;
        }

        return { key, href, label, external };
    });

    normalized.sort((a, b) => {
        const ai = order.indexOf(a.key);
        const bi = order.indexOf(b.key);
        if (ai === -1 && bi === -1)
            return a.key.localeCompare(b.key);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    return normalized;
}

function labelForKey(key: string) {
    switch (key) {
        case "github":
            return "GitHub"; // brand names usually stay as-is
        case "linkedin":
            return "LinkedIn";
        case "website":
            return tServer("memberDetail.links.website");
        case "twitter":
        case "x":
            return "Twitter";
        case "email":
            return tServer("memberDetail.links.email");
        default:
            return key[0].toUpperCase() + key.slice(1);
    }
}