"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/context/AuthProvider";
import * as api from "@/lib/api";
import { toImageSrc } from "@/lib/images";

const AREAS = ["FRONTEND","BACKEND","ML","DATA","DEVOPS","DESIGN","PM","OTHER"] as const;
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

function mergeCsv(existingCsv: string, adds: string[]) {
    const set = new Set(existingCsv.split(",").map(s => s.trim()).filter(Boolean));
    for (const a of adds) if (a && !set.has(a)) set.add(a);
    return Array.from(set).join(", ");
}

export default function AccountEditor() {
    const { user, accessToken } = useAuth();
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
    const [links, setLinks] = React.useState<{ label: string; url: string }[]>([]);
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
                const p: Profile = data.profile;
                const normalized: Profile = { ...p, avatarUrl: toImageSrc(p.avatarUrl) };
                setProfile(normalized);
                setName(normalized.name || "");
                setHeadline(normalized.headline || "");
                setShortBio(normalized.shortBio || "");
                setMarkdown(normalized.markdown || "");
                setLinks(Object.entries(normalized.links || {}).map(([label, url]) => ({ label, url })));
                setSkills((normalized.skills || []).join(", "));
                setTech((normalized.techStack || []).join(", "));
                setFocusArea((normalized.focusArea as Area) || "");
                setCvUrl(normalized.cvUrl || null);
            } catch (e: any) {
                setError(e.message || "Failed to load profile");
            } finally {
                setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [accessToken]);

    async function save() {
        if (!accessToken) return;
        setSaving(true);
        setError(null);
        try {
            const body: any = {
                name,
                headline: headline || null,
                shortBio: shortBio || null,
                markdown,
                links: Object.fromEntries(links.filter(x => x.label && x.url).map(x => [x.label.trim(), x.url.trim()])),
                skills: skills.split(",").map(s => s.trim()).filter(Boolean),
                techStack: tech.split(",").map(s => s.trim()).filter(Boolean),
            };
            if (focusArea) body.focusArea = focusArea;
            const res = await api.updateMyProfile(accessToken, body);
            const updated: Profile = { ...res.profile, avatarUrl: toImageSrc(res.profile?.avatarUrl) };
            setProfile(updated);
            setCvUrl(updated.cvUrl || null);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 1600);
        } catch (e: any) {
            setError(e.message || "Failed to save profile");
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
        } catch (e: any) {
            setError(e.message || "Avatar upload failed");
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
            setFoundSkills(Array.isArray(res.extractedSkills) ? res.extractedSkills : []);
            setFoundTech(Array.isArray(res.extractedTech) ? res.extractedTech : []);
        } catch (e: any) {
            setError(e.message || "CV upload failed");
        } finally {
            setSaving(false);
            e.target.value = "";
        }
    }

    if (!user) return <p className="text-white/70 px-4 py-10">Please log in to edit your profile.</p>;
    if (loading) return <p className="text-white/70 px-4 py-10">Loading your profile…</p>;
    if (error) return <p className="text-red-400 px-4 py-10">{error}</p>;
    if (!profile) return null;

    const avatarSrc = toImageSrc(profile.avatarUrl);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white text-black font-bold grid place-items-center overflow-hidden">
                        {avatarSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarSrc} alt={profile.name || "avatar"} className="w-full h-full object-cover" />
                        ) : (
                            (profile.name || "U").slice(0, 2).toUpperCase()
                        )}
                    </div>
                    <div>
                        <label className="block text-sm text-white/70 mb-1">Change avatar</label>
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} />
                        <p className="text-xs text-white/50">PNG/JPEG/WebP, up to 5MB.</p>
                    </div>
                </div>

                {/* CV upload + link (minimal UI) */}
                <div>
                    <label className="block text-sm text-white/70 mb-1">Curriculum Vitae (PDF)</label>
                    <div className="flex items-center gap-3">
                        <input type="file" accept="application/pdf" onChange={onCvChange} />
                        {cvUrl ? (
                            <a href={cvUrl} className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10 text-sm" target="_blank" rel="noopener noreferrer" download>
                                Download CV
                            </a>
                        ) : null}
                    </div>

                    {/* Clickable suggestions */}
                    {(foundSkills.length || foundTech.length) ? (
                        <div className="mt-2 space-y-2">
                            {foundSkills.length ? (
                                <div className="text-xs">
                                    <span className="text-white/70 mr-2">Skills found:</span>
                                    <button
                                        className="mr-2 px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                        onClick={() => setSkills(s => mergeCsv(s, foundSkills))}
                                    >
                                        + Add all
                                    </button>
                                    {foundSkills.map((s) => (
                                        <button
                                            key={`sk-${s}`}
                                            className="mr-1 mb-1 inline-flex px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                            onClick={() => setSkills(v => mergeCsv(v, [s]))}
                                            title="Add to Skills"
                                        >
                                            + {s}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                            {foundTech.length ? (
                                <div className="text-xs">
                                    <span className="text-white/70 mr-2">Tech found:</span>
                                    <button
                                        className="mr-2 px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                        onClick={() => setTech(t => mergeCsv(t, foundTech))}
                                    >
                                        + Add all
                                    </button>
                                    {foundTech.map((t) => (
                                        <button
                                            key={`te-${t}`}
                                            className="mr-1 mb-1 inline-flex px-2 py-1 rounded-md ring-1 ring-white/15 hover:bg-white/10"
                                            onClick={() => setTech(v => mergeCsv(v, [t]))}
                                            title="Add to Tech stack"
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
                    <label className="block text-sm text-white/70 mb-1">Name</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">Headline</label>
                    <input value={headline} onChange={(e) => setHeadline(e.target.value)} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">Short bio</label>
                    <textarea value={shortBio} onChange={(e) => setShortBio(e.target.value)} rows={3} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">Primary area</label>
                    <select value={focusArea} onChange={(e) => setFocusArea(e.target.value as Area)} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2">
                        <option value="">(Choose…)</option>
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <p className="text-xs text-white/50 mt-1">This drives categorization on the Members graph & filters.</p>
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">Links</label>
                    <div className="space-y-2">
                        {links.map((row, i) => (
                            <div key={i} className="flex gap-2">
                                <input placeholder="Label (e.g., GitHub)" value={row.label} onChange={(e) => setLinks((v) => v.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))} className="flex-1 rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                                <input placeholder="https://…" value={row.url} onChange={(e) => setLinks((v) => v.map((r, idx) => (idx === i ? { ...r, url: e.target.value } : r)))} className="flex-[2] rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                                <button type="button" onClick={() => setLinks((v) => v.filter((_r, idx) => idx !== i))} className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10">✕</button>
                            </div>
                        ))}
                        <button type="button" onClick={() => setLinks((v) => [...v, { label: "", url: "" }])} className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10">+ Add link</button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">Skills (comma-separated)</label>
                    <input value={skills} onChange={(e) => setSkills(e.target.value)} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                </div>

                <div>
                    <label className="block text-sm text-white/70 mb-1">Tech stack (comma-separated)</label>
                    <input value={tech} onChange={(e) => setTech(e.target.value)} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2" />
                </div>

                <div className="pt-2 flex items-center gap-3">
                    <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-white text-black font-semibold disabled:opacity-50">
                        {saving ? "Saving…" : "Save changes"}
                    </button>
                    {justSaved ? <span className="text-sm text-emerald-300">Saved ✓</span> : null}
                </div>
            </section>

            <section className="space-y-3">
                <label className="block text-sm text-white/70">Profile Markdown</label>
                <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={14} className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 font-mono text-sm" placeholder="### About me" />
                <div className="text-sm text-white/60">Preview</div>
                <div className="prose prose-invert max-w-none rounded-md border border-white/10 p-4 bg-white/5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || "_Nothing yet…_"}</ReactMarkdown>
                </div>
            </section>
        </div>
    );
}
