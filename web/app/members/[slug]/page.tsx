/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/* ------------------------------ Types ------------------------------ */
type Member = {
    id: string;
    slug: string;
    name: string;
    avatar?: string | null;
    avatarUrl?: string | null;
    headline?: string | null;
    shortBio?: string | null;
    bio?: string | null;
    location?: string | null;
    links?: Record<string, string> | null;
    photos?: string[] | null;
    skills?: string[];
    techStack?: string[];
    expertise?: string[];

    projects?: {
        slug: string;
        name?: string;
        title?: string;
        role?: string | null;
        year?: number | null;
        cover?: string | null;
        summary?: string | null;
        tech?: string[];
        techStack?: string[];
    }[];

    events?: {
        slug: string;
        name?: string;
        role?: string | null;
        dateStart?: string | null;
        dateEnd?: string | null;
    }[];
};

/* ---------------------------- Fetch helpers ---------------------------- */
async function getMemberBySlug(slug: string): Promise<Member | null> {
    const res = await fetch(`${API_BASE}/api/members/${slug}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to load member");
    return res.json();
}

/* ------------------------- Dynamic metadata ------------------------- */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const member = await getMemberBySlug(params.slug);
    return {
        title: member ? `${member.name} – PUM` : "Member – PUM",
        description: member?.headline || member?.bio || "PUM member profile",
    };
}

/* -------------------------------- Page -------------------------------- */
export default async function MemberDetailPage({ params }: { params: { slug: string } }) {
    const member = await getMemberBySlug(params.slug);

    if (!member) {
        return (
            <section className="section">
                <h1 className="display">Member not found</h1>
                <p className="mt-4"><Link href="/members" className="underline underline-offset-4">Back to members</Link></p>
            </section>
        );
    }

    const avatar = member.avatar || member.avatarUrl || "/avatars/default.png";

    return (
        <section className="section">
            <header className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                <img
                    src={avatar}
                    alt={member.name}
                    className="w-28 h-28 rounded-full object-cover ring-2 ring-white/10"
                />
                <div className="flex-1">
                    <p className="kicker">MEMBER</p>
                    <h1 className="display">{member.name}</h1>
                    {member.headline && <p className="text-white/70 mt-1">{member.headline}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                        {(member.expertise || []).map((x) => (
                            <span key={x} className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{x}</span>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    {member.links?.github && <a className="btn-secondary" href={member.links.github} target="_blank" rel="noreferrer">GitHub</a>}
                    {member.links?.linkedin && <a className="btn-secondary" href={member.links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                    {member.links?.website && <a className="btn-secondary" href={member.links.website} target="_blank" rel="noreferrer">Website</a>}
                    <Link className="btn-primary" href="/contact">Contact</Link>
                </div>
            </header>

            <div className="grid lg:grid-cols-5 gap-6">
                {/* Left column */}
                <div className="lg:col-span-3 space-y-6">
                    {(member.bio || member.shortBio) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">About</h2>
                            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                                {member.bio ?? member.shortBio}
                            </p>
                        </div>
                    )}

                    {member.projects && member.projects.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Projects</h2>
                            <div className="space-y-4">
                                {member.projects.map((p, idx) => {
                                    const title = p.title || p.name || p.slug;
                                    const tech = p.techStack || p.tech || [];
                                    return (
                                        <div key={`${p.slug}-${idx}`} className="flex gap-3">
                                            {p.cover && (
                                                <img src={p.cover} alt={title} className="w-36 h-24 object-cover rounded-md ring-1 ring-white/10" />
                                            )}
                                            <div>
                                                <div className="font-semibold">{title}</div>
                                                {(p.role || p.year) && (
                                                    <div className="text-xs text-white/60">
                                                        {p.role ? `Role: ${p.role}` : ""}{p.role && p.year ? " • " : ""}{p.year ? `Year: ${p.year}` : ""}
                                                    </div>
                                                )}
                                                {p.summary && <div className="text-sm text-white/80 mt-1">{p.summary}</div>}
                                                {!!tech.length && (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {tech.map((t) => (
                                                            <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                                {p.slug && (
                                                    <div className="mt-1">
                                                        <Link href={`/projects/${p.slug}`} className="text-xs underline underline-offset-4">Open project →</Link>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {member.photos && member.photos.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {member.photos.map((src, i) => (
                                    <img key={i} src={src} alt={`${member.name} photo ${i+1}`} className="w-full h-32 object-cover rounded-md ring-1 ring-white/10" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column */}
                <aside className="lg:col-span-2 space-y-6">
                    {(member.skills && member.skills.length > 0) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Skills</h2>
                            <div className="flex flex-wrap gap-1.5">
                                {member.skills!.map((s) => (
                                    <span key={s} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {(member.events && member.events.length > 0) && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">Events</h2>
                            <ul className="space-y-2">
                                {member.events!.map((ev, i) => (
                                    <li key={`${ev.slug}-${i}`} className="flex items-start gap-3">
                                        <span className="mt-1 inline-block w-2 h-2 rounded-full bg-cyan-300 ring-1 ring-white/50 shadow-[0_0_12px_rgba(56,189,248,.9)]" />
                                        <div>
                                            <Link href={`/events/${ev.slug}`} className="font-medium hover:underline">
                                                {ev.name || ev.slug}
                                            </Link>
                                            {(ev.dateStart || ev.dateEnd) && (
                                                <div className="text-xs text-white/60">
                                                    {ev.dateStart ? new Date(ev.dateStart).toLocaleDateString() : ""}
                                                    {ev.dateStart && ev.dateEnd ? " – " : ""}
                                                    {ev.dateEnd ? new Date(ev.dateEnd).toLocaleDateString() : ""}
                                                </div>
                                            )}
                                            {ev.role && <div className="text-xs text-white/70">Role: {ev.role}</div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/members" className="underline underline-offset-4">← Back to all members</Link>
            </div>
        </section>
    );
}
