// components/AccountEditor.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useSafeAuth, getRoles } from "@/lib/auth-helpers";
import * as api from "@/lib/api";
import type { AccountProfileApi } from "@/lib/api";
import { toImageSrc } from "@/lib/images";
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

type Profile = {
    id: string;
    slug: string;
    name: string;
    headline: string | null;
    shortBio: string | null;
    markdown: string;
    links: Record<string, string>;
    avatarUrl: string | null;
    focusArea: Area | null;
    skills: string[];
    techStack: string[];
    cvUrl?: string | null;
};

type LinkRow = { label: string; url: string };

function mergeCsv(existingCsv: string, adds: string[]) {
    const set = new Set(
        existingCsv
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
    );
    for (const a of adds) if (a && !set.has(a)) set.add(a);
    return Array.from(set).join(", ");
}

function focusAreaLabel(a: Area) {
    switch (a) {
        case "FRONTEND":
            return tClient("account.editor.focusArea.frontend");
        case "BACKEND":
            return tClient("account.editor.focusArea.backend");
        case "ML":
            return tClient("account.editor.focusArea.ml");
        case "DATA":
            return tClient("account.editor.focusArea.data");
        case "DEVOPS":
            return tClient("account.editor.focusArea.devops");
        case "DESIGN":
            return tClient("account.editor.focusArea.design");
        case "PM":
            return tClient("account.editor.focusArea.pm");
        case "OTHER":
        default:
            return tClient("account.editor.focusArea.other");
    }
}

function getErrorMessage(e: unknown): string | undefined {
    if (!e || typeof e !== "object") return undefined;
    if ("message" in e) {
        const maybeMessage = (e as { message?: unknown }).message;
        if (
            typeof maybeMessage === "string" &&
            maybeMessage.trim().length > 0
        ) {
            return maybeMessage;
        }
    }
    return undefined;
}

/**
 * Normalize the (loosely-typed) API profile into the stricter Profile shape
 * used by this component.
 */
function normalizeProfile(apiProfile: AccountProfileApi): Profile {
    const idRaw = apiProfile.id;
    const id =
        typeof idRaw === "string"
            ? idRaw
            : typeof idRaw === "number"
                ? String(idRaw)
                : "";

    const skills =
        Array.isArray(apiProfile.skills) && apiProfile.skills.length
            ? apiProfile.skills.filter(
                (s): s is string =>
                    typeof s === "string" && s.trim().length > 0,
            )
            : [];

    const techStack =
        Array.isArray(apiProfile.techStack) && apiProfile.techStack.length
            ? apiProfile.techStack.filter(
                (s): s is string =>
                    typeof s === "string" && s.trim().length > 0,
            )
            : [];

    return {
        id,
        slug: apiProfile.slug ?? "",
        name: apiProfile.name ?? "",
        headline: apiProfile.headline ?? null,
        shortBio: apiProfile.shortBio ?? null,
        markdown: apiProfile.markdown ?? "",
        links: apiProfile.links ?? {},
        avatarUrl: apiProfile.avatarUrl ?? null,
        focusArea:
            (apiProfile.focusArea as Area | null | undefined) ?? null,
        skills,
        techStack,
        cvUrl: apiProfile.cvUrl ?? null,
    };
}

export default function AccountEditor() {
    const { user, accessToken } = useSafeAuth();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [justSaved, setJustSaved] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [profile, setProfile] = React.useState<Profile | null>(null);

    // form state
    const [name, setName] = React.useState("");
    const [headline, setHeadline] = React.useState("");
    const [shortBio, setShortBio] = React.useState("");
    const [markdown, setMarkdown] = React.useState("");
    const [links, setLinks] = React.useState<LinkRow[]>([]);
    const [skills, setSkills] = React.useState("");
    const [tech, setTech] = React.useState("");
    const [focusArea, setFocusArea] = React.useState<Area | "">("");

    // CV state
    const [cvUrl, setCvUrl] = React.useState<string | null>(null);
    const [foundSkills, setFoundSkills] = React.useState<string[]>([]);
    const [foundTech, setFoundTech] = React.useState<string[]>([]);

    React.useEffect(() => {
        let active = true;
        (async () => {
            if (!accessToken) return;
            setLoading(true);
            setError(null);
            try {
                const data = await api.getMyProfile(accessToken);
                if (!active) return;

                const base = normalizeProfile(data.profile);
                const normalized: Profile = {
                    ...base,
                    avatarUrl: toImageSrc(base.avatarUrl),
                };

                setProfile(normalized);
                setName(normalized.name || "");
                setHeadline(normalized.headline || "");
                setShortBio(normalized.shortBio || "");
                setMarkdown(normalized.markdown || "");
                setLinks(
                    Object.entries(normalized.links || {}).map(
                        ([label, url]): LinkRow => ({ label, url }),
                    ),
                );
                setSkills((normalized.skills || []).join(", "));
                setTech((normalized.techStack || []).join(", "));
                setFocusArea((normalized.focusArea as Area) || "");
                setCvUrl(normalized.cvUrl || null);
            } catch (e: unknown) {
                const message =
                    getErrorMessage(e) ||
                    tClient("account.editor.error.loadProfile");
                setError(message);
            } finally {
                setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [accessToken]);

    async function save() {
        if (!accessToken) return;
        setSaving(true);
        setError(null);
        try {
            const body: Record<string, unknown> = {
                name,
                headline: headline || null,
                shortBio: shortBio || null,
                markdown,
                links: Object.fromEntries(
                    links
                        .filter((x) => x.label && x.url)
                        .map((x) => [x.label.trim(), x.url.trim()]),
                ),
                skills: skills
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                techStack: tech
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
            };
            if (focusArea) {
                body.focusArea = focusArea;
            }
            const res = await api.updateMyProfile(accessToken, body);
            const base = normalizeProfile(res.profile);
            const updated: Profile = {
                ...base,
                avatarUrl: toImageSrc(base.avatarUrl),
            };

            setProfile(updated);
            setCvUrl(updated.cvUrl || null);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 1600);
        } catch (e: unknown) {
            const message =
                getErrorMessage(e) ||
                tClient("account.editor.error.saveProfile");
            setError(message);
        } finally {
            setSaving(false);
        }
    }

    async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!accessToken) return;
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving(true);
        setError(null);
        try {
            const { url } = await api.uploadAvatar(accessToken, file);
            const absolute = toImageSrc(url);
            setProfile((p) => (p ? { ...p, avatarUrl: absolute } : p));
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 1600);
        } catch (e: unknown) {
            const message =
                getErrorMessage(e) ||
                tClient("account.editor.error.avatarUpload");
            setError(message);
        } finally {
            setSaving(false);
            e.target.value = "";
        }
    }

    async function onCvChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (!accessToken) return;
        const file = e.target.files?.[0];
        if (!file) return;
        setSaving(true);
        setError(null);
        try {
            const res = await api.uploadCv(accessToken, file);
            setCvUrl(res.url || null);
            setFoundSkills(
                Array.isArray(res.extractedSkills)
                    ? res.extractedSkills
                    : [],
            );
            setFoundTech(
                Array.isArray(res.extractedTech)
                    ? res.extractedTech
                    : [],
            );
        } catch (e: unknown) {
            const message =
                getErrorMessage(e) ||
                tClient("account.editor.error.cvUpload");
            setError(message);
        } finally {
            setSaving(false);
            e.target.value = "";
        }
    }

    if (!user) {
        return (
            <p className="text-white/70 px-4 py-10">
                {tClient("account.editor.loginToEdit")}
            </p>
        );
    }
    if (loading) {
        return (
            <p className="text-white/70 px-4 py-10">
                {tClient("account.editor.loading")}
            </p>
        );
    }
    if (error) {
        return (
            <p className="text-red-400 px-4 py-10">
                {error}
            </p>
        );
    }
    if (!profile) return null;

    const avatarSrc = toImageSrc(profile.avatarUrl);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white text-black font-bold grid place-items-center overflow-hidden">
                        {avatarSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={avatarSrc}
                                alt={
                                    profile.name ||
                                    tClient(
                                        "account.editor.avatar.altFallback",
                                    )
                                }
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            (profile.name || "U")
                                .slice(0, 2)
                                .toUpperCase()
                        )}
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-1">
                            {tClient("account.editor.avatar.changeLabel")}
                        </label>
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={onAvatarChange}
                        />
                        <p className="text-xs text-white/50">
                            {tClient("account.editor.avatar.helper")}
                        </p>
                    </div>
                </div>

                {/* CV upload + link */}
                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.cv.label")}
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={onCvChange}
                        />
                        {cvUrl ? (
                            <a
                                href={cvUrl}
                                className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10 text-sm"
                                target="_blank"
                                rel="noopener noreferrer"
                                download
                            >
                                {tClient("account.editor.cv.download")}
                            </a>
                        ) : null}
                    </div>

                    {foundSkills.length || foundTech.length ? (
                        <div className="mt-2 space-y-2">
                            {foundSkills.length ? (
                                <div className="text-xs">
                                    <span className="text-white/70 mr-2">
                                        {tClient(
                                            "account.editor.cv.skillsFound",
                                        )}
                                    </span>
                                    <button
                                        className="mr-2 px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                        onClick={() =>
                                            setSkills((s) =>
                                                mergeCsv(s, foundSkills),
                                            )
                                        }
                                        type="button"
                                    >
                                        {tClient("account.editor.cv.addAll")}
                                    </button>
                                    {foundSkills.map((s) => (
                                        <button
                                            key={`sk-${s}`}
                                            className="mr-1 mb-1 inline-flex px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                            onClick={() =>
                                                setSkills((v) =>
                                                    mergeCsv(v, [s]),
                                                )
                                            }
                                            title={tClient(
                                                "account.editor.cv.addSkillTitle",
                                            )}
                                            type="button"
                                        >
                                            + {s}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {foundTech.length ? (
                                <div className="text-xs">
                                    <span className="text-white/70 mr-2">
                                        {tClient(
                                            "account.editor.cv.techFound",
                                        )}
                                    </span>
                                    <button
                                        className="mr-2 px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                        onClick={() =>
                                            setTech((t) =>
                                                mergeCsv(t, foundTech),
                                            )
                                        }
                                        type="button"
                                    >
                                        {tClient("account.editor.cv.addAll")}
                                    </button>
                                    {foundTech.map((t) => (
                                        <button
                                            key={`te-${t}`}
                                            className="mr-1 mb-1 inline-flex px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                            onClick={() =>
                                                setTech((v) =>
                                                    mergeCsv(v, [t]),
                                                )
                                            }
                                            title={tClient(
                                                "account.editor.cv.addTechTitle",
                                            )}
                                            type="button"
                                        >
                                            + {t}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.name.label")}
                    </label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.headline.label")}
                    </label>
                    <input
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.shortBio.label")}
                    </label>
                    <textarea
                        value={shortBio}
                        onChange={(e) => setShortBio(e.target.value)}
                        rows={3}
                        className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.focusArea.label")}
                    </label>
                    <select
                        value={focusArea}
                        onChange={(e) =>
                            setFocusArea(e.target.value as Area | "")
                        }
                        className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                    >
                        <option value="">
                            {tClient("account.editor.focusArea.placeholder")}
                        </option>
                        {AREAS.map((a) => (
                            <option key={a} value={a}>
                                {focusAreaLabel(a)}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-white/50 mt-1">
                        {tClient("account.editor.focusArea.helper")}
                    </p>
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.links.label")}
                    </label>
                    <div className="space-y-2">
                        {links.map((row, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    placeholder={tClient(
                                        "account.editor.links.labelPlaceholder",
                                    )}
                                    value={row.label}
                                    onChange={(e) =>
                                        setLinks((v) =>
                                            v.map((r, idx) =>
                                                idx === i
                                                    ? {
                                                        ...r,
                                                        label: e.target
                                                            .value,
                                                    }
                                                    : r,
                                            ),
                                        )
                                    }
                                    className="flex-1 rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                                />
                                <input
                                    placeholder="https://…"
                                    value={row.url}
                                    onChange={(e) =>
                                        setLinks((v) =>
                                            v.map((r, idx) =>
                                                idx === i
                                                    ? {
                                                        ...r,
                                                        url: e.target.value,
                                                    }
                                                    : r,
                                            ),
                                        )
                                    }
                                    className="flex-[2] rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setLinks((v) =>
                                            v.filter(
                                                (_r, idx) => idx !== i,
                                            ),
                                        )
                                    }
                                    className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10"
                                    aria-label={tClient(
                                        "account.editor.links.remove",
                                    )}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() =>
                                setLinks((v) => [
                                    ...v,
                                    { label: "", url: "" },
                                ])
                            }
                            className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10"
                        >
                            {tClient("account.editor.links.add")}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.skills.label")}
                    </label>
                    <input
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">
                        {tClient("account.editor.tech.label")}
                    </label>
                    <input
                        value={tech}
                        onChange={(e) => setTech(e.target.value)}
                        className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                    />
                </div>

                <div className="pt-2 flex items-center gap-3">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-4 py-2 rounded-md bg-white text-black font-semibold disabled:opacity-50"
                        type="button"
                    >
                        {saving
                            ? tClient("common.saving")
                            : tClient("common.saveChanges")}
                    </button>
                    {justSaved ? (
                        <span className="text-sm text-emerald-300">
                            {tClient("common.savedCheck")}
                        </span>
                    ) : null}
                </div>
            </section>

            <section className="space-y-3">
                <label className="block text-sm text-white/70">
                    {tClient("account.editor.markdown.label")}
                </label>
                <textarea
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    rows={14}
                    className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 font-mono text-sm"
                    placeholder={tClient(
                        "account.editor.markdown.placeholder",
                    )}
                />
                <div className="text-sm text-white/60">
                    {tClient("account.editor.markdown.previewLabel")}
                </div>
                <div className="prose prose-invert max-w-none rounded-md border border-white/10 p-4 bg-white/5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {markdown ||
                            tClient("account.editor.markdown.empty")}
                    </ReactMarkdown>
                </div>
            </section>
        </div>
    );
}
