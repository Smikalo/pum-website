/* eslint-disable @next/next/no-img-element */
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

// --- utils ---
function formatDateRange(a?: string, b?: string) {
    if (!a && !b) return "";
    if (a && !b) return new Date(a).toLocaleDateString();
    if (!a && b) return new Date(b).toLocaleDateString();
    const da = new Date(a!);
    const db = new Date(b!);
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
    return `${da.toLocaleDateString(undefined, opts)} – ${db.toLocaleDateString(undefined, opts)}`;
}

function highlight(text: string | undefined, q: string) {
    if (!text) return null;
    if (!q) return text;
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return parts.map((p, i) =>
        re.test(p) ? (
            <mark key={i} className="px-0.5 rounded bg-yellow-300/30 text-yellow-200">{p}</mark>
        ) : (
            <span key={i}>{p}</span>
        )
    );
}

function matchesQuery(e: Event, q: string) {
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

// --- merge helpers (fix for missing lat/lng coming from API) ---
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

function normalizeEvent(e: any): Event {
    return {
        id: String(e.id ?? e.slug),
        slug: String(e.slug ?? e.id),
        name: String(e.name ?? e.slug ?? e.id ?? ""),
        dateStart: e.dateStart ?? undefined,
        dateEnd: e.dateEnd ?? undefined,
        locationName: e.locationName ?? undefined,
        lat: typeof e.lat === "number" ? e.lat : (typeof e.lat === "string" ? Number(e.lat) : undefined),
        lng: typeof e.lng === "number" ? e.lng : (typeof e.lng === "string" ? Number(e.lng) : undefined),
        description: e.description ?? undefined,
        photos: Array.isArray(e.photos) ? e.photos : undefined,
        tags: Array.isArray(e.tags) ? e.tags : undefined,
    };
}

function mergeOneEvent(seed?: Event, api?: Event): Event | undefined {
    if (!seed && !api) return undefined;
    const a = api || ({} as Event);
    const s = seed || ({} as Event);
    return {
        id: a.id ?? s.id!,
        slug: a.slug ?? s.slug!,
        name: a.name ?? s.name!,
        dateStart: a.dateStart ?? s.dateStart,
        dateEnd: a.dateEnd ?? s.dateEnd,
        locationName: a.locationName ?? s.locationName,
        // keep seed coords if API missing them
        lat: typeof a.lat === "number" ? a.lat : s.lat,
        lng: typeof a.lng === "number" ? a.lng : s.lng,
        description: a.description ?? s.description,
        photos: uniq([...(s.photos || []), ...(a.photos || [])]),
        tags:   uniq([...(s.tags   || []), ...(a.tags   || [])]),
    };
}

function mergeEvents(api: Event[], seeds: Event[]): Event[] {
    const map = new Map<string, Event>();
    // start with seeds so we always have coords/tags
    for (const s of seeds.map(normalizeEvent)) {
        if (!s.slug) continue;
        map.set(s.slug, s);
    }
    // overlay API (without dropping existing coords when API lacks them)
    for (const a of api.map(normalizeEvent)) {
        if (!a.slug) continue;
        const merged = mergeOneEvent(map.get(a.slug), a)!;
        map.set(a.slug, merged);
    }
    return Array.from(map.values());
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

export default async function EventsPage({
                                             searchParams,
                                         }: {
    searchParams?: { q?: string; year?: string };
}) {
    const q = searchParams?.q || "";
    const year = searchParams?.year || "";

    const apiEvents = await fetchAllEventsFromApi();

    // IMPORTANT: merge (don’t just dedupe) so seed coords survive when API lacks lat/lng
    const allEvents = mergeEvents(apiEvents || [], SEED_EVENTS);

    // Build year chips from all events
    const years = Array.from(
        new Set(
            allEvents
                .map((e) => (e.dateStart ? String(e.dateStart).slice(0, 4) : ""))
                .filter(Boolean)
        )
    ).sort((a, b) => Number(b) - Number(a));

    // Filter (query also matches tags)
    const filtered = allEvents.filter((e) => {
        const byQ = matchesQuery(e, q);
        const byYear = year ? parseYear(e.dateStart) === Number(year) : true;
        return byQ && byYear;
    });

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">EVENTS</p>
                <h1 className="display">Where we hack & build</h1>
                <p className="mt-3 text-white/70 max-w-2xl">
                    A map of hackathons, demos, and conferences we’ve attended — discover stories,
                    projects, and people behind each pin.
                </p>
            </header>

            {/* Controls */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1">
                    <MembersSearchBar
                        placeholder="Search events by name, location, or tag…"
                        paramKey="q"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <YearChips years={years} selected={year} params={{ q }} />
                </div>
            </div>

            {/* Map */}
            <div className="mb-8">
                <EventsMap events={filtered} />
            </div>

            {/* List */}
            <div className="mb-3 text-sm text-white/60">
                {filtered.length} event{filtered.length === 1 ? "" : "s"} found
                {year ? <> in <span className="font-semibold">{year}</span></> : null}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((e) => (
                    <Link
                        key={e.slug}
                        href={`/events/${e.slug}`}
                        className="card p-5 hover:shadow-[0_0_0_2px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 transition"
                    >
                        <div className="font-semibold text-lg line-clamp-1">
                            {highlight(e.name, q)}
                        </div>
                        <div className="mt-1 text-sm text-white/70">
                            {formatDateRange(e.dateStart, e.dateEnd)}
                        </div>
                        <div className="mt-1 text-sm text-white/60">
                            {highlight(e.locationName || "", q)}
                        </div>
                        {!!(e.tags && e.tags.length) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {e.tags!.slice(0, 6).map((t) => (
                                    <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                    {highlight(t, q)}
                  </span>
                                ))}
                            </div>
                        )}
                        {e.description ? (
                            <div className="mt-3 text-sm text-white/70 line-clamp-3">
                                {highlight(e.description, q)}
                            </div>
                        ) : null}
                    </Link>
                ))}
            </div>
        </section>
    );
}

function YearChips({
                       years,
                       selected,
                       params,
                   }: {
    years: string[];
    selected?: string;
    params: Record<string, string>;
}) {
    const makeHref = (year?: string) => {
        const p = new URLSearchParams({ ...params });
        if (year) p.set("year", year);
        else p.delete("year");
        const qs = p.toString();
        return `/events${qs ? `?${qs}` : ""}`;
    };
    return (
        <div className="flex flex-wrap gap-2">
            {selected ? (
                <Link href={makeHref("")} className="px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 bg-white/10">
                    Clear year
                </Link>
            ) : null}
            {years.map((y) => (
                <Link
                    key={y}
                    href={makeHref(y)}
                    className={`px-2.5 py-1.5 rounded-full text-xs ring-1 ring-white/10 ${
                        selected === y ? "bg-white text-black font-semibold" : "bg-white/5 hover:bg-white/10"
                    }`}
                    aria-current={selected === y ? "page" : undefined}
                >
                    {y}
                </Link>
            ))}
        </div>
    );
}
