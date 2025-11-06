"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/context/AuthProvider";
import * as api from "@/lib/api";

const AREAS = [
    "FRONTEND",
    "BACKEND",
    "ML",
    "DATA",
    "DEVOPS",
    "DESIGN",
    "PM",
    "OTHER",
] as const;
type Area = (typeof AREAS)[number];

type MemberProfile = {
    id: string;
    slug: string;
    name: string;
    headline: string | null;
    shortBio: string | null;
    markdown: string;
    links: Record<string, string>;
    focusArea: Area | null;
    skills: string[];
    techStack: string[];
    cvUrl: string | null;
    avatarUrl: string | null;
    userRoles: string[];
};

type LinkRow = { label: string; url: string };

type MemberAdminEditorProps = {
    slug: string;
    onClose: () => void;
};

type AccessRole = "" | "MODERATOR" | "MEMBER";

export default function MemberAdminEditor({
                                              slug,
                                              onClose,
                                          }: MemberAdminEditorProps) {
    const router = useRouter();
    const { accessToken, user } = useAuth();

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    const [profile, setProfile] = React.useState<MemberProfile | null>(null);

    // form state
    const [name, setName] = React.useState("");
    const [headline, setHeadline] = React.useState("");
    const [shortBio, setShortBio] = React.useState("");
    const [markdown, setMarkdown] = React.useState("");
    const [links, setLinks] = React.useState<LinkRow[]>([]);
    const [skills, setSkills] = React.useState("");
    const [tech, setTech] = React.useState("");
    const [focusArea, setFocusArea] = React.useState<Area | "">("");

    // avatar state
    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
    const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

    // cv state
    const [cvUrl, setCvUrl] = React.useState<string | null>(null);
    const [cvFile, setCvFile] = React.useState<File | null>(null);
    const [uploadingCv, setUploadingCv] = React.useState(false);

    // access role (for underlying user)
    const [accessRole, setAccessRole] = React.useState<AccessRole>("");

    // delete state
    const [deleteConfirmSlug, setDeleteConfirmSlug] = React.useState("");

    // feedback
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [error, setError] = React.useState<string | null>(null);
    const [hint, setHint] = React.useState<string | null>(null);

    const isAdmin = !!user?.roles?.includes("ADMIN");

    // --------------------------- helpers ---------------------------

    const inputCls = (field?: string) =>
        [
            "w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white",
            "placeholder:text-white/40 ring-1 outline-none",
            field && errors[field]
                ? "ring-red-400 focus:ring-red-400/80"
                : "ring-white/10 focus:ring-white/30",
        ].join(" ");

    function normalizeMemberFromApi(m: any): MemberProfile {
        const rawSkills: unknown[] = Array.isArray(m?.skills) ? m.skills : [];
        const rawTech: unknown[] = Array.isArray(m?.techStack)
            ? m.techStack
            : [];
        const linksObj: Record<string, string> =
            m && typeof m.links === "object" && m.links !== null
                ? m.links
                : {};

        const skillsArr = rawSkills
            .map((s) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean);
        const techArr = rawTech
            .map((s) => (typeof s === "string" ? s.trim() : ""))
            .filter(Boolean);

        const focus: Area | null =
            typeof m?.focusArea === "string" &&
            (AREAS as readonly string[]).includes(m.focusArea)
                ? (m.focusArea as Area)
                : null;

        const rawRoles: unknown[] = Array.isArray(m?.userRoles)
            ? m.userRoles
            : Array.isArray(m?.roles)
                ? m.roles
                : [];
        const userRoles = rawRoles
            .map((r) =>
                typeof r === "string" ? r.trim().toUpperCase() : "",
            )
            .filter(Boolean);

        const avatarUrl: string | null =
            typeof m?.avatarUrl === "string"
                ? m.avatarUrl
                : typeof m?.avatar === "string"
                    ? m.avatar
                    : null;

        return {
            id: String(m?.id ?? ""),
            slug: String(m?.slug ?? ""),
            name: String(m?.name ?? ""),
            headline:
                typeof m?.headline === "string"
                    ? m.headline
                    : m?.headline ?? null,
            shortBio:
                typeof m?.shortBio === "string"
                    ? m.shortBio
                    : m?.shortBio ?? null,
            markdown:
                typeof m?.markdown === "string"
                    ? m.markdown
                    : typeof m?.bio === "string"
                        ? m.bio
                        : "",
            links: linksObj,
            focusArea: focus,
            skills: skillsArr,
            techStack: techArr,
            cvUrl: typeof m?.cvUrl === "string" ? m.cvUrl : null,
            avatarUrl,
            userRoles,
        };
    }

    function linksObjectToRows(obj: Record<string, string>): LinkRow[] {
        return Object.entries(obj || {}).map(([label, url]) => ({
            label,
            url: url ?? "",
        }));
    }

    function linksRowsToObject(rows: LinkRow[]): Record<string, string> {
        const out: Record<string, string> = {};
        for (const row of rows) {
            const label = row.label.trim();
            const url = row.url.trim();
            if (!label || !url) continue;
            out[label] = url;
        }
        return out;
    }

    function prettyAreaLabel(a: Area) {
        switch (a) {
            case "FRONTEND":
                return "Frontend";
            case "BACKEND":
                return "Backend";
            case "ML":
                return "Machine learning";
            case "DATA":
                return "Data / Analytics";
            case "DEVOPS":
                return "DevOps / Infra";
            case "DESIGN":
                return "Design / UX";
            case "PM":
                return "Product / Project mgmt";
            case "OTHER":
            default:
                return "Other";
        }
    }

    function deriveAccessRole(roles: string[]): AccessRole {
        if (roles.includes("MODERATOR")) return "MODERATOR";
        if (roles.includes("MEMBER")) return "MEMBER";
        return "";
    }

    // --------------------------- load member ---------------------------

    React.useEffect(() => {
        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            setHint(null);
            setErrors({});

            try {
                const res = await fetch(`${API_BASE}/api/members/${slug}`, {
                    cache: "no-store",
                });
                if (!res.ok) {
                    throw new Error("Failed to load member profile.");
                }
                const json = await res.json();
                if (cancelled) return;

                const prof = normalizeMemberFromApi(json);
                setProfile(prof);

                setName(prof.name || "");
                setHeadline(prof.headline ?? "");
                setShortBio(prof.shortBio ?? "");
                setMarkdown(prof.markdown || "");
                setFocusArea(prof.focusArea ?? "");
                setLinks(linksObjectToRows(prof.links));
                setSkills(prof.skills.join(", "));
                setTech(prof.techStack.join(", "));
                setCvUrl(prof.cvUrl);
                setAvatarUrl(prof.avatarUrl ?? null);
                setAccessRole(deriveAccessRole(prof.userRoles));
            } catch (err: any) {
                if (cancelled) return;
                setError(err?.message || "Failed to load member profile.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    // --------------------------- save handler ---------------------------

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!accessToken) {
            setError(
                "You must be logged in as an admin or moderator to edit member profiles.",
            );
            return;
        }

        const nextErrors: Record<string, string> = {};
        if (!name.trim()) {
            nextErrors.name = "Name is required.";
        }

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) return;

        const skillsArr = skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const techArr = tech
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

        const body: any = {
            name: name.trim(),
            headline: headline.trim() || null,
            shortBio: shortBio.trim() || null,
            markdown: markdown || "",
            links: linksRowsToObject(links),
            skills: skillsArr,
            techStack: techArr,
            focusArea: focusArea || null,
        };

        // only admins can change roles; send desired role as accessRole
        if (isAdmin) {
            body.accessRole = accessRole || null; // "MODERATOR" | "MEMBER" | null
        }

        setSaving(true);
        setError(null);
        setHint(null);

        try {
            const res: any = await api.updateMemberProfile(
                accessToken,
                slug,
                body,
            );
            if (res && res.member) {
                const prof = normalizeMemberFromApi(res.member);
                setProfile(prof);
                setCvUrl(prof.cvUrl);
                setAvatarUrl(prof.avatarUrl ?? null);
                setAccessRole(deriveAccessRole(prof.userRoles));
            }
            setHint("Profile updated ✓");
        } catch (err: any) {
            setError(err?.message || "Failed to update member profile.");
        } finally {
            setSaving(false);
        }
    }

    // --------------------------- avatar handlers ---------------------------

    async function onUploadAvatar() {
        if (!accessToken) {
            setError(
                "You must be logged in as an admin or moderator to change profile pictures.",
            );
            return;
        }
        if (!avatarFile) {
            setError("Please choose an image file to upload.");
            return;
        }

        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(avatarFile.type)) {
            setError(
                "Unsupported image type. Please upload PNG, JPG, JPEG, WEBP, or GIF.",
            );
            return;
        }

        setUploadingAvatar(true);
        setError(null);
        setHint(null);

        try {
            // Requires backend endpoint & helper:
            // POST /api/members/:slug/avatar + api.uploadMemberAvatar(token, slug, file)
            const res: any = await api.uploadMemberAvatar(
                accessToken,
                slug,
                avatarFile,
            );
            // Expecting response { ok: true, url: string } or similar
            if (res?.url || res?.avatarUrl) {
                setAvatarUrl(res.url || res.avatarUrl);
                setHint("Profile picture updated ✓");
                setAvatarFile(null);
            } else if (res?.member) {
                const prof = normalizeMemberFromApi(res.member);
                setProfile(prof);
                setAvatarUrl(prof.avatarUrl ?? null);
                setHint("Profile picture updated ✓");
            } else {
                setHint("Avatar uploaded.");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to upload profile picture.");
        } finally {
            setUploadingAvatar(false);
        }
    }

    // --------------------------- CV handlers ---------------------------

    async function onUploadCv() {
        if (!accessToken) {
            setError(
                "You must be logged in as an admin or moderator to upload CVs.",
            );
            return;
        }
        if (!cvFile) {
            setError("Please choose a PDF file to upload.");
            return;
        }
        if (cvFile.type !== "application/pdf") {
            setError("CV must be a PDF file.");
            return;
        }

        setUploadingCv(true);
        setError(null);
        setHint(null);

        try {
            const res: any = await api.uploadMemberCv(
                accessToken,
                slug,
                cvFile,
            );
            // Backend returns { ok: true, url }
            if (res?.url) {
                setCvUrl(res.url);
                setHint("CV uploaded ✓");
                setCvFile(null);
            } else if (res?.cvUrl) {
                setCvUrl(res.cvUrl);
                setHint("CV uploaded ✓");
                setCvFile(null);
            } else {
                setHint("CV uploaded.");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to upload CV.");
        } finally {
            setUploadingCv(false);
        }
    }

    // --------------------------- delete handler ---------------------------

    async function onDelete() {
        if (!accessToken) {
            setError(
                "You must be logged in as an admin or moderator to delete members.",
            );
            return;
        }

        const trimmed = deleteConfirmSlug.trim();
        if (!trimmed) {
            setError("Please type the member slug to confirm deletion.");
            return;
        }
        if (trimmed !== slug) {
            setError(`Slug mismatch. Type "${slug}" to confirm deletion.`);
            return;
        }

        const ok = window.confirm(
            "This will permanently delete this member profile and its associations. This action cannot be undone.\n\nAre you absolutely sure?",
        );
        if (!ok) return;

        setDeleting(true);
        setError(null);
        setHint(null);

        try {
            await api.deleteMember(accessToken, slug, trimmed);
            setHint("Member deleted ✓ Redirecting…");
            router.push("/members");
        } catch (err: any) {
            setError(err?.message || "Failed to delete member.");
        } finally {
            setDeleting(false);
        }
    }

    // --------------------------- link list helpers ---------------------------

    function addLinkRow() {
        setLinks((prev) => [...prev, { label: "", url: "" }]);
    }

    function updateLinkRow(index: number, patch: Partial<LinkRow>) {
        setLinks((prev) =>
            prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
        );
    }

    function removeLinkRow(index: number) {
        setLinks((prev) => prev.filter((_, i) => i !== index));
    }

    // --------------------------- render ---------------------------

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-slate-900/95 ring-1 ring-white/10 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-white">
                            Edit member profile
                        </h2>
                        <p className="text-xs text-white/60 mt-1">
                            Editing public member entry{" "}
                            <span className="font-mono text-white/80">
                                {slug}
                            </span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm text-white/60 hover:text-white"
                    >
                        Close
                    </button>
                </div>

                {error && (
                    <div className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {error}
                    </div>
                )}
                {hint && (
                    <div className="mb-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                        {hint}
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-white/70">Loading member…</p>
                ) : !profile ? (
                    <p className="text-sm text-red-300">
                        Member could not be loaded.
                    </p>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Left column: basic info + avatar */}
                            <div className="space-y-4">
                                <div className="card p-4 space-y-4">
                                    {/* Avatar */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0">
                                            {avatarUrl ? (
                                                <img
                                                    src={avatarUrl}
                                                    alt={name || profile.name}
                                                    className="h-16 w-16 rounded-full object-cover border border-white/20 bg-white/10"
                                                />
                                            ) : (
                                                <div className="h-16 w-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs text-white/50">
                                                    No photo
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <label className="block text-sm">
                                                Profile picture
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                                onChange={(e) =>
                                                    setAvatarFile(
                                                        e.target.files?.[0] ||
                                                        null,
                                                    )
                                                }
                                                className="block w-full text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20"
                                            />
                                            <button
                                                type="button"
                                                onClick={onUploadAvatar}
                                                disabled={
                                                    uploadingAvatar ||
                                                    !avatarFile
                                                }
                                                className="btn-secondary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {uploadingAvatar
                                                    ? "Uploading picture…"
                                                    : "Upload new picture"}
                                            </button>
                                            <p className="text-[11px] text-white/45">
                                                PNG, JPG, WEBP or GIF. Will be
                                                shown on member cards and
                                                profile pages.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) =>
                                                setName(e.target.value)
                                            }
                                            className={inputCls("name")}
                                            placeholder="Full name"
                                            autoFocus
                                        />
                                        {errors.name && (
                                            <p className="mt-1 text-xs text-red-300">
                                                {errors.name}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Headline
                                        </label>
                                        <input
                                            type="text"
                                            value={headline}
                                            onChange={(e) =>
                                                setHeadline(e.target.value)
                                            }
                                            className={inputCls()}
                                            placeholder="Short one-line headline shown on profile cards"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Short bio
                                        </label>
                                        <textarea
                                            value={shortBio}
                                            onChange={(e) =>
                                                setShortBio(e.target.value)
                                            }
                                            className={`${inputCls()} min-h-[80px]`}
                                            placeholder="Short summary used across the site"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Focus area
                                        </label>
                                        <select
                                            value={focusArea}
                                            onChange={(e) =>
                                                setFocusArea(
                                                    e.target.value
                                                        ? (e.target
                                                            .value as Area)
                                                        : "",
                                                )
                                            }
                                            className={inputCls()}
                                        >
                                            <option value="">Not set</option>
                                            {AREAS.map((a) => (
                                                <option key={a} value={a}>
                                                    {prettyAreaLabel(a)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Skills (comma-separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={skills}
                                            onChange={(e) =>
                                                setSkills(e.target.value)
                                            }
                                            className={inputCls()}
                                            placeholder="product discovery, storytelling, leadership"
                                        />
                                        <p className="mt-1 text-xs text-white/40">
                                            These map to the skill tags shown on
                                            the profile.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Tech stack (comma-separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={tech}
                                            onChange={(e) =>
                                                setTech(e.target.value)
                                            }
                                            className={inputCls()}
                                            placeholder="React, Next.js, TypeScript, Postgres"
                                        />
                                        <p className="mt-1 text-xs text-white/40">
                                            Technologies the member works with.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            Links
                                        </label>
                                        <div className="space-y-2">
                                            {links.map((row, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex gap-2"
                                                >
                                                    <input
                                                        type="text"
                                                        value={row.label}
                                                        onChange={(e) =>
                                                            updateLinkRow(idx, {
                                                                label: e.target
                                                                    .value,
                                                            })
                                                        }
                                                        className={inputCls()}
                                                        placeholder="Label (e.g. website, github, linkedin)"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={row.url}
                                                        onChange={(e) =>
                                                            updateLinkRow(idx, {
                                                                url: e.target
                                                                    .value,
                                                            })
                                                        }
                                                        className={inputCls()}
                                                        placeholder="https://example.com"
                                                    />
                                                    <button
                                                        type="button"
                                                        className="text-xs text-red-300 hover:text-red-200"
                                                        onClick={() =>
                                                            removeLinkRow(idx)
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addLinkRow}
                                                className="text-xs text-white/70 hover:text-white"
                                            >
                                                + Add link
                                            </button>
                                        </div>
                                    </div>

                                    {/* Access role (admin only) */}
                                    {isAdmin && (
                                        <div className="mt-2 border-t border-white/10 pt-3">
                                            <label className="block text-sm mb-1">
                                                Access role
                                            </label>
                                            <select
                                                value={accessRole}
                                                onChange={(e) =>
                                                    setAccessRole(
                                                        e.target
                                                            .value as AccessRole,
                                                    )
                                                }
                                                className={inputCls()}
                                            >
                                                <option value="">
                                                    Leave unchanged
                                                </option>
                                                <option value="MEMBER">
                                                    Regular member
                                                </option>
                                                <option value="MODERATOR">
                                                    Moderator
                                                </option>
                                            </select>
                                            <p className="mt-1 text-[11px] text-white/45">
                                                Only admins can change access
                                                roles. This affects what the
                                                user can do across the site.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right column: markdown + CV + delete */}
                            <div className="space-y-4">
                                <div className="card p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm">
                                            Profile description (Markdown)
                                        </label>
                                        <span className="text-[11px] text-white/40">
                                            Supports basic Markdown syntax
                                            (lists, links, headings, code)
                                        </span>
                                    </div>
                                    <textarea
                                        value={markdown}
                                        onChange={(e) =>
                                            setMarkdown(e.target.value)
                                        }
                                        className={`${inputCls()} min-h-[180px] font-mono text-[13px]`}
                                        placeholder="Write a longer profile here..."
                                    />
                                </div>

                                {/* CV management */}
                                <div className="card p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-white">
                                        Curriculum Vitae (CV)
                                    </h3>
                                    {cvUrl ? (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-white/70">
                                                A CV is currently uploaded for
                                                this member.
                                            </p>
                                            <a
                                                href={cvUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn-secondary text-xs"
                                            >
                                                Open CV
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-white/60">
                                            No CV uploaded yet.
                                        </p>
                                    )}

                                    <div className="mt-2 space-y-2">
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={(e) =>
                                                setCvFile(
                                                    e.target.files?.[0] ||
                                                    null,
                                                )
                                            }
                                            className="block w-full text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20"
                                        />
                                        <button
                                            type="button"
                                            onClick={onUploadCv}
                                            disabled={uploadingCv || !cvFile}
                                            className="btn-secondary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {uploadingCv
                                                ? "Uploading CV…"
                                                : "Upload new CV"}
                                        </button>
                                        <p className="text-[11px] text-white/45">
                                            PDF only. Uploading a new CV will
                                            replace the previous one.
                                        </p>
                                    </div>
                                </div>

                                <div className="card p-4 space-y-2 border border-red-500/40 bg-red-950/30">
                                    <h3 className="text-sm font-semibold text-red-100">
                                        Danger zone
                                    </h3>
                                    <p className="text-xs text-red-200/80">
                                        Deleting a member removes their public
                                        profile and disconnects them from
                                        projects and events. This action cannot
                                        be undone.
                                    </p>

                                    <label className="block text-xs text-red-100 mt-2 mb-1">
                                        Type{" "}
                                        <span className="font-mono">
                                            {slug}
                                        </span>{" "}
                                        to confirm
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmSlug}
                                        onChange={(e) =>
                                            setDeleteConfirmSlug(e.target.value)
                                        }
                                        className={inputCls()}
                                        placeholder={slug}
                                    />
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        disabled={deleting}
                                        className="mt-3 inline-flex items-center justify-center rounded-md border border-red-500/70 bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {deleting
                                            ? "Deleting…"
                                            : "Delete member"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <p className="text-xs text-white/50">
                                Changes are saved immediately for all visitors.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="btn-secondary text-sm"
                                    disabled={saving || deleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary text-sm"
                                    disabled={saving || deleting}
                                >
                                    {saving ? "Saving…" : "Save changes"}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
