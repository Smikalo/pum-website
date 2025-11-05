"use client";

/* eslint-disable @next/next/no-img-element */
import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import * as api from "@/lib/api";
import EventsMap from "@/components/EventsMap";

// --- tiny markdown previewer (headings, bold/italic, code, links, lists) ---
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

// --- OpenStreetMap Nominatim search (no key) ---
type SearchHit = { display_name: string; lat: string; lon: string };

async function geocode(q: string, signal?: AbortSignal): Promise<SearchHit[]> {
    if (!q.trim()) return [];
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    // identify app politely per their usage policy
    url.searchParams.set("email", "noreply@pum.local");
    const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal,
    });
    if (!res.ok) return [];
    return (await res.json()) as SearchHit[];
}

type FormState = {
    name: string;
    locationName: string;
    dateStart: string; // datetime-local
    dateEnd: string;
    lat: string;
    lng: string;
    description: string; // markdown
};

type Errors = Partial<Record<keyof FormState | "photos", string>>;

// Members + attendees
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

// Projects
type ProjectRef = {
    id: string;
    slug: string;
    title: string;
    cover?: string | null;
    year?: number | null;
    summary?: string | null;
};

// --- Map preview using the same neon EventsMap as event detail page ---
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
                Map preview will appear here once you pick a location from search.
            </div>
        );
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    const previewEvent = {
        id: "new-event-preview",
        slug: "new-event-preview",
        name: name || "New event",
        locationName: locationName || undefined,
        dateStart: dateStart || undefined,
        lat: latNum,
        lng: lngNum,
        description: undefined,
        photos: [],
        tags: [],
    };

    return (
        <div className="rounded-md bg-black overflow-hidden ring-1 ring-white/10">
            <EventsMap events={[previewEvent]} />
        </div>
    );
}

export default function NewEventPage() {
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

    const [photos, setPhotos] = React.useState<File[]>([]);
    const [headerIndex, setHeaderIndex] = React.useState<number | null>(null);

    // Map search
    const [searchQ, setSearchQ] = React.useState("");
    const [hits, setHits] = React.useState<SearchHit[]>([]);
    const [searching, setSearching] = React.useState(false);

    // Members & attendees
    const [members, setMembers] = React.useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(true);
    const [membersError, setMembersError] = React.useState<string | null>(null);
    const [attendees, setAttendees] = React.useState<Attendee[]>([]);
    const [attendeeQ, setAttendeeQ] = React.useState("");

    // Projects
    const [projects, setProjects] = React.useState<ProjectRef[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(true);
    const [projectsError, setProjectsError] = React.useState<string | null>(null);
    const [selectedProjectSlugs, setSelectedProjectSlugs] = React.useState<string[]>([]);
    const [projectQ, setProjectQ] = React.useState("");

    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [hint, setHint] = React.useState<string | null>(null);
    const [errors, setErrors] = React.useState<Errors>({});

    // live map search (debounced) whenever user types in the search box
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
            } catch (err) {
                if ((err as any)?.name !== "AbortError") {
                    // eslint-disable-next-line no-console
                    console.error("[NewEvent] geocode error", err);
                }
            } finally {
                setSearching(false);
            }
        }, 250); // 250ms debounce

        return () => {
            window.clearTimeout(handle);
            controller.abort();
        };
    }, [searchQ]);

    // load members for attendee picker
    React.useEffect(() => {
        let cancelled = false;
        async function loadMembers() {
            try {
                const res = await fetch("/api/members?size=999");
                if (!res.ok) throw new Error("Failed to load members");
                const json = await res.json();
                const items: any[] = Array.isArray(json) ? json : json.items ?? [];
                const mapped: Member[] = items.map((m) => ({
                    id: m.id ?? m.slug,
                    slug: m.slug ?? m.id,
                    name: m.name,
                    avatarUrl: m.avatarUrl ?? m.avatar ?? m.photo ?? m.image ?? undefined,
                    headline: m.headline ?? m.shortBio ?? undefined,
                    email: m.email ?? undefined,
                }));
                if (!cancelled) {
                    setMembers(mapped);
                    setMembersError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    // eslint-disable-next-line no-console
                    console.error("[NewEvent] members load error", err);
                    setMembersError("Could not load members.");
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

    // load projects for project picker
    React.useEffect(() => {
        let cancelled = false;

        async function loadProjects() {
            try {
                const res = await fetch("/api/projects?size=999");
                if (!res.ok) throw new Error("Failed to load projects");
                const json = await res.json();
                const items: any[] = Array.isArray(json) ? json : json.items ?? [];
                const mapped: ProjectRef[] = items.map((p) => ({
                    id: p.id ?? p.slug,
                    slug: p.slug ?? p.id,
                    title: p.title,
                    cover: p.cover ?? p.imageUrl ?? null,
                    year: p.year ?? null,
                    summary: p.summary ?? null,
                }));
                if (!cancelled) {
                    setProjects(mapped);
                    setProjectsError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    // eslint-disable-next-line no-console
                    console.error("[NewEvent] projects load error", err);
                    setProjectsError("Could not load projects.");
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

    // If not logged in, show friendly gate (API still enforces auth)
    if (!user) {
        return (
            <section className="section">
                <h1 className="display">Create a new event</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    You need to be logged in to create events.
                </p>
                <div className="mt-5 flex gap-3">
                    <Link href="/events" className="btn-secondary">
                        ← Back to events
                    </Link>
                    <Link href="/" className="btn-primary">
                        Log in
                    </Link>
                </div>
            </section>
        );
    }

    function set<K extends keyof FormState>(k: K, v: FormState[K]) {
        setState((s) => ({ ...s, [k]: v }));
        setErrors((e) => ({ ...e, [k]: undefined })); // clear on change
    }

    function validate(): Errors {
        const e: Errors = {};
        if (!state.name.trim()) e.name = "Event name is required.";
        if (state.dateStart && Number.isNaN(new Date(state.dateStart).getTime()))
            e.dateStart = "Invalid start date.";
        if (state.dateEnd && Number.isNaN(new Date(state.dateEnd).getTime()))
            e.dateEnd = "Invalid end date.";
        if (state.dateStart && state.dateEnd) {
            const a = new Date(state.dateStart).getTime();
            const b = new Date(state.dateEnd).getTime();
            if (a > b) e.dateEnd = "End must be after start.";
        }

        if (photos.length > 12) e.photos = "Please upload at most 12 photos.";
        for (const f of photos) {
            const okType = /^image\/(png|jpe?g|webp|gif)$/i.test(f.type);
            if (!okType) {
                e.photos = "Only PNG, JPG/JPEG, WEBP, or GIF are allowed.";
                break;
            }
            if (f.size > 8 * 1024 * 1024) {
                e.photos = "Each photo must be ≤ 8 MB.";
                break;
            }
        }
        return e;
    }

    function addMemberAttendee(m: Member) {
        setAttendees((prev) => {
            if (prev.some((a) => a.kind === "member" && a.member.id === m.id)) return prev;
            return [...prev, { kind: "member", member: m }];
        });
        setAttendeeQ("");
    }

    function addInviteAttendee(value: string) {
        const trimmed = value.trim();
        if (!trimmed) return;
        setAttendees((prev) => {
            if (
                prev.some(
                    (a) =>
                        a.kind === "invite" &&
                        a.value.toLowerCase() === trimmed.toLowerCase(),
                )
            ) {
                return prev;
            }
            return [...prev, { kind: "invite", value: trimmed }];
        });
        setAttendeeQ("");
    }

    function removeAttendee(index: number) {
        setAttendees((prev) => prev.filter((_, i) => i !== index));
    }

    // Projects helpers
    function addProject(p: ProjectRef) {
        setSelectedProjectSlugs((prev) =>
            prev.includes(p.slug) ? prev : [...prev, p.slug],
        );
        setProjectQ("");
    }

    function removeProject(slug: string) {
        setSelectedProjectSlugs((prev) => prev.filter((s) => s !== slug));
    }

    const normalizedAttendeeQ = attendeeQ.trim().toLowerCase();
    const attendeeSuggestions = React.useMemo(() => {
        const alreadyIds = new Set(
            attendees
                .filter((a) => a.kind === "member")
                .map((a) => (a as any).member.id),
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
            .slice(0, 30);
    }, [members, attendees, normalizedAttendeeQ]);

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

    // Photo helpers
    function adjustHeaderAfterRemoval(
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

    // ✅ FIXED: append new selection instead of replacing previous files
    function handlePhotosChange(files: FileList | null) {
        const incoming = Array.from(files || []);
        if (incoming.length === 0) return;

        setPhotos((prev) => {
            const next = [...prev, ...incoming];
            // keep header if still valid; otherwise default to the first photo
            if (next.length === 0) {
                setHeaderIndex(null);
            } else if (headerIndex == null || headerIndex >= next.length) {
                setHeaderIndex(0);
            }
            return next;
        });
    }

    function removePhoto(index: number) {
        setPhotos((prev) => {
            const next = prev.filter((_, i) => i !== index);
            setHeaderIndex((current) =>
                adjustHeaderAfterRemoval(current, index, next.length),
            );
            return next;
        });
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
            setError("Please fix the highlighted fields.");
            return;
        }

        try {
            // 1) upload photos (if any)
            let finalPhotoUrls: string[] = [];
            if (photos.length) {
                const uploads = await Promise.all(
                    photos.map((file) => api.uploadEventPhoto(accessToken, file)),
                );
                const newPhotoUrls = uploads
                    .map((u) => u?.url)
                    .filter((u): u is string => !!u);

                if (newPhotoUrls.length) {
                    const hi =
                        headerIndex != null &&
                        headerIndex >= 0 &&
                        headerIndex < newPhotoUrls.length
                            ? headerIndex
                            : 0;
                    const headerUrl = newPhotoUrls[hi];
                    const rest = newPhotoUrls.filter((_, idx) => idx !== hi);
                    finalPhotoUrls = [headerUrl, ...rest];
                }
            }

            // 2) create event
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
                            type: "member",
                            memberId: a.member.id,
                            memberSlug: a.member.slug,
                            name: a.member.name,
                            email: a.member.email || null,
                        }
                        : {
                            type: "invite",
                            value: a.value,
                        },
                ),
                projectSlugs: selectedProjectSlugs,
            };

            const res = await api.createEvent(accessToken, body);
            setHint("Event created ✓ Redirecting…");
            setTimeout(() => {
                router.push(`/events/${res.slug}`);
            }, 600);
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error("[NewEvent] onSubmit error", err);
            const msg = err?.message || "Failed to create event";
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }

    const inputCls = (key: keyof FormState | "photos") =>
        `w-full rounded-md bg-white/5 ring-1 px-3 py-2 text-white placeholder:text-white/40 ${
            errors[key]
                ? "ring-red-500/60 focus:ring-red-500"
                : "ring-white/10 focus:ring-white/30"
        }`;

    // dark-themed search input
    const searchInputCls =
        "w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-white/30";

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">EVENTS</p>
                <h1 className="display">Create a new event</h1>
                <p className="mt-2 text-white/70 max-w-2xl">
                    Add dates, location, details, attendees, photos, and related projects.
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

            <form onSubmit={onSubmit} className="grid lg:grid-cols-5 gap-6">
                {/* Left */}
                <div className="lg:col-span-3 space-y-5">
                    <div className="card p-5 space-y-3">
                        <div>
                            <label className="block text-sm text-white/70 mb-1">
                                Event name *
                            </label>
                            <input
                                required
                                value={state.name}
                                onChange={(e) => set("name", e.target.value)}
                                className={inputCls("name")}
                                placeholder="HackNight 2026 @ PUM"
                                aria-invalid={!!errors.name}
                            />
                            {errors.name && (
                                <p className="mt-1 text-xs text-red-300">{errors.name}</p>
                            )}
                        </div>

                        {/* Split view: markdown input + preview */}
                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-white/70 mb-1">
                                    Description (Markdown)
                                </label>
                                <textarea
                                    rows={12}
                                    value={state.description}
                                    onChange={(e) => set("description", e.target.value)}
                                    className={inputCls("description")}
                                    placeholder="Describe the event. **Markdown** supported. Use lists, code, links, etc."
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-white/70 mb-1">
                                    Preview
                                </label>
                                <div className="rounded-md bg-white/5 ring-1 ring-white/10 p-3 min-h-[180px]">
                                    {state.description ? (
                                        <MarkdownPreview markdown={state.description} />
                                    ) : (
                                        <div className="text-white/50 text-sm">
                                            Nothing to preview yet.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-white/70 mb-1">
                                    Start (local)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={state.dateStart}
                                    onChange={(e) => set("dateStart", e.target.value)}
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
                                    End (local)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={state.dateEnd}
                                    onChange={(e) => set("dateEnd", e.target.value)}
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
                        {/* Photos (real files) */}
                        <div>
                            <label className="block text-sm text-white/70 mb-1">Photos</label>
                            <input
                                type="file"
                                multiple
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={(e) => handlePhotosChange(e.target.files)}
                                className={inputCls("photos")}
                                aria-invalid={!!errors.photos}
                            />
                            <p className="text-xs text-white/50 mt-1">
                                Upload up to 12 images; PNG/JPG/WEBP/GIF; max 8 MB each.
                                Choose one as the header image; the rest will appear in the gallery.
                            </p>
                            {errors.photos && (
                                <p className="mt-1 text-xs text-red-300">{errors.photos}</p>
                            )}

                            {photos.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {photos.map((f, i) => (
                                        <div
                                            key={i}
                                            className={`relative group rounded-md bg-white/5 ring-1 p-1 ${
                                                headerIndex === i
                                                    ? "ring-emerald-400/70"
                                                    : "ring-white/10"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(i)}
                                                className="absolute top-1 right-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                aria-label={`Remove ${f.name}`}
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
                                                    onClick={() => setHeaderIndex(i)}
                                                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                                        headerIndex === i
                                                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                                                            : "border-white/20 bg-black/40 text-white/70 hover:border-emerald-300 hover:text-emerald-100"
                                                    }`}
                                                >
                                                    {headerIndex === i ? "Header" : "Set header"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
                                Location name
                            </label>
                            <input
                                value={state.locationName}
                                onChange={(e) => set("locationName", e.target.value)}
                                className={inputCls("locationName")}
                                placeholder="Betahaus Berlin, Hall A"
                            />
                        </div>

                        {/* Map search (live search as you type) */}
                        <div className="space-y-2">
                            <div className="relative">
                                <input
                                    value={searchQ}
                                    onChange={(e) => setSearchQ(e.target.value)}
                                    placeholder="Search address / place"
                                    className={searchInputCls}
                                />
                                {searching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/50">
                                        Searching…
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
                                                set("lat", h.lat);
                                                set("lng", h.lon);
                                                setHits([]);
                                                setSearchQ(h.display_name);
                                                if (!state.locationName) {
                                                    set("locationName", h.display_name);
                                                }
                                            }}
                                        >
                                            {h.display_name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Map preview using EventsMap (dark neon) */}
                        <MapPreview
                            name={state.name}
                            locationName={state.locationName}
                            dateStart={state.dateStart}
                            lat={state.lat}
                            lng={state.lng}
                        />
                    </div>

                    {/* Attendees & invites */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-sm font-semibold text-white">
                                Attendees & invites
                            </h2>
                            {membersLoading && (
                                <span className="text-[11px] text-white/50">
                                    Loading members…
                                </span>
                            )}
                            {membersError && !membersLoading && (
                                <span className="text-[11px] text-red-300">
                                    {membersError}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-white/60">
                            Start typing a name to add an existing member, or enter an email /
                            name and hit Enter to add an invite.
                        </p>

                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input
                                    value={attendeeQ}
                                    onChange={(e) => setAttendeeQ(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            if (attendeeSuggestions[0]) {
                                                addMemberAttendee(attendeeSuggestions[0]);
                                            } else if (attendeeQ.trim()) {
                                                addInviteAttendee(attendeeQ);
                                            }
                                        }
                                    }}
                                    placeholder="Search member or type email"
                                    className={searchInputCls}
                                />
                                <button
                                    type="button"
                                    onClick={() => addInviteAttendee(attendeeQ)}
                                    className="px-3 py-2 rounded-md bg-white text-black text-xs font-medium disabled:opacity-60"
                                    disabled={!attendeeQ.trim()}
                                >
                                    Add invite
                                </button>
                            </div>

                            {!!attendeeSuggestions.length && (
                                <ul className="max-h-52 overflow-auto rounded-md bg-black/60 ring-1 ring-white/10 divide-y divide-white/10">
                                    {attendeeSuggestions.map((m) => (
                                        <li
                                            key={m.id}
                                            className="flex items-center gap-2 p-2 text-sm hover:bg-white/10 cursor-pointer"
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
                                                    {m.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-medium text-white truncate">
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
                                                    {a.member.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="text-xs text-white">
                                                {a.member.name}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttendee(idx)}
                                                className="text-[11px] text-white/60 hover:text-white"
                                                aria-label={`Remove ${a.member.name}`}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            key={`i-${a.value}`}
                                            className="flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 ring-1 ring-emerald-400/40"
                                        >
                                            <span className="text-xs text-white/90">
                                                {a.value}
                                            </span>
                                            <span className="text-[10px] text-emerald-300/80">
                                                invite
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttendee(idx)}
                                                className="text-[11px] text-white/60 hover:text-white"
                                                aria-label={`Remove ${a.value}`}
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
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-sm font-semibold text-white">
                                Related projects
                            </h2>
                            {projectsLoading && (
                                <span className="text-[11px] text-white/50">
                                    Loading projects…
                                </span>
                            )}
                            {projectsError && !projectsLoading && (
                                <span className="text-[11px] text-red-300">
                                    {projectsError}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-white/60">
                            Link projects that are showcased or launched during this event.
                            They will appear as project cards on the event page and vice versa.
                        </p>

                        <div className="space-y-2">
                            <input
                                value={projectQ}
                                onChange={(e) => setProjectQ(e.target.value)}
                                placeholder="Search projects by title, year, or tag"
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

                    {/* Create button */}
                    <div className="card p-5">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full px-4 py-2 rounded-md bg-white text-black font-semibold disabled:opacity-60"
                        >
                            {submitting ? "Creating…" : "Create event"}
                        </button>
                        <div className="mt-3 text-center">
                            <Link
                                href="/events"
                                className="text-sm underline underline-offset-4"
                            >
                                Cancel
                            </Link>
                        </div>
                    </div>
                </aside>
            </form>
        </section>
    );
}
