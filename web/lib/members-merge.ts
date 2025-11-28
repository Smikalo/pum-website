// web/lib/members-merge.ts
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
    // keep any extra legacy fields without enforcing concrete types:
    [key: string]: unknown;
};

type LegacyMembersResponse = MemberLite[] | { items?: unknown } | Record<string, unknown>;

/** Utility: safely coerce to string. */
function asString(value: unknown): string | undefined {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
    if (typeof value === "number") {
        return String(value);
    }
    return undefined;
}

/** Utility: turn unknown into a string array. */
function asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim())
            .filter((v) => v.length > 0);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }
    return [];
}

function uniqueStrings(values: string[]): string[] {
    return Array.from(new Set(values.filter((v) => v.length > 0)));
}

/** Normalize project references from unknown input. */
function normalizeProjects(value: unknown): MemberLite["projects"] {
    if (!Array.isArray(value)) return [];
    const result: MemberLite["projects"] = [];

    for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const slug = asString(obj.slug) ?? asString(obj.id);
        if (!slug) continue;

        result.push({
            slug,
            name: asString(obj.name),
        });
    }

    return result;
}

/** Normalize event references from unknown input. */
function normalizeEvents(value: unknown): MemberLite["events"] {
    if (!Array.isArray(value)) return [];
    const result: MemberLite["events"] = [];

    for (const item of value) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        const slug = asString(obj.slug) ?? asString(obj.id);
        if (!slug) continue;

        result.push({
            slug,
            name: asString(obj.name),
        });
    }

    return result;
}

/** Try to fetch members from your existing backend (if present). */
async function fetchLegacyMembers(): Promise<unknown[]> {
    const url = new URL("/api/members?size=999", API_BASE).toString();

    try {
        // eslint-disable-next-line no-console
        console.log("[members-merge] fetching legacy members", {
            apiBase: API_BASE,
            url,
        });

        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            // eslint-disable-next-line no-console
            console.error("[members-merge] legacy /api/members failed", {
                status: res.status,
                statusText: res.statusText,
                bodySnippet: body.slice(0, 500),
                apiBase: API_BASE,
                url,
            });
            return [];
        }

        const json: LegacyMembersResponse = await res.json();

        if (Array.isArray(json)) {
            // eslint-disable-next-line no-console
            console.log("[members-merge] legacy members array response", {
                count: json.length,
            });
            return json;
        }

        if (json && typeof json === "object" && "items" in json) {
            const items = (json as { items?: unknown }).items;
            if (Array.isArray(items)) {
                // eslint-disable-next-line no-console
                console.log("[members-merge] legacy members wrapped response", {
                    count: items.length,
                });
                return items;
            }
        }

        // eslint-disable-next-line no-console
        console.warn("[members-merge] unexpected legacy members response shape", {
            json,
        });

        return [];
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[members-merge] error while fetching legacy members", {
            error: err,
            apiBase: API_BASE,
            url,
        });
        return [];
    }
}

/** Normalize any member shape to MemberLite and build `tags` if missing. */
function normalize(raw: unknown): MemberLite {
    const obj = (raw ?? {}) as Record<string, unknown>;

    const skills = uniqueStrings([
        ...asStringArray(obj["skills"]),
        ...asStringArray(obj["skill"]),
    ]);

    const expertise = uniqueStrings([
        ...asStringArray(obj["expertise"]),
        ...asStringArray(obj["expertises"]),
    ]);

    const tags = uniqueStrings([...asStringArray(obj["tags"]), ...skills, ...expertise]);

    const id =
        asString(obj["id"]) ??
        asString(obj["slug"]) ??
        asString(obj["name"]) ??
        "member";

    const slug =
        asString(obj["slug"]) ??
        (asString(obj["name"])?.toLowerCase().replace(/\s+/g, "-")) ??
        id;

    const name = asString(obj["name"]) ?? "Unnamed";

    const bio = asString(obj["bio"]);

    const avatar =
        asString(obj["avatar"]) ??
        asString(obj["photo"]) ??
        asString(obj["image"]);

    const headline =
        asString(obj["headline"]) ??
        asString(obj["title"]) ??
        (bio ? bio.slice(0, 80) : undefined);

    return {
        id,
        slug,
        name,
        avatar,
        headline,
        expertise,
        skills,
        tags,
        projects: normalizeProjects(obj["projects"]),
        events: normalizeEvents(obj["events"]),
        // keep all original fields for backwards-compat:
        ...obj,
    };
}

/** Merge external + seeds with de-duplication by slug. */
export async function getAllMembersMerged(): Promise<MemberLite[]> {
    const legacyRaw = await fetchLegacyMembers();
    const seeds: SeedMember[] = SEED_MEMBERS;

    const pool: MemberLite[] = [
        ...legacyRaw.map((m) => normalize(m)),
        ...seeds.map((m) => normalize(m)),
    ];

    const map = new Map<string, MemberLite>();

    for (const m of pool) {
        if (!m.slug) continue;

        const existing = map.get(m.slug);

        if (!existing) {
            map.set(m.slug, m);
        } else {
            // prefer legacy if already present, then overlay any missing fields from seeds
            map.set(m.slug, { ...m, ...existing });
        }
    }

    const result = Array.from(map.values());

    // eslint-disable-next-line no-console
    console.log("[members-merge] merged members", {
        legacyCount: legacyRaw.length,
        seedCount: seeds.length,
        mergedCount: result.length,
    });

    return result;
}
