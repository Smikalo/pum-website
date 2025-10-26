// Local seed events to enrich the map and list for demo & content density.
// Cities requested: Munich, Regensburg, Potsdam, Vienna — across multiple years.

export type SeedEvent = {
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

// Helper to make quick photo sets
const p = (q: string) => [
    `https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=800&auto=format&fit=crop`,
    `https://images.unsplash.com/photo-1551836022-5f16a9ca4100?q=80&w=800&auto=format&fit=crop`,
    `https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&auto=format&fit=crop`,
    `https://images.unsplash.com/photo-1542834369-f10ebf06d3cb?q=80&w=800&auto=format&fit=crop`,
];

export const SEED_EVENTS: SeedEvent[] = [
    // Munich
    {
        id: "seed-2025-muc-01",
        slug: "pum-spring-hack-2025-munich",
        name: "PUM Spring Hack 2025",
        dateStart: "2025-04-19",
        dateEnd: "2025-04-20",
        locationName: "Munich, TUM Garching",
        lat: 48.2626,
        lng: 11.6683,
        description: "Two-day sprint at TUM. AI agents, AR demos, and robotics hacks. Sponsored pizza & Spezi.",
        tags: ["hackathon", "AI", "AR", "robotics"],
        photos: p("munich hackathon"),
    },
    {
        id: "seed-2024-muc-02",
        slug: "digital-innovation-day-2024-munich",
        name: "Digital Innovation Day 2024",
        dateStart: "2024-10-12",
        dateEnd: "2024-10-13",
        locationName: "Munich, Werk1",
        lat: 48.1346,
        lng: 11.6066,
        description: "Startup challenges with mentors from industry. We shipped 7 demos in 24h.",
        tags: ["startup", "cloud", "frontend", "demo-day"],
        photos: p("innovation"),
    },

    // Regensburg
    {
        id: "seed-2023-reg-01",
        slug: "danube-hack-2023-regensburg",
        name: "Danube Hack 2023",
        dateStart: "2023-06-02",
        dateEnd: "2023-06-04",
        locationName: "Regensburg Tech Campus",
        lat: 49.0139,
        lng: 12.1016,
        description: "Data + ML weekend. Won best use of open data with a sustainable mobility prototype.",
        tags: ["hackathon", "ML", "open-data", "sustainability"],
        photos: p("regensburg"),
    },

    // Potsdam
    {
        id: "seed-2022-pots-01",
        slug: "lakeside-dev-summit-2022-potsdam",
        name: "Lakeside Dev Summit 2022",
        dateStart: "2022-09-17",
        dateEnd: "2022-09-18",
        locationName: "Potsdam, HPI",
        lat: 52.3944,
        lng: 13.1326,
        description: "Talks + hack sprints by the lake. We demoed a real-time collaboration tool.",
        tags: ["conference", "web", "realtime", "collaboration"],
        photos: p("potsdam"),
    },

    // Vienna
    {
        id: "seed-2021-vie-01",
        slug: "vienna-ai-jam-2021",
        name: "Vienna AI Jam 2021",
        dateStart: "2021-11-20",
        dateEnd: "2021-11-21",
        locationName: "Vienna, TU Wien",
        lat: 48.1985,
        lng: 16.3690,
        description: "Zero-to-demo AI jam. Tiny LLMs on-device and generative UI experiments.",
        tags: ["AI", "LLM", "on-device", "generative"],
        photos: p("vienna"),
    },
    {
        id: "seed-2025-vie-02",
        slug: "european-maker-week-2025-vienna",
        name: "European Maker Week 2025",
        dateStart: "2025-05-31",
        dateEnd: "2025-06-01",
        locationName: "Vienna, MuseumsQuartier",
        lat: 48.2036,
        lng: 16.3609,
        description: "Hardware + software mashups. We built a thermal-cam art wall & an IoT plant orchestra.",
        tags: ["makers", "hardware", "iot", "art"],
        photos: p("maker"),
    },
];
