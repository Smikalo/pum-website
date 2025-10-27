export type EventItem = {
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
    participants?: string[]; // NEW (optional): member slugs
};

const img = (k: string) =>
    `https://images.unsplash.com/photo-1551836022-deb4988cc6c3?q=80&w=1200&auto=format&fit=crop`;

export const SEED_EVENTS: EventItem[] = [
    {
        id: "e-danube-2023",
        slug: "danube-hack-2023-regensburg",
        name: "Danube Hack 2023",
        locationName: "Regensburg Tech Campus",
        lat: 49.0167,
        lng: 12.0833,
        dateStart: "2023-06-02",
        dateEnd: "2023-06-04",
        description:
            "Data + ML weekend. Won best use of open data with a sustainable mobility prototype.",
        tags: ["hackathon", "ML", "open-data", "sustainability"],
        photos: [img("regensburg-1")],
        participants: ["alice-schmidt", "bob-kowalski"],
    },
    {
        id: "e-maker-2025",
        slug: "european-maker-week-2025-vienna",
        name: "European Maker Week 2025",
        locationName: "Vienna",
        lat: 48.2082,
        lng: 16.3738,
        dateStart: "2025-05-28",
        dateEnd: "2025-06-01",
        description:
            "Hardware + software mashups — thermal-cam art wall & plant orchestra.",
        tags: ["makers", "hardware", "iot", "art"],
        photos: [img("vienna-1")],
        participants: ["carla-berger", "alice-schmidt"],
    },
    {
        id: "e-potsdam-2024",
        slug: "potsdam-tech-2024",
        name: "Potsdam Tech Summit 2024",
        locationName: "Potsdam",
        lat: 52.4000,
        lng: 13.0667,
        dateStart: "2024-09-12",
        dateEnd: "2024-09-13",
        description: "Talk + live demo of our edge agents prototype.",
        tags: ["conference", "demo", "agents"],
        photos: [img("potsdam")],
        participants: ["dan-miller"],
    },
    {
        id: "e-munich-werk1-2025",
        slug: "munich-werk1-hack-2025",
        name: "Werk1 Hack 2025",
        locationName: "Munich, Werk1",
        lat: 48.1351,
        lng: 11.5820,
        dateStart: "2025-02-08",
        dateEnd: "2025-02-09",
        description: "Startup challenges with mentors from industry.",
        tags: ["hackathon", "startup"],
        photos: [img("werk1")],
    },
];
