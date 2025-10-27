import React from "react";
import Link from "next/link";
import { SEED_MEMBERS, type Member } from "@/data/members.seed";
import { SEED_EVENTS } from "@/data/events.seed";
import { API_BASE } from "@/lib/config";
import type { Metadata } from "next";

// Dynamic routes & generateStaticParams: official docs.
// Using this keeps older links stable and enables static generation. :contentReference[oaicite:0]{index=0}
export async function generateStaticParams() {
    return (SEED_MEMBERS || []).map((m) => ({ slug: m.slug }));
}

// Dynamic metadata for better sharing/SEO. :contentReference[oaicite:1]{index=1}
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const member = await getMemberBySlug(params.slug);
    return {
        title: member ? `${member.name} – PUM` : "Member – PUM",
        description: member?.headline || member?.bio || "PUM member profile",
    };
}

async function fetchApiMembers(): Promise<Member[]> {
    try {
        // Prefer your API if it exists; otherwise fallback to seeds (BC-friendly).
        const res = await fetch(new URL("/api/members?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : json.items ?? [];
    } catch {
        return [];
    }
}

async function getMemberBySlug(slug: string): Promise<Member | null> {
    const fromApi = await fetchApiMembers();
    const pool = [...fromApi, ...SEED_MEMBERS];
    const deduped = new Map(pool.map((m) => [m.slug, m]));
    return deduped.get(slug) ?? null;
}

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

    const eventBySlug = new Map(SEED_EVENTS.map((e) => [e.slug, e]));

    return (
        <section className="section">
            <header className="mb-6 flex flex-col md:flex-row items-start md:items-center gap-4">
                <img
                    src={member.avatar || "/avatars/default.png"}
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
                    {member.bio && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-2">About</h2>
                            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{member.bio}</p>
                        </div>
                    )}

                    {member.projects && member.projects.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Projects</h2>
                            <div className="space-y-4">
                                {member.projects.map((p) => (
                                    <div key={p.slug} className="flex gap-3">
                                        {p.cover && (
                                            <img src={p.cover} alt={p.name} className="w-36 h-24 object-cover rounded-md ring-1 ring-white/10" />
                                        )}
                                        <div>
                                            <div className="font-semibold">{p.name}</div>
                                            {p.role && <div className="text-xs text-white/60">{p.role} {p.year ? `• ${p.year}` : ""}</div>}
                                            {p.summary && <div className="text-sm text-white/80 mt-1">{p.summary}</div>}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {(p.tech || []).map((t) => (
                                                    <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{t}</span>
                                                ))}
                                            </div>
                                            {p.slug && (
                                                <div className="mt-1">
                                                    <Link href={`/projects/${p.slug}`} className="text-xs underline underline-offset-4">Open project →</Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
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
                                {member.events!.map((ev) => {
                                    const full = eventBySlug.get(ev.slug);
                                    return (
                                        <li key={ev.slug} className="flex items-start gap-3">
                                            <span className="mt-1 inline-block w-2 h-2 rounded-full bg-cyan-300 ring-1 ring-white/50 shadow-[0_0_12px_rgba(56,189,248,.9)]" />
                                            <div>
                                                <Link href={`/events/${ev.slug}`} className="font-medium hover:underline">
                                                    {full?.name || ev.name || ev.slug}
                                                </Link>
                                                {full?.dateStart && (
                                                    <div className="text-xs text-white/60">
                                                        {new Date(full.dateStart).toLocaleDateString()} {full.dateEnd ? `– ${new Date(full.dateEnd).toLocaleDateString()}` : ""}
                                                    </div>
                                                )}
                                                {ev.role && <div className="text-xs text-white/70">Role: {ev.role}</div>}
                                            </div>
                                        </li>
                                    );
                                })}
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
