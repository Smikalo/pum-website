// web/app/events/page.tsx
import React from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/config";
import MembersSearchBar from "@/components/MembersSearchBar";
import EventsMap from "@/components/EventsMap";
import { SEED_EVENTS } from "@/data/events.seed";

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
        photos: e.photos ?? [],
        tags: e.tags ?? [],
    };
}

function matchesQuery(e: Event, q: string): boolean {
    if (!q) return true;
    const n = q.toLowerCase();
    const fields = [
        e.name || "",
        e.locationName || "",
        e.description || "",
        ...(e.tags || []),
    ];
    return fields.some((f) => f.toLowerCase().includes(n));
}

function parseYear(s?: string) {
    if (!s) return undefined;
    const y = Number(s.slice(0, 4));
    return Number.isFinite(y) ? y : undefined;
}

// --- data ---
async function fetchAllEventsFromApi(): Promise<Event[]> {
    // Grab everything from the API, we'll filter locally so seed + api behave the same.
    const url = new URL("/api/events", API_BASE);
    url.searchParams.set("size", "999");
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: Event[] };
    return json.items || [];
}

function dedupeBySlug(list: Event[]): Event[] {
    const seen = new Set<string>();
    const out: Event[] = [];
    for (const e of list) {
        const key = e.slug;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(e);
    }
    return out;
}

export default async function EventsPage({
                                             searchParams,
                                         }: {
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const q = (searchParams?.q as string) || "";
    const year = (searchParams?.year as string) || "";

    const apiEvents = (await fetchAllEventsFromApi()).map(normalizeEvent);
    const events = dedupeBySlug([...SEED_EVENTS.map(normalizeEvent), ...apiEvents]);

    const years = Array.from(
        new Set(events.map((e) => (e.dateStart ? String(e.dateStart).slice(0, 4) : "")).filter(Boolean)),
    ).sort((a, b) => Number(b) - Number(a));

    const filtered = events.filter((e) => {
        const byQ = matchesQuery(e, q);
        const byYear = year ? parseYear(e.dateStart) === Number(year) : true;
        return byQ && byYear;
    });

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">EVENTS</p>
                <h1 className="display">What’s happening around PUM</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    Hackathons, meetups and demo days we host or join as a team. Explore by year or search by city and topic.
                </p>
            </header>

            <MembersSearchBar placeholder="Search events, places…" paramKey="q" />

            <div className="mt-6 grid lg:grid-cols-[1.2fr,1fr] gap-8 items-start">
                <div className="space-y-3">
                    {filtered.map((e) => (
                        <Link key={e.slug} href={`/events/${e.slug}`} className="row-card">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="font-semibold">{e.name}</div>
                                    <div className="text-xs text-white/60">
                                        {formatDateRange(e.dateStart, e.dateEnd)}{" "}
                                        {e.locationName ? `· ${e.locationName}` : ""}
                                    </div>
                                </div>
                                <div className="text-xs text-white/60">Open →</div>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="sticky top-20">
                    <EventsMap events={filtered} />
                    {!!years.length && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {years.map((y) => (
                                <Link
                                    key={y}
                                    href={`/events?year=${encodeURIComponent(y)}`}
                                    className="text-xs px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10"
                                >
                                    {y}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function formatDateRange(a?: string, b?: string) {
    if (!a && !b) return "";
    if (a && !b) return new Date(a).toLocaleDateString();
    if (!a && b) return new Date(b).toLocaleDateString();
    const da = new Date(a!);
    const db = new Date(b!);
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
    return `${da.toLocaleDateString(undefined, opts)} – ${db.toLocaleDateString(undefined, opts)}`;
}
