/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SEED_EVENTS } from "@/data/events.seed";
import {
    SEED_MEMBERS,
    type Member as SeedMember,
} from "@/data/members.seed";
import {
    SEED_PROJECTS,
    type Project as SeedProject,
} from "@/data/projects.seed";
import { API_BASE } from "@/lib/config";
import EventsMap from "@/components/EventsMap";
import EditEventButton from "@/components/EditEventButton";
import { tServer } from "@/lib/i18n-server";

/* ----------------------- Tiny Markdown renderer ----------------------- */

function MarkdownPreview({ markdown }: { markdown: string }) {
    const src = (markdown || "").replace(/\r\n/g, "\n");

    type FencedSegment =
        | { type: "text"; content: string }
        | { type: "code"; content: string; lang?: string };

    function splitFenced(input: string): FencedSegment[] {
        const out: FencedSegment[] = [];
        const fence = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = fence.exec(input))) {
            if (m.index > lastIndex) {
                out.push({
                    type: "text",
                    content: input.slice(lastIndex, m.index),
                });
            }
            out.push({
                type: "code",
                content: m[2].replace(/\n$/, ""),
                lang: m[1],
            });
            lastIndex = fence.lastIndex;
        }
        if (lastIndex < input.length) {
            out.push({
                type: "text",
                content: input.slice(lastIndex),
            });
        }
        return out;
    }

    type InlineSegment = string | { code: string };

    function splitInline(
        text: string,
        re: RegExp,
    ): InlineSegment[] {
        const out: InlineSegment[] = [];
        let last = 0;
        let m: RegExpExecArray | null;
        const rx = new RegExp(re.source, "g");
        while ((m = rx.exec(text))) {
            if (m.index > last)
                out.push(text.slice(last, m.index));
            out.push({ code: m[1] });
            last = rx.lastIndex;
        }
        if (last < text.length) out.push(text.slice(last));
        return out;
    }

    type LinkSegment =
        | string
        | { label: string; href: string };

    function splitLinks(text: string): LinkSegment[] {
        const out: LinkSegment[] = [];
        const re = /\[([^\]]+)\]\(([^)]+)\)/g;
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
            if (m.index > last)
                out.push(text.slice(last, m.index));
            out.push({ label: m[1], href: m[2] });
            last = re.lastIndex;
        }
        if (last < text.length) out.push(text.slice(last));
        return out;
    }

    function normalizeHref(href: string): string {
        if (
            /^https?:\/\//i.test(href) ||
            href.startsWith("mailto:")
        )
            return href;
        return `https://${href}`;
    }

    function inline(text: string): React.ReactNode[] {
        if (!text) return [];
        const segments = splitInline(text, /`([^`]+)`/);
        return segments.flatMap((seg, idx) => {
            if (typeof seg !== "string") {
                return (
                    <code
                        key={`code-${idx}`}
                        className="px-1 rounded bg-white/10 text-white/90"
                    >
                        {seg.code}
                    </code>
                );
            }
            // links
            const withLinks = splitLinks(seg).flatMap(
                (s, j) => {
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
                },
            );
            // bold
            const bolded = withLinks.flatMap((s, j) => {
                if (typeof s !== "string") return s;
                const parts = splitInline(
                    s,
                    /\*\*([^*]+)\*\*/,
                );
                return parts.map((p, k) =>
                    typeof p === "string" ? (
                        p
                    ) : (
                        <strong
                            key={`b-${idx}-${j}-${k}`}
                            className="text-white"
                        >
                            {p.code}
                        </strong>
                    ),
                );
            });
            // italic
            const italicized = bolded.flatMap((s, j) => {
                if (typeof s !== "string") return s;
                const parts = splitInline(
                    s,
                    /\*([^*]+)\*/,
                );
                return parts.map((p, k) =>
                    typeof p === "string" ? (
                        p
                    ) : (
                        <em
                            key={`i-${idx}-${j}-${k}`}
                            className="italic"
                        >
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
                        <h3
                            key={`h-${i}`}
                            className="text-2xl font-bold text-white mt-3"
                        >
                            {inline(content)}
                        </h3>
                    ) : level === 2 ? (
                        <h4
                            key={`h-${i}`}
                            className="text-xl font-semibold text-white mt-2"
                        >
                            {inline(content)}
                        </h4>
                    ) : (
                        <h5
                            key={`h-${i}`}
                            className="text-lg font-semibold text-white mt-2"
                        >
                            {inline(content)}
                        </h5>
                    ),
                );
                i++;
                continue;
            }
            if (/^\s*\d+\.\s+/.test(line)) {
                const items: React.ReactNode[] = [];
                while (
                    i < lines.length &&
                    /^\s*\d+\.\s+/.test(lines[i])
                    ) {
                    const item = lines[i].replace(
                        /^\s*\d+\.\s+/,
                        "",
                    );
                    items.push(
                        <li
                            key={`ol-${i}`}
                            className="ml-4"
                        >
                            {inline(item)}
                        </li>,
                    );
                    i++;
                }
                blocks.push(
                    <ol
                        key={`ol-block-${i}`}
                        className="list-decimal pl-5 space-y-1"
                    >
                        {items}
                    </ol>,
                );
                continue;
            }
            if (/^\s*([-*+])\s+/.test(line)) {
                const items: React.ReactNode[] = [];
                while (
                    i < lines.length &&
                    /^\s*([-*+])\s+/.test(lines[i])
                    ) {
                    const item = lines[i].replace(
                        /^\s*([-*+])\s+/,
                        "",
                    );
                    items.push(
                        <li
                            key={`ul-${i}`}
                            className="ml-4"
                        >
                            {inline(item)}
                        </li>,
                    );
                    i++;
                }
                blocks.push(
                    <ul
                        key={`ul-block-${i}`}
                        className="list-disc pl-5 space-y-1"
                    >
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
                <p
                    key={`p-${i}`}
                    className="text-white/85"
                >
                    {inline(paraText)}
                </p>,
            );
        }
        return <>{blocks}</>;
    }

    const segments = splitFenced(src);
    return (
        <div className="space-y-3 leading-relaxed text-white/90">
            {segments.map((seg, i) =>
                seg.type === "code" ? (
                    <pre
                        key={`code-${i}`}
                        className="overflow-x-auto rounded-md bg-white/5 ring-1 ring-white/10 p-3 text-[13px] leading-relaxed"
                        aria-label={
                            seg.lang
                                ? tServer(
                                    "events.edit.markdown.codeBlockWithLang",
                                ).replace("{lang}", seg.lang)
                                : tServer(
                                    "events.edit.markdown.codeBlock",
                                )
                        }
                    >
                        <code>{seg.content}</code>
                    </pre>
                ) : (
                    <BlockText
                        key={`txt-${i}`}
                        text={seg.content}
                    />
                ),
            )}
        </div>
    );
}

/* ----------------------------- Types & helpers ---------------------------- */

type Event = {
    id: string;
    slug: string;
    name: string;
    dateStart?: string;
    dateEnd?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    description?: string;
    photos?: string[];
    tags?: string[];
};

type Member = {
    slug: string | null;
    name: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    avatar?: string | null;
    headline?: string | null;
    pending?: boolean;
};

type ProjectMemberRef = {
    memberId?: string;
    memberSlug?: string;
    role?: string;
};

type Project = {
    id: string;
    slug: string;
    title: string;
    tags?: string[];
    techStack?: string[];
    members?: ProjectMemberRef[];
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

type BlogCard = {
    slug: string;
    title: string;
    cover?: string | null;
    summary?: string | null;
    publishedAt?: string | null;
    tags?: string[];
};

// Raw shapes from API responses (loose, all optional)
type RawEvent = {
    id?: string | number;
    slug?: string | number;
    name?: string;
    dateStart?: string;
    dateEnd?: string;
    locationName?: string;
    lat?: number | string;
    lng?: number | string;
    description?: string;
    photos?: string[];
    tags?: string[];
};

type RawMember = {
    slug?: string;
    id?: string;
    name?: string;
    email?: string | null;
    avatarUrl?: string | null;
    avatar?: string | null;
    photo?: string | null;
    image?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    pending?: boolean;
};

type RawProjectMember = {
    memberId?: string;
    memberSlug?: string;
    id?: string;
    slug?: string;
    role?: string;
};

type RawProject = {
    id?: string | number;
    slug?: string | number;
    title?: string;
    name?: string;
    tags?: string[];
    techStack?: string[];
    tech?: string[];
    members?: RawProjectMember[];
    imageUrl?: string;
    cover?: string;
    summary?: string | null;
    description?: string | null;
    year?: number;
    demoUrl?: string;
    repoUrl?: string;
    events?: { slug?: string; id?: string; name?: string }[];
    gallery?: string[];
};

type RawBlog = {
    slug?: string;
    id?: string;
    title?: string;
    name?: string;
    cover?: string | null;
    imageUrl?: string | null;
    images?: string[];
    photos?: string[];
    summary?: string | null;
    publishedAt?: string | null;
    date?: string | null;
    createdAt?: string | null;
    tags?:
        | string[]
        | string
        | null;
};

type EventDetailDto = {
    id: string;
    slug: string;
    name: string;
    dateStart?: string;
    dateEnd?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    description?: string;
    photos?: string[];
    tags?: string[];
    attendees?: {
        slug: string | null;
        name?: string | null;
        email?: string | null;
        avatarUrl?: string | null;
        role?: string | null;
        headline?: string | null;
        pending?: boolean;
    }[];
    projects?: {
        slug: string;
        title: string;
        imageUrl?: string | null;
        cover?: string | null;
        year?: number | null;
        summary?: string | null;
        techStack?: string[] | null;
        tech?: string[] | null;
        members?: {
            memberSlug?: string;
            memberId?: string;
        }[];
    }[];
    blogs?: {
        slug: string;
        title: string;
        cover?: string | null;
        imageUrl?: string | null;
        summary?: string | null;
        publishedAt?: string | null;
        tags?: string[] | null;
    }[];
} | null;

type BlogsApiResponse =
    | RawBlog[]
    | {
    items?: RawBlog[];
}
    | null
    | undefined;

// Pre-generate known seed slugs to keep links stable, still fetch dynamic at runtime too.
export async function generateStaticParams() {
    return (SEED_EVENTS || []).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: { slug: string };
}): Promise<Metadata> {
    const ev = await getEvent(params.slug);
    return {
        title: ev
            ? `${ev.name} – PUM Events`
            : "Event – PUM",
        description:
            ev?.description ||
            ev?.locationName ||
            "PUM event",
    };
}

type ProjectEventRef = {
    slug?: string | number;
    id?: string | number;
    name?: string;
};

function normalizeProject(p: RawProject | SeedProject): Project {
    const slugValue =
        (p as RawProject).slug ?? (p as SeedProject).slug ?? (p as RawProject).id;
    const idValue =
        (p as RawProject).id ?? slugValue;

    const tags: string[] =
        (p as RawProject).tags ??
        (p as SeedProject).tags ??
        [];

    const techStack: string[] =
        (p as RawProject).techStack ??
        (p as RawProject).tech ??
        (p as SeedProject).techStack ??
        [];

    const rawMembers: RawProjectMember[] =
        (p as RawProject).members ??
        (p as SeedProject).members ??
        [];

    const members: ProjectMemberRef[] =
        rawMembers.map((m) => ({
            memberId: m.memberId ?? m.id,
            memberSlug: m.memberSlug ?? m.slug,
            role: m.role,
        }));

    const eventsRaw: ProjectEventRef[] =
        (p as RawProject).events ??
        (p as SeedProject).events ??
        [];

    const events =
        eventsRaw.map((e): {slug: string; name?: string} => ({
            slug: String(e.slug ?? e.id ?? ""),
            name: e.name,
        }));

    const gallery =
        (p as RawProject).gallery ??
        (p as SeedProject).gallery ??
        [];

    return {
        id: String(idValue ?? ""),
        slug: String(slugValue ?? ""),
        title:
            (p as RawProject).title ??
            (p as SeedProject).title ??
            (p as RawProject).name ??
            String(slugValue ?? ""),
        tags,
        techStack,
        members,
        imageUrl:
            (p as RawProject).imageUrl ??
            (p as SeedProject).imageUrl ??
            (p as SeedProject).cover,
        summary:
            (p as RawProject).summary ??
            (p as SeedProject).summary ??
            undefined,
        description:
            (p as RawProject).description ??
            (p as SeedProject).description ??
            undefined,
        year:
            typeof (p as RawProject).year === "number"
                ? (p as RawProject).year
                : typeof (p as SeedProject).year === "number"
                    ? (p as SeedProject).year
                    : undefined,
        cover:
            (p as RawProject).cover ??
            (p as SeedProject).cover ??
            (p as RawProject).imageUrl ??
            (p as SeedProject).imageUrl,
        demoUrl:
            (p as RawProject).demoUrl ??
            (p as SeedProject).demoUrl,
        repoUrl:
            (p as RawProject).repoUrl ??
            (p as SeedProject).repoUrl,
        events,
        gallery,
    };
}

function mergeProjects(
    api: Project[],
    seeds: SeedProject[],
): Project[] {
    const uniq = <T,>(arr: T[]): T[] =>
        Array.from(new Set(arr));
    const map = new Map<string, Project>();
    for (const p of api) map.set(p.slug, { ...p });
    for (const s of seeds) {
        const sn = normalizeProject(s);
        if (map.has(s.slug)) {
            const cur = map.get(s.slug)!;
            map.set(s.slug, {
                ...sn,
                ...cur, // API wins
                id: cur.id || sn.id,
                tags: uniq([
                    ...(cur.tags || []),
                    ...(sn.tags || []),
                ]),
                techStack: uniq([
                    ...(cur.techStack || []),
                    ...(sn.techStack || []),
                ]),
                members:
                    (cur.members?.length
                        ? cur.members
                        : sn.members) || [],
                imageUrl: cur.imageUrl || sn.imageUrl,
                cover: cur.cover || sn.cover,
                summary: cur.summary || sn.summary,
                description:
                    cur.description || sn.description,
                year: cur.year ?? sn.year,
                demoUrl: cur.demoUrl || sn.demoUrl,
                repoUrl: cur.repoUrl || sn.repoUrl,
                events:
                    (cur.events?.length
                        ? cur.events
                        : sn.events) || [],
                gallery:
                    (cur.gallery?.length
                        ? cur.gallery
                        : sn.gallery) || [],
            });
        } else {
            map.set(s.slug, sn);
        }
    }
    return Array.from(map.values());
}

/* --------------------------------- Fetchers -------------------------------- */

async function fetchApiEvents(): Promise<Event[]> {
    try {
        const res = await fetch(
            new URL("/api/events?size=999", API_BASE).toString(),
            { cache: "no-store" },
        );
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json)
            ? (json as RawEvent[])
            : ((json as { items?: RawEvent[] })
                .items ?? []);
        return items.map((e) => normalizeEvent(e));
    } catch {
        return [];
    }
}

async function fetchApiEventDetail(
    slug: string,
): Promise<EventDetailDto> {
    try {
        const res = await fetch(
            new URL(`/api/events/${slug}`, API_BASE).toString(),
            { cache: "no-store" },
        );
        if (!res.ok) return null;
        const json = (await res.json()) as EventDetailDto;
        return json;
    } catch {
        return null;
    }
}

async function fetchApiMembers(): Promise<Member[]> {
    try {
        const res = await fetch(
            new URL("/api/members?size=999", API_BASE).toString(),
            { cache: "no-store" },
        );
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json)
            ? (json as RawMember[])
            : ((json as { items?: RawMember[] }).items ??
                []);
        return items.map((m) => ({
            slug: m.slug ?? m.id ?? null,
            name: m.name ?? null,
            email: null,
            avatarUrl:
                m.avatarUrl ??
                m.avatar ??
                m.photo ??
                m.image ??
                null,
            avatar: m.avatar ?? m.avatarUrl ?? null,
            headline: m.headline ?? m.shortBio ?? null,
            pending: false,
        }));
    } catch {
        return [];
    }
}

async function fetchApiProjects(): Promise<Project[]> {
    try {
        const res = await fetch(
            new URL("/api/projects?size=999", API_BASE).toString(),
            { cache: "no-store" },
        );
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json)
            ? (json as RawProject[])
            : ((json as { items?: RawProject[] }).items ??
                []);
        return items.map((p) => normalizeProject(p));
    } catch {
        return [];
    }
}

function normalizeBlogFromApi(b: RawBlog): BlogCard | null {
    const images: string[] = Array.isArray(b.images)
        ? b.images
        : Array.isArray(b.photos)
            ? b.photos
            : [];

    const cover =
        b.cover ?? b.imageUrl ?? images[0] ?? null;

    const slug =
        b.slug ?? b.id;
    const title =
        b.title ?? b.name ?? "Untitled";

    if (!slug || !title) return null;

    let tags: string[] = [];

    if (Array.isArray(b.tags)) {
        tags = b.tags;
    } else if (typeof b.tags === "string") {
        tags = b.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    const publishedAt =
        b.publishedAt ?? b.date ?? b.createdAt ?? null;

    return {
        slug: String(slug),
        title: String(title),
        cover,
        summary: b.summary ?? null,
        publishedAt,
        tags,
    };
}

async function fetchBlogsForEventSlug(
    eventSlug: string,
): Promise<BlogCard[]> {
    if (!eventSlug) return [];

    const parseResponse = (json: BlogsApiResponse): RawBlog[] => {
        if (!json) return [];
        if (Array.isArray(json)) return json;
        return json.items ?? [];
    };

    const tryParam = async (
        paramName: "eventSlug" | "event",
    ): Promise<BlogCard[]> => {
        try {
            const url = new URL("/api/blogs", API_BASE);
            url.searchParams.set(paramName, eventSlug);
            url.searchParams.set("size", "6");
            const res = await fetch(url.toString(), {
                cache: "no-store",
            });
            if (!res.ok) return [];
            const json = (await res.json()) as BlogsApiResponse;
            const items = parseResponse(json);
            return items
                .map(normalizeBlogFromApi)
                .filter(
                    (b): b is BlogCard => b !== null,
                );
        } catch {
            return [];
        }
    };

    const viaEventSlug = await tryParam("eventSlug");
    if (viaEventSlug.length) return viaEventSlug;
    const viaEvent = await tryParam("event");
    return viaEvent;
}

function normalizeEvent(e: RawEvent): Event {
    return {
        id: String(e.id ?? e.slug ?? ""),
        slug: String(e.slug ?? e.id ?? ""),
        name:
            e.name ??
            String(e.slug ?? e.id ?? ""),
        dateStart: e.dateStart ?? undefined,
        dateEnd: e.dateEnd ?? undefined,
        locationName: e.locationName ?? undefined,
        lat:
            typeof e.lat === "number"
                ? e.lat
                : typeof e.lat === "string"
                    ? Number(e.lat)
                    : undefined,
        lng:
            typeof e.lng === "number"
                ? e.lng
                : typeof e.lng === "string"
                    ? Number(e.lng)
                    : undefined,
        description: e.description ?? undefined,
        photos: Array.isArray(e.photos)
            ? e.photos
            : undefined,
        tags: Array.isArray(e.tags) ? e.tags : undefined,
    };
}

function mergeEvent(
    seed?: Event,
    api?: Partial<Event> | null,
): Event | null {
    if (!seed && !api) return null;
    const s: Event =
        seed ??
        ({
            id: "",
            slug: "",
            name: "",
        } as Event);
    const a = api ?? {};
    return {
        id: String(a.id ?? s.id ?? s.slug),
        slug: String(a.slug ?? s.slug),
        name: String(a.name ?? s.name),
        dateStart: a.dateStart ?? s.dateStart,
        dateEnd: a.dateEnd ?? s.dateEnd,
        locationName:
            a.locationName ?? s.locationName,
        lat:
            typeof a.lat === "number"
                ? a.lat
                : s.lat,
        lng:
            typeof a.lng === "number"
                ? a.lng
                : s.lng,
        description:
            a.description ?? s.description,
        photos:
            Array.isArray(a.photos) && a.photos.length
                ? a.photos
                : s.photos,
        tags:
            Array.isArray(a.tags) && a.tags.length
                ? a.tags
                : s.tags,
    };
}

async function getEvent(slug: string): Promise<Event | null> {
    const fromApi = await fetchApiEvents();
    const seed = SEED_EVENTS.find(
        (e) => e.slug === slug,
    );
    const api = fromApi.find(
        (e) => e.slug === slug,
    );
    return mergeEvent(seed, api);
}

/* --------------------------------- Page --------------------------------- */

export default async function EventDetailPage({
                                                  params,
                                              }: {
    params: { slug: string };
}) {
    const baseEvent = await getEvent(params.slug); // merged API list + seeds (for coords/photos)
    if (!baseEvent) {
        return (
            <section className="section">
                <h1 className="display">
                    {tServer("events.edit.notFound.title")}
                </h1>
                <p className="mt-4">
                    <Link
                        href="/events"
                        className="underline underline-offset-4"
                    >
                        {tServer(
                            "events.edit.notFound.back",
                        )}
                    </Link>
                </p>
            </section>
        );
    }

    // Prefer attendees/projects/blogs directly from the API detail:
    const evDetail = await fetchApiEventDetail(
        params.slug,
    );

    const creatorSlug =
        evDetail?.attendees?.find(
            (a) => a.role === "CREATOR" && a.slug,
        )?.slug ?? null;

    // Members for avatars in the "tiny team row" under projects:
    const membersFromApi = await fetchApiMembers();
    const membersFromSeeds: Member[] =
        SEED_MEMBERS.map((m: SeedMember) => ({
            slug: m.slug,
            name: m.name,
            email: null,
            avatarUrl:
                m.avatarUrl ?? m.avatar ?? null,
            avatar: m.avatar ?? null,
            headline:
                (m as SeedMember & {
                    headline?: string | null;
                }).headline ?? m.shortBio,
            pending: false,
        }));
    const membersAll = dedupeBy(
        [...membersFromApi, ...membersFromSeeds],
        (m) => m.slug ?? "",
    );
    const memMap = new Map(
        membersAll.map((m) => [m.slug ?? "", m]),
    );

    // Attendees:
    const attendees: Member[] =
        evDetail?.attendees && evDetail.attendees.length
            ? evDetail.attendees.map((a) => {
                const slug = a.slug ?? null;
                const fromMembers = slug
                    ? memMap.get(slug)
                    : undefined;

                return {
                    slug,
                    // prefer full member data, fall back to what the event API has
                    name:
                        fromMembers?.name ??
                        a.name ??
                        null,
                    email:
                        fromMembers?.email ??
                        a.email ??
                        null,
                    avatarUrl:
                        fromMembers?.avatarUrl ??
                        fromMembers?.avatar ??
                        a.avatarUrl ??
                        null,
                    avatar:
                        fromMembers?.avatar ??
                        fromMembers?.avatarUrl ??
                        null,
                    headline:
                        fromMembers?.headline ??
                        a.headline ??
                        null,
                    pending: a.pending ?? false,
                };
            })
            : // Fallback to old behavior (seed-based) only if API has none:
            membersAll.filter((m) =>
                (SEED_MEMBERS.find(
                        (s) => s.slug === m.slug,
                    )?.events || []
                ).some(
                    (x) => x.slug === baseEvent.slug,
                ),
            );

    // Projects at this event (many-to-many via API detail or fallback to seeds)
    let projectsForEvent: Project[] = [];
    if (evDetail?.projects && evDetail.projects.length) {
        projectsForEvent = evDetail.projects.map(
            (p) => ({
                id: p.slug,
                slug: p.slug,
                title: p.title,
                imageUrl:
                    p.imageUrl ?? p.cover ?? undefined,
                year:
                    (p.year ??
                        undefined) as number | undefined,
                summary:
                    p.summary ?? undefined,
                techStack:
                    (p.techStack ?? p.tech ?? []) ||
                    [],
                members:
                    p.members?.map((r) => ({
                        memberSlug: r.memberSlug,
                        memberId: r.memberId,
                        role: undefined,
                    })) || [],
                tags: undefined,
                description: undefined,
                cover:
                    p.cover ?? p.imageUrl ?? undefined,
                demoUrl: undefined,
                repoUrl: undefined,
                events: [],
                gallery: [],
            }),
        );
    } else {
        // Fallback to previous merge if API detail didn't include projects
        const apiProjects = await fetchApiProjects();
        const allProjects = mergeProjects(
            apiProjects,
            SEED_PROJECTS,
        );
        projectsForEvent = allProjects.filter((p) =>
            (p.events || []).some(
                (e) => e.slug === baseEvent.slug,
            ),
        );
    }

    // Blog posts about this event — only use blogs directly connected via the event detail API.
    let blogsForEvent: BlogCard[] = [];
    if (evDetail?.blogs && evDetail.blogs.length) {
        const seen = new Set<string>();
        blogsForEvent = evDetail.blogs
            .map((b) => {
                const images: string[] = [];
                const cover =
                    b.cover ??
                    b.imageUrl ??
                    images[0] ??
                    null;
                const slug = b.slug;
                const title = b.title;
                if (!slug || !title) return null;
                return {
                    slug,
                    title,
                    cover,
                    summary: b.summary ?? null,
                    publishedAt:
                        b.publishedAt ?? null,
                    tags: Array.isArray(b.tags)
                        ? b.tags
                        : [],
                } as BlogCard;
            })
            .filter((b): b is BlogCard => {
                if (!b) return false;
                if (!b.slug) return false;
                if (seen.has(b.slug)) return false;
                seen.add(b.slug);
                return true;
            });
    } else {
        // If event-detail API doesn't carry blogs, we can fall back to the dedicated endpoint
        blogsForEvent = await fetchBlogsForEventSlug(
            baseEvent.slug,
        );
    }

    const photos = baseEvent.photos || [];
    const cover = photos[0];

    const pendingLabel = tServer(
        "events.detail.attendees.pendingInvite",
    );
    const unknownLabel = tServer(
        "events.detail.attendees.unknown",
    );

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">
                    {tServer("events.detail.kicker")}
                </p>
                <div className="flex items-center justify-between gap-4">
                    <h1 className="display">
                        {baseEvent.name}
                    </h1>
                    <EditEventButton
                        slug={baseEvent.slug}
                        creatorSlug={creatorSlug}
                    />
                </div>
                <div className="mt-2 text-white/70 text-sm">
                    {baseEvent.locationName
                        ? `${baseEvent.locationName} • `
                        : ""}
                    {baseEvent.dateStart
                        ? new Date(
                            baseEvent.dateStart,
                        ).toLocaleDateString()
                        : ""}
                    {baseEvent.dateEnd
                        ? ` – ${new Date(
                            baseEvent.dateEnd,
                        ).toLocaleDateString()}`
                        : ""}
                </div>
            </header>

            {cover && (
                <div className="mb-6">
                    <img
                        src={cover}
                        alt={baseEvent.name}
                        className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10"
                    />
                </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <article className="lg:col-span-3 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">
                            {
                                tServer(
                                    "events.detail.about.title",
                                )
                            }
                        </h2>
                        {baseEvent.description ? (
                            <MarkdownPreview
                                markdown={
                                    baseEvent.description
                                }
                            />
                        ) : (
                            <p className="text-white/60">
                                {
                                    tServer(
                                        "events.detail.about.empty",
                                    )
                                }
                            </p>
                        )}

                        {baseEvent.tags &&
                            baseEvent.tags.length >
                            0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {baseEvent.tags
                                        .slice(0, 12)
                                        .map((t) => (
                                            <span
                                                key={t}
                                                className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                </div>
                            )}
                    </div>

                    {/* Map */}
                    {typeof baseEvent.lng ===
                        "number" &&
                        typeof baseEvent.lat ===
                        "number" && (
                            <div className="card p-0 overflow-hidden">
                                <EventsMap
                                    events={[baseEvent]}
                                />
                            </div>
                        )}

                    {/* Projects at this event */}
                    {projectsForEvent.length >
                        0 && (
                            <div className="card p-5">
                                <h2 className="text-lg font-semibold mb-3">
                                    {
                                        tServer(
                                            "events.detail.projects.title",
                                        )
                                    }
                                </h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {projectsForEvent.map(
                                        (p) => (
                                            <Link
                                                key={p.slug}
                                                href={`/projects/${p.slug}`}
                                                className="flex gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                                            >
                                                {p.imageUrl && (
                                                    <img
                                                        src={
                                                            p.imageUrl
                                                        }
                                                        alt={
                                                            p.title
                                                        }
                                                        className="w-32 h-24 object-cover rounded-md ring-1 ring-white/10"
                                                    />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-semibold leading-tight hover:underline">
                                                        {
                                                            p.title
                                                        }
                                                    </div>
                                                    {typeof p.year ===
                                                        "number" && (
                                                            <div className="text-xs text-white/60 mt-0.5">
                                                                {
                                                                    p.year
                                                                }
                                                            </div>
                                                        )}
                                                    {p.summary && (
                                                        <div className="text-sm text-white/70 mt-1 line-clamp-3">
                                                            {
                                                                p.summary
                                                            }
                                                        </div>
                                                    )}

                                                    {/* tiny team row */}
                                                    {p.members &&
                                                        p.members
                                                            .length >
                                                        0 && (
                                                            <div className="mt-2 flex -space-x-2">
                                                                {p.members
                                                                    .slice(
                                                                        0,
                                                                        5,
                                                                    )
                                                                    .map(
                                                                        (
                                                                            ref,
                                                                            i,
                                                                        ) => {
                                                                            const slug =
                                                                                ref.memberSlug ??
                                                                                ref.memberId ??
                                                                                "";
                                                                            const m =
                                                                                slug
                                                                                    ? memMap.get(
                                                                                        slug,
                                                                                    )
                                                                                    : undefined;
                                                                            const avatarSrc =
                                                                                m?.avatarUrl ??
                                                                                m?.avatar ??
                                                                                "/avatars/default.png";
                                                                            const title =
                                                                                m?.name ??
                                                                                slug;
                                                                            return (
                                                                                <span
                                                                                    key={`${slug}-${i}`}
                                                                                    className="inline-block"
                                                                                >
                                                                                <img
                                                                                    src={
                                                                                        avatarSrc
                                                                                    }
                                                                                    alt={
                                                                                        title
                                                                                    }
                                                                                    title={
                                                                                        title
                                                                                    }
                                                                                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                                                                                />
                                                                            </span>
                                                                            );
                                                                        },
                                                                    )}
                                                            </div>
                                                        )}

                                                    {/* tech chips */}
                                                    {p.techStack &&
                                                        p.techStack
                                                            .length >
                                                        0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {p.techStack
                                                                    .slice(
                                                                        0,
                                                                        6,
                                                                    )
                                                                    .map(
                                                                        (
                                                                            t,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    t
                                                                                }
                                                                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10"
                                                                            >
                                                                            {
                                                                                t
                                                                            }
                                                                        </span>
                                                                        ),
                                                                    )}
                                                            </div>
                                                        )}
                                                </div>
                                            </Link>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}

                    {/* Blog posts about this event */}
                    {blogsForEvent.length >
                        0 && (
                            <div className="card p-5">
                                <h2 className="text-lg font-semibold mb-3">
                                    {
                                        tServer(
                                            "events.detail.blogs.title",
                                        )
                                    }
                                </h2>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {blogsForEvent.map(
                                        (post) => (
                                            <Link
                                                key={
                                                    post.slug
                                                }
                                                href={`/blog/${post.slug}`}
                                                className="flex gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                                            >
                                                {post.cover && (
                                                    <img
                                                        src={
                                                            post.cover
                                                        }
                                                        alt={
                                                            post.title
                                                        }
                                                        className="w-28 h-24 object-cover rounded-md ring-1 ring-white/10 flex-shrink-0"
                                                    />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="font-semibold leading-tight hover:underline">
                                                        {
                                                            post.title
                                                        }
                                                    </div>
                                                    {post.publishedAt && (
                                                        <div className="text-xs text-white/60 mt-0.5">
                                                            {new Date(
                                                                post.publishedAt,
                                                            ).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                    {post.summary && (
                                                        <div className="text-sm text-white/70 mt-1 line-clamp-3">
                                                            {
                                                                post.summary
                                                            }
                                                        </div>
                                                    )}
                                                    {post.tags &&
                                                        post.tags
                                                            .length >
                                                        0 && (
                                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                                {post.tags
                                                                    .slice(
                                                                        0,
                                                                        4,
                                                                    )
                                                                    .map(
                                                                        (
                                                                            t,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    t
                                                                                }
                                                                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10"
                                                                            >
                                                                            {
                                                                                t
                                                                            }
                                                                        </span>
                                                                        ),
                                                                    )}
                                                            </div>
                                                        )}
                                                </div>
                                            </Link>
                                        ),
                                    )}
                                </div>
                            </div>
                        )}

                    {photos.length > 1 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">
                                {
                                    tServer(
                                        "events.detail.gallery.title",
                                    )
                                }
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {photos
                                    .slice(1)
                                    .map((src, i) => (
                                        <img
                                            key={src}
                                            src={src}
                                            alt={tServer(
                                                "events.detail.gallery.photoAlt",
                                            )
                                                .replace(
                                                    "{name}",
                                                    baseEvent.name,
                                                )
                                                .replace(
                                                    "{index}",
                                                    String(
                                                        i +
                                                        2,
                                                    ),
                                                )}
                                            className="w-full h-32 object-cover rounded-md ring-1 ring-white/10"
                                        />
                                    ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="lg:col-span-2 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">
                            {
                                tServer(
                                    "events.detail.attendees.title",
                                )
                            }
                        </h2>
                        {attendees.length === 0 ? (
                            <p className="text-white/60">
                                {
                                    tServer(
                                        "events.detail.attendees.empty",
                                    )
                                }
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {attendees.map(
                                    (m, idx) => {
                                        const key =
                                            m.slug ??
                                            m.email ??
                                            String(idx);
                                        const hasSlug =
                                            !!m.slug;
                                        const fallbackName =
                                            hasSlug
                                                ? unknownLabel
                                                : pendingLabel;
                                        const displayName = m.slug
                                            ? m.name ??
                                            m.email ??
                                            fallbackName
                                            : m.name ??
                                            m.email ??
                                            pendingLabel;
                                        const avatar =
                                            m.avatarUrl ??
                                            m.avatar ??
                                            "/avatars/default.png";
                                        return (
                                            <li
                                                key={
                                                    key
                                                }
                                                className="flex items-center gap-3"
                                            >
                                                <img
                                                    src={
                                                        avatar
                                                    }
                                                    alt={
                                                        displayName
                                                    }
                                                    className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                                />
                                                <div className="min-w-0">
                                                    {m.slug ? (
                                                        <Link
                                                            href={`/members/${m.slug}`}
                                                            className="font-medium hover:underline"
                                                        >
                                                            {
                                                                displayName
                                                            }
                                                        </Link>
                                                    ) : (
                                                        <span className="font-medium">
                                                            {
                                                                displayName
                                                            }
                                                        </span>
                                                    )}
                                                    <div className="text-xs text-white/60 truncate">
                                                        {m.pending
                                                            ? pendingLabel
                                                            : m.headline ||
                                                            ""}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    },
                                )}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>

            <div className="mt-8">
                <Link
                    href="/events"
                    className="underline underline-offset-4"
                >
                    {tServer("events.detail.backToAll")}
                </Link>
            </div>
        </section>
    );
}

/* --------------------------------- utils --------------------------------- */

function dedupeBy<T>(
    arr: T[],
    key: (
        x: T,
    ) =>
        | string
        | number
        | undefined
        | null,
): T[] {
    const map = new Map<string | number, T>();
    for (const item of arr) {
        const k = key(item);
        if (
            k === undefined ||
            k === null
        )
            continue;
        if (!map.has(k)) map.set(k, item);
    }
    return Array.from(map.values());
}
