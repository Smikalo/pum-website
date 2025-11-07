"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "@/lib/config";

type BlogEditorFormProps = {
    mode: "create" | "edit";
    initialBlog?: any;
    onSubmit: (formData: FormData) => void | Promise<void>;
};

type MemberOption = {
    slug: string;
    name: string;
    avatarUrl?: string | null;
    headline?: string | null;
    role?: string | null; // to detect CREATOR on initialBlog
};

type ProjectOption = {
    slug: string;
    title: string;
    cover?: string | null;
    year?: number | null;
};

const emptyArr: any[] = [];

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

function isAllowedImage(file: File) {
    const t = (file.type || "").toLowerCase();
    return ALLOWED_IMAGE_MIME.includes(t as any);
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
        : emptyArr;
    const initialImages: string[] = Array.isArray(initialBlog?.images)
        ? initialBlog.images
        : [];
    const initialPublishedDate: string =
        initialBlog?.publishedAt
            ? new Date(initialBlog.publishedAt).toISOString().slice(0, 10)
            : "";

    const [content, setContent] = useState<string>(initialContent);
    const [members, setMembers] = useState<MemberOption[]>([]);
    const [projects, setProjects] = useState<ProjectOption[]>([]);

    // People & projects selection (project-style)
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

    const [projectQ, setProjectQ] = useState("");
    const [selectedProjectSlugs, setSelectedProjectSlugs] = useState<string[]>(
        [],
    );

    // Photos: existing (from backend) + new uploads + cover selection
    const [existingPhotos, setExistingPhotos] =
        useState<string[]>(initialImages);
    const [newPhotos, setNewPhotos] = useState<File[]>([]);
    const [photosError, setPhotosError] = useState<string | null>(null);

    const [headerExistingIndex, setHeaderExistingIndex] = useState<
        number | null
    >(() => {
        // If backend exposes cover, prefer it
        const cover: string | null =
            initialBlog?.cover ?? initialBlog?.imageUrl ?? null;
        if (cover && initialImages.length) {
            const idx = initialImages.indexOf(cover);
            if (idx >= 0) return idx;
        }
        return initialImages.length ? 0 : null;
    });
    const [headerNewIndex, setHeaderNewIndex] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const tagsCsvDefault = initialTags.join(", ");
    const techCsvDefault = initialTechStack.join(", ");

    // Load members list
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/members?size=200`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const json = await res.json();
                if (!cancelled) {
                    const items: any[] = Array.isArray(json.items)
                        ? json.items
                        : [];
                    setMembers(
                        items.map((m) => ({
                            slug: m.slug,
                            name: m.name,
                            avatarUrl: m.avatarUrl || null,
                            headline: m.headline || m.shortBio || null,
                        })),
                    );
                }
            } catch (err) {
                console.error(
                    "[BlogEditorForm] failed to load members",
                    err,
                );
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Load projects list
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/projects?size=200`, {
                    credentials: "include",
                });
                if (!res.ok) return;
                const json = await res.json();
                if (!cancelled) {
                    const items: any[] = Array.isArray(json.items)
                        ? json.items
                        : [];
                    setProjects(
                        items.map((p) => ({
                            slug: p.slug,
                            title: p.title,
                            cover:
                                Array.isArray(p.photos) && p.photos.length
                                    ? p.photos[0]
                                    : p.cover || null,
                            year: typeof p.year === "number" ? p.year : null,
                        })),
                    );
                }
            } catch (err) {
                console.error(
                    "[BlogEditorForm] failed to load projects",
                    err,
                );
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

        // Filter by supported MIME types BEFORE we add them
        const unsupported = arr.filter((f) => !isAllowedImage(f));
        if (unsupported.length) {
            setPhotosError(
                "Some files were skipped: only PNG, JPG/JPEG, WEBP, and GIF are supported.",
            );
        } else {
            setPhotosError(null);
        }

        const allowed = arr.filter(isAllowedImage);
        if (!allowed.length && unsupported.length) {
            // Nothing to add
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        const combined = [...newPhotos, ...allowed];
        if (combined.length + existingPhotos.length > 20) {
            setPhotosError("Please keep to 20 images max.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setNewPhotos(combined);
        syncFileInput(combined);

        // If no cover yet, and no existing cover, set first new as cover
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
            // adjust header index if needed
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
            // resync input
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

    /* ------------------------- People / project logic ------------------------- */

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

    const projectQuery = projectQ.trim().toLowerCase();
    const projectSuggestions = projects
        .filter((p) => !selectedProjectSlugs.includes(p.slug))
        .filter((p) => {
            if (!projectQuery) return true;
            return (
                p.title.toLowerCase().includes(projectQuery) ||
                p.slug.toLowerCase().includes(projectQuery)
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

    function toggleProject(slug: string) {
        setSelectedProjectSlugs((prev) =>
            prev.includes(slug)
                ? prev.filter((s) => s !== slug)
                : [...prev, slug],
        );
    }

    /* -------------------------------- Render -------------------------------- */

    const authorSlugs = selectedAuthors.map((a) => a.slug);
    const projectSlugs = selectedProjectSlugs;

    return (
        <form
            action={onSubmit}
            encType="multipart/form-data"
            className="card p-5 space-y-4"
        >
            {/* Title */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                    Title<span className="text-red-400">*</span>
                </label>
                <input
                    name="title"
                    required
                    defaultValue={initialTitle}
                    placeholder="e.g. Building side projects with the PUM community"
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                />
            </div>

            {/* Summary */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                    Summary
                </label>
                <textarea
                    name="summary"
                    rows={3}
                    defaultValue={initialSummary}
                    placeholder="Short teaser shown in lists and social previews."
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                />
            </div>

            {/* Content + Markdown preview */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60">
                        Content (Markdown supported)
                    </label>
                    <span className="text-[11px] text-white/50">
                        {content.length} characters
                    </span>
                </div>
                <textarea
                    name="content"
                    rows={10}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your story here in Markdown or plain text."
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/30"
                />

                <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Live preview
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3 max-h-80 overflow-y-auto prose prose-sm prose-invert">
                        {content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {content}
                            </ReactMarkdown>
                        ) : (
                            <p className="text-xs text-white/50">
                                Start typing above to see rendered Markdown.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Tags + tech stack */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Tags
                    </label>
                    <input
                        name="tags"
                        defaultValue={tagsCsvDefault}
                        placeholder="hackathon, ai, community"
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="mt-1 text-xs text-white/50">
                        Comma-separated.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Tech stack
                    </label>
                    <input
                        name="techStack"
                        defaultValue={techCsvDefault}
                        placeholder="TypeScript, Next.js, PostgreSQL"
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="mt-1 text-xs text-white/50">
                        Comma-separated.
                    </p>
                </div>
            </div>

            {/* Published date */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Published date
                    </label>
                    <input
                        type="date"
                        name="publishedAt"
                        defaultValue={initialPublishedDate}
                        className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <p className="mt-1 text-xs text-white/50">
                        Leave empty to keep it as a draft / unpublished.
                    </p>
                </div>

                {/* Authors selection (project-style) */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Authors
                    </label>
                    <input
                        type="text"
                        value={memberQ}
                        onChange={(e) => setMemberQ(e.target.value)}
                        placeholder="Search members by name or slug…"
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
                                    <img
                                        src={
                                            m.avatarUrl ||
                                            "/avatars/default.png"
                                        }
                                        alt={m.name}
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
                                No authors selected yet. The post creator will
                                be added on the backend.
                            </p>
                        ) : (
                            selectedAuthors.map((a) => (
                                <span
                                    key={a.slug}
                                    className="inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-1 text-xs"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={
                                            a.avatarUrl ||
                                            "/avatars/default.png"
                                        }
                                        alt={a.name}
                                        className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
                                    />
                                    <span className="max-w-[120px] truncate">
                                        {a.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeAuthor(a.slug)}
                                        className="text-white/60 hover:text-red-300"
                                        aria-label={`Remove ${a.name}`}
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))
                        )}
                    </div>

                    <p className="mt-1 text-xs text-white/50">
                        The post creator is always kept as an author.
                    </p>
                </div>
            </div>

            {/* Related projects + photos */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Related projects (project-style) */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Related projects
                    </label>
                    <input
                        type="text"
                        value={projectQ}
                        onChange={(e) => setProjectQ(e.target.value)}
                        placeholder="Search projects by title or slug…"
                        className={searchInputCls()}
                    />
                    {projectSuggestions.length > 0 && projectQ.trim() && (
                        <div className="mt-1 rounded-md bg-black/80 border border-white/15 max-h-52 overflow-y-auto text-sm">
                            {projectSuggestions.map((p) => (
                                <button
                                    key={p.slug}
                                    type="button"
                                    onClick={() => toggleProject(p.slug)}
                                    className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/5 text-left"
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {p.cover && (
                                        <img
                                            src={p.cover}
                                            alt={p.title}
                                            className="w-8 h-8 rounded-md object-cover ring-1 ring-white/10"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium truncate">
                                            {p.title}
                                        </div>
                                        <div className="text-[11px] text-white/50">
                                            {p.year ? p.year : p.slug}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedProjectSlugs.length === 0 ? (
                            <p className="text-xs text-white/50">
                                No projects linked yet. Optional.
                            </p>
                        ) : (
                            selectedProjectSlugs.map((slug) => {
                                const proj = projects.find(
                                    (p) => p.slug === slug,
                                );
                                const label = proj ? proj.title : slug;
                                return (
                                    <button
                                        key={slug}
                                        type="button"
                                        onClick={() => toggleProject(slug)}
                                        className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10 hover:bg-white/10"
                                    >
                                        <span>{label}</span>
                                        <span className="text-xs text-white/60">
                                            ×
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Photos UI (project-style) */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">
                        Photos
                    </label>

                    <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs text-white/50">
                            Add a cover image and gallery shots. These will be
                            reused on the blog page.
                        </p>
                        <label className="inline-flex items-center px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-xs ring-1 ring-white/10 cursor-pointer">
                            <span>Upload</span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                name="photos"
                                multiple
                                // important: tighten accepted types to match backend
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                className="hidden"
                                onChange={(e) => handleNewPhotos(e.target.files)}
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
                                    Existing
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
                                                <img
                                                    src={src}
                                                    alt={`Existing image ${
                                                        idx + 1
                                                    }`}
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
                                                            ? "Cover image"
                                                            : "Set as cover"}
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
                                                        Remove
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
                                    New uploads (not saved yet)
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
                                                <img
                                                    src={url}
                                                    alt={file.name}
                                                    className="w-full h-20 object-cover"
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
                                                            ? "Cover image"
                                                            : "Set as cover"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeNewPhoto(idx)
                                                        }
                                                        className="rounded bg-black/70 px-1 py-0.5 border border-red-400/70 text-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {existingPhotos.length === 0 && newPhotos.length === 0 && (
                        <p className="mt-1 text-xs text-white/50">
                            No images yet. The cover image will be used at the
                            top of the post and in lists.
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

            {/* Hidden fields for authors and projects (CSV-style) */}
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

            <div className="pt-2 border-t border-white/10 mt-4 flex items-center justify-end gap-3">
                <button type="submit" className="btn-primary">
                    {mode === "edit" ? "Save changes" : "Create post"}
                </button>
            </div>
        </form>
    );
};

export default BlogEditorForm;
