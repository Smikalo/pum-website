"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/context/AuthProvider";
import * as api from "@/lib/api";

type Profile = {
    id: string;
    slug: string;
    name: string;
    headline: string | null;
    shortBio: string | null;
    markdown: string;
    links: Record<string, string>;
    avatarUrl: string | null;
    skills: string[];
    techStack: string[];
};

export default function AccountEditor() {
    const { user, accessToken } = useAuth();
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
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
                setProfile(p);
                setName(p.name || "");
                setHeadline(p.headline || "");
                setShortBio(p.shortBio || "");
                setMarkdown(p.markdown || "");
                setLinks(Object.entries(p.links || {}).map(([label, url]) => ({ label, url })));
                setSkills((p.skills || []).join(", "));
                setTech((p.techStack || []).join(", "));
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
            const body = {
                name,
                headline: headline || null,
                shortBio: shortBio || null,
                markdown,
                links: Object.fromEntries(links.filter(x => x.label && x.url).map(x => [x.label.trim(), x.url.trim()])),
                skills: skills.split(",").map(s => s.trim()).filter(Boolean),
                techStack: tech.split(",").map(s => s.trim()).filter(Boolean),
            };
            const res = await api.updateMyProfile(accessToken, body);
            setProfile(res.profile);
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
            setProfile((p) => (p ? { ...p, avatarUrl: url } : p));
        } catch (e: any) {
            setError(e.message || "Avatar upload failed");
        } finally {
            setSaving(false);
            e.target.value = "";
        }
    }

    if (!user) return <p className="text-white/70 px-4 py-10">Please log in to edit your profile.</p>;
    if (loading) return <p className="text-white/70 px-4 py-10">Loading your profile…</p>;
    if (error) return <p className="text-red-400 px-4 py-10">{error}</p>;
    if (!profile) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white text-black font-bold grid place-items-center overflow-hidden">
                        {profile.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
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
                    <label className="block text-sm text-white/70 mb-1">Links</label>
                    <div className="space-y-2">
                        {links.map((row, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    placeholder="Label (e.g., GitHub)"
                                    value={row.label}
                                    onChange={(e) => setLinks((v) => v.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))}
                                    className="flex-1 rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                                />
                                <input
                                    placeholder="https://…"
                                    value={row.url}
                                    onChange={(e) => setLinks((v) => v.map((r, idx) => (idx === i ? { ...r, url: e.target.value } : r)))}
                                    className="flex-[2] rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2"
                                />
                                <button
                                    type="button"
                                    onClick={() => setLinks((v) => v.filter((_r, idx) => idx !== i))}
                                    className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setLinks((v) => [...v, { label: "", url: "" }])}
                            className="px-3 py-2 rounded-md ring-1 ring-white/10 hover:bg-white/10"
                        >
                            + Add link
                        </button>
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

                <div className="pt-2">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-4 py-2 rounded-md bg-white text-black font-semibold disabled:opacity-50"
                    >
                        {saving ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </section>

            <section className="space-y-3">
                <label className="block text-sm text-white/70">Profile Markdown</label>
                <textarea
                    value={markdown}
                    onChange={(e) => setMarkdown(e.target.value)}
                    rows={14}
                    className="w-full rounded-md bg-white/5 ring-1 ring-white/10 px-3 py-2 font-mono text-sm"
                    placeholder="### About me"
                />
                <div className="text-sm text-white/60">Preview</div>
                <div className="prose prose-invert max-w-none rounded-md border border-white/10 p-4 bg-white/5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown || "_Nothing yet…_"}</ReactMarkdown>
                </div>
            </section>
        </div>
    );
}
