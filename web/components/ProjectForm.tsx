// web/components/ProjectForm.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/context/AuthProvider";
import { tClient } from "@/lib/i18n-client";
import { useSearchableOptions, SearchableOption } from "@/hooks/useSearchableOptions";
import LinkedResourcePicker from "@/components/LinkedResourcePicker";
import SimpleMarkdown from "@/components/SimpleMarkdown";

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

// ProjectForm-specific types for loaders
type EventsApiResponse = {
    items?: {
        slug: string;
        name: string;
        dateStart?: string | null;
        locationName?: string | null;
        cover?: string | null;
    }[];
};

type BlogsApiResponse = {
    items?: {
        slug: string;
        title: string;
        summary?: string | null;
        cover?: string | null;
    }[];
};

type ProjectFormMode = "create" | "edit";

type ProjectFormProps = {
    mode: ProjectFormMode;
    slug?: string;
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

type LinkEntry = {
    label: string;
    url: string;
};

// API types for existing loadProject
interface ProjectApiMember {
    memberSlug?: string;
    slug?: string;
    avatarUrl?: string | null;
    role?: string | null;
    isCreator?: boolean;
}

interface ProjectApiBlog {
    slug?: string;
}

interface ProjectApi {
    id?: string | number;
    slug?: string;
    title?: string;
    summary?: string | null;
    description?: string | null;
    year?: number | null;
    status?: string | null;
    demoUrl?: string | null;
    repoUrl?: string | null;
    photos?: unknown[];
    images?: unknown[];
    cover?: string | null;
    members?: unknown[];
    events?: unknown[];
    blogs?: unknown[];
    relatedBlogs?: unknown[];
    blogPosts?: unknown[];
    links?: unknown;
    tags?: unknown[];
    techStack?: unknown[];
}

type ProjectMutationResult = {
    slug?: string;
} | null | undefined;

/* ----------------------------- Loaders ----------------------------- */
async function loadAllEvents(): Promise<SearchableOption[]> {
    try {
        const url = new URL("/api/events", API_BASE);
        url.searchParams.set("size", "999");
        const res = await fetch(url.toString(), { credentials: "include" });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as EventsApiResponse;
        const items = Array.isArray(json.items) ? json.items : [];
        return items.map(e => ({
            id: e.slug,
            label: e.name,
            description: e.dateStart ? new Date(e.dateStart).toLocaleDateString() : undefined,
            cover: e.cover
        }));
    } catch {
        return [];
    }
}

async function loadAllBlogs(): Promise<SearchableOption[]> {
    try {
        const url = new URL("/api/blogs", API_BASE);
        url.searchParams.set("size", "999");
        const res = await fetch(url.toString(), { credentials: "include" });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as BlogsApiResponse;
        const items = Array.isArray(json.items) ? json.items : [];
        return items.map(b => ({
            id: b.slug,
            label: b.title,
            description: b.summary || undefined,
            cover: b.cover
        }));
    } catch {
        return [];
    }
}

type MembersApiItem = {
    id?: string | number;
    slug?: string;
    name?: string;
    avatarUrl?: string | null;
};

function normalizeMembersPayload(payload: unknown): Member[] {
    const root = payload as { items?: unknown } | unknown[];
    const items: unknown[] = Array.isArray(root)
        ? root
        : Array.isArray(root.items)
            ? (root.items as unknown[])
            : [];
    const result: Member[] = [];
    for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const { id, slug, name, avatarUrl } = item as MembersApiItem;
        if (typeof slug !== "string" || typeof name !== "string") continue;
        const normalizedId = typeof id === "string" ? id : typeof id === "number" ? String(id) : slug;
        result.push({
            id: normalizedId,
            slug,
            name,
            avatarUrl: avatarUrl ?? null,
        });
    }
    return result;
}

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

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
}

/* ----------------------------- Component ----------------------------- */

export default function ProjectForm({ mode, slug }: ProjectFormProps) {
    const router = useRouter();
    const { user, accessToken } = useAuth();

    const [state, setState] = React.useState<FormState>({
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
    });
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

    // members / team (manual UI maintained as it's custom)
    const [members, setMembers] = React.useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(false);
    const [membersError, setMembersError] = React.useState<string | null>(null);
    const [memberQ, setMemberQ] = React.useState("");
    const [team, setTeam] = React.useState<TeamEntry[]>([]);
    const [invites, setInvites] = React.useState<InviteEntry[]>([]);

    // events & blogs via hooks
    const {
        filtered: filteredEvents,
        query: eventQuery,
        setQuery: setEventQuery,
        loading: eventsLoading,
        error: eventsError
    } = useSearchableOptions({ loadAll: loadAllEvents });
    const [selectedEventSlugs, setSelectedEventSlugs] = React.useState<string[]>([]);

    const {
        filtered: filteredBlogs,
        query: blogQuery,
        setQuery: setBlogQuery,
        loading: blogsLoading,
        error: blogsError
    } = useSearchableOptions({ loadAll: loadAllBlogs });
    const [selectedBlogSlugs, setSelectedBlogSlugs] = React.useState<string[]>([]);

    // links
    const [links, setLinks] = React.useState<LinkEntry[]>([{ label: "", url: "" }]);

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = React.useState("");
    const [deleting, setDeleting] = React.useState(false);

    const isEdit = mode === "edit";
    const hasAuth = !!(user && accessToken);

    const meSlug = user?.member?.slug || null;
    const roles = (user?.roles || []) as string[];
    const isAdmin = roles.includes("ADMIN");
    const isModerator = roles.includes("MODERATOR");

    // Load members manually
    React.useEffect(() => {
        let cancelled = false;
        async function loadMembers() {
            setMembersLoading(true);
            setMembersError(null);
            try {
                const res = await fetch("/api/members?size=999", { credentials: "include" });
                if (!res.ok) throw new Error(tClient("projects.form.load.membersFailed"));
                const data = (await res.json()) as unknown;
                if (cancelled) return;
                setMembers(normalizeMembersPayload(data));
            } catch (error: unknown) {
                if (cancelled) return;
                setMembersError((error instanceof Error) ? error.message : "Error");
            } finally {
                if (!cancelled) setMembersLoading(false);
            }
        }
        loadMembers();
        return () => { cancelled = true; };
    }, []);

    // Load project data
    React.useEffect(() => {
        if (!isEdit || !slug) return;
        let cancelled = false;
        async function loadProject() {
            setLoadingProject(true);
            try {
                const url = new URL(`/api/projects/${encodeURIComponent(slug ?? "")}`, API_BASE);
                const res = await fetch(url.toString(), { credentials: "include" });
                if (!res.ok) throw new Error("Failed");
                const json = await res.json();
                if (cancelled) return;
                const p = json as ProjectApi;

                const title = typeof p.title === "string" && p.title.trim() ? p.title : typeof p.slug === "string" ? p.slug : "";

                setState(s => ({
                    ...s,
                    title: title || "",
                    summary: typeof p.summary === "string" ? p.summary : "",
                    description: typeof p.description === "string" ? p.description : "",
                    year: typeof p.year === "number" && Number.isFinite(p.year) ? String(p.year) : "",
                    status: typeof p.status === "string" ? p.status : "",
                    demoUrl: typeof p.demoUrl === "string" ? p.demoUrl : "",
                    repoUrl: typeof p.repoUrl === "string" ? p.repoUrl : "",
                    tags: Array.isArray(p.tags) ? p.tags.filter((tag): tag is string => typeof tag === "string") : [],
                    techStack: Array.isArray(p.techStack) ? p.techStack.filter((tech): tech is string => typeof tech === "string") : []
                }));

                const photoSources = Array.isArray(p.photos) ? p.photos : Array.isArray(p.images) ? p.images : [];
                const existing = photoSources.filter((u): u is string => typeof u === "string" && u.length > 0);
                setExistingPhotos(existing);

                let headerIdx: number | null = null;
                if (typeof p.cover === "string" && existing.length) {
                    const idx = existing.indexOf(p.cover);
                    headerIdx = idx >= 0 ? idx : 0;
                } else if (existing.length) {
                    headerIdx = 0;
                }
                setHeaderExistingIndex(headerIdx);
                setHeaderNewIndex(null);

                // team members
                if (Array.isArray(p.members) && members.length) {
                    const entries: TeamEntry[] = [];
                    for (const raw of p.members) {
                        if (!raw || typeof raw !== "object") continue;
                        const m = raw as ProjectApiMember;
                        const slugValRaw = m.memberSlug || m.slug;
                        if (!slugValRaw) continue;
                        const slugVal = String(slugValRaw);
                        const found = members.find((mm) => mm.slug === slugVal);
                        if (!found) continue;
                        const isCreator = !!m.isCreator;
                        const role = typeof m.role === "string" && m.role.trim() ? m.role : isCreator ? "Creator" : "Contributor";
                        entries.push({
                            member: { id: found.id, slug: found.slug, name: found.name, avatarUrl: m.avatarUrl ?? found.avatarUrl ?? null },
                            role,
                            isCreator,
                        });
                    }
                    if (entries.length) setTeam(entries);
                }

                // Events
                if (Array.isArray(p.events)) {
                    const slugs = p.events
                        .map((e) => {
                            if (!e || typeof e !== "object") return undefined;
                            const evt = e as { slug?: unknown };
                            return typeof evt.slug === "string" ? evt.slug : undefined;
                        })
                        .filter((s): s is string => !!s);
                    setSelectedEventSlugs(slugs);
                }

                // Blogs
                const allBlogs = [...(p.blogs || []), ...(p.relatedBlogs || []), ...(p.blogPosts || [])] as ProjectApiBlog[];
                if (allBlogs.length) {
                    const slugs = allBlogs.map(b => typeof b?.slug === 'string' ? b.slug : undefined).filter((s): s is string => !!s);
                    setSelectedBlogSlugs(slugs);
                }

                // Links
                const linksRaw = p.links;
                const parsedLinks: LinkEntry[] = [];
                if (Array.isArray(linksRaw)) {
                    for (const l of linksRaw) {
                        if (!l || typeof l !== "object") continue;
                        const obj = l as { label?: unknown; url?: unknown };
                        const label = typeof obj.label === "string" ? obj.label : "";
                        const url = typeof obj.url === "string" ? obj.url : "";
                        if (!label && !url) continue;
                        parsedLinks.push({ label, url });
                    }
                } else if (linksRaw && typeof linksRaw === "object") {
                    for (const [labelKey, urlVal] of Object.entries(linksRaw as Record<string, unknown>)) {
                        if (typeof urlVal === "string") {
                            parsedLinks.push({ label: labelKey, url: urlVal });
                        }
                    }
                }
                setLinks(parsedLinks.length ? parsedLinks : [{ label: "", url: "" }]);

            } catch {
                setLoadError("Failed to load project");
            } finally {
                setLoadingProject(false);
            }
        }
        if (members.length > 0 || !isEdit) {
            loadProject();
        }
        return () => { cancelled = true; };
    }, [isEdit, slug, members, meSlug]);

    /* ---------------------- Prefill creator as team member ---------------------- */
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
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTagFromInput(); }
    }
    function handleTechKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTechFromInput(); }
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
            setErrors((e) => ({ ...e, photos: tClient("projects.form.validation.photosTooMany") }));
            return;
        }
        setPhotos(combined);
        setErrors((e) => ({ ...e, photos: undefined }));
        setSubmitError(null);
    }
    function removeExistingPhoto(idx: number) {
        setExistingPhotos((prev) => prev.filter((_, i) => i !== idx));
        if (headerExistingIndex === idx) setHeaderExistingIndex(null);
        else if (headerExistingIndex !== null && headerExistingIndex > idx) setHeaderExistingIndex(headerExistingIndex - 1);
    }
    function removeNewPhoto(idx: number) {
        setPhotos((prev) => prev.filter((_, i) => i !== idx));
        if (headerNewIndex === idx) setHeaderNewIndex(null);
        else if (headerNewIndex !== null && headerNewIndex > idx) setHeaderNewIndex(headerNewIndex - 1);
    }
    function setHeaderFromExisting(idx: number) { setHeaderExistingIndex(idx); setHeaderNewIndex(null); }
    function setHeaderFromNew(idx: number) { setHeaderNewIndex(idx); setHeaderExistingIndex(null); }

    // Team handlers
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
            if (prev.some((inv) => inv.value.toLowerCase() === lower)) return prev;
            return [...prev, { value: trimmed }];
        });
        setMemberQ("");
    }
    function removeInvite(idx: number) { setInvites((prev) => prev.filter((_, i) => i !== idx)); }
    function removeTeamMember(memberId: string) {
        setTeam((prev) => {
            const target = prev.find((t) => t.member.id === memberId);
            if (target?.isCreator) return prev;
            return prev.filter((t) => t.member.id !== memberId);
        });
    }
    function updateTeamRole(memberId: string, role: string) {
        setTeam((prev) => prev.map((t) => (t.member.id === memberId ? { ...t, role } : t)));
    }
    function handleMemberSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>, suggestions: Member[]) {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const query = memberQ.trim();
        if (!query) return;
        const first = suggestions[0];
        if (first) addTeamMember(first);
        else addInvite(query);
    }

    // Links handlers
    function updateLink(idx: number, key: keyof LinkEntry, value: string) {
        setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: value } : l)));
    }
    function addLinkRow() { setLinks((prev) => [...prev, { label: "", url: "" }]); }
    function removeLinkRow(idx: number) { setLinks((prev) => prev.filter((_, i) => i !== idx)); }

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

    /* ------------------------------- Submit ------------------------------- */
    function validate(current: FormState, currentTeam: TeamEntry[]): Errors {
        const next: Errors = {};
        if (!current.title.trim()) next.title = tClient("projects.form.validation.titleRequired");
        if (current.year.trim()) {
            const yr = Number(current.year.trim());
            if (!Number.isFinite(yr) || yr < 1900 || yr > 2100) next.year = tClient("projects.form.validation.yearInvalid");
        }
        if (!currentTeam.length && !isEdit) next.team = tClient("projects.form.validation.teamRequired");
        if (photos.length + existingPhotos.length > 20) next.photos = tClient("projects.form.validation.photosTooMany");
        return next;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!accessToken || !user) { setSubmitError(tClient("projects.form.error.authRequired")); return; }
        setSubmitError(null); setHint(null);
        const v = validate(state, team);
        if (Object.keys(v).length) { setErrors(v); setSubmitError(tClient("projects.form.validation.fixFields")); return; }
        setSubmitting(true);

        try {
            const uploaded: string[] = [];
            for (const file of photos) {
                const result = await api.uploadProjectPhoto(accessToken, file);
                if (result?.url) uploaded.push(result.url);
            }
            const allPhotos = [...existingPhotos, ...uploaded];
            let coverUrl: string | null = null;
            if (headerExistingIndex !== null && allPhotos[headerExistingIndex]) coverUrl = allPhotos[headerExistingIndex];
            else if (headerNewIndex !== null) {
                const idx = existingPhotos.length + headerNewIndex;
                if (allPhotos[idx]) coverUrl = allPhotos[idx];
            } else if (allPhotos.length) coverUrl = allPhotos[0];

            let photosForApi = allPhotos;
            if (coverUrl) {
                const idx = photosForApi.indexOf(coverUrl);
                if (idx > 0) photosForApi = [coverUrl, ...photosForApi.filter((u, i) => i !== idx)];
            }

            const yearNum = state.year.trim() ? Number(state.year.trim()) : null;
            const cleanLinks = links.map((l) => ({ label: (l.label || "").trim(), url: (l.url || "").trim() })).filter((l) => l.label || l.url);
            const memberPayload = team.map((t) => ({ memberId: t.member.id, memberSlug: t.member.slug, role: t.role.trim() || null, isCreator: !!t.isCreator }));
            const invitePayload = invites.map((inv) => inv.value.trim()).filter(Boolean).map((email) => ({ value: email }));

            const payload = {
                title: state.title.trim(),
                summary: state.summary.trim() || null,
                description: state.description.trim() || null,
                year: yearNum && Number.isFinite(yearNum) ? yearNum : null,
                status: state.status.trim() || null,
                demoUrl: state.demoUrl.trim() || null,
                repoUrl: state.repoUrl.trim() || null,
                photos: photosForApi,
                cover: coverUrl,
                tags: state.tags,
                techStack: state.techStack,
                members: [...memberPayload, ...invitePayload],
                eventSlugs: selectedEventSlugs,
                blogSlugs: selectedBlogSlugs,
                links: cleanLinks,
            };

            let result: ProjectMutationResult;
            if (isEdit) {
                if (!slug) throw new Error("Missing project slug for edit.");
                result = (await api.updateProject(accessToken, slug, payload)) as ProjectMutationResult;
                setHint(tClient("projects.form.submit.success.edit"));
            } else {
                result = (await api.createProject(accessToken, payload)) as ProjectMutationResult;
                setHint(tClient("projects.form.submit.success.create"));
            }

            const fallbackSlug = state.title.trim().toLowerCase().replace(/\s+/g, "-");
            const nextSlug: string = result?.slug || slug || fallbackSlug || "project";
            router.replace(`/projects/${encodeURIComponent(nextSlug)}`);
        } catch (error: unknown) {
            setSubmitError(getErrorMessage(error, tClient("projects.form.submit.error")));
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete() {
        if (!isEdit || !slug) return;
        if (!accessToken || !user) { setSubmitError(tClient("projects.form.error.authRequiredDelete")); return; }
        if (!canDelete) { setSubmitError(tClient("projects.form.error.noPermissionDelete")); return; }
        if (deleteConfirm.trim() !== slug) { setSubmitError(tClient("projects.form.delete.error.mismatch").replace("{slug}", slug)); return; }

        setDeleting(true); setSubmitError(null); setHint(null);
        try {
            await api.deleteProject(accessToken, slug, deleteConfirm.trim());
            setHint(tClient("projects.form.delete.success"));
            router.replace("/projects");
        } catch (error: unknown) {
            setSubmitError(getErrorMessage(error, tClient("projects.form.delete.error.generic")));
        } finally {
            setDeleting(false);
        }
    }

    /* ------------------------------- Render ------------------------------- */

    return (
        <section className="section">
            <header className="mb-6 flex items-center justify-between gap-3">
                <div>
                    <p className="kicker">{tClient("projects.form.kicker")}</p>
                    <h1 className="display">
                        {isEdit ? state.title || tClient("projects.form.title.edit") : tClient("projects.form.title.new")}
                    </h1>
                    <p className="mt-3 text-white/70 max-w-2xl text-sm">
                        {isEdit ? tClient("projects.form.subtitle.edit") : tClient("projects.form.subtitle.new")}
                    </p>
                </div>
            </header>

            {loadError && <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">{loadError}</div>}
            {!hasAuth && <div className="mb-4 rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{tClient("projects.form.gate.loginRequired")} <Link href="/login" className="underline underline-offset-4">{tClient("projects.form.gate.loginLink")}</Link>.</div>}
            {submitError && <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-100">{submitError}</div>}
            {hint && <div className="mb-4 rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{hint}</div>}

            <form onSubmit={onSubmit} className="grid lg:grid-cols-3 gap-6">
                {/* Left: content */}
                <div className="space-y-4 lg:col-span-2">
                    {/* Basics */}
                    <div className="card p-5 space-y-4">
                        <div>
                            <label className="block text-sm mb-1">{tClient("projects.form.fields.title.label")}</label>
                            <input type="text" value={state.title} onChange={(e) => updateField("title", e.target.value)} className={inputCls(!!errors.title)} placeholder={tClient("projects.form.fields.title.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                            {errors.title && <p className="mt-1 text-xs text-red-300">{errors.title}</p>}
                        </div>
                        <div className="grid md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm mb-1">{tClient("projects.form.fields.year.label")}</label>
                                <input type="number" value={state.year} onChange={(e) => updateField("year", e.target.value)} className={inputCls(!!errors.year)} placeholder={tClient("projects.form.fields.year.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                                {errors.year && <p className="mt-1 text-xs text-red-300">{errors.year}</p>}
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm mb-1">{tClient("projects.form.fields.status.label")}</label>
                                <input type="text" value={state.status} onChange={(e) => updateField("status", e.target.value)} className={inputCls(!!errors.status)} placeholder={tClient("projects.form.fields.status.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm mb-1">{tClient("projects.form.fields.summary.label")}</label>
                            <textarea value={state.summary} onChange={(e) => updateField("summary", e.target.value)} className={inputCls(!!errors.summary) + " min-h-[70px] resize-y"} placeholder={tClient("projects.form.fields.summary.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm mb-1">{tClient("projects.form.fields.tags.label")}</label>
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                    {state.tags.map((tag) => (
                                        <button key={tag} type="button" onClick={() => removeTag(tag)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"><span>{tag}</span><span className="text-xs text-white/60">×</span></button>
                                    ))}
                                </div>
                                <input type="text" value={state.tagInput} onChange={(e) => updateField("tagInput", e.target.value)} onKeyDown={handleTagKeyDown} className={inputCls(false)} placeholder={tClient("projects.form.fields.tags.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">{tClient("projects.form.fields.tech.label")}</label>
                                <div className="flex flex-wrap gap-1.5 mb-1">
                                    {state.techStack.map((t) => (
                                        <button key={t} type="button" onClick={() => removeTech(t)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"><span>{t}</span><span className="text-xs text-white/60">×</span></button>
                                    ))}
                                </div>
                                <input type="text" value={state.techInput} onChange={(e) => updateField("techInput", e.target.value)} onKeyDown={handleTechKeyDown} className={inputCls(false)} placeholder={tClient("projects.form.fields.tech.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="card p-5 space-y-3">
                        <div>
                            <label className="block text-sm mb-1">{tClient("projects.form.fields.description.label")}</label>
                            <textarea value={state.description} onChange={(e) => updateField("description", e.target.value)} className={inputCls(!!errors.description) + " min-h-[160px] resize-y font-mono text-xs"} placeholder={tClient("projects.form.fields.description.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                        </div>
                        <div className="mt-3 rounded-md bg-black/40 ring-1 ring-white/10 px-3 py-2">
                            <div className="text-[11px] uppercase tracking-widest text-white/40 mb-1">{tClient("projects.form.markdown.previewLabel")}</div>
                            <SimpleMarkdown markdown={state.description} />
                        </div>
                    </div>

                    {/* Media */}
                    <div className="card p-5 space-y-4">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold">{tClient("projects.form.photos.title")}</h2>
                                <p className="text-xs text-white/60">{tClient("projects.form.photos.helper")}</p>
                            </div>
                            <label className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs ring-1 ring-white/10 cursor-pointer">
                                <span>{tClient("projects.form.photos.upload")}</span>
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleNewPhotos(e.target.files)} disabled={!hasAuth || loadingProject || submitting} />
                            </label>
                        </div>
                        {errors.photos && <p className="text-xs text-red-300">{errors.photos}</p>}
                        <div className="grid md:grid-cols-2 gap-3">
                            {/* Existing */}
                            {existingPhotos.length > 0 && (
                                <div>
                                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">{tClient("projects.form.photos.existingSection")}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {existingPhotos.map((url, i) => {
                                            const isHeader = headerExistingIndex === i && headerNewIndex === null;
                                            return (
                                                <div key={url + i} className={`relative group rounded-md overflow-hidden ring-1 ${isHeader ? "ring-emerald-400" : "ring-white/10"}`}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt={tClient("projects.form.photos.existingAlt").replace("{index}", String(i + 1))} className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-stretch justify-between p-1 text-[10px]">
                                                        <button type="button" onClick={() => setHeaderFromExisting(i)} className="rounded bg-black/70 px-1 py-0.5 border border-white/30">{isHeader ? tClient("projects.form.photos.headerLabel") : tClient("projects.form.photos.setHeader")}</button>
                                                        <button type="button" onClick={() => removeExistingPhoto(i)} className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200">{tClient("projects.form.photos.removeExisting").replace("{index}", String(i + 1))}</button>
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
                                    <div className="text-xs uppercase tracking-widest text-white/60 mb-2">{tClient("projects.form.photos.newSection")}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {photos.map((file, i) => {
                                            const url = URL.createObjectURL(file);
                                            const isHeader = headerNewIndex === i && headerExistingIndex === null;
                                            return (
                                                <div key={file.name + i} className={`relative group rounded-md overflow-hidden ring-1 ${isHeader ? "ring-emerald-400" : "ring-white/10"}`}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt={file.name} className="w-full h-24 object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col items-stretch justify-between p-1 text-[10px]">
                                                        <button type="button" onClick={() => setHeaderFromNew(i)} className="rounded bg-black/70 px-1 py-0.5 border border-white/30">{isHeader ? tClient("projects.form.photos.headerLabel") : tClient("projects.form.photos.setHeader")}</button>
                                                        <button type="button" onClick={() => removeNewPhoto(i)} className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200">{tClient("projects.form.photos.removeNew").replace("{name}", file.name)}</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        {existingPhotos.length === 0 && photos.length === 0 && <p className="text-xs text-white/50">{tClient("projects.form.photos.empty")}</p>}
                    </div>
                </div>

                {/* Right: team & relations */}
                <div className="space-y-4">
                    {/* Team */}
                    <div className="card p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold">{tClient("projects.form.team.title")}</h2>
                                <p className="text-xs text-white/60">{tClient("projects.form.team.helper")}</p>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs mb-1">{tClient("projects.form.team.searchLabel")}</label>
                            <input type="text" value={memberQ} onChange={(e) => setMemberQ(e.target.value)} onKeyDown={(e) => handleMemberSearchKeyDown(e, memberSuggestions)} className={searchInputCls()} placeholder={tClient("projects.form.team.searchPlaceholder")} disabled={membersLoading || !hasAuth || loadingProject || submitting} />
                            {membersError && <p className="mt-1 text-xs text-red-300">{membersError}</p>}
                            {memberSuggestions.length > 0 && memberQ.trim() && (
                                <div className="mt-1 rounded-md bg-black/80 border border-white/15 max-h-52 overflow-y-auto text-sm">
                                    {memberSuggestions.map((m) => (
                                        <button key={m.id} type="button" onClick={() => addTeamMember(m)} className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={m.avatarUrl || "/avatars/default.png"} alt={m.name} className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10" />
                                            <div className="min-w-0">
                                                <div className="text-xs font-medium">{m.name}</div>
                                                <div className="text-[11px] text-white/50">{m.slug}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {errors.team && <p className="text-xs text-red-300">{errors.team}</p>}
                        <div className="mt-2 space-y-2">
                            {team.length === 0 ? (
                                <p className="text-xs text-white/60">{tClient("projects.form.team.noMembers")}</p>
                            ) : (
                                <ul className="space-y-2">
                                    {team.map((t) => {
                                        const isCreatorFlag = !!t.isCreator;
                                        return (
                                            <li key={t.member.id} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-2">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={t.member.avatarUrl || "/avatars/default.png"} alt={t.member.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-sm font-medium">{t.member.name}</div>
                                                                {isCreatorFlag && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/50">{tClient("projects.form.team.creatorBadge")}</span>}
                                                            </div>
                                                            <div className="text-[11px] text-white/50">{t.member.slug}</div>
                                                        </div>
                                                        {isCreatorFlag ? <span className="text-[11px] text-white/40">{tClient("projects.form.team.cannotRemove")}</span> : <button type="button" className="text-[11px] text-white/60 hover:text-red-300" onClick={() => removeTeamMember(t.member.id)}>{tClient("projects.form.team.removeMember")}</button>}
                                                    </div>
                                                    <div className="mt-1">
                                                        <input type="text" value={t.role} onChange={(e) => updateTeamRole(t.member.id, e.target.value)} className={inputCls(false)} placeholder={tClient("projects.form.team.rolePlaceholder")} disabled={!hasAuth || loadingProject || submitting} />
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
                                <div className="text-xs uppercase tracking-widest text-white/60 mb-1">{tClient("projects.form.team.invites.sectionTitle")}</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {invites.map((inv, idx) => (
                                        <span key={`${inv.value}-${idx}`} className="inline-flex items-center gap-1 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-1 text-[11px]">
                                            <span className="font-mono">{inv.value}</span>
                                            <span className="text-white/50">{tClient("projects.form.team.invites.badge")}</span>
                                            <button type="button" onClick={() => removeInvite(idx)} className="text-white/60 hover:text-red-300" aria-label={tClient("projects.form.team.invites.removeAria").replace("{value}", inv.value)}>✕</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Related events */}
                    <div className="card p-5 space-y-3">
                        <LinkedResourcePicker
                            label={tClient("projects.form.events.title")}
                            searchPlaceholder={tClient("projects.form.events.searchPlaceholder")}
                            options={filteredEvents}
                            selectedIds={selectedEventSlugs}
                            onChangeSelected={setSelectedEventSlugs}
                            query={eventQuery}
                            onQueryChange={setEventQuery}
                            loading={eventsLoading}
                            error={eventsError ? <span className="text-red-300">Error</span> : null}
                            emptyStateText={tClient("projects.form.events.noneLinked")}
                        />
                    </div>

                    {/* Related blog posts */}
                    <div className="card p-5 space-y-3">
                        <LinkedResourcePicker
                            label={tClient("projects.form.blogs.title")}
                            searchPlaceholder={tClient("projects.form.blogs.searchPlaceholder")}
                            options={filteredBlogs}
                            selectedIds={selectedBlogSlugs}
                            onChangeSelected={setSelectedBlogSlugs}
                            query={blogQuery}
                            onQueryChange={setBlogQuery}
                            loading={blogsLoading}
                            error={blogsError ? <span className="text-red-300">Error</span> : null}
                            emptyStateText={tClient("projects.form.blogs.noneLinked")}
                        />
                    </div>

                    {/* Links + actions */}
                    <div className="card p-5 space-y-3">
                        <h2 className="text-sm font-semibold">{tClient("projects.form.links.title")}</h2>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-sm mb-1">{tClient("projects.form.links.demo.label")}</label>
                                <input type="url" value={state.demoUrl} onChange={(e) => updateField("demoUrl", e.target.value)} className={inputCls(!!errors.demoUrl)} placeholder={tClient("projects.form.links.demo.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">{tClient("projects.form.links.repo.label")}</label>
                                <input type="url" value={state.repoUrl} onChange={(e) => updateField("repoUrl", e.target.value)} className={inputCls(!!errors.repoUrl)} placeholder={tClient("projects.form.links.repo.placeholder")} disabled={!hasAuth || loadingProject || submitting} />
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs uppercase tracking-widest text-white/60">{tClient("projects.form.links.additional.title")}</span>
                                <button type="button" onClick={addLinkRow} className="text-[11px] text-white/70 hover:text-white underline underline-offset-4">{tClient("projects.form.links.additional.add")}</button>
                            </div>
                            <div className="space-y-2">
                                {links.map((link, idx) => (
                                    <div key={idx} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto] gap-2">
                                        <input type="text" value={link.label} onChange={(e) => updateLink(idx, "label", e.target.value)} className={inputCls(false)} placeholder={tClient("projects.form.links.additional.labelPlaceholder")} disabled={!hasAuth || loadingProject || submitting} />
                                        <input type="url" value={link.url} onChange={(e) => updateLink(idx, "url", e.target.value)} className={inputCls(false)} placeholder={tClient("projects.form.links.additional.urlPlaceholder")} disabled={!hasAuth || loadingProject || submitting} />
                                        <button type="button" onClick={() => removeLinkRow(idx)} className="text-xs text-white/60 hover:text-red-300 px-2" disabled={!hasAuth || loadingProject || submitting}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Danger zone */}
                        {isEdit && slug && canDelete && (
                            <div className="mt-5 border-t border-red-500/40 pt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs uppercase tracking-widest text-red-300">{tClient("projects.form.delete.title")}</span>
                                    <span className="text-[11px] text-red-200/80">{tClient("projects.form.delete.subtitle")}</span>
                                </div>
                                <p className="text-[11px] text-red-100/80">{tClient("projects.form.delete.body")}</p>
                                <label className="block text-[11px] text-red-100 mb-1">{tClient("projects.form.delete.confirmLabel").replace("{slug}", slug)}</label>
                                <div className="flex gap-2">
                                    <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="flex-1 rounded-md bg-red-900/40 ring-1 ring-red-500/60 px-3 py-1.5 text-xs text-red-50 placeholder:text-red-200/60 outline-none focus:ring-red-300" placeholder={slug} disabled={!hasAuth || loadingProject || submitting || deleting} />
                                    <button type="button" onClick={handleDelete} disabled={!hasAuth || loadingProject || submitting || deleting || deleteConfirm.trim() !== slug} className="px-3 py-1.5 rounded-md bg-red-600 text-xs font-semibold text-white disabled:opacity-60">
                                        {deleting ? tClient("projects.form.delete.deleting") : tClient("projects.form.delete.button")}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="pt-3 flex items-center justify-between gap-3">
                            <Link href={slug ? `/projects/${slug}` : "/projects"} className="text-xs text-white/60 underline underline-offset-4">{tClient("common.cancel")}</Link>
                            <button type="submit" disabled={!hasAuth || submitting || loadingProject} className="btn-primary text-sm disabled:opacity-60">
                                {submitting ? isEdit ? tClient("common.saving") : tClient("projects.form.submit.creating") : isEdit ? tClient("common.saveChanges") : tClient("projects.form.submit.create")}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </section>
    );
}