const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const z = require("zod");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const slugify = require("slugify");
const multer = require("multer");
const crypto = require("crypto");
const nodemailer = require("nodemailer"); // <-- NEW

const { prisma } = require("./db");
const { authRouter } = require("./auth");
const { accountRouter } = require("./account");

const app = express();

/* -------------------------------- CORS -------------------------------- */
// Keep this simple & reliable in dev: one explicit web origin.
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

const corsOptions = {
    origin: WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "Authorization"],
    optionsSuccessStatus: 204,
};

console.log("[config] WEB_ORIGIN =", WEB_ORIGIN);

app.use((req, _res, next) => {
    // log origins hitting us for CORS debugging
    console.log(`[req] ${req.method} ${req.originalUrl} origin=${req.headers.origin || "n/a"}`);
    next();
});

app.use(cors(corsOptions));
// Preflight for all routes
app.options("*", cors(corsOptions));

/* ---------------- Proxy + middleware ---------------- */
app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        crossOriginEmbedderPolicy: false,
    }),
);

// Gentle rate limits for auth & mutating endpoints
const limiter = rateLimit({ windowMs: 60_000, max: 300 });
app.use(limiter);

/* ------------------------ Static uploads ------------------------ */
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

app.use(
    "/uploads",
    (req, res, next) => {
        // allow the web app to embed these files in an <iframe> (PDF viewer)
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.removeHeader("X-Frame-Options");
        // Only permit our web origin (and same-origin) to frame these responses
        res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${WEB_ORIGIN}`);
        next();
    },
    express.static(UPLOAD_ROOT, { maxAge: "1h", etag: true }),
);

/* ------------------------ Helpers ------------------------ */
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-only-change-me";

console.log("[config] PUBLIC_API_BASE =", PUBLIC_API_BASE || "(not set)");

function abs(u, req) {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    const base = PUBLIC_API_BASE || `${req.protocol}://${req.get("host")}`;
    const rel = u.startsWith("/") ? u : `/${u}`;
    return `${base}${rel}`;
}
const toInt = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/* ------------------------ Mail (invites) ------------------------ */
// very lightweight mail helper; if SMTP_* envs aren't set, we just log
const MAIL_FROM = process.env.MAIL_FROM || "contact@the-pum.com";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || null;
const SMTP_PASS = process.env.SMTP_PASS || null;

let mailTransporter = null;
if (SMTP_HOST) {
    console.log("[mail] configuring SMTP transport", {
        host: SMTP_HOST,
        port: SMTP_PORT,
        user: SMTP_USER ? "(set)" : "(none)",
    });
    mailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: SMTP_USER
            ? {
                user: SMTP_USER,
                pass: SMTP_PASS,
            }
            : undefined,
    });
} else {
    console.log("[mail] SMTP_HOST not set; invite emails will be logged only");
}

async function sendInviteEmail(to, subject, text) {
    if (!to) return;
    if (!mailTransporter) {
        console.log(
            `[invite-email] (no SMTP configured) Would send mail from ${MAIL_FROM} to ${to}:\nSubject: ${subject}\n\n${text}`,
        );
        return;
    }
    try {
        console.log("[invite-email] sending mail to", to);
        await mailTransporter.sendMail({
            from: MAIL_FROM,
            to,
            subject,
            text,
        });
        console.log("[invite-email] sent OK to", to);
    } catch (err) {
        console.error("[invite-email] send error", err);
    }
}

// Minimal access-token guard (same JWT used by /api/account)
async function requireUser(req, res) {
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) {
        console.warn("[auth] missing access token for", req.method, req.originalUrl);
        res.status(401).json({ ok: false, error: "Missing access token" });
        return null;
    }
    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
        console.log("[auth] token OK for user id", decoded.sub);
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            include: { roles: true },
        });
        if (!user) {
            console.warn("[auth] token user not found in DB", decoded.sub);
            res.status(401).json({ ok: false, error: "Unknown user" });
            return null;
        }
        return user;
    } catch (err) {
        console.warn("[auth] invalid access token for", req.method, req.originalUrl, err?.message);
        res.status(401).json({ ok: false, error: "Invalid access token" });
        return null;
    }
}

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
    const include = {
        skills: { include: { skill: true } },
        techs: { include: { tech: true } },
        projects: { include: { project: true } },
        events: { include: { event: true } },
    };

    console.log("[members/:slug] slug =", req.params.slug);

    // try by slug
    let m = await prisma.member.findUnique({
        where: { slug: req.params.slug },
        include,
    });

    // fallback resolve by user email local-part
    if (!m) {
        console.log("[members/:slug] not found by slug; trying user email link");
        const u = await prisma.user.findFirst({
            where: { email: { startsWith: `${req.params.slug}@`, mode: "insensitive" }, memberId: { not: null } },
            select: { memberId: true },
        });
        if (u?.memberId) {
            m = await prisma.member.findUnique({ where: { id: u.memberId }, include });
        }
    }

    if (!m) {
        console.warn("[members/:slug] 404 for slug", req.params.slug);
        return res.status(404).json({ error: "Not found" });
    }

    // resolve CV if present
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
    console.log("[GET /api/events] query =", req.query);

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
            include: {
                attendees: {
                    include: {
                        member: {
                            select: { slug: true, name: true, avatarUrl: true, headline: true, id: true },
                        },
                    },
                },
            },
            orderBy: [{ dateStart: "desc" }, { name: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    console.log("[GET /api/events] total events =", total);

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

/* ---------- NEW: single event detail endpoint with attendees ---------- */
app.get("/api/events/:slug", async (req, res) => {
    console.log("[GET /api/events/:slug] slug =", req.params.slug);

    const e = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: {
            attendees: {
                include: {
                    member: {
                        select: { slug: true, name: true, avatarUrl: true, headline: true },
                    },
                },
            },
        },
    });
    if (!e) {
        console.warn("[GET /api/events/:slug] not found", req.params.slug);
        return res.status(404).json({ error: "Not found" });
    }

    console.log("[GET /api/events/:slug] found event id =", e.id);

    res.json({
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
        attendees: e.attendees.map((a) => ({
            slug: a.member.slug,
            name: a.member.name,
            avatarUrl: abs(a.member.avatarUrl || null, req),
            headline: a.member.headline || null,
            role: a.role || null,
        })),
        // projects are intentionally omitted here; event detail page will
        // still fall back to the existing projects lookup logic.
    });
});

// Safe ISO datetime (no z.string().datetime() to avoid version issues)
const isoDate = z
    .string()
    .optional()
    .nullable()
    .refine(
        (v) => !v || !Number.isNaN(Date.parse(v)),
        { message: "Invalid ISO datetime" },
    );

// Input validation for event creation
const createEventSchema = z.object({
    name: z.string().min(1).max(200),
    dateStart: isoDate,
    dateEnd: isoDate,
    locationName: z.string().max(200).optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    description: z.string().max(10_000).optional().nullable(),
    tags: z.array(z.string().min(1).max(40)).max(50).optional(),
    photos: z.array(z.string().url()).max(20).optional(),
    // NEW: attendees from the create-event UI
    // (we keep this loose, and interpret in the handler)
    attendees: z.array(z.any()).optional(),
});

async function uniqueEventSlug(base) {
    const b = slugify(base || "event", { lower: true, strict: true }) || "event";
    let slug = b;
    let i = 1;
    while (await prisma.event.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

app.post("/api/events", async (req, res) => {
    console.log("[POST /api/events] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[POST /api/events] blocked: unauthenticated");
        return;
    }

    const hasMemberRole = (user.roles || []).some((r) => ["ADMIN", "MODERATOR", "MEMBER"].includes(r.role));
    if (!hasMemberRole) {
        console.warn("[POST /api/events] blocked: insufficient role for user", user.id);
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = createEventSchema.safeParse({
        ...req.body,
        lat: typeof req.body?.lat === "string" ? Number(req.body.lat) : req.body?.lat,
        lng: typeof req.body?.lng === "string" ? Number(req.body.lng) : req.body?.lng,
    });
    if (!parsed.success) {
        console.warn("[POST /api/events] validation error", parsed.error.flatten());
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }
    const d = parsed.data;
    console.log("[POST /api/events] parsed data (without photos) =", {
        name: d.name,
        dateStart: d.dateStart,
        dateEnd: d.dateEnd,
        locationName: d.locationName,
        lat: d.lat,
        lng: d.lng,
        description: d.description ? d.description.slice(0, 100) + "…" : null,
        attendeesCount: Array.isArray(d.attendees) ? d.attendees.length : 0,
    });

    const slug = await uniqueEventSlug(d.name);
    console.log("[POST /api/events] generated slug =", slug);

    const rawAttendees = Array.isArray(d.attendees) ? d.attendees : [];

    // existing members selected in the UI -> attach to event
    const memberIds = [];
    for (const a of rawAttendees) {
        if (!a || typeof a !== "object") continue;
        if (typeof a.memberId === "string") {
            memberIds.push(a.memberId);
        }
    }
    console.log("[POST /api/events] memberIds to attach =", memberIds);

    // create event with nested attendees so we don't need the join model name
    const event = await prisma.event.create({
        data: {
            slug,
            name: d.name,
            dateStart: d.dateStart ? new Date(d.dateStart) : null,
            dateEnd: d.dateEnd ? new Date(d.dateEnd) : null,
            locationName: d.locationName || null,
            lat: typeof d.lat === "number" && Number.isFinite(d.lat) ? d.lat : null,
            lng: typeof d.lng === "number" && Number.isFinite(d.lng) ? d.lng : null,
            description: d.description || null,
            photos: Array.isArray(d.photos) ? d.photos : [],
            // NOTE: still not writing `tags` because Event model has no `tags` field
            attendees:
                memberIds.length > 0
                    ? {
                        create: memberIds.map((memberId) => ({
                            member: { connect: { id: memberId } },
                        })),
                    }
                    : undefined,
        },
    });

    console.log("[POST /api/events] created event id =", event.id);

    // external invitees (email or "value" field)
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const inviteEmails = [];
    for (const a of rawAttendees) {
        if (!a || typeof a !== "object") continue;
        let addr = null;
        if (typeof a.email === "string") addr = a.email.trim();
        else if (typeof a.value === "string") addr = a.value.trim();
        if (addr && emailRegex.test(addr)) inviteEmails.push(addr);
    }
    console.log("[POST /api/events] inviteEmails =", inviteEmails);

    if (inviteEmails.length) {
        const when = event.dateStart ? new Date(event.dateStart).toLocaleString() : "an upcoming event";
        const where = event.locationName || "TBA";
        const eventUrl = abs(`/events/${event.slug}`, req);
        const subject = `You're invited: ${event.name}`;
        const text = `Hi,

You've been invited to the event "${event.name}" at PUM.

Where: ${where}
When: ${when}

More details: ${eventUrl}

This invite was sent from ${MAIL_FROM}.
`;

        for (const to of inviteEmails) {
            // fire-and-forget; errors are logged in sendInviteEmail
            void sendInviteEmail(to, subject, text);
        }
    }

    return res.status(201).json({ ok: true, slug: event.slug, id: event.id });
});

/* --------------------------- Upload: event photo --------------------------- */
const eventsDir = path.join(UPLOAD_ROOT, "events");
fs.mkdirSync(eventsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, eventsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/.test(ext) ? ext : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 }, // 8 MB
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
        else cb(new Error("Unsupported file type"));
    },
});

app.post("/api/uploads/event-photo", async (req, res, next) => {
    console.log("[POST /api/uploads/event-photo] incoming upload");
    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[POST /api/uploads/event-photo] blocked: unauthenticated");
        return;
    }
    return upload.single("photo")(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return res.status(400).json({ ok: false, error: "No file" });
        const url = abs(`/uploads/events/${req.file.filename}`, req);
        console.log("[POST /api/uploads/event-photo] stored file =", req.file.filename);
        return res.status(201).json({ ok: true, url });
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

/* ------------------------------ Error handler ------------------------------ */
app.use((err, req, res, _next) => {
    // Unified, friendly JSON errors for CORS, uploads, validation, etc.
    console.error("[error] during", req.method, req.originalUrl, "\n", err && err.stack ? err.stack : err);

    const msg =
        err?.message?.includes("CORS") ? "CORS: Origin not allowed" :
            err?.message?.includes("Unsupported file type") ? "Unsupported file type" :
                err?.message || "Server error";
    if (res.headersSent) return;
    res.status(400).json({ ok: false, error: msg });
});

/* ------------------------------ Start ------------------------------ */
const PORT = Number(process.env.PORT || 3001);
console.log("[config] PORT =", PORT);

app.listen(PORT, () =>
    console.log(
        `API on :${PORT} (WEB_ORIGIN=${WEB_ORIGIN}, PUBLIC_API_BASE=${PUBLIC_API_BASE || "n/a"})`,
    ),
);
