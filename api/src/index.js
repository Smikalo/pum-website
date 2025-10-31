const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const z = require("zod");
const path = require("path");
const fs = require("fs");

const { prisma } = require("./db");
const { authRouter } = require("./auth");
const { accountRouter } = require("./account");

const app = express();

/* ------------------------ CORS ------------------------ */
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
app.use(
    cors({
        origin: WEB_ORIGIN,
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
        optionsSuccessStatus: 204,
    })
);

/* ---------------- Proxy + middleware ---------------- */
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
    })
);

/* ------------------------ Static uploads ------------------------ */
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

app.use(
    "/uploads",
    (req, res, next) => {
        // allow the web app to embed these files in an <iframe> (PDF viewer)
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.removeHeader("X-Frame-Options");
        // Explicitly permit only our web origin (and same-origin) to frame these responses
        res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${WEB_ORIGIN}`);
        next();
    },
    express.static(UPLOAD_ROOT, { maxAge: "1h", etag: true })
);

/* ------------------------ Helpers ------------------------ */
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;
function abs(u, req) {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    const base = PUBLIC_API_BASE || `${req.protocol}://${req.get("host")}`;
    const rel = u.startsWith("/") ? u : `/${u}`;
    return `${base}${rel}`;
}
const toInt = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/* ------------------------------ Health ------------------------------ */
app.get("/healthz", async (_req, res) => {
    try {
        const dbOk = await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true, service: "api", db: !!dbOk });
    } catch (e) {
        res.status(500).json({ ok: false, service: "api", db: false, error: String(e) });
    }
});

const qpSchema = z.object({
    q: z.string().optional(),
    skill: z.string().optional(),
    tech: z.string().optional(),
    page: z.string().optional(),
    size: z.string().optional(),
});

/* ------------------------------ Members ------------------------------ */
app.get("/api/members", async (req, res) => {
    const qp = qpSchema.parse(req.query);
    const page = toInt(qp.page, 1);
    const size = Math.min(toInt(qp.size, 24), 1000);

    const skills = (qp.skill || "").split(",").map((s) => s.trim()).filter(Boolean);
    const techs = (qp.tech || "").split(",").map((s) => s.trim()).filter(Boolean);

    const AND = [];
    if (qp.q)
        AND.push({
            OR: [
                { name: { contains: qp.q, mode: "insensitive" } },
                { shortBio: { contains: qp.q, mode: "insensitive" } },
                { longBio: { contains: qp.q, mode: "insensitive" } },
                { bio: { contains: qp.q, mode: "insensitive" } },
                { headline: { contains: qp.q, mode: "insensitive" } },
            ],
        });
    for (const s of skills) AND.push({ skills: { some: { skill: { name: s } } } });
    for (const t of techs) AND.push({ techs: { some: { tech: { name: t } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.member.count({ where }),
        prisma.member.findMany({
            where,
            include: { skills: { include: { skill: true } }, techs: { include: { tech: true } } },
            orderBy: { name: "asc" },
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    res.json({
        items: rows.map((m) => ({
            id: m.id,
            slug: m.slug,
            name: m.name,
            avatarUrl: abs(m.avatarUrl || m.avatar || null, req),
            shortBio: m.shortBio || m.bio || null,
            headline: m.headline || null,
            skills: m.skills.map((x) => x.skill.name),
            techStack: m.techs.map((x) => x.tech.name),
            focusArea: m.focusArea || null,
            links: m.links || {},
        })),
        page,
        size,
        total,
    });
});

app.get("/api/members/:slug", async (req, res) => {
    // shared "include" to keep changes minimal
    const include = {
        skills: { include: { skill: true } },
        techs: { include: { tech: true } },
        projects: { include: { project: true } },
        events: { include: { event: true } },
    };

    // 1) try by slug as usual
    let m = await prisma.member.findUnique({
        where: { slug: req.params.slug },
        include,
    });

    // 2) minimal, safe fallback: if not found, try to resolve by user email local-part (e.g., "admin")
    if (!m) {
        const u = await prisma.user.findFirst({
            where: {
                email: { startsWith: `${req.params.slug}@`, mode: "insensitive" },
                memberId: { not: null },
            },
            select: { memberId: true },
        });
        if (u?.memberId) {
            m = await prisma.member.findUnique({ where: { id: u.memberId }, include });
        }
    }

    if (!m) return res.status(404).json({ error: "Not found" });

    // resolve cv if present for the linked user
    let cvUrl = null;
    const uForCv = await prisma.user.findFirst({ where: { memberId: m.id }, select: { id: true } });
    if (uForCv) {
        const p = path.join(UPLOAD_ROOT, "cv", `${uForCv.id}-latest.pdf`);
        if (fs.existsSync(p)) cvUrl = abs(`/uploads/cv/${uForCv.id}-latest.pdf`, req);
    }

    res.json({
        id: m.id,
        slug: m.slug,
        name: m.name,
        avatar: abs(m.avatar || m.avatarUrl || null, req),
        avatarUrl: abs(m.avatarUrl || m.avatar || null, req),
        headline: m.headline,
        shortBio: m.shortBio,
        bio: m.bio || m.longBio,
        markdown: m.bio || m.longBio || "",
        location: m.location,
        links: m.links || {},
        photos: m.photos || [],
        skills: m.skills.map((x) => x.skill.name),
        techStack: m.techs.map((x) => x.tech.name),
        focusArea: m.focusArea || null,
        projects: m.projects.map((r) => ({
            id: r.project.id,
            slug: r.project.slug,
            title: r.project.title,
            role: r.role,
            contribution: r.contribution,
            cover: abs(r.project.cover || r.project.imageUrl || null, req),
            year: r.project.year,
            tech: [],
            techStack: [],
            summary: r.project.summary || null,
        })),
        events: m.events.map((r) => ({
            id: r.event.id,
            slug: r.event.slug,
            name: r.event.name,
            role: r.role || null,
            dateStart: r.event.dateStart,
            dateEnd: r.event.dateEnd,
        })),
        cvUrl,
    });
});

/* ------------------------------ Projects ------------------------------ */
app.get("/api/projects", async (req, res) => {
    const page = Number.isFinite(Number(req.query.page)) ? Number(req.query.page) : 1;
    const size = Math.min(Number.isFinite(Number(req.query.size)) ? Number(req.query.size) : 24, 1000);

    const q = (req.query.q || "").toString().trim();
    const techCsv = (req.query.tech || "").toString();
    const tagCsv = (req.query.tag || "").toString();
    const techs = techCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const tags = tagCsv.split(",").map((s) => s.trim()).filter(Boolean);

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
            ],
        });
    }
    for (const t of techs) AND.push({ techs: { some: { tech: { name: t } } } });
    for (const t of tags) AND.push({ tags: { some: { tag: { name: t } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
            where,
            include: {
                techs: { include: { tech: true } },
                tags: { include: { tag: true } },
                members: { include: { member: { select: { id: true, slug: true, name: true, avatarUrl: true } } } },
            },
            orderBy: [{ year: "desc" }, { title: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    res.json({
        items: rows.map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            summary: p.summary || null,
            cover: abs(p.cover || p.imageUrl || null, req),
            imageUrl: abs(p.imageUrl || p.cover || null, req),
            year: p.year || null,
            techStack: p.techs.map((x) => x.tech.name),
            tags: p.tags.map((x) => x.tag.name),
            members: p.members.map((r) => ({
                memberId: r.member.id,
                memberSlug: r.member.slug,
                memberName: r.member.name,
                avatarUrl: abs(r.member.avatarUrl || null, req),
            })),
        })),
        page,
        size,
        total,
    });
});

app.get("/api/projects/:slug", async (req, res) => {
    const p = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: {
            techs: { include: { tech: true } },
            tags: { include: { tag: true } },
            members: { include: { member: { select: { slug: true, name: true, avatarUrl: true, id: true } } } },
            event: true,
        },
    });
    if (!p) return res.status(404).json({ error: "Not found" });

    res.json({
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary || null,
        description: p.description || null,
        status: p.status || null,
        demoUrl: p.demoUrl || null,
        imageUrl: abs(p.imageUrl || null, req),
        cover: abs(p.cover || null, req),
        images: Array.isArray(p.images) ? p.images.map((u) => abs(u, req)) : [],
        year: p.year || null,
        event: p.event ? { slug: p.event.slug, name: p.event.name, dateStart: p.event.dateStart } : null,
        techStack: p.techs.map((x) => x.tech.name),
        tags: p.tags.map((x) => x.tag.name),
        members: p.members.map((r) => ({
            slug: r.member.slug,
            name: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
        })),
    });
});

/* ---------------- Members categories/graph ---------------- */
app.get("/api/members/categories", async (_req, res) => {
    const [skills, tech, areas] = await Promise.all([
        prisma.skill.findMany({ select: { name: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } }),
        prisma.tech.findMany({ select: { name: true, _count: { select: { members: true } } }, orderBy: { name: "asc" } }),
        prisma.member.groupBy({ by: ["focusArea"], where: { NOT: { focusArea: null } }, _count: { focusArea: true } }),
    ]);
    res.json({
        skills: skills.map((s) => ({ name: s.name, count: s._count.members })),
        tech: tech.map((t) => ({ name: t.name, count: t._count.members })),
        areas: areas.filter((a) => a.focusArea).map((a) => ({ name: a.focusArea, count: a._count.focusArea })),
    });
});

app.get("/api/members/graph", async (_req, res) => {
    const members = await prisma.member.findMany({
        select: { id: true, slug: true, name: true, focusArea: true, skills: { include: { skill: true } }, avatarUrl: true },
    });
    const projects = await prisma.project.findMany({
        select: { id: true, slug: true, title: true, members: { select: { memberId: true } } },
    });
    res.json({
        nodes: [
            ...members.map((m) => ({
                id: `m:${m.id}`,
                type: "member",
                slug: m.slug,
                name: m.name,
                area: m.focusArea || null,
                avatarUrl: m.avatarUrl || null,
                skills: m.skills.map((s) => s.skill.name),
            })),
            ...projects.map((p) => ({ id: `p:${p.id}`, type: "project", slug: p.slug, title: p.title })),
        ],
        links: projects.flatMap((p) => p.members.map((r) => ({ source: `m:${r.memberId}`, target: `p:${p.id}` }))),
    });
});

/* -------------------------------- Events -------------------------------- */
app.get("/api/events", async (req, res) => {
    const page = Number.isFinite(Number(req.query.page)) ? Number(req.query.page) : 1;
    const size = Math.min(Number.isFinite(Number(req.query.size)) ? Number(req.query.size) : 24, 1000);
    const q = (req.query.q || "").toString().trim();
    const year = (req.query.year || "").toString().trim();

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { locationName: { contains: q, mode: "insensitive" } },
            ],
        });
    }
    if (year) {
        AND.push({
            dateStart: {
                gte: new Date(`${year}-01-01T00:00:00.000Z`),
                lt: new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`),
            },
        });
    }
    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.event.count({ where }),
        prisma.event.findMany({
            where,
            include: { attendees: { include: { member: { select: { slug: true, name: true, avatarUrl: true, headline: true, id: true } } } } },
            orderBy: [{ dateStart: "desc" }, { name: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    res.json({
        items: rows.map((e) => ({
            id: e.id,
            slug: e.slug,
            name: e.name,
            dateStart: e.dateStart,
            dateEnd: e.dateEnd,
            locationName: e.locationName,
            lat: e.lat,
            lng: e.lng,
            description: e.description,
            photos: Array.isArray(e.photos) ? e.photos.map((u) => abs(u, req)) : [],
            tags: Array.isArray(e.tags) ? e.tags : [],
            attendeesCount: e.attendees.length,
            attendees: e.attendees.map((a) => ({
                slug: a.member.slug,
                name: a.member.name,
                avatarUrl: abs(a.member.avatarUrl || null, req),
                headline: a.member.headline || null,
            })),
        })),
        page,
        size,
        total,
    });
});

/* ------------------------------ Blogs ------------------------------ */
app.get("/api/blogs", async (req, res) => {
    const page = Number.isFinite(Number(req.query.page)) ? Number(req.query.page) : 1;
    const size = Math.min(Number.isFinite(Number(req.query.size)) ? Number(req.query.size) : 24, 1000);

    const q = (req.query.q || "").toString().trim();
    const techCsv = (req.query.tech || "").toString();
    const tagCsv = (req.query.tag || "").toString();
    const authorCsv = (req.query.author || "").toString();

    const techs = techCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const tags = tagCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const authors = authorCsv.split(",").map((s) => s.trim()).filter(Boolean);

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
            ],
        });
    }
    for (const t of techs) AND.push({ techs: { some: { tech: { name: t } } } });
    for (const t of tags) AND.push({ tags: { some: { tag: { name: t } } } });
    for (const a of authors) AND.push({ authors: { some: { member: { slug: a } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.blog.count({ where }),
        prisma.blog.findMany({
            where,
            include: {
                techs: { include: { tech: true } },
                tags: { include: { tag: true } },
                authors: { include: { member: { select: { slug: true, name: true, avatarUrl: true, headline: true } } } },
            },
            orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    res.json({
        items: rows.map((b) => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            summary: b.summary || null,
            cover: abs(b.cover || b.imageUrl || null, req),
            imageUrl: abs(b.imageUrl || null, req),
            publishedAt: b.publishedAt || null,
            techStack: b.techs.map((x) => x.tech.name),
            tags: b.tags.map((x) => x.tag.name),
            authors: b.authors.map((r) => ({
                slug: r.member.slug,
                name: r.member.name,
                avatarUrl: abs(r.member.avatarUrl || null, req),
                headline: r.member.headline || null,
            })),
        })),
        page,
        size,
        total,
    });
});

/* ------------------------------ Routers ------------------------------ */
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);

/* ------------------------------ Start ------------------------------ */
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`API on :${PORT}`));
