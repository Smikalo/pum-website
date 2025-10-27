// Backwards-compatible project seeds.
// Matches your overview's expectations: slug, title, tags, techStack, members[], imageUrl.
// Adds optional fields used by the detail page (summary, description, year, links, gallery, events).

export type Project = {
    id?: string;
    slug: string;
    title: string;

    // Overview
    tags?: string[];
    techStack?: string[];
    members?: { memberId?: string; memberSlug?: string; role?: string }[];
    imageUrl?: string;

    // Detail
    summary?: string;
    description?: string;
    year?: number;
    cover?: string; // same as imageUrl; either works
    demoUrl?: string;
    repoUrl?: string;
    events?: { slug: string; name?: string }[];
    gallery?: string[];
};

const cover = (q: string) =>
    `https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1400&auto=format&fit=crop`;

export const SEED_PROJECTS: Project[] = [
    {
        slug: "green-route-planner",
        title: "Green Route Planner",
        summary:
            "Optimizes trips by emissions + transfers using GTFS feeds, historic delays and map heuristics.",
        description:
            "A hackathon-born prototype to plan routes minimizing CO₂ while keeping transfers reasonable. We experimented with on-device models for latency and privacy.",
        year: 2023,
        tags: ["hackathon", "mobility", "sustainability"],
        techStack: ["python", "pytorch", "onnx", "nextjs", "tailwind"],
        members: [{ memberSlug: "alice-ml", role: "ML Lead" }],
        events: [{ slug: "danube-hack-2023-regensburg" }],
        imageUrl: cover("mobility"),
        cover: cover("mobility"),
        demoUrl: "#",
        repoUrl: "#",
        gallery: [
            "https://images.unsplash.com/photo-1520583457224-aee11bad5112?q=80&w=1200&auto=format&fit=crop",
        ],
    },
    {
        slug: "spezi-finder",
        title: "Spezi Finder",
        summary: "Community map for Spezi hotspots. Never run out again 😉",
        description:
            "A playful web app with a map that lets you find the nearest Spezi stash. Built on Next.js + MapLibre with a tiny Prisma backend.",
        year: 2025,
        tags: ["map", "fun"],
        techStack: ["nextjs", "maplibre", "prisma", "typescript"],
        members: [{ memberSlug: "bob-fs", role: "Tech Lead" }],
        imageUrl: cover("spezi"),
        cover: cover("spezi"),
        demoUrl: "#",
        repoUrl: "#",
    },
    {
        slug: "plant-orchestra",
        title: "Plant Orchestra",
        summary: "Interactive installation turning plant signals into sound.",
        description:
            "Hardware + web audio mashup: map sensors to generative sound & visuals, performed during a maker weekend.",
        year: 2024,
        tags: ["makers", "art", "iot"],
        techStack: ["arduino", "max/msp", "web-audio"],
        members: [{ memberSlug: "carol-design", role: "Design" }],
        events: [{ slug: "european-maker-week-2025-vienna" }],
        imageUrl: cover("plants"),
        cover: cover("plants"),
        demoUrl: "#",
    },
];
