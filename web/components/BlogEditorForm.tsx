"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "@/lib/config";
import { tClient } from "@/lib/i18n-client";
import { useSearchableOptions, SearchableOption } from "@/hooks/useSearchableOptions";
import LinkedResourcePicker from "@/components/LinkedResourcePicker";

type BlogAuthor = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
    role?: string | null;
};

type BlogProjectRef = {
    slug?: string | null;
};

type BlogEventRef = {
    slug?: string | null;
};

type BlogProjectFull = {
    slug?: string | null;
    title?: string | null;
    cover?: string | null;
    year?: number | null;
};

type BlogEventFull = {
    slug?: string | null;
    name?: string | null;
    cover?: string | null;
    dateStart?: string | null;
};

type BlogDraft = {
    title?: string;
    summary?: string | null;
    content?: string | null;
    tags?: string[];
    techStack?: string[];
    authors?: BlogAuthor[];
    images?: string[];
    publishedAt?: string | Date | null;
    projectSlugs?: (string | null | undefined)[];
    projects?: BlogProjectFull[];
    eventSlugs?: (string | null | undefined)[];
    events?: BlogEventFull[];
    cover?: string | null;
    imageUrl?: string | null;
};

type BlogEditorFormProps = {
    mode: "create" | "edit";
    initialBlog?: BlogDraft;
    onSubmit: (formData: FormData) => void | Promise<void>;
};

type MemberOption = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
    role?: string | null;
};

type MembersApiResponse = {
    items?: {
        slug: string;
        name: string;
        avatarUrl?: string | null;
        headline?: string | null;
        shortBio?: string | null;
    }[];
};

type ProjectsApiResponse = {
    items?: {
        slug: string;
        title: string;
        cover?: string | null;
        year?: number | null;
    }[];
};

type EventsApiResponse = {
    items?: {
        slug: string;
        name: string;
        cover?: string | null;
        dateStart?: string | null;
    }[];
};

const emptyAuthors: MemberOption[] = [];

function searchInputCls() {
    return "w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30";
}

// Must match backend multer filter: /^image\/(png|jpe?g|webp|gif)$/i
const ALLOWED_IMAGE_MIME = [
    "image/png",
    "image/jpg",
    "image/jpeg",
    "image/webp",
    "image/gif",
] as const;

type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

function isAllowedImage(file: File) {
    const t = (file.type || "").toLowerCase() as AllowedImageMime | "";
    return ALLOWED_IMAGE_MIME.includes(t as AllowedImageMime);
}

// Loaders for useSearchableOptions
async function loadAllProjects(): Promise<SearchableOption[]> {
    try {
        const res = await fetch(`${API_BASE}/api/projects?size=200`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as ProjectsApiResponse;
        const items = Array.isArray(json.items) ? json.items : [];
        return items.map(p => ({
            id: p.slug,
            label: p.title,
            description: p.year ? String(p.year) : undefined,
            cover: p.cover
        }));
    } catch {
        return [];
    }
}

async function loadAllEvents(): Promise<SearchableOption[]> {
    try {
        const res = await fetch(`${API_BASE}/api/events?size=200`, { credentials: "include" });
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


const BlogEditorForm: React.FC<BlogEditorFormProps> = ({
                                                           mode,
                                                           initialBlog,
                                                           onSubmit,
                                                       }) => {
    const initialTitle: string = initialBlog?.title ?? "";
    const initialSummary: string = initialBlog?.summary ?? "";
    const initialContent: string = initialBlog?.content ?? "";
    const initialTags: string[] = Array.isArray(initialBlog?.tags)
        ? initialBlog.tags
        : [];
    const initialTechStack: string[] = Array.isArray(initialBlog?.techStack)
        ? initialBlog.techStack
        : [];
    const initialAuthors: MemberOption[] = Array.isArray(initialBlog?.authors)
        ? initialBlog.authors
        : emptyAuthors;
    const initialImages: string[] = Array.isArray(initialBlog?.images)
        ? initialBlog.images
        : [];
    const initialPublishedDate: string =
        initialBlog?.publishedAt
            ? new Date(initialBlog.publishedAt).toISOString().slice(0, 10)
            : "";

    function cleanSlugArray(slugs: (string | null | undefined)[] | undefined): string[] {
        if (!Array.isArray(slugs)) return [];
        return slugs
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim());
    }

    // Existing related project connections
    let initialProjectSlugs: string[] = [];
    if (Array.isArray(initialBlog?.projectSlugs)) {
        initialProjectSlugs = cleanSlugArray(initialBlog.projectSlugs);
    } else if (Array.isArray(initialBlog?.projects)) {
        const slugsFromProjects = (initialBlog.projects as BlogProjectRef[]).map(
            (p) => p.slug ?? null,
        );
        initialProjectSlugs = cleanSlugArray(slugsFromProjects);
    }

    // Existing related event connections
    let initialEventSlugs: string[] = [];
    if (Array.isArray(initialBlog?.eventSlugs)) {
        initialEventSlugs = cleanSlugArray(initialBlog.eventSlugs);
    } else if (Array.isArray(initialBlog?.events)) {
        const slugsFromEvents = (initialBlog.events as BlogEventRef[]).map(
            (e) => e.slug ?? null,
        );
        initialEventSlugs = cleanSlugArray(slugsFromEvents);
    }

    const [content, setContent] = useState<string>(initialContent);

    // Members for authors
    const [members, setMembers] = useState<MemberOption[]>([]);
    const [memberQ, setMemberQ] = useState("");
    const [selectedAuthors, setSelectedAuthors] = useState<MemberOption[]>(
        initialAuthors.map((a) => ({
            slug: a.slug,
            name: a.name,
            avatarUrl: a.avatarUrl ?? null,
            headline: a.headline ?? null,
            role: a.role ?? null,
        })),
    );

    // Hooks for projects & events
    const {
        filtered: filteredProjects,
        query: projectQuery,
        setQuery: setProjectQuery,
        loading: projectsLoading,
        error: projectsError
    } = useSearchableOptions({ loadAll: loadAllProjects });
    const [selectedProjectSlugs, setSelectedProjectSlugs] = useState<string[]>(initialProjectSlugs);

    const {
        filtered: filteredEvents,
        query: eventQuery,
        setQuery: setEventQuery,
        loading: eventsLoading,
        error: eventsError
    } = useSearchableOptions({ loadAll: loadAllEvents });
    const [selectedEventSlugs, setSelectedEventSlugs] = useState<string[]>(initialEventSlugs);

    // Photos: existing (from backend) + new uploads + cover selection
    const [existingPhotos, setExistingPhotos] =
        useState<string[]>(initialImages);
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const [photosError, setPhotosError] = useState<string | null>(null);

    const [headerExistingIndex, setHeaderExistingIndex] = useState<number | null>(
        () => {
            const cover: string | null =
                initialBlog?.cover ?? initialBlog?.imageUrl ?? null;
            if (cover && initialImages.length) {
                const idx = initialImages.indexOf(cover);
                if (idx >= 0) return idx;
            }
            return initialImages.length ? 0 : null;
        },
    );
    const [headerNewIndex, setHeaderNewIndex] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const tagsCsvDefault = initialTags.join(", ");
    const techCsvDefault = initialTechStack.join(", ");

    // Load members list (kept manual because custom UI with chips)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/members?size=200`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const json = (await res.json()) as MembersApiResponse;
                if (!cancelled) {
                    const items = Array.isArray(json.items) ? json.items : [];
                    setMembers(
                        items.map(
                            (m): MemberOption => ({
                                slug: m.slug,
                                name: m.name,
                                avatarUrl: m.avatarUrl || null,
                                headline: m.headline || m.shortBio || null,
                            }),
                        ),
                    );
                }
            } catch {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);


    /* ----------------------------- Photos logic ----------------------------- */

    function syncFileInput(files: File[]) {
        const input = fileInputRef.current;
        if (!input) return;
        const dt = new DataTransfer();
        for (const f of files) {
            dt.items.add(f);
        }
        input.files = dt.files;
    }

    function handleNewPhotos(files: FileList | null) {
        if (!files || !files.length) return;
        const arr = Array.from(files);

        const unsupported = arr.filter((f) => !isAllowedImage(f));
        if (unsupported.length) {
            setPhotosError(
                tClient("blog.editor.photos.error.type"),
            );
        } else {
            setPhotosError(null);
        }

        const allowed = arr.filter(isAllowedImage);
        if (!allowed.length && unsupported.length) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        const combined = [...newPhotos, ...allowed];
        if (combined.length + existingPhotos.length > 20) {
            setPhotosError(
                tClient("blog.editor.photos.error.tooMany"),
            );
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setNewPhotos(combined);
        syncFileInput(combined);

        if (
            headerExistingIndex === null &&
            headerNewIndex === null &&
            combined.length
        ) {
            setHeaderNewIndex(0);
        }
    }

    function removeExistingPhoto(idx: number) {
        setExistingPhotos((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            if (headerExistingIndex !== null) {
                if (headerExistingIndex === idx) {
                    setHeaderExistingIndex(null);
                } else if (headerExistingIndex > idx) {
                    setHeaderExistingIndex(headerExistingIndex - 1);
                }
            }
            return next;
        });
    }

    function removeNewPhoto(idx: number) {
        setNewPhotos((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            if (headerNewIndex !== null) {
                if (headerNewIndex === idx) {
                    setHeaderNewIndex(null);
                } else if (headerNewIndex > idx) {
                    setHeaderNewIndex(headerNewIndex - 1);
                }
            }
            syncFileInput(next);
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

    /* ------------------------- People logic ------------------------- */

    const memberQuery = memberQ.trim().toLowerCase();
    const memberSuggestions = members
        .filter((m) => !selectedAuthors.some((a) => a.slug === m.slug))
        .filter((m) => {
            if (!memberQuery) return true;
            return (
                m.name.toLowerCase().includes(memberQuery) ||
                m.slug.toLowerCase().includes(memberQuery)
            );
        })
        .slice(0, 8);

    function addAuthor(m: MemberOption) {
        if (selectedAuthors.some((a) => a.slug === m.slug)) return;
        setSelectedAuthors((prev) => [...prev, m]);
        setMemberQ("");
    }

    function removeAuthor(slug: string) {
        setSelectedAuthors((prev) => prev.filter((a) => a.slug !== slug));
    }

    /* -------------------------------- Render -------------------------------- */

    const authorSlugs = selectedAuthors.map((a) => a.slug);
    const projectSlugs = selectedProjectSlugs;
    const eventSlugs = selectedEventSlugs;

    const isTest = process.env.NODE_ENV === 'test';

    return (
        <form
            {...(isTest
                ? {
                    onSubmit: (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        void onSubmit(formData);
                    },
                }
                : {
                    action: onSubmit,
                })}
            encType="multipart/form-data"
            className="card p-5 space-y-4"
        >
            {/* Title */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                    {tClient("blog.editor.title.label")}
                    <span className="text-red-400">*</span>
                </label>
                <input
                    name="title"
                    required
                    defaultValue={initialTitle}
                    placeholder={tClient(
                        "blog.editor.title.placeholder",
                    )}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                />
            </div>

            {/* Summary */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                    {tClient("blog.editor.summary.label")}
                </label>
                <textarea
                    name="summary"
                    rows={3}
                    defaultValue={initialSummary}
                    placeholder={tClient(
                        "blog.editor.summary.placeholder",
                    )}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                />
            </div>

            {/* Content + Markdown preview */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60">
                        {tClient("blog.editor.content.label")}
                    </label>
                    <span className="text-[11px] text-white/50">
                        {content.length}{" "}
                        {tClient("blog.editor.content.charCountSuffix")}
                    </span>
                </div>
                <textarea
                    name="content"
                    rows={10}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={tClient(
                        "blog.editor.content.placeholder",
                    )}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/30"
                />

                <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {tClient("blog.editor.preview.label")}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 max-h-80 overflow-y-auto prose prose-sm prose-invert">
                        {content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {content}
                            </ReactMarkdown>
                        ) : (
                            <p className="text-xs text-white/50">
                                {tClient(
                                    "blog.editor.preview.empty",
                                )}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tags + tech stack */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {tClient("blog.editor.tags.label")}
                    </label>
                    <input
                        name="tags"
                        defaultValue={tagsCsvDefault}
                        placeholder={tClient(
                            "blog.editor.tags.placeholder",
                        )}
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="mt-1 text-xs text-white/50">
                        {tClient("blog.editor.tags.helper")}
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {tClient("blog.editor.tech.label")}
                    </label>
                    <input
                        name="techStack"
                        defaultValue={techCsvDefault}
                        placeholder={tClient(
                            "blog.editor.tech.placeholder",
                        )}
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="mt-1 text-xs text-white/50">
                        {tClient("blog.editor.tech.helper")}
                    </p>
                </div>
            </div>

            {/* Published date + Authors */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {tClient("blog.editor.publishedAt.label")}
                    </label>
                    <input
                        type="date"
                        name="publishedAt"
                        defaultValue={initialPublishedDate}
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="mt-1 text-xs text-white/50">
                        {tClient("blog.editor.publishedAt.helper")}
                    </p>
                </div>

                {/* Authors selection */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {tClient("blog.editor.authors.label")}
                    </label>
                    <input
                        type="text"
                        value={memberQ}
                        onChange={(e) => setMemberQ(e.target.value)}
                        placeholder={tClient(
                            "blog.editor.authors.searchPlaceholder",
                        )}
                        className={searchInputCls()}
                    />
                    {memberSuggestions.length > 0 && memberQ.trim() && (
                        <div className="mt-1 rounded-md bg-black/80 border border-white/15 max-h-52 overflow-y-auto text-sm">
                            {memberSuggestions.map((m) => (
                                <button
                                    key={m.slug}
                                    type="button"
                                    onClick={() => addAuthor(m)}
                                    className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <Image
                                        src={
                                            m.avatarUrl ||
                                            "/avatars/default.png"
                                        }
                                        alt={m.name}
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium">
                                            {m.name}
                                        </div>
                                        <div className="text-[11px] text-white/50 truncate">
                                            {m.headline || m.slug}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                        {selectedAuthors.length === 0 ? (
                            <p className="text-xs text-white/50">
                                {tClient(
                                    "blog.editor.authors.empty",
                                )}
                            </p>
                        ) : (
                            selectedAuthors.map((a) => (
                                <span
                                    key={a.slug}
                                    className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-1 text-xs"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <Image
                                        src={
                                            a.avatarUrl ||
                                            "/avatars/default.png"
                                        }
                                        alt={a.name}
                                        width={24}
                                        height={24}
                                        className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
                                    />
                                    <span className="max-w-[120px] truncate">
                                        {a.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeAuthor(a.slug)}
                                        className="text-white/60 hover:text-red-300"
                                        aria-label={tClient(
                                            "blog.editor.authors.remove",
                                        )}
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))
                        )}
                    </div>

                    <p className="mt-1 text-xs text-white/50">
                        {tClient("blog.editor.authors.helper")}
                    </p>
                </div>
            </div>

            {/* Related projects & events (using LinkedResourcePicker) + Photos */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Related projects & events */}
                <div className="space-y-6">
                    <LinkedResourcePicker
                        label={tClient("blog.editor.projects.label")}
                        searchPlaceholder={tClient("blog.editor.projects.searchPlaceholder")}
                        options={filteredProjects}
                        selectedIds={selectedProjectSlugs}
                        onChangeSelected={setSelectedProjectSlugs}
                        query={projectQuery}
                        onQueryChange={setProjectQuery}
                        loading={projectsLoading}
                        error={projectsError ? <span className="text-red-300">Error loading projects</span> : null}
                        emptyStateText={tClient("blog.editor.projects.empty")}
                    />

                    <LinkedResourcePicker
                        label={tClient("blog.editor.events.label")}
                        searchPlaceholder={tClient("blog.editor.events.searchPlaceholder")}
                        options={filteredEvents}
                        selectedIds={selectedEventSlugs}
                        onChangeSelected={setSelectedEventSlugs}
                        query={eventQuery}
                        onQueryChange={setEventQuery}
                        loading={eventsLoading}
                        error={eventsError ? <span className="text-red-300">Error loading events</span> : null}
                        emptyStateText={tClient("blog.editor.events.empty")}
                    />
                </div>

                {/* Photos UI */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        {tClient("blog.editor.photos.label")}
                    </label>

                    <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs text-white/50">
                            {tClient("blog.editor.photos.helper")}
                        </p>
                        <label className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs ring-1 ring-white/10 cursor-pointer">
                            <span>{tClient("blog.editor.photos.upload")}</span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                name="photos"
                                multiple
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                className="hidden"
                                onChange={(e) =>
                                    handleNewPhotos(e.target.files)
                                }
                            />
                        </label>
                    </div>

                    {photosError && (
                        <p className="text-xs text-red-300 mb-1">
                            {photosError}
                        </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                        {/* Existing photos */}
                        {existingPhotos.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-[11px] uppercase tracking-widest text-white/60">
                                    {tClient(
                                        "blog.editor.photos.existingSection",
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {existingPhotos.map((src, idx) => {
                                        const isHeader =
                                            headerExistingIndex === idx &&
                                            headerNewIndex === null;
                                        return (
                                            <div
                                                key={src + idx}
                                                className={`relative group rounded-md overflow-hidden ring-1 ${
                                                    isHeader
                                                        ? "ring-emerald-400"
                                                        : "ring-white/10"
                                                }`}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <Image
                                                    src={src}
                                                    alt={tClient(
                                                        "blog.editor.photos.existingAlt",
                                                    ).replace(
                                                        "{index}",
                                                        String(idx + 1),
                                                    )}
                                                    width={160}
                                                    height={80}
                                                    className="w-full h-20 object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-1 text-[10px]">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setHeaderFromExisting(
                                                                idx,
                                                            )
                                                        }
                                                        className="rounded bg-black/70 px-1 py-0.5 border border-white/30"
                                                    >
                                                        {isHeader
                                                            ? tClient(
                                                                "blog.editor.photos.coverLabel",
                                                            )
                                                            : tClient(
                                                                "blog.editor.photos.setCover",
                                                            )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeExistingPhoto(
                                                                idx,
                                                            )
                                                        }
                                                        className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200"
                                                    >
                                                        {tClient(
                                                            "blog.editor.photos.removeExisting",
                                                        ).replace(
                                                            "{index}",
                                                            String(idx + 1),
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
                        {newPhotos.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-[11px] uppercase tracking-widest text-white/60">
                                    {tClient(
                                        "blog.editor.photos.newSection",
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {newPhotos.map((file, idx) => {
                                        const url =
                                            URL.createObjectURL(file);
                                        const isHeader =
                                            headerNewIndex === idx &&
                                            headerExistingIndex === null;
                                        return (
                                            <div
                                                key={file.name + idx}
                                                className={`relative group rounded-md overflow-hidden ring-1 ${
                                                    isHeader
                                                        ? "ring-emerald-400"
                                                        : "ring-white/10"
                                                }`}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <Image
                                                    src={url}
                                                    alt={file.name}
                                                    width={160}
                                                    height={80}
                                                    className="w-full h-20 object-cover"
                                                    unoptimized
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-1 text-[10px]">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setHeaderFromNew(
                                                                idx,
                                                            )
                                                        }
                                                        className="rounded bg-black/70 px-1 py-0.5 border border-white/30"
                                                    >
                                                        {isHeader
                                                            ? tClient(
                                                                "blog.editor.photos.coverLabel",
                                                            )
                                                            : tClient(
                                                                "blog.editor.photos.setCover",
                                                            )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeNewPhoto(idx)
                                                        }
                                                        className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200"
                                                    >
                                                        {tClient(
                                                            "blog.editor.photos.removeNew",
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

                    {existingPhotos.length === 0 &&
                        newPhotos.length === 0 && (
                            <p className="mt-1 text-xs text-white/50">
                                {tClient("blog.editor.photos.empty")}
                            </p>
                        )}

                    {/* Hidden fields for server actions */}
                    <input
                        type="hidden"
                        name="existingPhotos"
                        value={existingPhotos.join("\n")}
                    />
                    <input
                        type="hidden"
                        name="headerExistingIndex"
                        value={
                            headerExistingIndex !== null
                                ? String(headerExistingIndex)
                                : ""
                        }
                    />
                    <input
                        type="hidden"
                        name="headerNewIndex"
                        value={
                            headerNewIndex !== null
                                ? String(headerNewIndex)
                                : ""
                        }
                    />
                </div>
            </div>

            {/* Hidden fields for authors, projects and events */}
            <input
                type="hidden"
                name="authorSlugs"
                value={authorSlugs.join(",")}
            />
            <input
                type="hidden"
                name="projectSlugs"
                value={projectSlugs.join(",")}
            />
            <input
                type="hidden"
                name="eventSlugs"
                value={eventSlugs.join(",")}
            />

            <div className="pt-2 border-t border-white/10 mt-4 flex items-center justify-end gap-3">
                <button type="submit" className="btn-primary">
                    {mode === "edit"
                        ? tClient("blog.editor.submit.save")
                        : tClient("blog.editor.submit.create")}
                </button>
            </div>
        </form>
    );
};

export default BlogEditorForm;