import fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import path from "node:path";
import { promises as fs } from "node:fs";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

/* --------------------------- helpers & types --------------------------- */

async function readJson<T = any>(relPath: string): Promise<T> {
    const abs = path.join(process.cwd(), relPath);
    const txt = await fs.readFile(abs, "utf8");
    return JSON.parse(txt) as T;
}

function sliceBySize<T>(items: T[], size?: string | number) {
    const n = Number(size);
    if (Number.isFinite(n) && n > 0) return items.slice(0, n);
    return items;
}

/* Minimal shapes that match the web app expectations */
type Member = {
    id: string;
    slug: string;
    name: string;
    shortBio?: string;
    longBio?: string;
    skills?: string[];
    techStack?: string[];
    avatarUrl?: string;
    badges?: string[];
    links?: Record<string, string>;
    projects?: Array<{ projectId?: string; projectSlug?: string; role?: string; contribution?: string }>;
};

type Project = {
    id: string;
    slug: string;
    title?: string;
    name?: string;
    summary?: string;
    description?: string;
    techStack?: string[];
    tags?: string[];
    imageUrl?: string;
    cover?: string;
    members?: Array<{ memberId?: string; memberSlug?: string; role?: string }>;
    year?: number;
};

type EventT = {
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

type BlogPost = {
    slug: string;
    title: string;
    excerpt?: string;
    cover?: string;
    image?: string;
    authorSlug?: string;
    tags?: string[];
    date?: string;
    bodyMd?: string;
    content?: string;
};

export async function buildApp() {
    const app = fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

    // Security, CORS, rate limit
    await app.register(helmet);
    await app.register(cors, {
        origin: [WEB_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
        credentials: true,
    }); // :contentReference[oaicite:1]{index=1}
    await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

    // OpenAPI + Swagger UI
    await app.register(swagger, {
        openapi: { info: { title: "PUM API", version: "0.1.0" }, servers: [{ url: "/" }] },
    }); // :contentReference[oaicite:2]{index=2}
    await app.register(swaggerUi, { routePrefix: "/docs" });

    /* ------------------------------ health ------------------------------ */
    app.get("/", async () => ({ ok: true, service: "pum-api", port: Number(process.env.API_PORT || 3001) }));
    app.get("/health", async () => ({ ok: true, uptime: process.uptime(), version: "0.1.0" }));
    app.get("/health/z", async () => ({ ok: true, uptime: process.uptime(), version: "0.1.0" }));

    /* ------------------------------ loaders ----------------------------- */
    async function loadMembers(): Promise<Member[]> {
        try { return await readJson<Member[]>("src/data/members.json"); } catch { return []; }
    }
    async function loadProjects(): Promise<Project[]> {
        try { return await readJson<Project[]>("src/data/projects.json"); } catch { return []; }
    }
    async function loadEvents(): Promise<EventT[]> {
        try { return await readJson<EventT[]>("src/data/events.json"); } catch { return []; }
    }
    async function loadBlog(): Promise<BlogPost[]> {
        // primary location in this repo
        try { return await readJson<BlogPost[]>("api/prisma/seed-data/blog.json"); } catch {}
        try { return await readJson<BlogPost[]>("prisma/seed-data/blog.json"); } catch {}
        try { return await readJson<BlogPost[]>("src/data/blog.json"); } catch {}
        return [];
    }

    /* ------------------------------- members ---------------------------- */
    app.get("/api/members", async (req) => {
        const size = (req.query as any)?.size;
        const items = sliceBySize(await loadMembers(), size);
        return { items, total: items.length };
    });

    app.get<{ Params: { slug: string } }>("/api/members/:slug", async (req, reply) => {
        const items = await loadMembers();
        const m = items.find(x => x.slug === req.params.slug || x.id === req.params.slug);
        if (!m) return reply.code(404).send({ error: "Not found" });
        return m;
    });

    /* ------------------------------- projects --------------------------- */
    app.get("/api/projects", async (req) => {
        const size = (req.query as any)?.size;
        const list = await loadProjects();
        const items = sliceBySize(list.map(p => ({
            ...p,
            title: p.title ?? p.name,
        })), size);
        return { items, total: list.length };
    });

    app.get<{ Params: { slug: string } }>("/api/projects/:slug", async (req, reply) => {
        const items = await loadProjects();
        const p = items.find(x => (x.slug || x.id) === req.params.slug);
        if (!p) return reply.code(404).send({ error: "Not found" });
        return { ...p, title: p.title ?? p.name };
    });

    /* -------------------------------- events ---------------------------- */
    app.get("/api/events", async (req) => {
        const size = (req.query as any)?.size;
        const items = sliceBySize(await loadEvents(), size);
        return { items, total: items.length };
    });

    app.get<{ Params: { slug: string } }>("/api/events/:slug", async (req, reply) => {
        const items = await loadEvents();
        const e = items.find(x => x.slug === req.params.slug || x.id === req.params.slug);
        if (!e) return reply.code(404).send({ error: "Not found" });
        return e;
    });

    /* -------------------------------- blog ------------------------------ */
    app.get("/api/blog", async (req) => {
        const size = (req.query as any)?.size;
        const posts = await loadBlog();
        const items = sliceBySize(posts.map(p => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt || (p.bodyMd ? p.bodyMd.slice(0, 180) : ""),
            cover: p.cover || p.image,
            author: p.authorSlug,
            tags: p.tags || [],
            date: p.date,
        })), size);
        return { items, total: posts.length };
    });

    app.get<{ Params: { slug: string } }>("/api/blog/:slug", async (req, reply) => {
        const posts = await loadBlog();
        const p = posts.find(x => x.slug === req.params.slug);
        if (!p) return reply.code(404).send({ error: "Not found" });
        return {
            slug: p.slug,
            title: p.title,
            content: p.content || p.bodyMd || "",
            excerpt: p.excerpt || "",
            cover: p.cover || p.image,
            author: p.authorSlug,
            tags: p.tags || [],
            date: p.date,
        };
    });

    // legacy aliases for blog
    // /api/posts  -> reuse /api/blog
    app.get("/api/posts", async (req, reply) => {
        const res = await app.inject({
            method: "GET",
            url: "/api/blog",
            query: req.query as any, // preserve ?size=...
        });

        // NOTE: headers is an object, not a function
        return reply
            .code(res.statusCode)
            .headers(res.headers as Record<string, any>)
            .send(res.body ?? res.payload);
    });

// /api/posts/:slug  -> reuse /api/blog/:slug
    app.get<{ Params: { slug: string } }>("/api/posts/:slug", async (req, reply) => {
        const res = await app.inject({
            method: "GET",
            url: `/api/blog/${req.params.slug}`,
        });

        return reply
            .code(res.statusCode)
            .headers(res.headers as Record<string, any>)
            .send(res.body ?? res.payload);
    });

    return app;
}
