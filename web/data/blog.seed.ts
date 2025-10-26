export type BlogPost = {
    id: string;
    slug: string;
    title: string;
    summary: string;
    date: string; // ISO
    tags?: string[];
    cover?: string;
    contentHtml: string; // keep simple HTML for now
};

// Compact helper to keep seeds easy
const img = (q: string) =>
    `https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1200&auto=format&fit=crop`;

export const SEED_POSTS: BlogPost[] = [
    {
        id: "blog-2025-01",
        slug: "pum-wins-danube-hack",
        title: "PUM wins at Danube Hack with sustainable mobility prototype",
        summary:
            "We combined open data with ML to build a route planner that optimizes for emissions and transfers. Here’s how we prototyped it in 36 hours.",
        date: "2025-06-05",
        tags: ["hackathon", "ML", "open-data", "sustainability"],
        cover: img("mobility"),
        contentHtml: `
      <p>What a weekend! At <a href="/events/danube-hack-2023-regensburg">Danube Hack</a> we prototyped a mobility planner that weighs <strong>emissions</strong>, delays and transfers, trained on open GTFS feeds and historic delays.</p>
      <p>Shout-outs to our teammates from <a href="/members">PUM</a> and mentors on the ground. We’ll open-source the core in the next sprint and connect it to our <a href="/projects">project</a> pages.</p>
      <p>Tech: Python, PyTorch, on-device inference experiments, Tailwind, Next.js.</p>
    `,
    },
    {
        id: "blog-2025-02",
        slug: "agents-at-the-edge",
        title: "Agents at the edge: on-device LLMs for hackathon demos",
        summary:
            "We’ve been experimenting with tiny LLMs running on laptops and phones for instant inference and privacy-by-default assistants.",
        date: "2025-05-12",
        tags: ["AI", "LLM", "on-device", "agents"],
        cover: img("llm"),
        contentHtml: `
      <p>Running small LLMs locally lets us prototype <em>private-first</em> assistants that work offline and respond instantly.</p>
      <ul>
        <li>Latency: no network round-trip.</li>
        <li>Privacy: sensitive prompts stay on device.</li>
        <li>Reliability: demos don’t depend on Wi-Fi.</li>
      </ul>
      <p>We’ll share a starter repo soon.</p>
    `,
    },
    {
        id: "blog-2024-12",
        slug: "vienna-maker-week-recap",
        title: "Vienna Maker Week recap: a thermal-cam art wall & plant orchestra",
        summary:
            "Hardware + software mashups from a weekend of making in Vienna — here’s our photo dump and what we’d improve next time.",
        date: "2024-06-02",
        tags: ["makers", "hardware", "iot", "art"],
        cover: img("maker"),
        contentHtml: `
      <p>We brought together sensors, microcontrollers and a sprinkle of web audio to craft installations that respond to people and plants.</p>
      <p>Teams shared components across projects — a pattern we also use in software. Read the <a href="/events/european-maker-week-2025-vienna">event page</a> for connections.</p>
    `,
    },
];
