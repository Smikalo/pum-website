// api/src/index.js
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const z = require("zod");
const { prisma } = require("./db");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(helmet()); // secure headers :contentReference[oaicite:2]{index=2}
app.use(cors({ origin: true, credentials: true }));

app.use(rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_MAX || 100), standardHeaders: true, legacyHeaders: false })); // :contentReference[oaicite:3]{index=3}

app.get("/healthz", async (_, res) => {
    const dbOk = await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, service: "api", db: !!dbOk });
});

const toInt = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const qpSchema = z.object({ q: z.string().optional(), skill: z.string().optional(), tech: z.string().optional(), page: z.string().optional(), size: z.string().optional() });

// ---- Members (list) ----
app.get("/api/members", async (req, res) => {
    const qp = qpSchema.parse(req.query);
    const page = toInt(qp.page, 1);
    const size = Math.min(toInt(qp.size, 24), 1000);

    const skills = (qp.skill || "").split(",").map(s=>s.trim()).filter(Boolean);
    const techs  = (qp.tech  || "").split(",").map(s=>s.trim()).filter(Boolean);

    const AND = [];
    if (qp.q) AND.push({ OR: [
            { name: { contains: qp.q, mode: 'insensitive' } },
            { shortBio: { contains: qp.q, mode: 'insensitive' } },
            { longBio: { contains: qp.q, mode: 'insensitive' } },
            { bio:      { contains: qp.q, mode: 'insensitive' } },
            { headline: { contains: qp.q, mode: 'insensitive' } },
        ]});
    for (const s of skills) AND.push({ skills: { some: { skill: { name: s } } } });
    for (const t of techs)  AND.push({ techs:  { some: { tech:  { name: t } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.member.count({ where }),
        prisma.member.findMany({
            where,
            include: { skills: { include: { skill: true } }, techs: { include: { tech: true } } },
            orderBy: { name: 'asc' }, skip: (page-1)*size, take: size,
        }),
    ]);

    res.json({
        items: rows.map(m => ({
            id: m.id, slug: m.slug, name: m.name,
            avatarUrl: m.avatarUrl || m.avatar || null,
            shortBio: m.shortBio || m.bio || null,
            headline: m.headline || null,
            skills: m.skills.map(x=>x.skill.name),
            techStack: m.techs.map(x=>x.tech.name),
        })),
        page, size, total
    });
});

// ---- Member detail ----
app.get("/api/members/:slug", async (req, res) => {
    const m = await prisma.member.findUnique({
        where: { slug: req.params.slug },
        include: {
            skills:   { include: { skill: true } },
            techs:    { include: { tech: true } },
            projects: { include: { project: true } },
            events:   { include: { event: true } },
        },
    });
    if (!m) return res.status(404).json({ error: "Not found" });
    res.json({
        id: m.id, slug: m.slug, name: m.name,
        avatar: m.avatar || m.avatarUrl || null, avatarUrl: m.avatarUrl || m.avatar || null,
        headline: m.headline, shortBio: m.shortBio, bio: m.bio || m.longBio,
        location: m.location, links: m.links || {}, photos: m.photos || [],
        skills: m.skills.map(x=>x.skill.name), techStack: m.techs.map(x=>x.tech.name),
        projects: m.projects.map(r => ({
            id: r.project.id, slug: r.project.slug, title: r.project.title,
            role: r.role, contribution: r.contribution, cover: r.project.cover || r.project.imageUrl, year: r.project.year
        })),
        events: m.events.map(r => ({ id: r.event.id, slug: r.event.slug, name: r.event.name, role: r.role || null })),
    });
});

// ---- Projects list/detail (unchanged URL shape, DB-backed) ----
/* ...same as above — see full snippet in this message ... */

// ---- Categories (NEW) ----
app.get("/api/members/categories", async (_req, res) => {
    const [skills, tech] = await Promise.all([
        prisma.skill.findMany({ select: { name: true, _count: { select: { members: true } } }, orderBy: { name: 'asc' } }),
        prisma.tech.findMany({  select: { name: true, _count: { select: { members: true } } }, orderBy: { name: 'asc' } }),
    ]);
    res.json({
        skills: skills.map(s => ({ name: s.name, count: s._count.members })),
        tech:   tech.map(t => ({ name: t.name,  count: t._count.members })),
    });
});

// ---- Graph (NEW) ----
app.get("/api/members/graph", async (_req, res) => {
    const members = await prisma.member.findMany({ select: { id:true, slug:true, name:true, skills:{ include:{ skill:true } } } });
    const projects = await prisma.project.findMany({ select: { id:true, slug:true, title:true, members:{ select:{ memberId:true } } } });
    res.json({
        nodes: [
            ...members.map(m => ({ id:`m:${m.id}`, type:"member", slug:m.slug, name:m.name, skills:m.skills.map(s=>s.skill.name) })),
            ...projects.map(p => ({ id:`p:${p.id}`, type:"project", slug:p.slug, title:p.title })),
        ],
        links: projects.flatMap(p => p.members.map(r => ({ source:`m:${r.memberId}`, target:`p:${p.id}` }))),
    });
});

// ---- Search (kept) ----
app.get("/api/search", async (req, res) => {
    const q = String(req.query.q || "");
    if (!q) return res.json({ items: [] });
    const [ms, ps, es] = await Promise.all([
        prisma.member.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, select: { slug:true, name:true } }),
        prisma.project.findMany({ where: { title:{ contains: q, mode: 'insensitive' } }, select: { slug:true, title:true } }),
        prisma.event.findMany({   where: { name: { contains: q, mode: 'insensitive' } }, select: { slug:true, name:true } }),
    ]);
    res.json({
        items: [
            ...ms.map(m => ({ type:"member", slug:m.slug, title:m.name })),
            ...ps.map(p => ({ type:"project", slug:p.slug, title:p.title })),
            ...es.map(e => ({ type:"event",  slug:e.slug, title:e.name })),
        ],
    });
});

app.post("/api/contact", (req, res) => {
    const { type, name, email, message } = req.body || {};
    if (!type || !name || !email || !message) return res.status(400).json({ error: "Missing fields" });
    res.status(201).json({ id: Math.random().toString(36).slice(2), received: true });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`API on :${PORT}`));
