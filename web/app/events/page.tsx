import React from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/config";
import MembersSearchBar from "@/components/MembersSearchBar";
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
    const sameMonth = da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
    const opts: Intl.DateTimeFormatOptions = sameMonth
        ? { year: "numeric", month: "short", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" };
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

// --- data ---
async function fetchEvents(params: Record<string, string | number | undefined> = {}) {
    const url = new URL("/api/events", API_BASE);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load events");
    return res.json() as Promise<{ items: Event[]; total?: number }>;
}

export default async function EventsPage({
                                             searchParams,
                                         }: {
    searchParams?: { q?: string; year?: string };
}) {
    const q = searchParams?.q || "";
    const year = searchParams?.year || "";

    // We grab all events for year chips, and filtered ones for map/list.
    const [allRes, filteredRes] = await Promise.all([
        fetchEvents(),
        fetchEvents({ q, year }),
    ]);

    const allEvents = allRes.items || [];
    const events = filteredRes.items || [];

    const years = Array.from(
        new Set(
            allEvents
                .map((e) => (e.dateStart ? String(e.dateStart).slice(0, 4) : ""))
                .filter(Boolean)
        )
    ).sort((a, b) => Number(b) - Number(a));

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
                        placeholder="Search events by name or location…"
                        paramKey="q"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <YearChips years={years} selected={year} params={{ q }} />
                </div>
            </div>

            {/* Map */}
            <div className="mb-8">
                <EventsMap events={events} />
            </div>

            {/* List */}
            <div className="mb-3 text-sm text-white/60">
                {events.length} event{events.length === 1 ? "" : "s"} found
                {year ? <> in <span className="font-semibold">{year}</span></> : null}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((e) => (
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
