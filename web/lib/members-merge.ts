import { SEED_MEMBERS, type Member as SeedMember } from "@/data/members.seed";
import { API_BASE } from "@/lib/config";

/** A minimal shape the rest of the app expects (backwards-compatible). */
export type MemberLite = {
    id: string;
    slug: string;
    name: string;
    avatar?: string;
    headline?: string;
    expertise?: string[];
    skills?: string[];
    /** Unified tags used by search/categories; built from skills+expertise if missing. */
    tags?: string[];
    /** For graph connections (kept optional for BC). */
    projects?: { slug: string; name?: string }[];
    events?: { slug: string; name?: string }[];
    // keep any extra legacy fields without enforcing types:
    [key: string]: any;
};

/** Try to fetch members from your existing backend (if present). */
async function fetchLegacyMembers(): Promise<MemberLite[]> {
    try {
        const res = await fetch(new URL("/api/members?size=999", API_BASE).toString(), { cache: "no-store" });
        if (!res.ok) return [];
        const json = await res.json();
        const items: any[] = Array.isArray(json) ? json : (json.items ?? []);
        return items as MemberLite[];
    } catch {
        return [];
    }
}

/** Normalize any member shape to MemberLite and build `tags` if missing. */
function normalize(m: any): MemberLite {
    const skills: string[] = Array.from(new Set([...(m.skills ?? []), ...(m.skill ?? [])])).filter(Boolean);
    const expertise: string[] = Array.from(new Set([...(m.expertise ?? []), ...(m.expertises ?? [])])).filter(Boolean);
    const tags: string[] = Array.from(new Set([...(m.tags ?? []), ...skills, ...expertise])).filter(Boolean);

    return {
        id: m.id ?? m.slug ?? m.name,
        slug: m.slug ?? (m.name ? m.name.toLowerCase().replace(/\s+/g, "-") : m.id),
        name: m.name ?? "Unnamed",
        avatar: m.avatar ?? m.photo ?? m.image,
        headline: m.headline ?? m.title ?? m.bio?.slice(0, 80),
        expertise,
        skills,
        tags,
        projects: (m.projects ?? []).map((p: any) => ({ slug: p.slug ?? p.id, name: p.name })),
        events: (m.events ?? []).map((e: any) => ({ slug: e.slug ?? e.id, name: e.name })),
        ...m,
    };
}

/** Merge external + seeds with de-duplication by slug. */
export async function getAllMembersMerged(): Promise<MemberLite[]> {
    const legacy = await fetchLegacyMembers();
    const seeds: SeedMember[] = SEED_MEMBERS;
    const pool = [...legacy.map(normalize), ...seeds.map(normalize)];

    const map = new Map<string, MemberLite>();
    for (const m of pool) {
        if (!m.slug) continue;
        // prefer legacy if already present, then overlay any missing fields from seeds
        if (!map.has(m.slug)) {
            map.set(m.slug, m);
        } else {
            map.set(m.slug, { ...m, ...map.get(m.slug) });
        }
    }
    return Array.from(map.values());
}
