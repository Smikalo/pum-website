// Unified member seeds for BOTH the overview page (which expects shortBio/skills/techStack/avatarUrl)
// and the detail/attendee pages (which may reference avatar/headline/expertise/...).
// Everything beyond slug+name is optional for backwards compatibility.

export type Member = {
    id?: string;
    slug: string;
    name: string;

    // --- Overview-page fields (your existing Members page expects these names) ---
    shortBio?: string;
    skills?: string[];     // e.g., ["frontend","ml","design"]
    techStack?: string[];  // e.g., ["python","pytorch","nextjs"]
    avatarUrl?: string;

    // --- Detail/attendee fields (used by member/event detail pages) ---
    avatar?: string;       // duplicate of avatarUrl for components that expect "avatar"
    headline?: string;
    location?: string;
    expertise?: string[];
    bio?: string;
    links?: {
        github?: string;
        linkedin?: string;
        website?: string;
        email?: string;
    };
    projects?: Array<{
        slug: string;
        name: string;
        role?: string;
        summary?: string;
        tech?: string[];
        year?: number;
        cover?: string;
    }>;
    events?: Array<{
        slug: string;
        name?: string;
        role?: string;
    }>;
    photos?: string[];
};

// Minimal shape the Members page needs; kept for clarity.
// (This is a subset of Member; using it where you specifically want the small surface.)
export type MemberSeed = {
    slug: string;
    name: string;
    shortBio?: string;
    skills?: string[];
    techStack?: string[];
    avatarUrl?: string;

    // The following are optional, but included so seeds can power detail pages too.
    avatar?: string;
    headline?: string;
    location?: string;
    expertise?: string[];
    bio?: string;
    links?: Member["links"];
    projects?: Member["projects"];
    events?: Member["events"];
    photos?: string[];
};

const avatar = (seed: string) =>
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4`;

// You can freely add more members here. Fields are optional and backward-compatible.
export const SEED_MEMBERS: Member[] = [
    {
        slug: "alice-ml",
        name: "Alice Petrenko",
        headline: "ML Engineer @ PUM • Graphs, LLMs, Optimization",
        shortBio:
            "ML engineer shipping fast hackathon prototypes: LLM tooling, routing, MLOps. Loves 24–48h sprints.",
        skills: ["ml", "ai", "data"],
        techStack: ["python", "pytorch", "onnx", "nextjs", "tailwind", "vector-search", "graphs"],
        avatarUrl: avatar("alice"),
        avatar: avatar("alice"),
        expertise: ["ML/AI"],
        links: {
            github: "https://github.com/example",
            linkedin: "https://linkedin.com/in/example",
            website: "https://pum.dev",
        },
        projects: [
            {
                slug: "green-route-planner",
                name: "Green Route Planner",
                role: "ML lead",
                summary:
                    "Optimizes urban trips on emissions + transfers using GTFS feeds, historical delays and map heuristics.",
                tech: ["python", "pytorch", "onnx", "nextjs", "tailwind"],
                year: 2023,
                cover:
                    "https://images.unsplash.com/photo-1520583457224-aee11bad5112?q=80&w=1200&auto=format&fit=crop",
            },
        ],
        events: [
            { slug: "danube-hack-2023-regensburg", role: "participant" },
            { slug: "munich-werk1-2025", role: "mentor" },
        ],
        photos: [
            "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200&auto=format&fit=crop",
        ],
    },
    {
        slug: "bob-fs",
        name: "Bob Nguyen",
        headline: "Full-stack + DevOps • TypeScript enjoyer",
        shortBio: "Full-stack + DevOps. DX-first, tidy CI, scales frontends to robust APIs.",
        skills: ["fullstack"],
        techStack: ["typescript", "react", "nextjs", "docker", "postgres"],
        avatarUrl: avatar("bob"),
        avatar: avatar("bob"),
        projects: [
            {
                slug: "spezi-finder",
                name: "Spezi Finder",
                role: "Tech lead",
                summary: "Never run out of Spezi again — map the nearest stash 😉",
                tech: ["nextjs", "maplibre", "prisma"],
                year: 2025,
            },
        ],
        events: [{ slug: "european-maker-week-2025-vienna" }, { slug: "munich-werk1-2025" }],
    },
    {
        slug: "carol-design",
        name: "Carol Meyer",
        headline: "Product Design • HCI • Data Viz",
        shortBio: "Product design • HCI • data-viz. Turns messy prototypes into clear narratives.",
        skills: ["design"],
        techStack: ["figma", "ux", "data-vis", "storytelling"],
        avatarUrl: avatar("carol"),
        avatar: avatar("carol"),
        expertise: ["Design"],
        projects: [
            {
                slug: "plant-orchestra",
                name: "Plant Orchestra",
                role: "Design",
                summary: "Interactive installation turning plant signals into sound.",
                tech: ["arduino", "max/msp", "web-audio"],
                year: 2024,
            },
        ],
        events: [{ slug: "european-maker-week-2025-vienna" }],
    },
];
