// web/app/events/[slug]/page.tsx
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { API_BASE } from "@/lib/config";
import EventsMap from "@/components/EventsMap";

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
};

function normalizeEvent(e: any): Event {
    const slug = e.slug ?? e.id ?? "";
    return {
        id: String(e.id ?? slug),
        slug,
        name: e.name ?? e.title ?? slug,
        dateStart: e.dateStart ?? e.start ?? undefined,
        dateEnd: e.dateEnd ?? e.end ?? undefined,
        locationName: e.locationName ?? e.location ?? undefined,
        lat: e.lat ?? e.latitude ?? undefined,
        lng: e.lng ?? e.longitude ?? undefined,
        description: e.description ?? e.summary ?? undefined,
    };
}

async function fetchEvent(slug: string): Promise<Event | null> {
    const candidates = [
        `/api/events/${encodeURIComponent(slug)}`,
        `/api/event/${encodeURIComponent(slug)}`,
    ];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            return normalizeEvent(json);
        } catch {}
    }
    return null;
}

async function fetchEventSlugs(): Promise<string[]> {
    const candidates = ["/api/events?size=999", "/api/events"];
    for (const path of candidates) {
        try {
            const res = await fetch(new URL(path, API_BASE).toString(), { cache: "no-store" });
            if (!res.ok) continue;
            const json = await res.json();
            const items: any[] = Array.isArray(json) ? json : json.items ?? [];
            return items.map((e: any) => String(e.slug ?? e.id ?? "")).filter(Boolean);
        } catch {}
    }
    return [];
}

export async function generateStaticParams() {
    const slugs = await fetchEventSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const ev = await fetchEvent(params.slug);
    return {
        title: ev ? `${ev.name} – Event` : "Event",
        description: ev?.description || ev?.locationName || "PUM Event",
    };
}

export default async function EventDetail({ params }: { params: { slug: string } }) {
    const ev = await fetchEvent(params.slug);
    if (!ev) {
        return (
            <section className="section">
                <h1 className="h1">Event not found</h1>
                <Link href="/events" className="underline underline-offset-4">← Back to all events</Link>
            </section>
        );
    }

    return (
        <section className="section">
            <h1 className="h1">{ev.name}</h1>
            <div className="text-white/70">
                {[ev.dateStart, ev.dateEnd].filter(Boolean).join(" – ")} {ev.locationName ? `· ${ev.locationName}` : ""}
            </div>

            <div className="mt-6 grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    {ev.description && <p className="text-white/80 whitespace-pre-line">{ev.description}</p>}
                    <div className="rounded-xl overflow-hidden ring-1 ring-white/10">
                        <EventsMap events={[ev]} />
                    </div>
                </div>

                <aside className="space-y-4">
                    {/* Add any event-specific sidebar information here */}
                </aside>
            </div>

            <div className="mt-8">
                <Link href="/events" className="underline underline-offset-4">← Back to all events</Link>
            </div>
        </section>
    );
}
