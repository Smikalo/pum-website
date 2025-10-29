/* eslint-disable @next/next/no-img-element */
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SEED_EVENTS } from "@/data/events.seed";
import { SEED_MEMBERS, type Member as SeedMember } from "@/data/members.seed";
import { SEED_PROJECTS, type Project as SeedProject } from "@/data/projects.seed";
import { API_BASE } from "@/lib/config";
import EventsMap from "@/components/EventsMap";

// Pre-generate known seed slugs to keep links stable, still fetch dynamic at runtime too.
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

/* ----------------------------- Types & helpers ---------------------------- */

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

type Member = {
    slug: string;
    name: string;
    avatarUrl?: string;
    avatar?: string;
    headline?: string;
};

type Project = {
    id: string;
    slug: string;
    title: string;
    tags?: string[];
    techStack?: string[];
    members?: { memberId?: string; memberSlug?: string; role?: string }[];
    imageUrl?: string;
    // detail
    summary?: string;
    description?: string;
    year?: number;
    cover?: string;
    demoUrl?: string;
    repoUrl?: string;
    events?: { slug: string; name?: string }[];
    gallery?: string[];
};

function normalizeProject(p: any): Project {
    const slug: string = p.slug ?? p.id ?? "";
    const id: string = (p.id ?? slug) as string;
    return {
        id,
        slug,
        title: p.title ?? p.name ?? slug,
        tags: p.tags ?? [],
        techStack: p.techStack ?? p.tech ?? [],
        members:
            (p.members ?? []).map((m: any) => ({
                memberId: m.memberId ?? m.id,
                memberSlug: m.memberSlug ?? m.slug,
                role: m.role,
            })) ?? [],
        imageUrl: p.imageUrl ?? p.cover,
        summary: p.summary,
        description: p.description,
        year: typeof p.year === "number" ? p.year : undefined,
        cover: p.cover ?? p.imageUrl,
        demoUrl: p.demoUrl,
        repoUrl: p.repoUrl,
        events: (p.events ?? []).map((e: any) => ({ slug: e.slug ?? e.id, name: e.name })),
        gallery: p.gallery ?? [],
    };
}

function mergeProjects(api: Project[], seeds: SeedProject[]): Project[] {
    const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
    const map = new Map<string, Project>();
    for (const p of api) map.set(p.slug, { ...p });
    for (const s of seeds) {
        const sn = normalizeProject(s);
        if (map.has(s.slug)) {
            const cur = map.get(s.slug)!;
            map.set(s.slug, {
                ...sn,
                ...cur, // API wins
                id: cur.id || sn.id,
                tags: uniq([...(cur.tags || []), ...(sn.tags || [])]),
                techStack: uniq([...(cur.techStack || []), ...(sn.techStack || [])]),
                members: (cur.members?.length ? cur.members : sn.members) || [],
                imageUrl: cur.imageUrl || sn.imageUrl,
                cover: cur.cover || sn.cover,
                summary: cur.summary || sn.summary,
                description: cur.description || sn.description,
                year: cur.year ?? sn.year,
                demoUrl: cur.demoUrl || sn.demoUrl,
                repoUrl: cur.repoUrl || sn.repoUrl,
                events: (cur.events?.length ? cur.events : sn.events) || [],
                gallery: (cur.gallery?.length ? cur.gallery : sn.gallery) || [],
            });
        } else {
            map.set(s.slug, sn);
        }
    }
    return Array.from(map.values());
}

/* --------------------------------- Fetchers -------------------------------- */

async function fetchApiEvents(): Promise<Event[]> {
    try {
        const res = await fetch(new URL("/api/events?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const items = Array.isArray(json) ? json : json.items ?? [];
        return items as Event[];
    } catch {
        return [];
    }
}

async function fetchApiEventDetail(slug: string): Promise<{
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
    attendees?: { slug: string; name?: string; avatarUrl?: string; role?: string; headline?: string }[];
    projects?: {
        slug: string;
        title: string;
        imageUrl?: string | null;
        year?: number | null;
        summary?: string | null;
        techStack?: string[];
        members?: { memberSlug?: string; memberId?: string }[];
    }[];
} | null> {
    try {
        const res = await fetch(new URL(`/api/events/${slug}`, API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function fetchApiMembers(): Promise<Member[]> {
    try {
        const res = await fetch(new URL("/api/members?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const items: any[] = Array.isArray(json) ? json : json.items ?? [];
        return items.map((m) => ({
            slug: m.slug ?? m.id,
            name: m.name,
            avatarUrl: m.avatarUrl ?? m.avatar ?? m.photo ?? m.image,
            avatar: m.avatar ?? m.avatarUrl,
            headline: m.headline ?? m.shortBio,
        }));
    } catch {
        return [];
    }
}

async function fetchApiProjects(): Promise<Project[]> {
    try {
        const res = await fetch(new URL("/api/projects?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const items: any[] = Array.isArray(json) ? json : json.items ?? [];
        return items.map(normalizeProject);
    } catch {
        return [];
    }
}

function mergeEvent(seed?: Event, api?: Partial<Event> | null): Event | null {
    if (!seed && !api) return null;
    const s = seed || ({} as Event);
    const a = (api || {}) as Partial<Event>;
    return {
        id: String(a.id ?? s.id ?? s.slug),
        slug: String(a.slug ?? s.slug),
        name: String(a.name ?? s.name),
        dateStart: a.dateStart ?? s.dateStart,
        dateEnd: a.dateEnd ?? s.dateEnd,
        locationName: a.locationName ?? s.locationName,
        lat: typeof a.lat === "number" ? a.lat : s.lat,
        lng: typeof a.lng === "number" ? a.lng : s.lng,
        description: a.description ?? s.description,
        photos: Array.isArray(a.photos) ? a.photos : s.photos,
        tags: Array.isArray(a.tags) ? a.tags : s.tags,
    };
}

async function getEvent(slug: string): Promise<Event | null> {
    const fromApi = await fetchApiEvents();
    const seed = SEED_EVENTS.find((e) => e.slug === slug);
    const api = fromApi.find((e) => e.slug === slug);
    return mergeEvent(seed, api);
}

/* --------------------------------- Page --------------------------------- */

export default async function EventDetailPage({ params }: { params: { slug: string } }) {
    const baseEvent = await getEvent(params.slug); // merged API list + seeds (for coords/photos)
    if (!baseEvent) {
        return (
            <section className="section">
                <h1 className="display">Event not found</h1>
                <p className="mt-4">
                    <Link href="/events" className="underline underline-offset-4">
                        Back to events
                    </Link>
                </p>
            </section>
        );
    }

    // Prefer attendees/projects directly from the API detail:
    const evDetail = await fetchApiEventDetail(params.slug);

    // Members for avatars in the "tiny team row" under projects:
    const membersFromApi = await fetchApiMembers();
    const membersFromSeeds: Member[] = SEED_MEMBERS.map((m: SeedMember) => ({
        slug: m.slug,
        name: m.name,
        avatarUrl: m.avatarUrl ?? m.avatar,
        avatar: m.avatar,
        headline: (m as any).headline ?? m.shortBio,
    }));
    const membersAll = dedupeBy([...membersFromApi, ...membersFromSeeds], (m) => m.slug);
    const memMap = new Map(membersAll.map((m) => [m.slug, m]));

    // Attendees:
    const attendees: Member[] =
        evDetail?.attendees && evDetail.attendees.length
            ? evDetail.attendees.map((a) => ({
                slug: a.slug,
                name: a.name || a.slug,
                avatarUrl: a.avatarUrl || undefined,
                headline: a.headline || undefined,
            }))
            : // Fallback to old behavior (seed-based) only if API has none:
            membersAll.filter((m) =>
                (SEED_MEMBERS.find((s) => s.slug === m.slug)?.events || []).some((x) => x.slug === baseEvent.slug),
            );

    // Projects at this event:
    let projectsForEvent: Project[] = [];
    if (evDetail?.projects && evDetail.projects.length) {
        projectsForEvent = evDetail.projects.map((p) => ({
            id: p.slug,
            slug: p.slug,
            title: p.title,
            imageUrl: p.imageUrl || undefined,
            year: (p.year ?? undefined) as number | undefined,
            summary: p.summary || undefined,
            techStack: p.techStack || [],
            members:
                p.members?.map((r) => ({
                    memberSlug: r.memberSlug,
                    memberId: r.memberId,
                })) || [],
        }));
    } else {
        // Fallback to previous merge if API detail didn't include projects
        const apiProjects = await fetchApiProjects();
        const allProjects = mergeProjects(apiProjects, SEED_PROJECTS);
        projectsForEvent = allProjects.filter((p) => (p.events || []).some((e) => e.slug === baseEvent.slug));
    }

    const photos = baseEvent.photos || [];
    const cover = photos[0];

    return (
        <section className="section">
            <header className="mb-6">
                <p className="kicker">EVENT</p>
                <h1 className="display">{baseEvent.name}</h1>
                <div className="mt-2 text-white/70 text-sm">
                    {baseEvent.locationName ? `${baseEvent.locationName} • ` : ""}
                    {baseEvent.dateStart ? new Date(baseEvent.dateStart).toLocaleDateString() : ""}
                    {baseEvent.dateEnd ? ` – ${new Date(baseEvent.dateEnd).toLocaleDateString()}` : ""}
                </div>
            </header>

            {cover && (
                <div className="mb-6">
                    <img src={cover} alt={baseEvent.name} className="w-full h-80 object-cover rounded-xl ring-1 ring-white/10" />
                </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
                <article className="lg:col-span-3 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">About</h2>
                        {baseEvent.description ? (
                            <p className="text-white/80 leading-relaxed">{baseEvent.description}</p>
                        ) : (
                            <p className="text-white/60">No description yet.</p>
                        )}

                        {(baseEvent.tags && baseEvent.tags.length > 0) && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {baseEvent.tags.slice(0, 12).map((t) => (
                                    <span key={t} className="text-[11px] px-2 py-1 rounded-full bg-white/5 ring-1 ring-white/10">
                    {t}
                  </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* reuse the same MapLibre component with a single event to keep styling consistent */}
                    {(typeof baseEvent.lng === "number" && typeof baseEvent.lat === "number") && (
                        <div className="card p-0 overflow-hidden">
                            <EventsMap events={[baseEvent]} />
                        </div>
                    )}

                    {/* Projects at this event */}
                    {projectsForEvent.length > 0 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Projects at this event</h2>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {projectsForEvent.map((p) => (
                                    <Link
                                        key={p.slug}
                                        href={`/projects/${p.slug}`}
                                        className="flex gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                                    >
                                        {p.imageUrl && (
                                            <img
                                                src={p.imageUrl}
                                                alt={p.title}
                                                className="w-32 h-24 object-cover rounded-md ring-1 ring-white/10"
                                            />
                                        )}
                                        <div className="min-w-0">
                                            <div className="font-semibold leading-tight hover:underline">{p.title}</div>
                                            {typeof p.year === "number" && (
                                                <div className="text-xs text-white/60 mt-0.5">{p.year}</div>
                                            )}
                                            {p.summary && (
                                                <div className="text-sm text-white/70 mt-1 line-clamp-3">{p.summary}</div>
                                            )}

                                            {/* tiny team row */}
                                            {p.members && p.members.length > 0 && (
                                                <div className="mt-2 flex -space-x-2">
                                                    {p.members.slice(0, 5).map((ref, i) => {
                                                        const slug = ref.memberSlug || ref.memberId || "";
                                                        const m = slug ? memMap.get(slug) : undefined;
                                                        return (
                                                            <span key={`${slug}-${i}`} className="inline-block">
                                <img
                                    src={m?.avatarUrl || m?.avatar || "/avatars/default.png"}
                                    alt={m?.name || slug}
                                    title={m?.name || slug}
                                    className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                                />
                              </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* tech chips */}
                                            {p.techStack && p.techStack.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {p.techStack.slice(0, 6).map((t) => (
                                                        <span
                                                            key={t}
                                                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 ring-1 ring-white/10"
                                                        >
                              {t}
                            </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {photos.length > 1 && (
                        <div className="card p-5">
                            <h2 className="text-lg font-semibold mb-3">Gallery</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {photos.slice(1).map((src, i) => (
                                    <img
                                        key={i}
                                        src={src}
                                        alt={`${baseEvent.name} photo ${i + 2}`}
                                        className="w-full h-32 object-cover rounded-md ring-1 ring-white/10"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </article>

                <aside className="lg:col-span-2 space-y-6">
                    <div className="card p-5">
                        <h2 className="text-lg font-semibold mb-2">Attendees</h2>
                        {attendees.length === 0 ? (
                            <p className="text-white/60">No attendees listed yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {attendees.map((m) => (
                                    <li key={m.slug} className="flex items-center gap-3">
                                        <img
                                            src={m.avatarUrl || m.avatar || "/avatars/default.png"}
                                            alt={m.name}
                                            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                            <Link href={`/members/${m.slug}`} className="font-medium hover:underline">
                                                {m.name}
                                            </Link>
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
                <Link href="/events" className="underline underline-offset-4">
                    ← Back to all events
                </Link>
            </div>
        </section>
    );
}

/* --------------------------------- utils --------------------------------- */

function dedupeBy<T>(arr: T[], key: (x: T) => string | number | undefined | null): T[] {
    const map = new Map<string | number, T>();
    for (const item of arr) {
        const k = key(item);
        if (k === undefined || k === null) continue;
        if (!map.has(k)) map.set(k, item);
    }
    return Array.from(map.values());
}
