import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SEED_EVENTS } from "@/data/events.seed";
import { SEED_MEMBERS, type Member } from "@/data/members.seed";
import { API_BASE } from "@/lib/config";
import EventsMap from "@/components/EventsMap";

// Pre-generate known seed slugs to keep links stable, still fetch dynamic at runtime too. :contentReference[oaicite:2]{index=2}
export async function generateStaticParams() {
    return (SEED_EVENTS || []).map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const ev = await getEvent(params.slug);
    return {
        title: ev ? `${ev.name} – PUM Events` : "Event – PUM",
        description: ev?.description || ev?.locationName || "PUM event",
    };
}

type Event = {
    id: string;
    slug: string;
    name: string;
    dateStart?: string;
    dateEnd?: string;
    locationName?: string;
    lat?: number;
    lng?: number;
    description?: string;
    photos?: string[];
    tags?: string[];
};

async function fetchApiEvents(): Promise<Event[]> {
    try {
        const res = await fetch(new URL("/api/events?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : json.items ?? [];
    } catch {
        return [];
    }
}

async function fetchApiMembers(): Promise<Member[]> {
    try {
        const res = await fetch(new URL("/api/members?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json : json.items ?? [];
    } catch {
        return [];
    }
}

async function getEvent(slug: string): Promise<Event | null> {
    const fromApi = await fetchApiEvents();
    const pool = [...fromApi, ...SEED_EVENTS];
    const map = new Map(pool.map((e) => [e.slug, e]));
    return map.get(slug) ?? null;
}

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
    const ev = await getEvent(params.slug);

    if (!ev) {
        return (
            <section className="section">
                <h1 className="display">Event not found</h1>
                <p className="mt-4"><Link href="/events" className="underline underline-offset-4">Back to events</Link></p>
            </section>
        );
    }

    // attendees = members that list this event slug
    const membersAll = [...SEED_MEMBERS, ...(await fetchApiMembers())];
    const seen = new Set<string>();
    const dedupedMembers = membersAll.filter((m) => {
        if (!m.slug || seen.has(m.slug)) return false;
        seen.add(m.slug);
        return (m.events || []).some((x) => x.slug === ev.slug);
    });

    const photos = ev.photos || [];
    const cover = photos[0];

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">EVENT</p>
                <h1 className="display">{ev.name}</h1>
                <div className="mt-2 text-white/70 text-sm">
                    {ev.locationName ? `${ev.locationName} • ` : ""}
                    {ev.dateStart ? new Date(ev.dateStart).toLocaleDateString() : ""}
                    {ev.dateEnd ? ` – ${new Date(ev.dateEnd).toLocaleDateString()}` : ""}
                </div>
            </header>

            {cover && (
                <div className="mb-6">
                    <img src={cover} alt={ev.name} className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10" />
                </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <article className="lg:col-span-3 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">About</h2>
                        {ev.description ? (
                            <p className="text-white/80 leading-relaxed">{ev.description}</p>
                        ) : (
                            <p className="text-white/60">No description yet.</p>
                        )}

                        {(ev.tags && ev.tags.length > 0) && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {ev.tags.slice(0, 12).map((t) => (
                                    <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">{t}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* reuse the same MapLibre component with a single event to keep styling consistent */}
                    {(typeof ev.lng === "number" && typeof ev.lat === "number") && (
                        <div className="card p-0 overflow-hidden">
                            <EventsMap events={[ev]} />
                        </div>
                    )}

                    {photos.length > 1 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {photos.slice(1).map((src, i) => (
                                    <img key={i} src={src} alt={`${ev.name} photo ${i+2}`} className="w-full h-32 object-cover rounded-md ring-1 ring-white/10" />
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="lg:col-span-2 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">Attendees</h2>
                        {dedupedMembers.length === 0 ? (
                            <p className="text-white/60">No attendees listed yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {dedupedMembers.map((m) => (
                                    <li key={m.slug} className="flex items-center gap-3">
                                        <img
                                            src={m.avatar || "/avatars/default.png"}
                                            alt={m.name}
                                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            <Link href={`/members/${m.slug}`} className="font-medium hover:underline">{m.name}</Link>
                                            {m.headline && <div className="text-xs text-white/60 truncate">{m.headline}</div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/events" className="underline underline-offset-4">← Back to all events</Link>
            </div>
        </section>
    );
}
