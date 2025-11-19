"use client";

/* eslint-disable @next/next/no-img-element */

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import * as api from "@/lib/api";
import EventsMap from "@/components/EventsMap";
import { API_BASE } from "@/lib/config";
import { tClient } from "@/lib/i18n-client";

/* ----------------------- Tiny Markdown renderer ----------------------- */

function MarkdownPreview({ markdown }: { markdown: string }) {
    const src = (markdown || "").replace(/\r\n/g, "\n");

    function splitFenced(
        input: string,
    ): Array<{ type: "text" | "code"; content: string; lang?: string }> {
        const out: Array<{ type: "text" | "code"; content: string; lang?: string }> = [];
        const fence = /```(\w+)?\n([\s\S]*?)```/g;
        let lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = fence.exec(input))) {
            if (m.index > lastIndex) {
                out.push({ type: "text", content: input.slice(lastIndex, m.index) });
            }
            out.push({
                type: "code",
                content: m[2].replace(/\n$/, ""),
                lang: m[1],
            });
            lastIndex = fence.lastIndex;
        }
        if (lastIndex < input.length) {
            out.push({ type: "text", content: input.slice(lastIndex) });
        }
        return out;
    }

    function splitInline(
        text: string,
        re: RegExp,
    ): Array<string | { code: string }> {
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

    function splitLinks(
        text: string,
    ): Array<string | { label: string; href: string }> {
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
                    <code
                        key={`code-${idx}`}
                        className="px-1 rounded bg-white/10 text-white/90"
                    >
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
                const parts = splitInline(s, /\*([^*]+)\*/);
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
                while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                    const item = lines[i].replace(/^\s*\d+\.\s+/, "");
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
                while (i < lines.length && /^\s*([-*+])\s+/.test(lines[i])) {
                    const item = lines[i].replace(/^\s*([-*+])\s+/, "");
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
    if (!src.trim()) {
        return (
            <p className="text-white/50 text-sm">
                {tClient("events.edit.markdown.empty")}
            </p>
        );
    }
    return (
        <div className="space-y-3 leading-relaxed text-white/90">
            {segments.map((seg, i) =>
                seg.type === "code" ? (
                    <pre
                        key={`code-${i}`}
                        className="overflow-x-auto rounded-md bg-white/5 ring-1 ring-white/10 p-3 text-[13px] leading-relaxed"
                        aria-label={
                            seg.lang
                                ? tClient(
                                    "events.edit.markdown.codeBlockWithLang",
                                ).replace("{lang}", seg.lang)
                                : tClient("events.edit.markdown.codeBlock")
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

/* ----------------------------- Geocoding ----------------------------- */

type SearchHit = {
    display_name: string;
    lat: string;
    lon: string;
};

async function geocode(
    q: string,
    signal?: AbortSignal,
): Promise<SearchHit[]> {
    if (!q.trim()) return [];
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("email", "noreply@pum.local");

    const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal,
    });
    if (!res.ok) return [];
    return (await res.json()) as SearchHit[];
}

/* ----------------------------- Form types ---------------------------- */

type FormState = {
    name: string;
    locationName: string;
    dateStart: string;
    dateEnd: string;
    lat: string;
    lng: string;
    description: string;
};

type Errors = Partial<Record<keyof FormState | "photos", string>>;

type Member = {
    id: string;
    slug: string;
    name: string;
    avatarUrl?: string;
    headline?: string;
    email?: string;
};

type Attendee =
    | { kind: "member"; member: Member }
    | { kind: "invite"; value: string };

type ProjectRef = {
    id: string;
    slug: string;
    title: string;
    cover?: string | null;
    year?: number | null;
    summary?: string | null;
};

type BlogRef = {
    slug: string;
    title: string;
    cover?: string | null;
    summary?: string | null;
    publishedAt?: string | null;
};

/* --------------------------- Raw API types --------------------------- */

type RawMember = {
    id?: string;
    slug?: string;
    name?: string;
    avatarUrl?: string | null;
    avatar?: string | null;
    photo?: string | null;
    image?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    email?: string | null;
};

type MembersResponse = RawMember[] | { items?: RawMember[] };

type RawProject = {
    id?: string;
    slug?: string;
    title?: string;
    cover?: string | null;
    imageUrl?: string | null;
    year?: number | string | null;
    summary?: string | null;
};

type ProjectsResponse = RawProject[] | { items?: RawProject[] };

type RawBlogSummary = {
    id?: string | number;
    slug?: string | number;
    title?: string;
    name?: string;
    summary?: string | null;
    cover?: string | null;
    imageUrl?: string | null;
    images?: string[];
    photos?: string[];
    publishedAt?: string | null;
    date?: string | null;
    createdAt?: string | null;
};

type BlogsResponse = RawBlogSummary[] | { items?: RawBlogSummary[] };

type RawEventAttendee = {
    pending?: boolean;
    email?: string | null;
    slug?: string | null;
    memberSlug?: string | null;
    memberId?: string | null;
    id?: string | null;
    name?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    avatar?: string | null;
    photo?: string | null;
    headline?: string | null;
    title?: string | null;
    role?: string | null;
};

type RawEventProjectRef = {
    slug?: string | null;
};

type RawEventBlogRef = {
    slug?: string | null;
};

type RawEvent = {
    name?: string | null;
    locationName?: string | null;
    dateStart?: string | null;
    dateEnd?: string | null;
    lat?: number | string | null;
    lng?: number | string | null;
    description?: string | null;
    photos?: string[];
    attendees?: RawEventAttendee[];
    projects?: RawEventProjectRef[];
    blogs?: RawEventBlogRef[];
};

/* ---------------------------- Map preview ---------------------------- */

function MapPreview({
                        name,
                        locationName,
                        dateStart,
                        lat,
                        lng,
                    }: {
    name: string;
    locationName: string;
    dateStart: string;
    lat: string;
    lng: string;
}) {
    const hasCoords =
        !!lat && !!lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));

    if (!hasCoords) {
        return (
            <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3 text-xs text-white/60">
                {tClient("events.edit.map.noCoords")}
            </div>
        );
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    const previewEvent = {
        id: "event-preview",
        slug: "event-preview",
        name: name || tClient("events.edit.map.previewFallbackName"),
        locationName: locationName || undefined,
        dateStart: dateStart || undefined,
        lat: latNum,
        lng: lngNum,
        description: undefined,
        photos: [] as string[],
        tags: [] as string[],
    };

    return (
        <div className="rounded-md bg-black overflow-hidden ring-1 ring-white/10">
            <EventsMap events={[previewEvent]} />
        </div>
    );
}

/* ------------------------------ Page ------------------------------ */

type Props = { params: { slug: string } };

function isMemberAttendee(a: Attendee): a is { kind: "member"; member: Member } {
    return a.kind === "member";
}

export default function EditEventPage({ params }: Props) {
    const { user, accessToken } = useAuth();
    const router = useRouter();

    const [state, setState] = React.useState<FormState>({
        name: "",
        locationName: "",
        dateStart: "",
        dateEnd: "",
        lat: "",
        lng: "",
        description: "",
    });

    const [existingPhotos, setExistingPhotos] = React.useState<string[]>([]);
    const [photos, setPhotos] = React.useState<File[]>([]);

    // header selection: either an existing photo index or a new photo index
    const [headerExistingIndex, setHeaderExistingIndex] =
        React.useState<number | null>(null);
    const [headerNewIndex, setHeaderNewIndex] =
        React.useState<number | null>(null);

    const [searchQ, setSearchQ] = React.useState("");
    const [hits, setHits] = React.useState<SearchHit[]>([]);
    const [searching, setSearching] = React.useState(false);

    const [members, setMembers] = React.useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(true);
    const [membersError, setMembersError] = React.useState<string | null>(null);

    const [attendees, setAttendees] = React.useState<Attendee[]>([]);
    const [attendeeQ, setAttendeeQ] = React.useState("");

    const [projects, setProjects] = React.useState<ProjectRef[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(true);
    const [projectsError, setProjectsError] = React.useState<string | null>(null);
    const [selectedProjectSlugs, setSelectedProjectSlugs] = React.useState<string[]>([]);
    const [projectQ, setProjectQ] = React.useState("");

    const [blogs, setBlogs] = React.useState<BlogRef[]>([]);
    const [blogsLoading, setBlogsLoading] = React.useState(true);
    // blogs are optional, we intentionally do NOT show a red error if this fails
    const [selectedBlogSlugs, setSelectedBlogSlugs] = React.useState<string[]>([]);
    const [blogQ, setBlogQ] = React.useState("");

    const [errors, setErrors] = React.useState<Errors>({});
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [hint, setHint] = React.useState<string | null>(null);

    const [loadingEvent, setLoadingEvent] = React.useState(true);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [creatorSlug, setCreatorSlug] = React.useState<string | null>(null);

    // delete confirmation state
    const [deleteConfirmSlug, setDeleteConfirmSlug] = React.useState("");
    const [deleting, setDeleting] = React.useState(false);

    /* -------------------- live map search (debounced) -------------------- */

    React.useEffect(() => {
        if (!searchQ.trim()) {
            setHits([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const controller = new AbortController();
        const handle = window.setTimeout(async () => {
            try {
                const results = await geocode(searchQ, controller.signal);
                setHits(results);
            } catch {
                // swallow errors; aborts and network issues are non-fatal here
            } finally {
                setSearching(false);
            }
        }, 250); // debounce

        return () => {
            window.clearTimeout(handle);
            controller.abort();
        };
    }, [searchQ]);

    /* -------------------- load members for attendee picker -------------------- */

    React.useEffect(() => {
        let cancelled = false;

        async function loadMembers() {
            try {
                const res = await fetch("/api/members?size=999");
                if (!res.ok) throw new Error("Failed to load members");
                const json = (await res.json()) as MembersResponse;
                const items: RawMember[] = Array.isArray(json)
                    ? json
                    : json.items ?? [];
                const mapped: Member[] = items.map((m) => ({
                    id: (m.id ?? m.slug ?? "") as string,
                    slug: (m.slug ?? m.id ?? "") as string,
                    name: m.name ?? "",
                    avatarUrl:
                        m.avatarUrl ??
                        m.avatar ??
                        m.photo ??
                        m.image ??
                        undefined,
                    headline: m.headline ?? m.shortBio ?? undefined,
                    email: m.email ?? undefined,
                }));
                if (!cancelled) {
                    setMembers(mapped);
                    setMembersError(null);
                }
            } catch {
                if (!cancelled) {
                    setMembersError(tClient("events.edit.members.error"));
                }
            } finally {
                if (!cancelled) setMembersLoading(false);
            }
        }

        loadMembers();
        return () => {
            cancelled = true;
        };
    }, []);

    /* -------------------- load projects for project picker -------------------- */

    React.useEffect(() => {
        let cancelled = false;

        async function loadProjects() {
            try {
                const res = await fetch("/api/projects?size=999");
                if (!res.ok) throw new Error("Failed to load projects");
                const json = (await res.json()) as ProjectsResponse;
                const items: RawProject[] = Array.isArray(json)
                    ? json
                    : json.items ?? [];
                const mapped: ProjectRef[] = items.map((p) => ({
                    id: (p.id ?? p.slug ?? "") as string,
                    slug: (p.slug ?? p.id ?? "") as string,
                    title: p.title ?? (p.slug ?? "") ?? "",
                    cover: p.cover ?? p.imageUrl ?? null,
                    year:
                        typeof p.year === "number"
                            ? p.year
                            : typeof p.year === "string"
                                ? Number(p.year)
                                : null,
                    summary: p.summary ?? null,
                }));
                if (!cancelled) {
                    setProjects(mapped);
                    setProjectsError(null);
                }
            } catch {
                if (!cancelled) {
                    setProjectsError(tClient("events.edit.projects.error"));
                }
            } finally {
                if (!cancelled) setProjectsLoading(false);
            }
        }

        loadProjects();
        return () => {
            cancelled = true;
        };
    }, []);

    /* -------------------- load blogs for blog picker -------------------- */

    React.useEffect(() => {
        let cancelled = false;

        async function loadBlogs() {
            try {
                const res = await fetch("/api/blogs?size=999");
                if (!res.ok) throw new Error("Failed to load blogs");
                const json = (await res.json()) as BlogsResponse;
                const items: RawBlogSummary[] = Array.isArray(json)
                    ? json
                    : json.items ?? [];
                const mapped: BlogRef[] = items
                    .map((b) => {
                        const images: string[] = Array.isArray(b.images)
                            ? b.images
                            : Array.isArray(b.photos)
                                ? b.photos
                                : [];
                        const cover = b.cover ?? b.imageUrl ?? images[0] ?? null;
                        return {
                            slug: String(b.slug ?? b.id ?? ""),
                            title: String(b.title ?? b.name ?? "Untitled"),
                            cover,
                            summary: b.summary ?? null,
                            publishedAt:
                                b.publishedAt ?? b.date ?? b.createdAt ?? null,
                        };
                    })
                    .filter((b) => !!b.slug && !!b.title);
                if (!cancelled) {
                    setBlogs(mapped);
                }
            } catch {
                if (!cancelled) {
                    // blogs are optional; we do NOT surface a red error
                }
            } finally {
                if (!cancelled) setBlogsLoading(false);
            }
        }

        loadBlogs();
        return () => {
            cancelled = true;
        };
    }, []);

    /* ------------------------- load existing event ------------------------- */

    React.useEffect(() => {
        let cancelled = false;

        async function loadEvent() {
            setLoadingEvent(true);
            setLoadError(null);
            try {
                const url = new URL(
                    `/api/events/${encodeURIComponent(params.slug)}`,
                    API_BASE,
                );
                const res = await fetch(url.toString(), {
                    credentials: "include",
                });
                if (!res.ok) {
                    if (!cancelled) {
                        if (res.status === 404) setLoadError("not-found");
                        else setLoadError(tClient("events.edit.load.error.generic"));
                    }
                    return;
                }
                const ev = (await res.json()) as RawEvent;
                if (cancelled) return;

                const toInputValue = (iso: string | null | undefined): string => {
                    if (!iso) return "";
                    const d = new Date(iso);
                    if (Number.isNaN(d.getTime())) return "";
                    const pad = (n: number) => n.toString().padStart(2, "0");
                    return `${d.getFullYear()}-${pad(
                        d.getMonth() + 1,
                    )}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
                        d.getMinutes(),
                    )}`;
                };

                setState((prev) => ({
                    ...prev,
                    name: ev.name || "",
                    locationName: ev.locationName || "",
                    dateStart: toInputValue(ev.dateStart ?? null),
                    dateEnd: toInputValue(ev.dateEnd ?? null),
                    lat:
                        typeof ev.lat === "number"
                            ? String(ev.lat)
                            : ev.lat
                                ? String(ev.lat)
                                : "",
                    lng:
                        typeof ev.lng === "number"
                            ? String(ev.lng)
                            : ev.lng
                                ? String(ev.lng)
                                : "",
                    description: ev.description || "",
                }));

                if (Array.isArray(ev.photos)) {
                    setExistingPhotos(ev.photos);
                    if (ev.photos.length > 0) {
                        // assume first photo is current header
                        setHeaderExistingIndex(0);
                        setHeaderNewIndex(null);
                    }
                } else {
                    setExistingPhotos([]);
                    setHeaderExistingIndex(null);
                    setHeaderNewIndex(null);
                }

                const attendeesFromApi: RawEventAttendee[] = Array.isArray(
                    ev.attendees,
                )
                    ? ev.attendees
                    : [];

                const pendingInvites = attendeesFromApi.filter(
                    (a) => a.pending && a.email,
                );
                const memberAttendees = attendeesFromApi.filter(
                    (a) => !a.pending && (a.slug || a.memberSlug || a.memberId),
                );

                setAttendees([
                    ...memberAttendees.map<Attendee>((a) => ({
                        kind: "member",
                        member: {
                            id: a.memberId ?? a.id ?? a.slug ?? "",
                            slug: a.slug ?? a.memberSlug ?? a.id ?? "",
                            name: a.name ?? a.displayName ?? "Unknown",
                            avatarUrl:
                                a.avatarUrl ??
                                a.avatar ??
                                a.photo ??
                                undefined,
                            headline: a.headline ?? a.title ?? undefined,
                            email: a.email ?? undefined,
                        },
                    })),
                    ...pendingInvites.map<Attendee>((a) => ({
                        kind: "invite",
                        value: String(a.email),
                    })),
                ]);

                const creator = attendeesFromApi.find(
                    (a) =>
                        a.role === "CREATOR" &&
                        (a.slug || a.memberSlug),
                );
                setCreatorSlug(
                    (creator?.slug ?? creator?.memberSlug) ?? null,
                );

                // preselect related projects
                if (Array.isArray(ev.projects)) {
                    const slugs = ev.projects
                        .map((p) => p?.slug)
                        .filter((s): s is string => typeof s === "string");
                    setSelectedProjectSlugs(Array.from(new Set(slugs)));
                }

                // preselect related blogs, if API returns them
                if (Array.isArray(ev.blogs)) {
                    const slugs = ev.blogs
                        .map((b) => b?.slug)
                        .filter((s): s is string => typeof s === "string");
                    setSelectedBlogSlugs(Array.from(new Set(slugs)));
                }
            } catch {
                if (!cancelled)
                    setLoadError(tClient("events.edit.load.error.generic"));
            } finally {
                if (!cancelled) setLoadingEvent(false);
            }
        }

        loadEvent();
        return () => {
            cancelled = true;
        };
    }, [params.slug]);

    /* -------------------------- attendee helpers -------------------------- */

    const normalizedAttendeeQ = attendeeQ.trim().toLowerCase();
    const attendeeSuggestions = React.useMemo(() => {
        const alreadyIds = new Set(
            attendees
                .filter(isMemberAttendee)
                .map((a) => a.member.id),
        );
        return members
            .filter((m) => {
                if (alreadyIds.has(m.id)) return false;
                if (!normalizedAttendeeQ) return true;
                const h = m.headline || "";
                const email = m.email || "";
                return (
                    m.name.toLowerCase().includes(normalizedAttendeeQ) ||
                    m.slug.toLowerCase().includes(normalizedAttendeeQ) ||
                    h.toLowerCase().includes(normalizedAttendeeQ) ||
                    email.toLowerCase().includes(normalizedAttendeeQ)
                );
            })
            .slice(0, 8);
    }, [attendees, members, normalizedAttendeeQ]);

    // Projects helpers
    const normalizedProjectQ = projectQ.trim().toLowerCase();
    const projectSuggestions = React.useMemo(() => {
        const already = new Set(selectedProjectSlugs);
        return projects
            .filter((p) => {
                if (already.has(p.slug)) return false;
                if (!normalizedProjectQ) return true;
                const summary = p.summary || "";
                const year = p.year ? String(p.year) : "";
                return (
                    p.title.toLowerCase().includes(normalizedProjectQ) ||
                    summary.toLowerCase().includes(normalizedProjectQ) ||
                    year.includes(normalizedProjectQ)
                );
            })
            .slice(0, 20);
    }, [projects, selectedProjectSlugs, normalizedProjectQ]);

    const selectedProjects = React.useMemo(
        () =>
            selectedProjectSlugs
                .map((slug) => projects.find((p) => p.slug === slug))
                .filter((p): p is ProjectRef => !!p),
        [selectedProjectSlugs, projects],
    );

    // Blogs helpers
    const normalizedBlogQ = blogQ.trim().toLowerCase();
    const blogSuggestions = React.useMemo(() => {
        const already = new Set(selectedBlogSlugs);
        return blogs
            .filter((b) => {
                if (already.has(b.slug)) return false;
                if (!normalizedBlogQ) return true;
                const summary = b.summary || "";
                return (
                    b.title.toLowerCase().includes(normalizedBlogQ) ||
                    summary.toLowerCase().includes(normalizedBlogQ)
                );
            })
            .slice(0, 20);
    }, [blogs, selectedBlogSlugs, normalizedBlogQ]);

    const selectedBlogs = React.useMemo(
        () =>
            selectedBlogSlugs
                .map((slug) => blogs.find((b) => b.slug === slug))
                .filter((b): b is BlogRef => !!b),
        [selectedBlogSlugs, blogs],
    );

    /* ------------------------------ gating ------------------------------ */

    if (loadingEvent) {
        return (
            <section className="section">
                <h1 className="display">{tClient("events.edit.title")}</h1>
                <p className="mt-3 text-white/70">
                    {tClient("events.edit.loading")}
                </p>
                <p className="mt-4">
                    <Link
                        href="/events"
                        className="underline underline-offset-4"
                    >
                        {tClient("events.edit.backToEvents")}
                    </Link>
                </p>
            </section>
        );
    }

    if (loadError === "not-found") {
        return (
            <section className="section">
                <h1 className="display">{tClient("events.edit.notFound.title")}</h1>
                <p className="mt-3 text-white/70">
                    {tClient("events.edit.notFound.body")}
                </p>
                <p className="mt-4">
                    <Link
                        href="/events"
                        className="underline underline-offset-4"
                    >
                        {tClient("events.edit.backToEvents")}
                    </Link>
                </p>
            </section>
        );
    }

    if (loadError && loadError !== "not-found") {
        return (
            <section className="section">
                <h1 className="display">{tClient("events.edit.title")}</h1>
                <p className="mt-3 text-white/70">{loadError}</p>
                <p className="mt-4">
                    <Link
                        href="/events"
                        className="underline underline-offset-4"
                    >
                        {tClient("events.edit.backToEvents")}
                    </Link>
                </p>
            </section>
        );
    }

    // If not logged in, show friendly gate (API still enforces auth)
    if (!user) {
        return (
            <section className="section">
                <h1 className="display">{tClient("events.edit.title")}</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    {tClient("events.edit.gate.loginRequired")}
                </p>
                <div className="mt-5 flex gap-3">
                    <Link
                        href={`/events/${params.slug}`}
                        className="btn-secondary"
                    >
                        {tClient("events.edit.backToEvent")}
                    </Link>
                    <Link
                        href="/"
                        className="btn-primary"
                    >
                        {tClient("events.edit.loginButton")}
                    </Link>
                </div>
            </section>
        );
    }

    const roles = (user.roles || []) as string[];
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");
    const isCreator =
        !!creatorSlug &&
        user.member &&
        user.member.slug === creatorSlug;
    const canEditEvent = isAdmin || isModerator || isCreator;

    if (!canEditEvent) {
        return (
            <section className="section">
                <h1 className="display">{tClient("events.edit.title")}</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    {tClient("events.edit.gate.noPermission")}
                </p>
                <div className="mt-5 flex gap-3">
                    <Link
                        href={`/events/${params.slug}`}
                        className="btn-secondary"
                    >
                        {tClient("events.edit.backToEvent")}
                    </Link>
                    <Link
                        href="/events"
                        className="btn-primary"
                    >
                        {tClient("events.edit.browseEvents")}
                    </Link>
                </div>
            </section>
        );
    }

    /* --------------------------- form helpers --------------------------- */

    function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
        setState((s) => ({ ...s, [k]: v }));
        setErrors((e) => ({ ...e, [k]: undefined })); // clear on change
    }

    function validate(): Errors {
        const e: Errors = {};
        if (!state.name.trim())
            e.name = tClient("events.edit.validation.nameRequired");
        if (state.dateStart && Number.isNaN(new Date(state.dateStart).getTime()))
            e.dateStart = tClient("events.edit.validation.dateStartInvalid");
        if (state.dateEnd && Number.isNaN(new Date(state.dateEnd).getTime()))
            e.dateEnd = tClient("events.edit.validation.dateEndInvalid");
        if (state.dateStart && state.dateEnd) {
            const a = new Date(state.dateStart).getTime();
            const b = new Date(state.dateEnd).getTime();
            if (a > b) e.dateEnd = tClient("events.edit.validation.dateOrder");
        }

        const totalPhotos = existingPhotos.length + photos.length;
        if (totalPhotos > 12) {
            e.photos = tClient("events.edit.validation.photosTooMany");
        }

        for (const f of photos) {
            const okType = /^image\/(png|jpe?g|webp|gif)$/i.test(f.type);
            if (!okType) {
                e.photos = tClient("events.edit.validation.photosType");
                break;
            }
            if (f.size > 8 * 1024 * 1024) {
                e.photos = tClient("events.edit.validation.photosSize");
                break;
            }
        }
        return e;
    }

    function addMemberAttendee(m: Member) {
        setAttendees((prev) => {
            if (prev.some((a) => a.kind === "member" && a.member.id === m.id)) {
                return prev;
            }
            return [...prev, { kind: "member", member: m }];
        });
        setAttendeeQ("");
    }

    function addInviteAttendee(value: string) {
        const v = value.trim();
        if (!v) return;
        setAttendees((prev) => {
            if (
                prev.some(
                    (a) =>
                        a.kind === "invite" &&
                        a.value.toLowerCase() === v.toLowerCase(),
                )
            ) {
                return prev;
            }
            return [...prev, { kind: "invite", value: v }];
        });
        setAttendeeQ("");
    }

    function removeAttendee(index: number) {
        setAttendees((prev) => prev.filter((_, i) => i !== index));
    }

    function addProject(p: ProjectRef) {
        setSelectedProjectSlugs((prev) =>
            prev.includes(p.slug) ? prev : [...prev, p.slug],
        );
        setProjectQ("");
    }

    function removeProject(slug: string) {
        setSelectedProjectSlugs((prev) => prev.filter((s) => s !== slug));
    }

    function addBlog(b: BlogRef) {
        setSelectedBlogSlugs((prev) =>
            prev.includes(b.slug) ? prev : [...prev, b.slug],
        );
        setBlogQ("");
    }

    function removeBlog(slug: string) {
        setSelectedBlogSlugs((prev) => prev.filter((s) => s !== slug));
    }

    // photo helpers
    function adjustIndexAfterRemoval(
        current: number | null,
        removedIndex: number,
        newLength: number,
    ): number | null {
        if (current == null) return null;
        if (current === removedIndex) {
            return newLength > 0 ? 0 : null;
        }
        if (current > removedIndex) return current - 1;
        return current;
    }

    // append new files instead of replacing the previous selection
    function handleNewPhotos(files: FileList | null) {
        const incoming = Array.from(files || []);
        if (incoming.length === 0) {
            return;
        }

        setPhotos((prev) => {
            const next = [...prev, ...incoming];

            // keep existing header if valid; otherwise default to first new photo if no existing header
            if (next.length === 0) {
                setHeaderNewIndex(null);
            } else if (
                headerExistingIndex == null &&
                (headerNewIndex == null || headerNewIndex >= next.length)
            ) {
                setHeaderNewIndex(0);
            } else if (headerNewIndex != null && headerNewIndex >= next.length) {
                setHeaderNewIndex(0);
            }

            return next;
        });
    }

    function removeExistingPhoto(index: number) {
        setExistingPhotos((prev) => {
            const next = prev.filter((_, i) => i !== index);
            setHeaderExistingIndex((current) =>
                adjustIndexAfterRemoval(current, index, next.length),
            );
            // if we lost the only header and no existing photos remain, but have new photos, pick a new header from new photos
            if (next.length === 0 && photos.length > 0) {
                setHeaderExistingIndex(null);
                if (headerNewIndex == null) setHeaderNewIndex(0);
            }
            return next;
        });
    }

    function removeNewPhoto(index: number) {
        setPhotos((prev) => {
            const next = prev.filter((_, i) => i !== index);
            setHeaderNewIndex((current) =>
                adjustIndexAfterRemoval(current, index, next.length),
            );
            return next;
        });
    }

    function setHeaderFromExisting(idx: number) {
        setHeaderExistingIndex(idx);
        setHeaderNewIndex(null);
    }

    function setHeaderFromNew(idx: number) {
        setHeaderNewIndex(idx);
        setHeaderExistingIndex(null);
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!accessToken) return;

        setSubmitting(true);
        setError(null);
        setHint(null);

        const ve = validate();
        setErrors(ve);
        if (Object.values(ve).some(Boolean)) {
            setSubmitting(false);
            setError(tClient("events.edit.validation.fixFields"));
            return;
        }

        try {
            // 1) upload new photos (if any)
            let newPhotoUrls: string[] = [];
            if (photos.length) {
                const uploads = await Promise.all(
                    photos.map((file) => api.uploadEventPhoto(accessToken, file)),
                );
                newPhotoUrls = uploads
                    .map((u) => u?.url)
                    .filter((u): u is string => !!u);
            }

            // Determine header & final order
            let headerUrl: string | null = null;
            const finalExisting = [...existingPhotos];
            const finalNew = [...newPhotoUrls];

            // derive actual header choice (fall back to first existing/new if none set)
            let chosenHeaderExistingIndex = headerExistingIndex;
            let chosenHeaderNewIndex = headerNewIndex;

            if (finalExisting.length === 0 && finalNew.length === 0) {
                headerUrl = null;
            } else if (
                chosenHeaderExistingIndex != null &&
                finalExisting[chosenHeaderExistingIndex]
            ) {
                headerUrl = finalExisting[chosenHeaderExistingIndex];
            } else if (
                chosenHeaderNewIndex != null &&
                finalNew[chosenHeaderNewIndex]
            ) {
                headerUrl = finalNew[chosenHeaderNewIndex];
            } else if (finalExisting.length > 0) {
                headerUrl = finalExisting[0];
                chosenHeaderExistingIndex = 0;
                chosenHeaderNewIndex = null;
            } else if (finalNew.length > 0) {
                headerUrl = finalNew[0];
                chosenHeaderExistingIndex = null;
                chosenHeaderNewIndex = 0;
            }

            const remainingExisting =
                headerUrl && chosenHeaderExistingIndex != null
                    ? finalExisting.filter((_, idx) => idx !== chosenHeaderExistingIndex)
                    : finalExisting;

            const remainingNew =
                headerUrl && chosenHeaderNewIndex != null
                    ? finalNew.filter((_, idx) => idx !== chosenHeaderNewIndex)
                    : finalNew;

            const finalPhotoUrls =
                headerUrl == null
                    ? [...remainingExisting, ...remainingNew]
                    : [headerUrl, ...remainingExisting, ...remainingNew];

            // 2) update event
            const body = {
                name: state.name.trim(),
                locationName: state.locationName.trim() || null,
                dateStart: state.dateStart
                    ? new Date(state.dateStart).toISOString()
                    : null,
                dateEnd: state.dateEnd
                    ? new Date(state.dateEnd).toISOString()
                    : null,
                lat: state.lat ? Number(state.lat) : null,
                lng: state.lng ? Number(state.lng) : null,
                description: state.description.trim() || null,
                photos: finalPhotoUrls,
                attendees: attendees.map((a) =>
                    a.kind === "member"
                        ? {
                            type: "member" as const,
                            memberId: a.member.id,
                            memberSlug: a.member.slug,
                            name: a.member.name,
                            email: a.member.email || null,
                        }
                        : {
                            type: "invite" as const,
                            value: a.value,
                        },
                ),
                projectSlugs: selectedProjectSlugs,
                blogSlugs: selectedBlogSlugs,
            };

            await api.updateEvent(accessToken, params.slug, body);
            setHint(tClient("events.edit.submit.success"));
            setTimeout(() => {
                router.push(`/events/${params.slug}`);
            }, 600);
        } catch (err) {
            let msg = tClient("events.edit.submit.error");
            if (err instanceof Error && err.message) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }

    async function onDelete(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        if (!accessToken) return;

        const trimmed = deleteConfirmSlug.trim();

        setError(null);
        setHint(null);

        if (!trimmed) {
            setError(tClient("events.edit.delete.error.emptyConfirm"));
            return;
        }
        if (trimmed !== params.slug) {
            setError(tClient("events.edit.delete.error.mismatch"));
            return;
        }

        const confirmed = window.confirm(
            tClient("events.edit.delete.confirmDialog"),
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            await api.deleteEvent(accessToken, params.slug, trimmed);
            setHint(tClient("events.edit.delete.success"));
            router.push("/events");
        } catch (err) {
            let msg = tClient("events.edit.delete.error.generic");
            if (err instanceof Error && err.message) {
                msg = err.message;
            }
            setError(msg);
        } finally {
            setDeleting(false);
        }
    }

    const inputCls = (field: keyof FormState | "photos" = "name") =>
        `w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 ring-1 outline-none ${
            errors[field]
                ? "ring-red-400 focus:ring-red-400/80"
                : "ring-white/10 focus:ring-white/30"
        }`;

    const searchInputCls =
        "w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-white/30 outline-none";

    /* ------------------------------- render ------------------------------- */

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">{tClient("events.edit.kicker")}</p>
                <h1 className="display">{tClient("events.edit.title")}</h1>
                <p className="mt-2 text-white/70 max-w-2xl">
                    {tClient("events.edit.subtitle")}
                </p>
            </header>

            {/* Alerts */}
            {error ? (
                <div
                    role="alert"
                    className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-200"
                >
                    {error}
                </div>
            ) : null}
            {hint ? (
                <div
                    role="status"
                    className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-emerald-200"
                >
                    {hint}
                </div>
            ) : null}

            <form
                onSubmit={onSubmit}
                className="grid lg:grid-cols-5 gap-6"
            >
                {/* Left */}
                <div className="lg:col-span-3 space-y-5">
                    <div className="card p-5 space-y-3">
                        <div>
                            <label className="block text-sm text-white/70 mb-1">
                                {tClient("events.edit.form.name.label")} *
                            </label>
                            <input
                                required
                                value={state.name}
                                onChange={(e) => setField("name", e.target.value)}
                                className={inputCls("name")}
                                placeholder={tClient("events.edit.form.name.placeholder")}
                                aria-invalid={!!errors.name}
                            />
                            {errors.name && (
                                <p className="mt-1 text-xs text-red-300">
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        {/* Split view: markdown input + preview */}
                        <div className="grid md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="block text-sm text-white/70">
                                    {tClient("events.edit.form.description.label")}
                                </label>
                                <textarea
                                    value={state.description}
                                    onChange={(e) =>
                                        setField("description", e.target.value)
                                    }
                                    className={`${inputCls()} min-h-[160px] resize-vertical`}
                                    placeholder={tClient(
                                        "events.edit.form.description.placeholder",
                                    )}
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-white/60">
                                    <span>
                                        {tClient(
                                            "events.edit.markdown.previewLabel",
                                        )}
                                    </span>
                                    <span>
                                        {tClient("events.edit.markdown.supports")}
                                    </span>
                                </div>
                                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3 min-h-[160px] text-sm">
                                    <MarkdownPreview markdown={state.description} />
                                </div>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-white/70 mb-1">
                                    {tClient("events.edit.form.dateStart.label")}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={state.dateStart}
                                    onChange={(e) =>
                                        setField("dateStart", e.target.value)
                                    }
                                    className={inputCls("dateStart")}
                                    aria-invalid={!!errors.dateStart}
                                />
                                {errors.dateStart && (
                                    <p className="mt-1 text-xs text-red-300">
                                        {errors.dateStart}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm text-white/70 mb-1">
                                    {tClient("events.edit.form.dateEnd.label")}
                                </label>
                                <input
                                    type="datetime-local"
                                    value={state.dateEnd}
                                    onChange={(e) =>
                                        setField("dateEnd", e.target.value)
                                    }
                                    className={inputCls("dateEnd")}
                                    aria-invalid={!!errors.dateEnd}
                                />
                                {errors.dateEnd && (
                                    <p className="mt-1 text-xs text-red-300">
                                        {errors.dateEnd}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card p-5 space-y-3">
                        {/* Photos (existing + new) */}
                        <div>
                            <label className="block text-sm text-white/70 mb-1">
                                {tClient("events.edit.form.photos.label")}
                            </label>
                            <input
                                type="file"
                                multiple
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={(e) => handleNewPhotos(e.target.files)}
                                className={inputCls("photos")}
                                aria-invalid={!!errors.photos}
                            />
                            <p className="text-xs text-white/50 mt-1">
                                {tClient("events.edit.form.photos.helper")}
                            </p>
                            {errors.photos && (
                                <p className="mt-1 text-xs text-red-300">
                                    {errors.photos}
                                </p>
                            )}

                            {(existingPhotos.length > 0 || photos.length > 0) && (
                                <div className="mt-3 space-y-3">
                                    {existingPhotos.length > 0 && (
                                        <div>
                                            <p className="text-[11px] text-white/50 mb-1">
                                                {tClient(
                                                    "events.edit.form.photos.existing",
                                                )}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {existingPhotos.map((url, i) => (
                                                    <div
                                                        key={`existing-${i}`}
                                                        className={`relative group rounded-md bg-white/5 p-1 ${
                                                            headerExistingIndex === i
                                                                ? "ring-emerald-400/70 ring-2"
                                                                : "ring-1 ring-white/10"
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeExistingPhoto(i)
                                                            }
                                                            className="absolute top-1 right-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                            aria-label={tClient(
                                                                "events.edit.form.photos.removeExisting",
                                                            ).replace(
                                                                "{index}",
                                                                String(i + 1),
                                                            )}
                                                        >
                                                            ✕
                                                        </button>
                                                        <img
                                                            src={url}
                                                            alt={tClient(
                                                                "events.edit.form.photos.existingAlt",
                                                            ).replace(
                                                                "{index}",
                                                                String(i + 1),
                                                            )}
                                                            className="w-full h-24 object-cover rounded"
                                                        />
                                                        <div className="mt-1 flex items-center justify-between gap-1">
                                                            <span className="text-[11px] text-white/70 truncate">
                                                                {tClient(
                                                                    "events.edit.form.photos.existingLabelPrefix",
                                                                )}
                                                                {i + 1}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setHeaderFromExisting(
                                                                        i,
                                                                    )
                                                                }
                                                                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                                                    headerExistingIndex ===
                                                                    i &&
                                                                    headerNewIndex == null
                                                                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                                                                        : "border-white/20 bg-black/40 text-white/70 hover:border-emerald-300 hover:text-emerald-100"
                                                                }`}
                                                            >
                                                                {headerExistingIndex ===
                                                                i &&
                                                                headerNewIndex == null
                                                                    ? tClient(
                                                                        "events.edit.form.photos.headerLabel",
                                                                    )
                                                                    : tClient(
                                                                        "events.edit.form.photos.setHeader",
                                                                    )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {photos.length > 0 && (
                                        <div>
                                            <p className="text-[11px] text-white/50 mb-1">
                                                {tClient(
                                                    "events.edit.form.photos.newUploads",
                                                )}
                                            </p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {photos.map((f, i) => (
                                                    <div
                                                        key={`new-${i}`}
                                                        className={`relative group rounded-md bg-white/5 p-1 ${
                                                            headerNewIndex === i &&
                                                            headerExistingIndex == null
                                                                ? "ring-emerald-400/70 ring-2"
                                                                : "ring-1 ring-white/10"
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeNewPhoto(i)
                                                            }
                                                            className="absolute top-1 right-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                            aria-label={tClient(
                                                                "events.edit.form.photos.removeNew",
                                                            ).replace(
                                                                "{name}",
                                                                f.name,
                                                            )}
                                                        >
                                                            ✕
                                                        </button>
                                                        <img
                                                            src={URL.createObjectURL(f)}
                                                            alt={f.name}
                                                            className="w-full h-24 object-cover rounded"
                                                        />
                                                        <div className="mt-1 flex items-center justify-between gap-1">
                                                            <div className="text-[11px] truncate text-white/70">
                                                                {f.name}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setHeaderFromNew(i)
                                                                }
                                                                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                                                    headerNewIndex ===
                                                                    i &&
                                                                    headerExistingIndex ==
                                                                    null
                                                                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                                                                        : "border-white/20 bg-black/40 text-white/70 hover:border-emerald-300 hover:text-emerald-100"
                                                                }`}
                                                            >
                                                                {headerNewIndex ===
                                                                i &&
                                                                headerExistingIndex ==
                                                                null
                                                                    ? tClient(
                                                                        "events.edit.form.photos.headerLabel",
                                                                    )
                                                                    : tClient(
                                                                        "events.edit.form.photos.setHeader",
                                                                    )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right */}
                <aside className="lg:col-span-2 space-y-5">
                    {/* Location + map */}
                    <div className="card p-5 space-y-3">
                        <div>
                            <label className="block text-sm text-white/70 mb-1">
                                {tClient("events.edit.form.locationName.label")}
                            </label>
                            <input
                                value={state.locationName}
                                onChange={(e) =>
                                    setField("locationName", e.target.value)
                                }
                                className={inputCls("locationName")}
                                placeholder={tClient(
                                    "events.edit.form.locationName.placeholder",
                                )}
                            />
                        </div>

                        {/* Map search */}
                        <div className="space-y-2">
                            <div className="relative">
                                <input
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    placeholder={tClient(
                                        "events.edit.map.search.placeholder",
                                    )}
                                    className={searchInputCls}
                                />
                                {searching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/50">
                                        {tClient(
                                            "events.edit.map.search.searching",
                                        )}
                                    </div>
                                )}
                            </div>
                            {!!hits.length && (
                                <ul className="max-h-48 overflow-auto rounded-md ring-1 ring-white/10 divide-y divide-white/10 bg-black/60">
                                    {hits.map((h, i) => (
                                        <li
                                            key={i}
                                            className="p-2 text-sm hover:bg-white/10 cursor-pointer"
                                            onClick={() => {
                                                setField("lat", h.lat);
                                                setField("lng", h.lon);
                                                setHits([]);
                                                setSearchQ(h.display_name);
                                                setField(
                                                    "locationName",
                                                    h.display_name,
                                                );
                                            }}
                                        >
                                            <div className="font-medium text-white">
                                                {h.display_name}
                                            </div>
                                            <div className="text-xs text-white/60 mt-0.5">
                                                {tClient(
                                                    "events.edit.map.search.latLabel",
                                                )}{" "}
                                                {h.lat},{" "}
                                                {tClient(
                                                    "events.edit.map.search.lngLabel",
                                                )}{" "}
                                                {h.lon}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Lat/lng raw inputs */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-white/60 mb-1">
                                    {tClient("events.edit.form.lat.label")}
                                </label>
                                <input
                                    value={state.lat}
                                    onChange={(e) => setField("lat", e.target.value)}
                                    className={inputCls("lat")}
                                    placeholder={tClient(
                                        "events.edit.form.lat.placeholder",
                                    )}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-white/60 mb-1">
                                    {tClient("events.edit.form.lng.label")}
                                </label>
                                <input
                                    value={state.lng}
                                    onChange={(e) => setField("lng", e.target.value)}
                                    className={inputCls("lng")}
                                    placeholder={tClient(
                                        "events.edit.form.lng.placeholder",
                                    )}
                                />
                            </div>
                        </div>

                        <MapPreview
                            name={state.name}
                            locationName={state.locationName}
                            dateStart={state.dateStart}
                            lat={state.lat}
                            lng={state.lng}
                        />
                    </div>

                    {/* Attendees + invites */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">
                                {tClient("events.edit.attendees.title")}
                            </h2>
                            {membersLoading && (
                                <span className="text-[11px] text-white/50">
                                    {tClient(
                                        "events.edit.attendees.loadingMembers",
                                    )}
                                </span>
                            )}
                        </div>
                        {membersError && (
                            <p className="text-xs text-red-300">
                                {membersError}
                            </p>
                        )}

                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    value={attendeeQ}
                                    onChange={(e) => setAttendeeQ(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (attendeeSuggestions[0]) {
                                                addMemberAttendee(
                                                    attendeeSuggestions[0],
                                                );
                                            } else if (attendeeQ.trim()) {
                                                addInviteAttendee(attendeeQ);
                                            }
                                        }
                                    }}
                                    placeholder={tClient(
                                        "events.edit.attendees.searchPlaceholder",
                                    )}
                                    className={searchInputCls}
                                />
                                <button
                                    type="button"
                                    onClick={() => addInviteAttendee(attendeeQ)}
                                    className="px-3 py-2 rounded-md bg-white text-black text-xs font-medium disabled:opacity-60"
                                    disabled={!attendeeQ.trim()}
                                >
                                    {tClient(
                                        "events.edit.attendees.addInviteButton",
                                    )}
                                </button>
                            </div>

                            {!!attendeeSuggestions.length && (
                                <ul className="max-h-52 overflow-auto rounded-md bg-black/60 ring-1 ring-white/10 divide-y divide-white/10">
                                    {attendeeSuggestions.map((m) => (
                                        <li
                                            key={m.id}
                                            className="p-2 text-sm hover:bg-white/10 cursor-pointer flex items-center gap-2"
                                            onClick={() => addMemberAttendee(m)}
                                        >
                                            {m.avatarUrl ? (
                                                <img
                                                    src={m.avatarUrl}
                                                    alt={m.name}
                                                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/20"
                                                />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[11px] text-white/80 ring-1 ring-white/20">
                                                    {m.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-white">
                                                    {m.name}
                                                </div>
                                                {m.headline && (
                                                    <div className="text-[11px] text-white/60 truncate">
                                                        {m.headline}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {attendees.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {attendees.map((a, idx) =>
                                    a.kind === "member" ? (
                                        <div
                                            key={`m-${a.member.id}`}
                                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                        >
                                            {a.member.avatarUrl ? (
                                                <img
                                                    src={a.member.avatarUrl}
                                                    alt={a.member.name}
                                                    className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20"
                                                />
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/80 ring-1 ring-white/20">
                                                    {a.member.name
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-xs text-white">
                                                {a.member.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttendee(idx)}
                                                className="text-[11px] text-white/60 hover:text-white"
                                                aria-label={tClient(
                                                    "events.edit.attendees.removeMember",
                                                ).replace(
                                                    "{name}",
                                                    a.member.name,
                                                )}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            key={`i-${a.value}-${idx}`}
                                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                        >
                                            <span className="text-xs text-white/90">
                                                {a.value}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttendee(idx)}
                                                className="text-[11px] text-white/60 hover:text-white"
                                                aria-label={tClient(
                                                    "events.edit.attendees.removeInvite",
                                                ).replace("{value}", a.value)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ),
                                )}
                            </div>
                        )}
                    </div>

                    {/* Related projects */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">
                                {tClient("events.edit.projects.title")}
                            </h2>
                            {projectsLoading && (
                                <span className="text-[11px] text-white/50">
                                    {tClient("events.edit.projects.loading")}
                                </span>
                            )}
                        </div>
                        {projectsError && (
                            <p className="text-xs text-red-300">
                                {projectsError}
                            </p>
                        )}

                        <div className="space-y-2">
                            <input
                                value={projectQ}
                                onChange={(e) => setProjectQ(e.target.value)}
                                placeholder={tClient(
                                    "events.edit.projects.searchPlaceholder",
                                )}
                                className={searchInputCls}
                            />
                            {!!projectSuggestions.length && (
                                <ul className="max-h-52 overflow-auto rounded-md bg-black/60 ring-1 ring-white/10 divide-y divide-white/10">
                                    {projectSuggestions.map((p) => (
                                        <li
                                            key={p.id}
                                            className="flex items-center gap-2 p-2 text-sm hover:bg-white/10 cursor-pointer"
                                            onClick={() => addProject(p)}
                                        >
                                            {p.cover ? (
                                                <img
                                                    src={p.cover}
                                                    alt={p.title}
                                                    className="w-9 h-9 rounded object-cover ring-1 ring-white/20"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center text-[11px] text-white/80 ring-1 ring-white/20">
                                                    {p.title.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-white truncate">
                                                    {p.title}
                                                </div>
                                                {p.year && (
                                                    <div className="text-[11px] text-white/60">
                                                        {p.year}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {selectedProjects.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedProjects.map((p) => (
                                    <button
                                        key={p.slug}
                                        type="button"
                                        onClick={() => removeProject(p.slug)}
                                        className="group flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:ring-red-400/70"
                                    >
                                        {p.cover ? (
                                            <img
                                                src={p.cover}
                                                alt={p.title}
                                                className="w-6 h-6 rounded object-cover ring-1 ring-white/20"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] text-white/80 ring-1 ring-white/20">
                                                {p.title.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-xs text-white">
                                            {p.title}
                                        </span>
                                        <span className="text-[11px] text-white/60 group-hover:text-red-300">
                                            ✕
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Related blog posts */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-white">
                                {tClient("events.edit.blogs.title")}
                            </h2>
                            {blogsLoading && (
                                <span className="text-[11px] text-white/50">
                                    {tClient("events.edit.blogs.loading")}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-white/60">
                            {tClient("events.edit.blogs.helper")}
                        </p>

                        <div className="space-y-2">
                            <input
                                value={blogQ}
                                onChange={(e) => setBlogQ(e.target.value)}
                                placeholder={tClient(
                                    "events.edit.blogs.searchPlaceholder",
                                )}
                                className={searchInputCls}
                            />
                            {!!blogSuggestions.length && (
                                <ul className="max-h-52 overflow-auto rounded-md bg-black/60 ring-1 ring-white/10 divide-y divide-white/10">
                                    {blogSuggestions.map((b) => (
                                        <li
                                            key={b.slug}
                                            className="flex items-center gap-2 p-2 text-sm hover:bg-white/10 cursor-pointer"
                                            onClick={() => addBlog(b)}
                                        >
                                            {b.cover ? (
                                                <img
                                                    src={b.cover}
                                                    alt={b.title}
                                                    className="w-9 h-9 rounded object-cover ring-1 ring-white/20"
                                                />
                                            ) : (
                                                <div className="w-9 h-9 rounded bg-white/10 flex items-center justify-center text-[11px] text-white/80 ring-1 ring-white/20">
                                                    {b.title.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium text-white truncate">
                                                    {b.title}
                                                </div>
                                                {b.publishedAt && (
                                                    <div className="text-[11px] text-white/60">
                                                        {new Date(
                                                            b.publishedAt,
                                                        ).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {!blogsLoading && blogs.length === 0 && (
                                <p className="text-[11px] text-white/50">
                                    {tClient("events.edit.blogs.noneFound")}
                                </p>
                            )}
                        </div>

                        {selectedBlogs.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedBlogs.map((b) => (
                                    <button
                                        key={b.slug}
                                        type="button"
                                        onClick={() => removeBlog(b.slug)}
                                        className="group flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:ring-red-400/70"
                                    >
                                        {b.cover ? (
                                            <img
                                                src={b.cover}
                                                alt={b.title}
                                                className="w-6 h-6 rounded object-cover ring-1 ring-white/20"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] text-white/80 ring-1 ring-white/20">
                                                {b.title.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-xs text-white">
                                            {b.title}
                                        </span>
                                        <span className="text-[11px] text-white/60 group-hover:text-red-300">
                                            ✕
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="card p-5">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full px-4 py-2 rounded-md bg-white text-black font-semibold disabled:opacity-60"
                        >
                            {submitting
                                ? tClient("events.edit.submit.saving")
                                : tClient("events.edit.submit.save")}
                        </button>
                        <div className="mt-3 text-center">
                            <Link
                                href={`/events/${params.slug}`}
                                className="text-sm underline underline-offset-4"
                            >
                                {tClient("events.edit.cancel")}
                            </Link>
                        </div>

                        {/* Danger zone: delete event */}
                        <div className="mt-5 border-t border-white/10 pt-4">
                            <h2 className="text-sm font-semibold text-red-300">
                                {tClient("events.edit.delete.title")}
                            </h2>
                            <p className="mt-1 text-xs text-white/60">
                                {tClient("events.edit.delete.body")}
                            </p>
                            <label className="mt-3 block text-xs text-white/70">
                                {tClient(
                                    "events.edit.delete.confirmLabel.prefix",
                                )}{" "}
                                <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">
                                    {params.slug}
                                </code>{" "}
                                {tClient(
                                    "events.edit.delete.confirmLabel.suffix",
                                )}
                            </label>
                            <input
                                value={deleteConfirmSlug}
                                onChange={(e) =>
                                    setDeleteConfirmSlug(e.target.value)
                                }
                                className={`${inputCls()} mt-1`}
                                placeholder={params.slug}
                            />
                            <button
                                type="button"
                                onClick={onDelete}
                                disabled={
                                    deleting ||
                                    !accessToken ||
                                    deleteConfirmSlug.trim() !== params.slug
                                }
                                className="mt-3 w-full px-4 py-2 rounded-md bg-red-600 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                                {deleting
                                    ? tClient("events.edit.delete.deleting")
                                    : tClient("events.edit.delete.button")}
                            </button>
                        </div>
                    </div>
                </aside>
            </form>
        </section>
    );
}
