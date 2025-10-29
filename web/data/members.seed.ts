// web/data/members.seed.ts
// Unified seed format used by list, graph, and detail pages.

export type MemberLinkset = {
    github?: string;
    linkedin?: string;
    website?: string;
};

export type MemberProjectRef = {
    slug: string;
    name?: string;
    role?: string;
    year?: number;
    cover?: string;
    tech?: string[];
    summary?: string;
};

export type MemberEventRef = {
    slug: string;
    name?: string;
    role?: string;
};

export type Member = {
    id?: string;
    slug: string;
    name: string;

    // Members list / graph expects these:
    shortBio?: string;
    skills?: string[];
    techStack?: string[];
    avatarUrl?: string;

    // Detail page fields (optional)
    avatar?: string;     // alias to avatarUrl
    headline?: string;
    bio?: string;
    links?: MemberLinkset;
    photos?: string[];
    projects?: MemberProjectRef[];
    events?: MemberEventRef[];
    expertise?: string[]; // optional alias category
};

const img = (q: string) =>
    `https://images.unsplash.com/${q}?q=80&w=1400&auto=format&fit=crop`;

export const SEED_MEMBERS: Member[] = [
    {
        id: "m-alice",
        slug: "alice-petrenko",
        name: "Alice Petrenko",
        headline: "Full-stack & ML @ PUM",
        shortBio: "Full-stack + applied ML, loves hackathons and FOSS.",
        skills: ["fullstack", "ml", "ai"],
        techStack: ["TypeScript", "Next.js", "Python", "PyTorch"],
        avatarUrl: img("photo-1544723795-3fb6469f5b39"),
        avatar: img("photo-1544723795-3fb6469f5b39"),
        bio:
            "Alice builds fast product prototypes with a focus on ML-powered UX. " +
            "She enjoys shipping, mentoring and coffee chats about model evaluations.",
        links: {
            github: "https://github.com/example-alice",
            linkedin: "https://www.linkedin.com/in/example-alice",
            website: "https://example.com/alice",
        },
        photos: [
            img("photo-1518770660439-4636190af475"),
            img("photo-1587620962725-abab7fe55159"),
        ],
        projects: [
            { slug: "spezi-scout", role: "Lead dev", year: 2024 },
            { slug: "hacktrack", role: "ML engineer", year: 2023 },
        ],
        events: [{ slug: "danube-hack-2023-regensburg", role: "Participant" }],
    },
    {
        id: "m-bob",
        slug: "bob-lee",
        name: "Bob Lee",
        headline: "Backend @ PUM",
        shortBio: "Developer experience, infra and APIs.",
        skills: ["backend"],
        techStack: ["Node.js", "PostgreSQL", "Prisma", "Docker"],
        avatarUrl: img("photo-1527980965255-d3b416303d12"),
        avatar: img("photo-1527980965255-d3b416303d12"),
        bio:
            "Bob designs resilient services and developer tooling. " +
            "Enjoys clean schemas, tracing, and long bike rides.",
        links: {
            github: "https://github.com/example-bob",
            linkedin: "https://www.linkedin.com/in/example-bob",
        },
        projects: [{ slug: "spezi-scout", role: "Backend", year: 2024 }],
        events: [
            { slug: "danube-hack-2023-regensburg", role: "Participant" },
            { slug: "bits-and-pretzels-2024-munich", role: "Volunteer" },
        ],
    },
];
