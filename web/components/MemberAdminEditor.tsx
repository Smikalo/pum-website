"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "@/lib/config";
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";
import * as api from "@/lib/api";
import { tClient } from "@/lib/i18n-client";

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

type ApiMemberLike = {
    id?: unknown;
    slug?: unknown;
    name?: unknown;
    headline?: unknown;
    shortBio?: unknown;
    markdown?: unknown;
    bio?: unknown;
    links?: unknown;
    focusArea?: unknown;
    skills?: unknown;
    techStack?: unknown;
    cvUrl?: unknown;
    avatarUrl?: unknown;
    avatar?: unknown;
    userRoles?: unknown;
    roles?: unknown;
};

function normalizeMemberFromApi(m: unknown): MemberProfile {
    const src = (m ?? {}) as ApiMemberLike;

    const rawSkills = Array.isArray(src.skills) ? src.skills : [];
    const rawTech = Array.isArray(src.techStack) ? src.techStack : [];

    const skillsArr = rawSkills
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean);
    const techArr = rawTech
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean);

    const linksObj: Record<string, string> = {};
    if (src.links && typeof src.links === "object") {
        for (const [label, url] of Object.entries(
            src.links as Record<string, unknown>,
        )) {
            if (typeof url === "string" && label.trim()) {
                linksObj[label] = url;
            }
        }
    }

    let focus: Area | null = null;
    if (
        typeof src.focusArea === "string" &&
        (AREAS as readonly string[]).includes(src.focusArea)
    ) {
        focus = src.focusArea as Area;
    }

    const rawRoles = Array.isArray(src.userRoles)
        ? src.userRoles
        : Array.isArray(src.roles)
            ? src.roles
            : [];
    const userRoles = rawRoles
        .map((r) => (typeof r === "string" ? r.trim().toUpperCase() : ""))
        .filter(Boolean);

    let normalizedAvatarUrl: string | null = null;
    if (typeof src.avatarUrl === "string") {
        normalizedAvatarUrl = src.avatarUrl;
    } else if (typeof src.avatar === "string") {
        normalizedAvatarUrl = src.avatar;
    }

    const cv = typeof src.cvUrl === "string" ? src.cvUrl : null;

    const headlineVal =
        typeof src.headline === "string" ? src.headline : null;
    const shortBioVal =
        typeof src.shortBio === "string" ? src.shortBio : null;

    const markdownVal =
        typeof src.markdown === "string"
            ? src.markdown
            : typeof src.bio === "string"
                ? src.bio
                : "";

    return {
        id: String(src.id ?? ""),
        slug: String(src.slug ?? ""),
        name: String(src.name ?? ""),
        headline: headlineVal,
        shortBio: shortBioVal,
        markdown: markdownVal,
        links: linksObj,
        focusArea: focus,
        skills: skillsArr,
        techStack: techArr,
        cvUrl: cv,
        avatarUrl: normalizedAvatarUrl,
        userRoles,
    };
}

type LinkRow = { label: string; url: string };

type MemberAdminEditorProps = {
    slug: string;
    onClose: () => void;
};

type AccessRole = "" | "MODERATOR" | "MEMBER";

function getErrorMessage(err: unknown, fallback: string): string {
    if (
        err &&
        typeof err === "object" &&
        "message" in err &&
        typeof (err as { message?: unknown }).message === "string"
    ) {
        return (err as { message: string }).message;
    }
    if (err instanceof Error && err.message) {
        return err.message;
    }
    return fallback;
}

export default function MemberAdminEditor({
                                              slug,
                                              onClose,
                                          }: MemberAdminEditorProps) {
    const router = useRouter();
    const { accessToken, user } = useSafeAuth();

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

    const roles = getRoles(user);
    const isAdmin = roles.includes("ADMIN");

    const inputCls = (field?: string) =>
        [
            "w-full rounded-md bg-white/5 px-3 py-2 text-sm text-white",
            "placeholder:text-white/40 ring-1 outline-none",
            field && errors[field]
                ? "ring-red-400 focus:ring-red-400/80"
                : "ring-white/10 focus:ring-white/30",
        ].join(" ");

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
                return tClient("admin.member.focusArea.frontend");
            case "BACKEND":
                return tClient("admin.member.focusArea.backend");
            case "ML":
                return tClient("admin.member.focusArea.ml");
            case "DATA":
                return tClient("admin.member.focusArea.data");
            case "DEVOPS":
                return tClient("admin.member.focusArea.devops");
            case "DESIGN":
                return tClient("admin.member.focusArea.design");
            case "PM":
                return tClient("admin.member.focusArea.pm");
            case "OTHER":
            default:
                return tClient("admin.member.focusArea.other");
        }
    }

    function deriveAccessRole(roles: string[]): AccessRole {
        if (roles.includes("MODERATOR")) return "MODERATOR";
        if (roles.includes("MEMBER")) return "MEMBER";
        return "";
    }

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
                    throw new Error(
                        tClient("admin.member.error.loadProfile"),
                    );
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
            } catch (err: unknown) {
                if (cancelled) return;
                setError(
                    getErrorMessage(
                        err,
                        tClient("admin.member.error.loadProfile"),
                    ),
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!accessToken) {
            setError(tClient("admin.member.error.authRequired"));
            return;
        }

        const nextErrors: Record<string, string> = {};
        if (!name.trim()) {
            nextErrors.name = tClient(
                "admin.member.validation.nameRequired",
            );
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

        type UpdateMemberRequestBody = {
            name: string;
            headline: string | null;
            shortBio: string | null;
            markdown: string;
            links: Record<string, string>;
            skills: string[];
            techStack: string[];
            focusArea: Area | null;
            accessRole?: AccessRole | null;
        };

        const body: UpdateMemberRequestBody = {
            name: name.trim(),
            headline: headline.trim() || null,
            shortBio: shortBio.trim() || null,
            markdown: markdown || "",
            links: linksRowsToObject(links),
            skills: skillsArr,
            techStack: techArr,
            focusArea: focusArea || null,
        };

        if (isAdmin) {
            body.accessRole = accessRole || null;
        }

        setSaving(true);
        setError(null);
        setHint(null);

        try {
            const res = await api.updateMemberProfile(
                accessToken,
                slug,
                body,
            );
            if (res && typeof res === "object" && "member" in res) {
                const memberFromResponse = (res as { member: unknown })
                    .member;
                const prof = normalizeMemberFromApi(memberFromResponse);
                setProfile(prof);
                setCvUrl(prof.cvUrl);
                setAvatarUrl(prof.avatarUrl ?? null);
                setAccessRole(deriveAccessRole(prof.userRoles));
            }
            setHint(tClient("admin.member.feedback.updated"));
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    tClient("admin.member.error.updateProfile"),
                ),
            );
        } finally {
            setSaving(false);
        }
    }

    async function onUploadAvatar() {
        if (!accessToken) {
            setError(tClient("admin.member.error.authRequiredAvatar"));
            return;
        }
        if (!avatarFile) {
            setError(tClient("admin.member.error.avatarNoFile"));
            return;
        }

        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(avatarFile.type)) {
            setError(tClient("admin.member.error.avatarType"));
            return;
        }

        setUploadingAvatar(true);
        setError(null);
        setHint(null);

        try {
            const res = await api.uploadMemberAvatar(
                accessToken,
                slug,
                avatarFile,
            );

            if (res && typeof res === "object") {
                if ("url" in res || "avatarUrl" in res) {
                    const cast = res as {
                        url?: string;
                        avatarUrl?: string;
                    };
                    setAvatarUrl(cast.url ?? cast.avatarUrl ?? null);
                    setHint(
                        tClient(
                            "admin.member.feedback.avatarUpdated",
                        ),
                    );
                    setAvatarFile(null);
                } else if ("member" in res) {
                    const prof = normalizeMemberFromApi(
                        (res as { member: unknown }).member,
                    );
                    setProfile(prof);
                    setAvatarUrl(prof.avatarUrl ?? null);
                    setHint(
                        tClient(
                            "admin.member.feedback.avatarUpdated",
                        ),
                    );
                } else {
                    setHint(
                        tClient(
                            "admin.member.feedback.avatarUploaded",
                        ),
                    );
                }
            } else {
                setHint(
                    tClient("admin.member.feedback.avatarUploaded"),
                );
            }
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    tClient("admin.member.error.avatarUploadFailed"),
                ),
            );
        } finally {
            setUploadingAvatar(false);
        }
    }

    async function onUploadCv() {
        if (!accessToken) {
            setError(tClient("admin.member.error.authRequiredCv"));
            return;
        }
        if (!cvFile) {
            setError(tClient("admin.member.error.cvNoFile"));
            return;
        }
        if (cvFile.type !== "application/pdf") {
            setError(tClient("admin.member.error.cvType"));
            return;
        }

        setUploadingCv(true);
        setError(null);
        setHint(null);

        try {
            const res = await api.uploadMemberCv(
                accessToken,
                slug,
                cvFile,
            );
            if (res && typeof res === "object") {
                const cast = res as { url?: string; cvUrl?: string };
                if (cast.url || cast.cvUrl) {
                    setCvUrl(cast.url ?? cast.cvUrl ?? null);
                    setHint(
                        tClient("admin.member.feedback.cvUploaded"),
                    );
                    setCvFile(null);
                } else {
                    setHint(
                        tClient("admin.member.feedback.cvUploaded"),
                    );
                }
            } else {
                setHint(tClient("admin.member.feedback.cvUploaded"));
            }
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    tClient("admin.member.error.cvUploadFailed"),
                ),
            );
        } finally {
            setUploadingCv(false);
        }
    }

    async function onDelete() {
        if (!accessToken) {
            setError(tClient("admin.member.error.authRequiredDelete"));
            return;
        }

        const trimmed = deleteConfirmSlug.trim();
        if (!trimmed) {
            setError(
                tClient("admin.member.delete.error.emptyConfirm"),
            );
            return;
        }
        if (trimmed !== slug) {
            setError(
                tClient("admin.member.delete.error.mismatch").replace(
                    "{slug}",
                    slug,
                ),
            );
            return;
        }

        const ok = window.confirm(
            tClient("admin.member.delete.confirmDialog"),
        );
        if (!ok) return;

        setDeleting(true);
        setError(null);
        setHint(null);

        try {
            await api.deleteMember(accessToken, slug, trimmed);
            setHint(tClient("admin.member.delete.success"));
            router.push("/members");
        } catch (err: unknown) {
            setError(
                getErrorMessage(
                    err,
                    tClient("admin.member.delete.error.generic"),
                ),
            );
        } finally {
            setDeleting(false);
        }
    }

    function addLinkRow() {
        setLinks((prev) => [...prev, { label: "", url: "" }]);
    }

    function updateLinkRow(index: number, patch: Partial<LinkRow>) {
        setLinks((prev) =>
            prev.map((row, i) =>
                i === index ? { ...row, ...patch } : row,
            ),
        );
    }

    function removeLinkRow(index: number) {
        setLinks((prev) => prev.filter((_, i) => i !== index));
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl bg-slate-900/95 ring-1 ring-white/10 p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-white">
                            {tClient("admin.member.title")}
                        </h2>
                        <p className="text-xs text-white/60 mt-1">
                            {tClient("admin.member.subtitle").replace(
                                "{slug}",
                                slug,
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm text-white/60 hover:text-white"
                    >
                        {tClient("common.close")}
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
                    <p className="text-sm text-white/70">
                        {tClient("admin.member.loading")}
                    </p>
                ) : !profile ? (
                    <p className="text-sm text-red-300">
                        {tClient("admin.member.error.noProfile")}
                    </p>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Left column */}
                            <div className="space-y-4">
                                <div className="card p-4 space-y-4">
                                    {/* Avatar */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0">
                                            {avatarUrl ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={avatarUrl}
                                                    alt={
                                                        name ||
                                                        profile.name ||
                                                        tClient(
                                                            "account.editor.avatar.altFallback",
                                                        )
                                                    }
                                                    className="h-16 w-16 rounded-full object-cover border border-white/20 bg-white/10"
                                                />
                                            ) : (
                                                <div className="h-16 w-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs text-white/50">
                                                    {tClient(
                                                        "admin.member.avatar.none",
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <label className="block text-sm">
                                                {tClient(
                                                    "admin.member.avatar.label",
                                                )}
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
                                                className="block w-full text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg.white/10 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20"
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
                                                    ? tClient(
                                                        "admin.member.avatar.uploading",
                                                    )
                                                    : tClient(
                                                        "admin.member.avatar.upload",
                                                    )}
                                            </button>
                                            <p className="text-[11px] text-white/45">
                                                {tClient(
                                                    "admin.member.avatar.helper",
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            {tClient(
                                                "account.editor.name.label",
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) =>
                                                setName(e.target.value)
                                            }
                                            className={inputCls("name")}
                                            placeholder={tClient(
                                                "admin.member.name.placeholder",
                                            )}
                                            autoFocus
                                        />
                                        {errors.name && (
                                            <p className="mt-1 text-xs text-red-300">
                                                {errors.name}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text.sm mb-1">
                                            {tClient(
                                                "account.editor.headline.label",
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={headline}
                                            onChange={(e) =>
                                                setHeadline(e.target.value)
                                            }
                                            className={inputCls()}
                                            placeholder={tClient(
                                                "admin.member.headline.placeholder",
                                            )}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            {tClient(
                                                "account.editor.shortBio.label",
                                            )}
                                        </label>
                                        <textarea
                                            value={shortBio}
                                            onChange={(e) =>
                                                setShortBio(e.target.value)
                                            }
                                            className={`${inputCls()} min-h-[80px]`}
                                            placeholder={tClient(
                                                "admin.member.shortBio.placeholder",
                                            )}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            {tClient(
                                                "account.editor.focusArea.label",
                                            )}
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
                                            <option value="">
                                                {tClient(
                                                    "account.editor.focusArea.placeholder",
                                                )}
                                            </option>
                                            {AREAS.map((a) => (
                                                <option key={a} value={a}>
                                                    {prettyAreaLabel(a)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            {tClient(
                                                "account.editor.skills.label",
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={skills}
                                            onChange={(e) =>
                                                setSkills(e.target.value)
                                            }
                                            className={inputCls()}
                                            placeholder={tClient(
                                                "admin.member.skills.placeholder",
                                            )}
                                        />
                                        <p className="mt-1 text-xs text-white/40">
                                            {tClient(
                                                "admin.member.skills.helper",
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            {tClient(
                                                "account.editor.tech.label",
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={tech}
                                            onChange={(e) =>
                                                setTech(e.target.value)
                                            }
                                            className={inputCls()}
                                            placeholder={tClient(
                                                "admin.member.tech.placeholder",
                                            )}
                                        />
                                        <p className="mt-1 text-xs text-white/40">
                                            {tClient(
                                                "admin.member.tech.helper",
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-1">
                                            {tClient(
                                                "account.editor.links.label",
                                            )}
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
                                                            updateLinkRow(
                                                                idx,
                                                                {
                                                                    label: e
                                                                        .target
                                                                        .value,
                                                                },
                                                            )
                                                        }
                                                        className={inputCls()}
                                                        placeholder={tClient(
                                                            "account.editor.links.labelPlaceholder",
                                                        )}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={row.url}
                                                        onChange={(e) =>
                                                            updateLinkRow(
                                                                idx,
                                                                {
                                                                    url: e
                                                                        .target
                                                                        .value,
                                                                },
                                                            )
                                                        }
                                                        className={inputCls()}
                                                        placeholder={tClient(
                                                            "admin.member.links.urlPlaceholder",
                                                        )}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="text-xs text-red-300 hover:text-red-200"
                                                        onClick={() =>
                                                            removeLinkRow(idx)
                                                        }
                                                    >
                                                        {tClient(
                                                            "account.editor.links.remove",
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addLinkRow}
                                                className="text-xs text-white/70 hover:text-white"
                                            >
                                                {tClient(
                                                    "account.editor.links.add",
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <div className="mt-2 border-t border.white/10 border-t border-white/10 pt-3">
                                            <label className="block text-sm mb-1">
                                                {tClient(
                                                    "admin.member.accessRole.label",
                                                )}
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
                                                    {tClient(
                                                        "admin.member.accessRole.keep",
                                                    )}
                                                </option>
                                                <option value="MEMBER">
                                                    {tClient(
                                                        "admin.member.accessRole.member",
                                                    )}
                                                </option>
                                                <option value="MODERATOR">
                                                    {tClient(
                                                        "admin.member.accessRole.moderator",
                                                    )}
                                                </option>
                                            </select>
                                            <p className="mt-1 text-[11px] text-white/45">
                                                {tClient(
                                                    "admin.member.accessRole.helper",
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right column */}
                            <div className="space-y-4">
                                <div className="card p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-sm">
                                            {tClient(
                                                "account.editor.markdown.label",
                                            )}
                                        </label>
                                        <span className="text-[11px] text-white/40">
                                            {tClient(
                                                "account.editor.markdown.helper",
                                            )}
                                        </span>
                                    </div>
                                    <textarea
                                        value={markdown}
                                        onChange={(e) =>
                                            setMarkdown(e.target.value)
                                        }
                                        className={`${inputCls()} min-h-[180px] font-mono text-[13px]`}
                                        placeholder={tClient(
                                            "account.editor.markdown.placeholder",
                                        )}
                                    />
                                    <div className="mt-2 text-xs text-white/50">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            className="prose prose-invert prose-sm max-w-none"
                                        >
                                            {markdown ||
                                                tClient(
                                                    "account.editor.markdown.empty",
                                                )}
                                        </ReactMarkdown>
                                    </div>
                                </div>

                                <div className="card p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-white">
                                        {tClient("admin.member.cv.title")}
                                    </h3>
                                    {cvUrl ? (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-white/70">
                                                {tClient(
                                                    "admin.member.cv.existing",
                                                )}
                                            </p>
                                            <a
                                                href={cvUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn-secondary text-xs"
                                            >
                                                {tClient(
                                                    "account.editor.cv.download",
                                                )}
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-white/60">
                                            {tClient(
                                                "admin.member.cv.noneYet",
                                            )}
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
                                            disabled={
                                                uploadingCv || !cvFile
                                            }
                                            className="btn-secondary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {uploadingCv
                                                ? tClient(
                                                    "admin.member.cv.uploading",
                                                )
                                                : tClient(
                                                    "admin.member.cv.upload",
                                                )}
                                        </button>
                                        <p className="text-[11px] text-white/45">
                                            {tClient(
                                                "admin.member.cv.helper",
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="card p-4 space-y-2 border border-red-500/40 bg-red-950/30">
                                    <h3 className="text-sm font-semibold text-red-100">
                                        {tClient(
                                            "admin.member.delete.title",
                                        )}
                                    </h3>
                                    <p className="text-xs text-red-200/80">
                                        {tClient(
                                            "admin.member.delete.body",
                                        )}
                                    </p>

                                    <label className="block text-xs text-red-100 mt-2 mb-1">
                                        {tClient(
                                            "admin.member.delete.confirmLabel",
                                        ).replace("{slug}", slug)}
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmSlug}
                                        onChange={(e) =>
                                            setDeleteConfirmSlug(
                                                e.target.value,
                                            )
                                        }
                                        className={inputCls()}
                                        placeholder={slug}
                                    />
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        disabled={deleting}
                                        className="mt-3 inline-flex items-center justify-center rounded-md border border-red-500/70 bg-red-600/80 px-3 py-1.5 text-xs font-medium text.white text-white shadow-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {deleting
                                            ? tClient(
                                                "admin.member.delete.deleting",
                                            )
                                            : tClient(
                                                "admin.member.delete.button",
                                            )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/10">
                            <p className="text-xs text-white/50">
                                {tClient("admin.member.footer.liveNotice")}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="btn-secondary text-sm"
                                    disabled={saving || deleting}
                                >
                                    {tClient("common.cancel")}
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary text-sm"
                                    disabled={saving || deleting}
                                >
                                    {saving
                                        ? tClient("common.saving")
                                        : tClient("common.saveChanges")}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
