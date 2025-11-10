// web/components/ProjectForm.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";

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
        return (
            <p className="text-white/60 text-sm">
                {tClient("projects.form.markdown.empty")}
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
                                ? tClient("projects.form.markdown.codeBlockWithLang").replace(
                                    "{lang}",
                                    seg.lang,
                                )
                                : tClient("projects.form.markdown.codeBlock")
                        }
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

/* ----------------------------- Types ----------------------------- */

type Member = {
    id: string;
    slug: string;
    name: string;
    avatarUrl?: string | null;
};

type TeamEntry = {
    member: Member;
    role: string;
    isCreator?: boolean;
};

type InviteEntry = {
    value: string;
};

type EventRef = {
    id: string;
    slug: string;
    name: string;
    dateStart?: string | null;
    locationName?: string | null;
    cover?: string | null;
};

type BlogRef = {
    id: string;
    slug: string;
    title: string;
    summary?: string | null;
    cover?: string | null;
};

type LinkEntry = {
    label: string;
    url: string;
};

type ProjectFormMode = "create" | "edit";

type ProjectFormProps = {
    mode: ProjectFormMode;
    slug?: string; // required for edit when we fetch the project
};

type FormState = {
    title: string;
    summary: string;
    description: string;
    year: string;
    status: string;
    demoUrl: string;
    repoUrl: string;
    tags: string[];
    tagInput: string;
    techStack: string[];
    techInput: string;
};

type Errors = Partial<
    FormState & {
    photos: string;
    team: string;
}
>;

/* ----------------------------- Helpers ----------------------------- */

function inputCls(hasError: boolean) {
    return [
        "w-full rounded-md bg-white/5 ring-1 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none",
        hasError ? "ring-red-500/70 focus:ring-red-400/80" : "ring-white/10 focus:ring-white/30",
    ].join(" ");
}

function searchInputCls() {
    return "w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:ring-white/30 outline-none";
}

function formatEventMeta(ev: EventRef): string {
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
    if (ev.locationName) bits.push(ev.locationName);
    return bits.join(" • ");
}

function uniqueBySlug<T extends { slug: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
        if (!item.slug || seen.has(item.slug)) continue;
        seen.add(item.slug);
        out.push(item);
    }
    return out;
}

/* ----------------------------- Component ----------------------------- */

const emptyState: FormState = {
    title: "",
    summary: "",
    description: "",
    year: "",
    status: "",
    demoUrl: "",
    repoUrl: "",
    tags: [],
    tagInput: "",
    techStack: [],
    techInput: "",
};

export default function ProjectForm({ mode, slug }: ProjectFormProps) {
    const router = useRouter();
    const { user, accessToken } = useAuth();

    const [state, setState] = React.useState<FormState>(emptyState);
    const [errors, setErrors] = React.useState<Errors>({});
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [hint, setHint] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);

    const [loadingProject, setLoadingProject] = React.useState(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    // photos
    const [existingPhotos, setExistingPhotos] = React.useState<string[]>([]);
    const [photos, setPhotos] = React.useState<File[]>([]);
    const [headerExistingIndex, setHeaderExistingIndex] = React.useState<number | null>(null);
    const [headerNewIndex, setHeaderNewIndex] = React.useState<number | null>(null);

    // members / team
    const [members, setMembers] = React.useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(false);
    const [membersError, setMembersError] = React.useState<string | null>(null);
    const [memberQ, setMemberQ] = React.useState("");
    const [team, setTeam] = React.useState<TeamEntry[]>([]);
    const [invites, setInvites] = React.useState<InviteEntry[]>([]);

    // events
    const [events, setEvents] = React.useState<EventRef[]>([]);
    const [eventsLoading, setEventsLoading] = React.useState(false);
    const [eventsError, setEventsError] = React.useState<string | null>(null);
    const [eventQ, setEventQ] = React.useState("");
    const [selectedEventSlugs, setSelectedEventSlugs] = React.useState<string[]>([]);

    // blogs
    const [blogs, setBlogs] = React.useState<BlogRef[]>([]);
    const [blogsLoading, setBlogsLoading] = React.useState(false);
    const [blogsError, setBlogsError] = React.useState<string | null>(null);
    const [blogQ, setBlogQ] = React.useState("");
    const [selectedBlogSlugs, setSelectedBlogSlugs] = React.useState<string[]>([]);

    // links
    const [links, setLinks] = React.useState<LinkEntry[]>([{ label: "", url: "" }]);

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = React.useState("");
    const [deleting, setDeleting] = React.useState(false);

    const isEdit = mode === "edit";

    const meSlug = user?.member?.slug || null;
    const roles = (user?.roles || []) as string[];
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");

    /* ------------------------ Load members/events/blogs ------------------------ */

    React.useEffect(() => {
        let cancelled = false;

        async function loadMembers() {
            setMembersLoading(true);
            setMembersError(null);
            try {
                const res = await fetch("/api/members?size=999", { credentials: "include" });
                if (!res.ok) {
                    throw new Error(tClient("projects.form.load.membersFailed"));
                }
                const data = await res.json();
                const items: any[] = Array.isArray(data) ? data : data.items ?? [];
                if (cancelled) return;
                setMembers(
                    items.map((m) => ({
                        id: m.id,
                        slug: m.slug,
                        name: m.name,
                        avatarUrl: m.avatarUrl || null,
                    })),
                );
            } catch (e: any) {
                if (cancelled) return;
                setMembersError(
                    e?.message || tClient("projects.form.load.membersFailed"),
                );
            } finally {
                if (!cancelled) setMembersLoading(false);
            }
        }

        async function loadEvents() {
            setEventsLoading(true);
            setEventsError(null);
            try {
                const url = new URL("/api/events", API_BASE);
                url.searchParams.set("size", "999");
                const res = await fetch(url.toString(), { credentials: "include" });
                if (!res.ok) {
                    throw new Error(tClient("projects.form.load.eventsFailed"));
                }
                const data = await res.json();
                const items: any[] = Array.isArray(data) ? data : data.items ?? [];
                if (cancelled) return;
                setEvents(
                    items.map((e) => ({
                        id: e.id,
                        slug: e.slug,
                        name: e.name,
                        dateStart: e.dateStart,
                        locationName: e.locationName,
                        cover: Array.isArray(e.photos) && e.photos.length ? e.photos[0] : null,
                    })),
                );
            } catch (e: any) {
                if (cancelled) return;
                setEventsError(
                    e?.message || tClient("projects.form.load.eventsFailed"),
                );
            } finally {
                if (!cancelled) setEventsLoading(false);
            }
        }

        async function loadBlogs() {
            setBlogsLoading(true);
            setBlogsError(null);
            try {
                const url = new URL("/api/blogs", API_BASE);
                url.searchParams.set("size", "999");
                const res = await fetch(url.toString(), { credentials: "include" });
                if (!res.ok) {
                    throw new Error(tClient("projects.form.load.blogsFailed"));
                }
                const data = await res.json();
                const items: any[] = Array.isArray(data) ? data : data.items ?? [];
                if (cancelled) return;
                setBlogs(
                    items.map((b) => ({
                        id: b.id,
                        slug: b.slug,
                        title: b.title,
                        summary: b.summary || null,
                        cover: b.cover || b.imageUrl || null,
                    })),
                );
            } catch (e: any) {
                if (cancelled) return;
                setBlogsError(
                    e?.message || tClient("projects.form.load.blogsFailed"),
                );
            } finally {
                if (!cancelled) setBlogsLoading(false);
            }
        }

        loadMembers();
        loadEvents();
        loadBlogs();

        return () => {
            cancelled = true;
        };
    }, []);

    /* ------------------------------ Load project ------------------------------ */

    React.useEffect(() => {
        if (!isEdit || !slug) return;

        let cancelled = false;

        async function loadProject() {
            setLoadingProject(true);
            setLoadError(null);
            try {
                const url = new URL(`/api/projects/${encodeURIComponent(slug ?? "")}`, API_BASE);
                const res = await fetch(url.toString(), { credentials: "include" });
                if (res.status === 404) {
                    if (!cancelled) {
                        setLoadError(
                            tClient("projects.form.load.error.notFound"),
                        );
                    }
                    return;
                }
                if (!res.ok) {
                    throw new Error(tClient("projects.form.load.error.generic"));
                }
                const p = await res.json();
                if (cancelled) return;

                setState((s) => ({
                    ...s,
                    title: p.title ?? p.slug ?? "",
                    summary: p.summary ?? "",
                    description: p.description ?? "",
                    year: typeof p.year === "number" ? String(p.year) : "",
                    status: p.status ?? "",
                    demoUrl: p.demoUrl ?? "",
                    repoUrl: p.repoUrl ?? "",
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    tagInput: "",
                    techStack: Array.isArray(p.techStack) ? p.techStack : [],
                    techInput: "",
                }));

                // Prefer p.photos (new API), fall back to p.images for backwards compatibility
                const rawPhotos: any[] = Array.isArray(p.photos)
                    ? p.photos
                    : Array.isArray(p.images)
                        ? p.images
                        : [];
                const existing = rawPhotos.filter(
                    (u: any) => typeof u === "string" && u,
                );

                setExistingPhotos(existing);

                let headerIdx: number | null = null;
                if (p.cover && existing.length) {
                    const idx = existing.indexOf(p.cover);
                    headerIdx = idx >= 0 ? idx : 0;
                } else if (existing.length) {
                    headerIdx = 0;
                }
                setHeaderExistingIndex(headerIdx);
                setHeaderNewIndex(null);

                // team members – map backend project.members (slug, name, avatarUrl, role, isCreator)
                if (Array.isArray(p.members) && members.length) {
                    const entries: TeamEntry[] = [];
                    for (const raw of p.members as any[]) {
                        const m: any = raw;
                        const slugVal: string | undefined = m.memberSlug || m.slug || undefined;
                        if (!slugVal) continue;

                        const found = members.find((mm) => mm.slug === slugVal);
                        if (!found) continue;

                        const isCreator = !!m.isCreator;

                        entries.push({
                            member: {
                                id: found.id,
                                slug: found.slug,
                                name: found.name,
                                avatarUrl: found.avatarUrl || m.avatarUrl || null,
                            },
                            role:
                                typeof m.role === "string" && m.role.trim()
                                    ? m.role
                                    : isCreator
                                        ? "Creator"
                                        : "Contributor",
                            isCreator,
                        });
                    }
                    if (entries.length) {
                        setTeam(entries);
                    }
                }

                // related events (API should provide p.events)
                if (Array.isArray(p.events)) {
                    const slugs = p.events
                        .map((e: any) => e.slug)
                        .filter((x: any) => typeof x === "string");
                    setSelectedEventSlugs(slugs);
                }

                // related blogs
                const blogsRaw: any[] = Array.isArray((p as any).blogs)
                    ? (p as any).blogs
                    : Array.isArray((p as any).relatedBlogs)
                        ? (p as any).relatedBlogs
                        : Array.isArray((p as any).blogPosts)
                            ? (p as any).blogPosts
                            : [];
                if (blogsRaw.length) {
                    const slugs = blogsRaw
                        .map((b: any) => b.slug)
                        .filter((x: any) => typeof x === "string");
                    setSelectedBlogSlugs(slugs);
                }

                // links (if server exposes them)
                const linksRaw = (p as any).links;
                const parsed: LinkEntry[] = [];
                if (Array.isArray(linksRaw)) {
                    for (const l of linksRaw) {
                        if (!l) continue;
                        if (typeof l.url === "string") {
                            parsed.push({ label: l.label || "", url: l.url });
                        }
                    }
                } else if (linksRaw && typeof linksRaw === "object") {
                    for (const [label, url] of Object.entries(linksRaw)) {
                        if (typeof url === "string") parsed.push({ label, url });
                    }
                }
                setLinks(parsed.length ? parsed : [{ label: "", url: "" }]);
            } catch (e: any) {
                if (cancelled) return;
                setLoadError(
                    e?.message || tClient("projects.form.load.error.generic"),
                );
            } finally {
                if (!cancelled) setLoadingProject(false);
            }
        }

        loadProject();

        return () => {
            cancelled = true;
        };
        // include `members` and `meSlug` so once they are loaded we can resolve IDs/slugs & creator flag
    }, [isEdit, slug, members, meSlug]);

    /* ---------------------- Prefill creator as team member ---------------------- */
    // Only for NEW projects; editing should preserve existing team as loaded above.
    React.useEffect(() => {
        if (!meSlug || isEdit) return;
        if (!members.length) return;
        if (team.length) return;

        const me = members.find((m) => m.slug === meSlug);
        if (!me) return;

        setTeam([{ member: me, role: "Creator", isCreator: true }]);
    }, [meSlug, members, team.length, isEdit]);

    /* ------------------------------ Derived permissions ------------------------------ */

    const isCreator = React.useMemo(() => {
        if (!meSlug) return false;
        return team.some((t) => t.isCreator && t.member.slug === meSlug);
    }, [team, meSlug]);

    const hasAuth = !!(user && accessToken);
    const canDelete = isEdit && hasAuth && (isAdmin || isModerator || isCreator);

    /* ------------------------------ Handlers ------------------------------ */

    function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setState((s) => ({ ...s, [key]: value }));
        setErrors((e) => ({ ...e, [key]: undefined }));
        setSubmitError(null);
        setHint(null);
    }

    function addTagFromInput() {
        const raw = state.tagInput.trim();
        if (!raw) return;
        if (state.tags.includes(raw)) {
            setState((s) => ({ ...s, tagInput: "" }));
            return;
        }
        setState((s) => ({ ...s, tags: [...s.tags, raw], tagInput: "" }));
    }

    function addTechFromInput() {
        const raw = state.techInput.trim();
        if (!raw) return;
        if (state.techStack.includes(raw)) {
            setState((s) => ({ ...s, techInput: "" }));
            return;
        }
        setState((s) => ({ ...s, techStack: [...s.techStack, raw], techInput: "" }));
    }

    function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTagFromInput();
        }
    }

    function handleTechKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTechFromInput();
        }
    }

    function removeTag(tag: string) {
        setState((s) => ({ ...s, tags: s.tags.filter((t) => t !== tag) }));
    }

    function removeTech(tname: string) {
        setState((s) => ({ ...s, techStack: s.techStack.filter((t) => t !== tname) }));
    }

    function handleNewPhotos(files: FileList | null) {
        if (!files || !files.length) return;
        const arr = Array.from(files);
        const combined = [...photos, ...arr];
        if (combined.length > 20) {
            setErrors((e) => ({
                ...e,
                photos: tClient("projects.form.validation.photosTooMany"),
            }));
            return;
        }
        setPhotos(combined);
        setErrors((e) => ({ ...e, photos: undefined }));
        setSubmitError(null);
    }

    function removeExistingPhoto(idx: number) {
        setExistingPhotos((prev) => prev.filter((_, i) => i !== idx));
        if (headerExistingIndex === idx) {
            setHeaderExistingIndex(null);
        } else if (headerExistingIndex !== null && headerExistingIndex > idx) {
            setHeaderExistingIndex(headerExistingIndex - 1);
        }
    }

    function removeNewPhoto(idx: number) {
        setPhotos((prev) => prev.filter((_, i) => i !== idx));
        if (headerNewIndex === idx) {
            setHeaderNewIndex(null);
        } else if (headerNewIndex !== null && headerNewIndex > idx) {
            setHeaderNewIndex(headerNewIndex - 1);
        }
    }

    function setHeaderFromExisting(idx: number) {
        setHeaderExistingIndex(idx);
        setHeaderNewIndex(null);
    }

    function setHeaderFromNew(idx: number) {
        setHeaderNewIndex(idx);
        setHeaderExistingIndex(null);
    }

    function addTeamMember(m: Member) {
        if (team.some((t) => t.member.id === m.id)) return;
        setTeam((prev) => [...prev, { member: m, role: "Contributor", isCreator: false }]);
        setMemberQ("");
        setErrors((e) => ({ ...e, team: undefined }));
    }

    function addInvite(value: string) {
        const trimmed = (value || "").trim();
        if (!trimmed) return;
        setInvites((prev) => {
            const lower = trimmed.toLowerCase();
            if (prev.some((inv) => inv.value.toLowerCase() === lower)) {
                return prev;
            }
            return [...prev, { value: trimmed }];
        });
        setMemberQ("");
    }

    function removeInvite(idx: number) {
        setInvites((prev) => prev.filter((_, i) => i !== idx));
    }

    function removeTeamMember(memberId: string) {
        setTeam((prev) => {
            const target = prev.find((t) => t.member.id === memberId);
            // Never remove creator member in the UI
            if (target?.isCreator) {
                return prev;
            }
            return prev.filter((t) => t.member.id !== memberId);
        });
    }

    function updateTeamRole(memberId: string, role: string) {
        setTeam((prev) =>
            prev.map((t) => (t.member.id === memberId ? { ...t, role } : t)),
        );
    }

    function handleMemberSearchKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>,
        suggestions: Member[],
    ) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const query = memberQ.trim();
        if (!query) return;
        const first = suggestions[0];
        if (first) {
            addTeamMember(first);
        } else {
            addInvite(query);
        }
    }

    function toggleEventSlug(eventSlug: string) {
        setSelectedEventSlugs((prev) =>
            prev.includes(eventSlug) ? prev.filter((s) => s !== eventSlug) : [...prev, eventSlug],
        );
    }

    function toggleBlogSlug(blogSlug: string) {
        setSelectedBlogSlugs((prev) =>
            prev.includes(blogSlug) ? prev.filter((s) => s !== blogSlug) : [...prev, blogSlug],
        );
    }

    function updateLink(idx: number, key: keyof LinkEntry, value: string) {
        setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
    }

    function addLinkRow() {
        setLinks((prev) => [...prev, { label: "", url: "" }]);
    }

    function removeLinkRow(idx: number) {
        setLinks((prev) => prev.filter((_, i) => i !== idx));
    }

    /* ------------------------------- Validation ------------------------------- */

    function validate(current: FormState, currentTeam: TeamEntry[]): Errors {
        const next: Errors = {};

        if (!current.title.trim()) {
            next.title = tClient("projects.form.validation.titleRequired");
        }

        if (current.year.trim()) {
            const yr = Number(current.year.trim());
            if (!Number.isFinite(yr) || yr < 1900 || yr > 2100) {
                next.year = tClient("projects.form.validation.yearInvalid");
            }
        }

        // For new projects, require at least one team member.
        if (!currentTeam.length && !isEdit) {
            next.team = tClient("projects.form.validation.teamRequired");
        }

        if (photos.length + existingPhotos.length > 20) {
            next.photos = tClient("projects.form.validation.photosTooMany");
        }

        return next;
    }

    /* ------------------------------- Submit ------------------------------- */

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!accessToken || !user) {
            setSubmitError(tClient("projects.form.error.authRequired"));
            return;
        }

        setSubmitError(null);
        setHint(null);

        const v = validate(state, team);
        if (Object.keys(v).length) {
            setErrors(v);
            setSubmitError(tClient("projects.form.validation.fixFields"));
            return;
        }

        setSubmitting(true);

        try {
            // Upload any new photos
            const uploaded: string[] = [];
            for (const file of photos) {
                const result = await api.uploadProjectPhoto(accessToken, file);
                if (result?.url) uploaded.push(result.url);
            }

            const allPhotos = [...existingPhotos, ...uploaded];

            // Determine cover
            let coverUrl: string | null = null;

            if (headerExistingIndex !== null && allPhotos[headerExistingIndex]) {
                coverUrl = allPhotos[headerExistingIndex];
            } else if (headerNewIndex !== null) {
                const idx = existingPhotos.length + headerNewIndex;
                if (allPhotos[idx]) coverUrl = allPhotos[idx];
            } else if (allPhotos.length) {
                coverUrl = allPhotos[0];
            }

            let photosForApi = allPhotos;
            if (coverUrl) {
                const idx = photosForApi.indexOf(coverUrl);
                if (idx > 0) {
                    photosForApi = [
                        coverUrl,
                        ...photosForApi.filter((u, i) => i !== idx),
                    ];
                }
            }

            const yearNum = state.year.trim() ? Number(state.year.trim()) : null;

            // strip empty links
            const cleanLinks: LinkEntry[] = links
                .map((l) => ({
                    label: (l.label || "").trim(),
                    url: (l.url || "").trim(),
                }))
                .filter((l) => l.label || l.url);

            const memberPayload = team.map((t) => ({
                memberId: t.member.id,
                memberSlug: t.member.slug,
                role: t.role.trim() || null,
                isCreator: !!t.isCreator,
            }));

            const invitePayload = invites
                .map((inv) => inv.value.trim())
                .filter(Boolean)
                .map((email) => ({
                    value: email,
                }));

            const payload: any = {
                title: state.title.trim(),
                summary: state.summary.trim() || null,
                description: state.description.trim() || null,
                year: yearNum && Number.isFinite(yearNum) ? yearNum : null,
                status: state.status.trim() || null,
                demoUrl: state.demoUrl.trim() || null,
                repoUrl: state.repoUrl.trim() || null,
                // IMPORTANT: backend expects `photos` (not `images`)
                photos: photosForApi,
                // `cover` is derived on the server from photos[0], but sending it is harmless
                cover: coverUrl,
                tags: state.tags,
                techStack: state.techStack,
                members: [...memberPayload, ...invitePayload],
                eventSlugs: selectedEventSlugs,
                blogSlugs: selectedBlogSlugs,
                links: cleanLinks,
            };

            let result: any;
            if (isEdit) {
                if (!slug) throw new Error("Missing project slug for edit.");
                result = await api.updateProject(accessToken, slug, payload);
                setHint(tClient("projects.form.submit.success.edit"));
            } else {
                result = await api.createProject(accessToken, payload);
                setHint(tClient("projects.form.submit.success.create"));
            }

            const nextSlug: string =
                result?.slug || slug || state.title.toLowerCase().replace(/\s+/g, "-");
            router.replace(`/projects/${encodeURIComponent(nextSlug)}`);
        } catch (err: any) {
            setSubmitError(
                err?.message || tClient("projects.form.submit.error"),
            );
        } finally {
            setSubmitting(false);
        }
    }

    /* ---------------------------- Delete handler ---------------------------- */

    async function handleDelete() {
        if (!isEdit || !slug) return;
        if (!accessToken || !user) {
            setSubmitError(tClient("projects.form.error.authRequiredDelete"));
            return;
        }
        if (!canDelete) {
            setSubmitError(tClient("projects.form.error.noPermissionDelete"));
            return;
        }
        if (deleteConfirm.trim() !== slug) {
            setSubmitError(
                tClient("projects.form.delete.error.mismatch").replace("{slug}", slug),
            );
            return;
        }

        setDeleting(true);
        setSubmitError(null);
        setHint(null);

        try {
            await api.deleteProject(accessToken, slug, deleteConfirm.trim());
            setHint(tClient("projects.form.delete.success"));
            router.replace("/projects");
        } catch (err: any) {
            setSubmitError(
                err?.message || tClient("projects.form.delete.error.generic"),
            );
        } finally {
            setDeleting(false);
        }
    }

    /* ------------------------------ Derived data ------------------------------ */

    const memberQuery = memberQ.trim().toLowerCase();
    const memberSuggestions = members
        .filter((m) => !team.some((t) => t.member.id === m.id))
        .filter((m) => {
            if (!memberQuery) return true;
            return (
                m.name.toLowerCase().includes(memberQuery) ||
                m.slug.toLowerCase().includes(memberQuery)
            );
        })
        .slice(0, 8);

    const selectedEvents = uniqueBySlug(
        events.filter((e) => selectedEventSlugs.includes(e.slug)),
    );
    const eventQuery = eventQ.trim().toLowerCase();
    const eventSuggestions = events
        .filter((e) => !selectedEventSlugs.includes(e.slug))
        .filter((e) => {
            if (!eventQuery) return true;
            return (
                e.name.toLowerCase().includes(eventQuery) ||
                e.slug.toLowerCase().includes(eventQuery)
            );
        })
        .slice(0, 8);

    const selectedBlogs = uniqueBySlug(
        blogs.filter((b) => selectedBlogSlugs.includes(b.slug)),
    );
    const blogQuery = blogQ.trim().toLowerCase();
    const blogSuggestions = blogs
        .filter((b) => !selectedBlogSlugs.includes(b.slug))
        .filter((b) => {
            if (!blogQuery) return true;
            return (
                b.title.toLowerCase().includes(blogQuery) ||
                b.slug.toLowerCase().includes(blogQuery)
            );
        })
        .slice(0, 8);

    /* ------------------------------- Render ------------------------------- */

    const isCreate = !isEdit;

    return (
        <section className="section">
            <header className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <p className="kicker">
                        {tClient("projects.form.kicker")}
                    </p>
                    <h1 className="display">
                        {isEdit
                            ? state.title || tClient("projects.form.title.edit")
                            : tClient("projects.form.title.new")}
                    </h1>
                    <p className="mt-3 text-white/70 max-w-2xl text-sm">
                        {isEdit
                            ? tClient("projects.form.subtitle.edit")
                            : tClient("projects.form.subtitle.new")}
                    </p>
                </div>
            </header>

            {loadError && (
                <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    {loadError}
                </div>
            )}

            {!hasAuth && (
                <div className="mb-4 rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {tClient("projects.form.gate.loginRequired")}{" "}
                    <Link href="/login" className="underline underline-offset-4">
                        {tClient("projects.form.gate.loginLink")}
                    </Link>
                    .
                </div>
            )}

            {submitError && (
                <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    {submitError}
                </div>
            )}

            {hint && (
                <div className="mb-4 rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    {hint}
                </div>
            )}

            <form onSubmit={onSubmit} className="grid lg:grid-cols-3 gap-6">
                {/* Left: content */}
                <div className="space-y-4 lg:col-span-2">
                    {/* Basics */}
                    <div className="card p-5 space-y-4">
                        <div>
                            <label className="block text-sm mb-1">
                                {tClient("projects.form.fields.title.label")}
                            </label>
                            <input
                                type="text"
                                value={state.title}
                                onChange={(e) => updateField("title", e.target.value)}
                                className={inputCls(!!errors.title)}
                                placeholder={tClient(
                                    "projects.form.fields.title.placeholder",
                                )}
                                disabled={!hasAuth || loadingProject || submitting}
                            />
                            {errors.title && (
                                <p className="mt-1 text-xs text-red-300">{errors.title}</p>
                            )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm mb-1">
                                    {tClient("projects.form.fields.year.label")}
                                </label>
                                <input
                                    type="number"
                                    value={state.year}
                                    onChange={(e) => updateField("year", e.target.value)}
                                    className={inputCls(!!errors.year)}
                                    placeholder={tClient(
                                        "projects.form.fields.year.placeholder",
                                    )}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                                {errors.year && (
                                    <p className="mt-1 text-xs text-red-300">{errors.year}</p>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm mb-1">
                                    {tClient("projects.form.fields.status.label")}
                                </label>
                                <input
                                    type="text"
                                    value={state.status}
                                    onChange={(e) => updateField("status", e.target.value)}
                                    className={inputCls(!!errors.status)}
                                    placeholder={tClient(
                                        "projects.form.fields.status.placeholder",
                                    )}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm mb-1">
                                {tClient("projects.form.fields.summary.label")}
                            </label>
                            <textarea
                                value={state.summary}
                                onChange={(e) => updateField("summary", e.target.value)}
                                className={
                                    inputCls(!!errors.summary) + " min-h-[70px] resize-y"
                                }
                                placeholder={tClient(
                                    "projects.form.fields.summary.placeholder",
                                )}
                                disabled={!hasAuth || loadingProject || submitting}
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm mb-1">
                                    {tClient("projects.form.fields.tags.label")}
                                </label>
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                    {state.tags.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => removeTag(tag)}
                                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                                        >
                                            <span>{tag}</span>
                                            <span className="text-xs text-white/60">×</span>
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={state.tagInput}
                                    onChange={(e) => updateField("tagInput", e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    className={inputCls(false)}
                                    placeholder={tClient(
                                        "projects.form.fields.tags.placeholder",
                                    )}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">
                                    {tClient("projects.form.fields.tech.label")}
                                </label>
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                    {state.techStack.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => removeTech(t)}
                                            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                                        >
                                            <span>{t}</span>
                                            <span className="text-xs text-white/60">×</span>
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    value={state.techInput}
                                    onChange={(e) => updateField("techInput", e.target.value)}
                                    onKeyDown={handleTechKeyDown}
                                    className={inputCls(false)}
                                    placeholder={tClient(
                                        "projects.form.fields.tech.placeholder",
                                    )}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="card p-5 space-y-3">
                        <div>
                            <label className="block text-sm mb-1">
                                {tClient("projects.form.fields.description.label")}
                            </label>
                            <textarea
                                value={state.description}
                                onChange={(e) => updateField("description", e.target.value)}
                                className={
                                    inputCls(!!errors.description) +
                                    " min-h-[160px] resize-y font-mono text-xs"
                                }
                                placeholder={tClient(
                                    "projects.form.fields.description.placeholder",
                                )}
                                disabled={!hasAuth || loadingProject || submitting}
                            />
                        </div>
                        <div className="mt-3 rounded-md bg-black/40 ring-1 ring-white/10 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-widest text-white/40 mb-1">
                                {tClient("projects.form.markdown.previewLabel")}
                            </div>
                            <MarkdownPreview markdown={state.description} />
                        </div>
                    </div>

                    {/* Media */}
                    <div className="card p-5 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold">
                                    {tClient("projects.form.photos.title")}
                                </h2>
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.photos.helper")}
                                </p>
                            </div>
                            <label className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs ring-1 ring-white/10 cursor-pointer">
                                <span>{tClient("projects.form.photos.upload")}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleNewPhotos(e.target.files)}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                            </label>
                        </div>

                        {errors.photos && (
                            <p className="text-xs text-red-300">{errors.photos}</p>
                        )}

                        <div className="grid md:grid-cols-2 gap-3">
                            {/* Existing */}
                            {existingPhotos.length > 0 && (
                                <div>
                                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                                        {tClient(
                                            "projects.form.photos.existingSection",
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {existingPhotos.map((url, i) => {
                                            const isHeader =
                                                headerExistingIndex === i &&
                                                headerNewIndex === null;
                                            return (
                                                <div
                                                    key={url + i}
                                                    className={`relative group rounded-md overflow-hidden ring-1 ${
                                                        isHeader
                                                            ? "ring-emerald-400"
                                                            : "ring-white/10"
                                                    }`}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={url}
                                                        alt={tClient(
                                                            "projects.form.photos.existingAlt",
                                                        ).replace(
                                                            "{index}",
                                                            String(i + 1),
                                                        )}
                                                        className="w-full h-24 object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-stretch justify-between p-1 text-[10px]">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setHeaderFromExisting(i)
                                                            }
                                                            className="rounded bg-black/70 px-1 py-0.5 border border-white/30"
                                                        >
                                                            {isHeader
                                                                ? tClient(
                                                                    "projects.form.photos.headerLabel",
                                                                )
                                                                : tClient(
                                                                    "projects.form.photos.setHeader",
                                                                )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeExistingPhoto(i)
                                                            }
                                                            className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200"
                                                        >
                                                            {tClient(
                                                                "projects.form.photos.removeExisting",
                                                            ).replace(
                                                                "{index}",
                                                                String(i + 1),
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* New uploads */}
                            {photos.length > 0 && (
                                <div>
                                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">
                                        {tClient(
                                            "projects.form.photos.newSection",
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {photos.map((file, i) => {
                                            const url = URL.createObjectURL(file);
                                            const isHeader =
                                                headerNewIndex === i &&
                                                headerExistingIndex === null;
                                            return (
                                                <div
                                                    key={file.name + i}
                                                    className={`relative group rounded-md overflow-hidden ring-1 ${
                                                        isHeader
                                                            ? "ring-emerald-400"
                                                            : "ring-white/10"
                                                    }`}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={url}
                                                        alt={file.name}
                                                        className="w-full h-24 object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-stretch justify-between p-1 text-[10px]">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setHeaderFromNew(i)
                                                            }
                                                            className="rounded bg-black/70 px-1 py-0.5 border border-white/30"
                                                        >
                                                            {isHeader
                                                                ? tClient(
                                                                    "projects.form.photos.headerLabel",
                                                                )
                                                                : tClient(
                                                                    "projects.form.photos.setHeader",
                                                                )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                removeNewPhoto(i)
                                                            }
                                                            className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200"
                                                        >
                                                            {tClient(
                                                                "projects.form.photos.removeNew",
                                                            ).replace(
                                                                "{name}",
                                                                file.name,
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {existingPhotos.length === 0 && photos.length === 0 && (
                            <p className="text-xs text-white/50">
                                {tClient("projects.form.photos.empty")}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: team & relations */}
                <div className="space-y-4">
                    {/* Team */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold">
                                    {tClient("projects.form.team.title")}
                                </h2>
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.team.helper")}
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs mb-1">
                                {tClient("projects.form.team.searchLabel")}
                            </label>
                            <input
                                type="text"
                                value={memberQ}
                                onChange={(e) => setMemberQ(e.target.value)}
                                onKeyDown={(e) =>
                                    handleMemberSearchKeyDown(e, memberSuggestions)
                                }
                                className={searchInputCls()}
                                placeholder={tClient(
                                    "projects.form.team.searchPlaceholder",
                                )}
                                disabled={
                                    membersLoading || !hasAuth || loadingProject || submitting
                                }
                            />
                            {membersError && (
                                <p className="mt-1 text-xs text-red-300">
                                    {membersError}
                                </p>
                            )}
                            {memberSuggestions.length > 0 && memberQ.trim() && (
                                <div className="mt-1 rounded-md bg-black/80 border border-white/15 max-h-52 overflow-y-auto text-sm">
                                    {memberSuggestions.map((m) => (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => addTeamMember(m)}
                                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={m.avatarUrl || "/avatars/default.png"}
                                                alt={m.name}
                                                className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
                                            />
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium">
                                                    {m.name}
                                                </div>
                                                <div className="text-[11px] text-white/50">
                                                    {m.slug}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {errors.team && (
                            <p className="text-xs text-red-300">{errors.team}</p>
                        )}

                        <div className="mt-2 space-y-2">
                            {team.length === 0 ? (
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.team.noMembers")}
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {team.map((t) => {
                                        const isCreatorFlag = !!t.isCreator;
                                        return (
                                            <li
                                                key={t.member.id}
                                                className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-2"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={
                                                        t.member.avatarUrl ||
                                                        "/avatars/default.png"
                                                    }
                                                    alt={t.member.name}
                                                    className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-sm font-medium">
                                                                    {t.member.name}
                                                                </div>
                                                                {isCreatorFlag && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/50">
                                                                        {tClient(
                                                                            "projects.form.team.creatorBadge",
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-white/50">
                                                                {t.member.slug}
                                                            </div>
                                                        </div>
                                                        {isCreatorFlag ? (
                                                            <span className="text-[11px] text-white/40">
                                                                {tClient(
                                                                    "projects.form.team.cannotRemove",
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="text-[11px] text-white/60 hover:text-red-300"
                                                                onClick={() =>
                                                                    removeTeamMember(t.member.id)
                                                                }
                                                            >
                                                                {tClient(
                                                                    "projects.form.team.removeMember",
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="mt-1">
                                                        <input
                                                            type="text"
                                                            value={t.role}
                                                            onChange={(e) =>
                                                                updateTeamRole(
                                                                    t.member.id,
                                                                    e.target.value,
                                                                )
                                                            }
                                                            className={inputCls(false)}
                                                            placeholder={tClient(
                                                                "projects.form.team.rolePlaceholder",
                                                            )}
                                                            disabled={
                                                                !hasAuth ||
                                                                loadingProject ||
                                                                submitting
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {invites.length > 0 && (
                            <div className="mt-3">
                                <div className="text-xs uppercase tracking-widest text-white/60 mb-1">
                                    {tClient(
                                        "projects.form.team.invites.sectionTitle",
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {invites.map((inv, idx) => (
                                        <span
                                            key={`${inv.value}-${idx}`}
                                            className="inline-flex items-center gap-1 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-1 text-[11px]"
                                        >
                                            <span className="font-mono">
                                                {inv.value}
                                            </span>
                                            <span className="text-white/50">
                                                {tClient(
                                                    "projects.form.team.invites.badge",
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeInvite(idx)}
                                                className="text-white/60 hover:text-red-300"
                                                aria-label={tClient(
                                                    "projects.form.team.invites.removeAria",
                                                ).replace("{value}", inv.value)}
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Related events */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold">
                                    {tClient("projects.form.events.title")}
                                </h2>
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.events.helper")}
                                </p>
                            </div>
                        </div>

                        <input
                            type="text"
                            value={eventQ}
                            onChange={(e) => setEventQ(e.target.value)}
                            className={searchInputCls()}
                            placeholder={tClient(
                                "projects.form.events.searchPlaceholder",
                            )}
                            disabled={eventsLoading || !hasAuth || loadingProject || submitting}
                        />
                        {eventsError && (
                            <p className="mt-1 text-xs text-red-300">
                                {eventsError}
                            </p>
                        )}

                        {eventSuggestions.length > 0 && eventQ.trim() && (
                            <div className="mt-1 rounded-md bg-black/80 border border-white/15 max-h-52 overflow-y-auto text-sm">
                                {eventSuggestions.map((ev) => (
                                    <button
                                        key={ev.id}
                                        type="button"
                                        onClick={() => toggleEventSlug(ev.slug)}
                                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium">
                                                {ev.name}
                                            </div>
                                            <div className="text-[11px] text-white/50">
                                                {formatEventMeta(ev)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-2 space-y-1">
                            {selectedEvents.length === 0 ? (
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.events.noneLinked")}
                                </p>
                            ) : (
                                selectedEvents.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1.5"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium truncate">
                                                {ev.name}
                                            </div>
                                            <div className="text-[11px] text-white/50">
                                                {formatEventMeta(ev)}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleEventSlug(ev.slug)}
                                            className="text-[11px] text-white/60 hover:text-red-300"
                                        >
                                            {tClient("projects.form.events.remove")}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Related blog posts */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold">
                                    {tClient("projects.form.blogs.title")}
                                </h2>
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.blogs.helper")}
                                </p>
                            </div>
                        </div>

                        <input
                            type="text"
                            value={blogQ}
                            onChange={(e) => setBlogQ(e.target.value)}
                            className={searchInputCls()}
                            placeholder={tClient(
                                "projects.form.blogs.searchPlaceholder",
                            )}
                            disabled={blogsLoading || !hasAuth || loadingProject || submitting}
                        />
                        {blogsError && (
                            <p className="mt-1 text-xs text-red-300">
                                {blogsError}
                            </p>
                        )}

                        {blogSuggestions.length > 0 && blogQ.trim() && (
                            <div className="mt-1 rounded-md bg-black/80 border border-white/15 max-h-52 overflow-y-auto text-sm">
                                {blogSuggestions.map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => toggleBlogSlug(b.slug)}
                                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium truncate">
                                                {b.title}
                                            </div>
                                            {b.summary && (
                                                <div className="text-[11px] text-white/50 line-clamp-2">
                                                    {b.summary}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mt-2 space-y-1">
                            {selectedBlogs.length === 0 ? (
                                <p className="text-xs text-white/60">
                                    {tClient("projects.form.blogs.noneLinked")}
                                </p>
                            ) : (
                                selectedBlogs.map((b) => (
                                    <div
                                        key={b.id}
                                        className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1.5"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs font-medium truncate">
                                                {b.title}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleBlogSlug(b.slug)}
                                            className="text-[11px] text-white/60 hover:text-red-300"
                                        >
                                            {tClient("projects.form.blogs.remove")}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Links + actions */}
                    <div className="card p-5 space-y-3">
                        <h2 className="text-sm font-semibold">
                            {tClient("projects.form.links.title")}
                        </h2>

                        <div className="space-y-2">
                            <div>
                                <label className="block text-sm mb-1">
                                    {tClient("projects.form.links.demo.label")}
                                </label>
                                <input
                                    type="url"
                                    value={state.demoUrl}
                                    onChange={(e) => updateField("demoUrl", e.target.value)}
                                    className={inputCls(!!errors.demoUrl)}
                                    placeholder={tClient(
                                        "projects.form.links.demo.placeholder",
                                    )}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">
                                    {tClient("projects.form.links.repo.label")}
                                </label>
                                <input
                                    type="url"
                                    value={state.repoUrl}
                                    onChange={(e) => updateField("repoUrl", e.target.value)}
                                    className={inputCls(!!errors.repoUrl)}
                                    placeholder={tClient(
                                        "projects.form.links.repo.placeholder",
                                    )}
                                    disabled={!hasAuth || loadingProject || submitting}
                                />
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs uppercase tracking-widest text-white/60">
                                    {tClient(
                                        "projects.form.links.additional.title",
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={addLinkRow}
                                    className="text-[11px] text-white/70 hover:text-white underline underline-offset-4"
                                >
                                    {tClient(
                                        "projects.form.links.additional.add",
                                    )}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {links.map((link, idx) => (
                                    <div
                                        key={idx}
                                        className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto] gap-2"
                                    >
                                        <input
                                            type="text"
                                            value={link.label}
                                            onChange={(e) =>
                                                updateLink(idx, "label", e.target.value)
                                            }
                                            className={inputCls(false)}
                                            placeholder={tClient(
                                                "projects.form.links.additional.labelPlaceholder",
                                            )}
                                            disabled={
                                                !hasAuth ||
                                                loadingProject ||
                                                submitting
                                            }
                                        />
                                        <input
                                            type="url"
                                            value={link.url}
                                            onChange={(e) =>
                                                updateLink(idx, "url", e.target.value)
                                            }
                                            className={inputCls(false)}
                                            placeholder={tClient(
                                                "projects.form.links.additional.urlPlaceholder",
                                            )}
                                            disabled={
                                                !hasAuth ||
                                                loadingProject ||
                                                submitting
                                            }
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeLinkRow(idx)}
                                            className="text-xs text-white/60 hover:text-red-300 px-2"
                                            disabled={
                                                !hasAuth ||
                                                loadingProject ||
                                                submitting
                                            }
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Danger zone: delete project */}
                        {isEdit && slug && canDelete && (
                            <div className="mt-5 border-t border-red-500/40 pt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs uppercase tracking-widest text-red-300">
                                        {tClient("projects.form.delete.title")}
                                    </span>
                                    <span className="text-[11px] text-red-200/80">
                                        {tClient("projects.form.delete.subtitle")}
                                    </span>
                                </div>
                                <p className="text-[11px] text-red-100/80">
                                    {tClient("projects.form.delete.body")}
                                </p>
                                <label className="block text-[11px] text-red-100 mb-1">
                                    {tClient(
                                        "projects.form.delete.confirmLabel",
                                    ).replace("{slug}", slug)}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        className="flex-1 rounded-md bg-red-900/40 ring-1 ring-red-500/60 px-3 py-1.5 text-xs text-red-50 placeholder:text-red-200/60 outline-none focus:ring-red-300"
                                        placeholder={slug}
                                        disabled={
                                            !hasAuth ||
                                            loadingProject ||
                                            submitting ||
                                            deleting
                                        }
                                    />
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={
                                            !hasAuth ||
                                            loadingProject ||
                                            submitting ||
                                            deleting ||
                                            deleteConfirm.trim() !== slug
                                        }
                                        className="px-3 py-1.5 rounded-md bg-red-600 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                        {deleting
                                            ? tClient("projects.form.delete.deleting")
                                            : tClient("projects.form.delete.button")}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-3 flex items-center justify-between gap-3">
                            <Link
                                href={slug ? `/projects/${slug}` : "/projects"}
                                className="text-xs text-white/60 underline underline-offset-4"
                            >
                                {tClient("common.cancel")}
                            </Link>
                            <button
                                type="submit"
                                disabled={!hasAuth || submitting || loadingProject}
                                className="btn-primary text-sm disabled:opacity-60"
                            >
                                {submitting
                                    ? isEdit
                                        ? tClient("common.saving")
                                        : tClient("projects.form.submit.creating")
                                    : isEdit
                                        ? tClient("common.saveChanges")
                                        : tClient("projects.form.submit.create")}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </section>
    );
}
