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
const nodemailer = require("nodemailer");

const { prisma } = require("./db");
const { authRouter } = require("./auth");
const { accountRouter } = require("./account");

const app = express();

/* -------------------------------- CORS -------------------------------- */
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
    console.log(`[req] ${req.method} ${req.originalUrl} origin=${req.headers.origin || "n/a"}`);
    next();
});

app.use(cors(corsOptions));
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

const limiter = rateLimit({ windowMs: 60_000, max: 300 });
app.use(limiter);

/* ------------------------ Static uploads ------------------------ */
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

app.use(
    "/uploads",
    (req, res, next) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.removeHeader("X-Frame-Options");
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

async function upsertStringList(list, modelName) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const nameRaw of list) {
        const name = String(nameRaw || "").trim();
        if (!name) continue;
        const row = await prisma[modelName].upsert({
            where: { name },
            create: { name },
            update: {},
            select: { id: true },
        });
        out.push(row.id);
    }
    return out;
}

/* ------------------------ Mail (invites) ------------------------ */
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

function genInviteToken() {
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}

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
            include: { roles: true, member: true },
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

    let m = await prisma.member.findUnique({
        where: { slug: req.params.slug },
        include,
    });

    if (!m) {
        console.log("[members/:slug] not found by slug; trying user email link");
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

    if (!m) {
        console.warn("[members/:slug] 404 for slug", req.params.slug);
        return res.status(404).json({ error: "Not found" });
    }

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
    const size = Math.min(
        Number.isFinite(Number(req.query.size)) ? Number(req.query.size) : 24,
        1000,
    );

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
                members: {
                    include: {
                        member: {
                            select: { id: true, slug: true, name: true, avatarUrl: true },
                        },
                    },
                },
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
                role: r.role || null,
                isCreator: !!r.isCreator,
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
            members: {
                include: {
                    member: {
                        select: { slug: true, name: true, avatarUrl: true, id: true },
                    },
                },
            },
            event: true,
            relatedEvents: {
                include: {
                    event: true,
                },
            },
            blogs: {
                include: {
                    blog: {
                        include: {
                            tags: { include: { tag: true } },
                        },
                    },
                },
            },
        },
    });
    if (!p) return res.status(404).json({ error: "Not found" });

    const eventsMap = new Map();
    if (p.event) {
        eventsMap.set(p.event.id, p.event);
    }
    for (const rel of p.relatedEvents || []) {
        if (rel.event) {
            eventsMap.set(rel.event.id, rel.event);
        }
    }
    const events = Array.from(eventsMap.values()).map((e) => ({
        slug: e.slug,
        name: e.name,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        locationName: e.locationName,
    }));

    const blogPosts =
        Array.isArray(p.blogs) && p.blogs.length
            ? p.blogs
                .filter((pb) => !!pb.blog)
                .map((pb) => ({
                    slug: pb.blog.slug,
                    title: pb.blog.title,
                    summary: pb.blog.summary || null,
                    cover: abs(pb.blog.cover || pb.blog.imageUrl || null, req),
                    imageUrl: abs(pb.blog.imageUrl || null, req),
                    publishedAt: pb.blog.publishedAt || null,
                    tags: Array.isArray(pb.blog.tags)
                        ? pb.blog.tags.map((t) => t.tag.name)
                        : [],
                }))
            : [];

    res.json({
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary || null,
        description: p.description || null,
        status: p.status || null,
        demoUrl: p.demoUrl || null,
        repoUrl: p.repoUrl || null,          // NEW
        links: p.links || {},                // NEW
        imageUrl: abs(p.imageUrl || null, req),
        cover: abs(p.cover || null, req),
        images: Array.isArray(p.images) ? p.images.map((u) => abs(u, req)) : [],
        year: p.year || null,
        event: p.event
            ? { slug: p.event.slug, name: p.event.name, dateStart: p.event.dateStart }
            : null,
        events,
        techStack: p.techs.map((x) => x.tech.name),
        tags: p.tags.map((x) => x.tag.name),
        members: p.members.map((r) => ({
            slug: r.member.slug,
            name: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
            role: r.role || null,
            isCreator: !!r.isCreator,
        })),
        blogPosts,
    });
});

/* -------- Projects: create/edit (event-style) -------- */

const projectLinkSchema = z.object({
    label: z.string().max(200).optional().nullable(),
    url: z.string().url(),
});

const createProjectSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(2000).optional().nullable(),
    description: z.string().max(20_000).optional().nullable(),
    status: z.string().max(200).optional().nullable(),
    year: z.number().int().optional().nullable(),
    demoUrl: z.string().url().optional().nullable(),
    repoUrl: z.string().url().optional().nullable(),
    photos: z.array(z.string().url()).max(20).optional(),
    techStack: z.array(z.string().min(1).max(40)).max(50).optional(),
    tags: z.array(z.string().min(1).max(40)).max(50).optional(),
    members: z.array(z.any()).optional(),
    blogSlugs: z.array(z.string().min(1)).max(200).optional(),
    eventSlugs: z.array(z.string().min(1)).max(200).optional(),
    links: z.array(projectLinkSchema).max(50).optional(),
});

async function uniqueProjectSlug(base) {
    const b = slugify(base || "project", { lower: true, strict: true }) || "project";
    let slug = b;
    let i = 1;
    while (await prisma.project.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

app.post("/api/projects", async (req, res) => {
    console.log("========== [POST /api/projects] BEGIN ==========");
    console.log("[POST /api/projects] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[POST /api/projects] blocked: unauthenticated");
        console.log("========== [POST /api/projects] END (unauthenticated) ==========");
        return;
    }

    const userRoles = (user.roles || []).map((r) => r.role);
    console.log(
        "[POST /api/projects] authenticated user id =",
        user.id,
        "roles =",
        userRoles,
    );

    const hasMemberRole = userRoles.some((r) => ["ADMIN", "MODERATOR", "MEMBER"].includes(r));
    if (!hasMemberRole) {
        console.warn("[POST /api/projects] blocked: insufficient role for user", user.id);
        console.log("========== [POST /api/projects] END (forbidden) ==========");
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year: typeof req.body?.year === "string" ? Number(req.body.year) : req.body?.year,
    });
    if (!parsed.success) {
        console.warn("[POST /api/projects] validation error", parsed.error.flatten());
        console.log("========== [POST /api/projects] END (validation error) ==========");
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;
    console.log("[POST /api/projects] parsed data (without photos) =", {
        title: d.title,
        year: d.year,
        status: d.status,
        summary: d.summary ? d.summary.slice(0, 100) + "…" : null,
        demoUrl: d.demoUrl || null,
        repoUrl: d.repoUrl || null,
        techStackCount: Array.isArray(d.techStack) ? d.techStack.length : 0,
        tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
        membersCount: Array.isArray(d.members) ? d.members.length : 0,
        blogSlugsCount: Array.isArray(d.blogSlugs) ? d.blogSlugs.length : 0,
        eventSlugsCount: Array.isArray(d.eventSlugs) ? d.eventSlugs.length : 0,
        linksCount: Array.isArray(d.links) ? d.links.length : 0,
    });

    const rawMembers = Array.isArray(d.members) ? d.members : [];
    rawMembers.forEach((m, idx) => {
        console.log(`[POST /api/projects] members[${idx}] =`, m);
    });

    const slug = await uniqueProjectSlug(d.title);
    console.log("[POST /api/projects] generated slug =", slug);

    const photos = Array.isArray(d.photos) ? d.photos : [];
    const coverRel = photos.length ? photos[0] : null;
    const imagesRel = photos;

    const linksArr = Array.isArray(d.links) ? d.links : [];
    const linksMap = {};
    for (const l of linksArr) {
        if (!l || typeof l !== "object") continue;
        const url = typeof l.url === "string" ? l.url.trim() : "";
        if (!url) continue;
        const label =
            typeof l.label === "string" && l.label.trim()
                ? l.label.trim()
                : "";
        linksMap[label] = url;
    }

    console.log("[POST /api/projects] creating project record in DB…");
    const project = await prisma.project.create({
        data: {
            slug,
            title: d.title,
            summary: d.summary || null,
            description: d.description || null,
            status: d.status || null,
            year: typeof d.year === "number" && Number.isFinite(d.year) ? d.year : null,
            demoUrl: d.demoUrl || null,
            repoUrl: d.repoUrl || null,
            cover: coverRel,
            imageUrl: coverRel,
            images: imagesRel,
            links: Object.keys(linksMap).length ? linksMap : {},
        },
    });

    console.log("[POST /api/projects] created project id =", project.id);

    const techNames = Array.isArray(d.techStack) ? d.techStack : [];
    const tagNames = Array.isArray(d.tags) ? d.tags : [];

    if (techNames.length) {
        const techIds = await upsertStringList(techNames, "tech");
        if (techIds.length) {
            await prisma.projectTech.createMany({
                data: techIds.map((id) => ({ projectId: project.id, techId: id })),
                skipDuplicates: true,
            });
        }
    }

    if (tagNames.length) {
        const tagIds = await upsertStringList(tagNames, "tag");
        if (tagIds.length) {
            await prisma.projectTag.createMany({
                data: tagIds.map((id) => ({ projectId: project.id, tagId: id })),
                skipDuplicates: true,
            });
        }
    }

    const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
    if (blogSlugs.length) {
        console.log("[POST /api/projects] linking related blogs by slugs =", blogSlugs);
        const blogs = await prisma.blog.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true, slug: true },
        });
        console.log(
            "[POST /api/projects] found blogs for relation =",
            blogs.map((b) => b.slug),
        );

        if (blogs.length) {
            await prisma.projectBlog.createMany({
                data: blogs.map((b) => ({
                    projectId: project.id,
                    blogId: b.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
    if (eventSlugs.length) {
        console.log("[POST /api/projects] linking related events by slugs =", eventSlugs);
        const events = await prisma.event.findMany({
            where: { slug: { in: eventSlugs } },
            select: { id: true, slug: true },
        });
        console.log(
            "[POST /api/projects] found events for relation =",
            events.map((e) => e.slug),
        );
        if (events.length) {
            await prisma.eventProject.createMany({
                data: events.map((e) => ({
                    eventId: e.id,
                    projectId: project.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    // --- TEAM: create MemberProject rows for all selected members ---
    const membersWithId = rawMembers.filter(
        (m) => m && typeof m === "object" && typeof m.memberId === "string",
    );
    const creatorMemberId = user && user.member && user.member.id ? user.member.id : null;

    // Ensure creator has a row (respect payload role/isCreator if present)
    if (creatorMemberId) {
        const fromPayload = membersWithId.find((m) => m.memberId === creatorMemberId);
        const creatorRole =
            fromPayload && typeof fromPayload.role === "string" && fromPayload.role.trim()
                ? fromPayload.role.trim()
                : "Creator";
        const creatorIsCreator =
            fromPayload && typeof fromPayload.isCreator === "boolean"
                ? !!fromPayload.isCreator
                : true;

        try {
            await prisma.memberProject.create({
                data: {
                    memberId: creatorMemberId,
                    projectId: project.id,
                    role: creatorRole,
                    contribution: null,
                    isCreator: creatorIsCreator,
                },
            });
        } catch (err) {
            console.error(
                "[POST /api/projects] failed to create memberProject CREATOR record",
                err,
            );
        }
    } else {
        console.log(
            "[POST /api/projects] user has no member profile; skipping creator memberProject",
        );
    }

    // Other members
    for (const m of membersWithId) {
        if (creatorMemberId && m.memberId === creatorMemberId) continue;
        const role =
            typeof m.role === "string" && m.role.trim()
                ? m.role.trim()
                : null;
        const isCreator =
            typeof m.isCreator === "boolean" ? !!m.isCreator : false;

        try {
            await prisma.memberProject.create({
                data: {
                    memberId: m.memberId,
                    projectId: project.id,
                    role,
                    contribution: null,
                    isCreator,
                },
            });
        } catch (err) {
            console.error(
                "[POST /api/projects] failed to create memberProject row for memberId",
                m.memberId,
                err,
            );
        }
    }

    // --- Invites (unchanged except now team is also persisted) ---
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const memberIdsFromPayload = [];
    const inviteMap = new Map();

    for (const m of rawMembers) {
        if (!m || typeof m !== "object") continue;
        let role = null;
        if (typeof m.role === "string" && m.role.trim()) role = m.role.trim();

        if (typeof m.memberId === "string") {
            memberIdsFromPayload.push(m.memberId);
        }

        let addr = null;
        if (typeof m.email === "string") addr = m.email.trim();
        else if (typeof m.value === "string") addr = m.value.trim();
        if (addr && emailRegex.test(addr)) {
            const lower = addr.toLowerCase();
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }
    }

    if (memberIdsFromPayload.length) {
        console.log(
            "[POST /api/projects] looking up users for memberIds =",
            memberIdsFromPayload,
        );
        const usersForMembers = await prisma.user.findMany({
            where: { memberId: { in: memberIdsFromPayload } },
            select: { email: true, memberId: true },
        });
        console.log("[POST /api/projects] usersForMembers =", usersForMembers);
        for (const u of usersForMembers) {
            if (!u.email) continue;
            const lower = u.email.toLowerCase();
            const fromPayload = rawMembers.find(
                (m) =>
                    m &&
                    typeof m === "object" &&
                    m.memberId === u.memberId &&
                    typeof m.role === "string" &&
                    m.role.trim(),
            );
            const role = fromPayload ? fromPayload.role.trim() : null;

            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }
    }

    const creatorEmailLower = (user.email || "").toLowerCase();
    if (creatorEmailLower) {
        inviteMap.delete(creatorEmailLower);
    }

    const invites = Array.from(inviteMap.values());
    console.log("[POST /api/projects] final invite specs =", invites);

    if (invites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const projectUrl = `${webBase}/projects/${project.slug}`;

        for (const inv of invites) {
            const email = inv.email;
            const roleLabel = inv.role || "Contributor";

            console.log("[POST /api/projects] creating invite for email =", email);
            const { raw, hash } = genInviteToken();
            console.log(
                "[POST /api/projects] generated invite token (hash only logged) tokenHash =",
                hash,
            );

            await prisma.projectInvite.create({
                data: {
                    projectId: project.id,
                    email,
                    role: inv.role || null,
                    tokenHash: hash,
                    status: "PENDING",
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                },
            });

            const acceptUrl = `${webBase}/accept-invite?token=${raw}`;

            const subject = `You've been invited to join project: ${project.title}`;
            const text = `Hi,

You've been invited to join the project "${project.title}" at PUM.

Role on the project: ${roleLabel}

Approve your invite:
${acceptUrl}

Project page: ${projectUrl}

This invite was sent from ${MAIL_FROM}.
`;

            void sendInviteEmail(email, subject, text);
        }
    }

    console.log("========== [POST /api/projects] END (success) ==========");
    return res.status(201).json({ ok: true, slug: project.slug, id: project.id });
});

app.put("/api/projects/:slug", async (req, res) => {
    console.log("========== [PUT /api/projects/:slug] BEGIN ==========");
    console.log("[PUT /api/projects/:slug] slug =", req.params.slug);
    console.log("[PUT /api/projects/:slug] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[PUT /api/projects/:slug] blocked: unauthenticated");
        console.log("========== [PUT /api/projects/:slug] END (unauthenticated) ==========");
        return;
    }

    const userRoles = (user.roles || []).map((r) => r.role);
    console.log(
        "[PUT /api/projects/:slug] authenticated user id =",
        user.id,
        "roles =",
        userRoles,
    );

    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: {
            members: true,
            invites: true,
        },
    });

    if (!project) {
        console.warn("[PUT /api/projects/:slug] 404 for slug", req.params.slug);
        console.log("========== [PUT /api/projects/:slug] END (not found) ==========");
        return res.status(404).json({ ok: false, error: "Not found" });
    }

    const isAdminOrModerator = userRoles.some(
        (r) => r === "ADMIN" || r === "MODERATOR",
    );

    let canEdit = false;

    if (isAdminOrModerator) {
        canEdit = true;
    } else if (user.member && user.member.id) {
        const mp = (project.members || []).find(
            (m) => m.memberId === user.member.id,
        );
        if (mp) {
            canEdit = true;
        }
    }

    if (!canEdit) {
        console.warn(
            "[PUT /api/projects/:slug] blocked: insufficient permissions for user",
            user.id,
        );
        console.log("========== [PUT /api/projects/:slug] END (forbidden) ==========");
        return res.status(403).json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year: typeof req.body?.year === "string" ? Number(req.body.year) : req.body?.year,
    });
    if (!parsed.success) {
        console.warn("[PUT /api/projects/:slug] validation error", parsed.error.flatten());
        console.log("========== [PUT /api/projects/:slug] END (validation error) ==========");
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;
    const hasTechStack = Object.prototype.hasOwnProperty.call(req.body || {}, "techStack");
    const hasTags = Object.prototype.hasOwnProperty.call(req.body || {}, "tags");
    const hasBlogSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "blogSlugs");
    const hasMembers = Object.prototype.hasOwnProperty.call(req.body || {}, "members");
    const hasEventSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "eventSlugs");
    const hasLinks = Object.prototype.hasOwnProperty.call(req.body || {}, "links");

    console.log("[PUT /api/projects/:slug] parsed data (without photos) =", {
        title: d.title,
        year: d.year,
        status: d.status,
        summary: d.summary ? d.summary.slice(0, 100) + "…" : null,
        demoUrl: d.demoUrl || null,
        repoUrl: d.repoUrl || null,
        techStackCount: Array.isArray(d.techStack) ? d.techStack.length : 0,
        tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
        hasBlogSlugs,
        blogSlugsCount: Array.isArray(d.blogSlugs) ? d.blogSlugs.length : 0,
        hasMembers,
        membersCount: Array.isArray(d.members) ? d.members.length : 0,
        hasEventSlugs,
        eventSlugsCount: Array.isArray(d.eventSlugs) ? d.eventSlugs.length : 0,
        hasLinks,
        linksCount: Array.isArray(d.links) ? d.links.length : 0,
    });

    const photos = Array.isArray(d.photos)
        ? d.photos
        : Array.isArray(project.images)
            ? project.images
            : [];
    const coverRel = photos.length ? photos[0] : project.cover || null;
    const imagesRel = photos;

    let linksToStore = project.links || {};
    if (hasLinks) {
        const linksArr = Array.isArray(d.links) ? d.links : [];
        const map = {};
        for (const l of linksArr) {
            if (!l || typeof l !== "object") continue;
            const url = typeof l.url === "string" ? l.url.trim() : "";
            if (!url) continue;
            const label =
                typeof l.label === "string" && l.label.trim()
                    ? l.label.trim()
                    : "";
            map[label] = url;
        }
        linksToStore = map;
    }

    console.log("[PUT /api/projects/:slug] updating project record in DB…");
    const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
            title: d.title,
            summary: d.summary || null,
            description: d.description || null,
            status: d.status || null,
            year: typeof d.year === "number" && Number.isFinite(d.year) ? d.year : null,
            demoUrl: d.demoUrl || null,
            repoUrl: d.repoUrl || null,
            cover: coverRel,
            imageUrl: coverRel || project.imageUrl,
            images: imagesRel,
            links: linksToStore,
        },
    });

    console.log("[PUT /api/projects/:slug] updated project id =", updated.id);

    if (hasTechStack) {
        const techNames = Array.isArray(d.techStack) ? d.techStack : [];
        console.log("[PUT /api/projects/:slug] updating techStack =", techNames);
        await prisma.projectTech.deleteMany({ where: { projectId: updated.id } });
        if (techNames.length) {
            const techIds = await upsertStringList(techNames, "tech");
            if (techIds.length) {
                await prisma.projectTech.createMany({
                    data: techIds.map((id) => ({ projectId: updated.id, techId: id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasTags) {
        const tagNames = Array.isArray(d.tags) ? d.tags : [];
        console.log("[PUT /api/projects/:slug] updating tags =", tagNames);
        await prisma.projectTag.deleteMany({ where: { projectId: updated.id } });
        if (tagNames.length) {
            const tagIds = await upsertStringList(tagNames, "tag");
            if (tagIds.length) {
                await prisma.projectTag.createMany({
                    data: tagIds.map((id) => ({ projectId: updated.id, tagId: id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasBlogSlugs) {
        const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
        console.log("[PUT /api/projects/:slug] updating related blogs, slugs =", blogSlugs);

        await prisma.projectBlog.deleteMany({
            where: { projectId: updated.id },
        });

        if (blogSlugs.length) {
            const blogs = await prisma.blog.findMany({
                where: { slug: { in: blogSlugs } },
                select: { id: true, slug: true },
            });
            console.log(
                "[PUT /api/projects/:slug] found blogs for new relations =",
                blogs.map((b) => b.slug),
            );

            if (blogs.length) {
                await prisma.projectBlog.createMany({
                    data: blogs.map((b) => ({
                        projectId: updated.id,
                        blogId: b.id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasEventSlugs) {
        const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
        console.log(
            "[PUT /api/projects/:slug] updating related events, slugs =",
            eventSlugs,
        );

        await prisma.eventProject.deleteMany({
            where: { projectId: updated.id },
        });

        if (eventSlugs.length) {
            const events = await prisma.event.findMany({
                where: { slug: { in: eventSlugs } },
                select: { id: true, slug: true },
            });
            console.log(
                "[PUT /api/projects/:slug] found events for new relations =",
                events.map((e) => e.slug),
            );

            if (events.length) {
                await prisma.eventProject.createMany({
                    data: events.map((e) => ({
                        eventId: e.id,
                        projectId: updated.id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    // --- TEAM: replace memberProject rows with payload (except creator cannot be removed) ---
    if (hasMembers) {
        const rawMembers = Array.isArray(d.members) ? d.members : [];
        rawMembers.forEach((m, idx) => {
            console.log(`[PUT /api/projects/:slug] members[${idx}] =`, m);
        });

        const existingInviteEmails = new Set(
            (project.invites || [])
                .map((i) => (i.email || "").toLowerCase())
                .filter((e) => !!e),
        );
        console.log(
            "[PUT /api/projects/:slug] existingInviteEmails =",
            Array.from(existingInviteEmails),
        );

        const existingMemberMap = new Map(
            (project.members || []).map((m) => [m.memberId, m]),
        );

        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
        const memberIdsFromPayload = [];
        const inviteMap = new Map();
        const newMemberIdsSet = new Set();

        // Upsert memberProject rows
        for (const m of rawMembers) {
            if (!m || typeof m !== "object") continue;
            if (typeof m.memberId === "string") {
                const memberId = m.memberId;
                newMemberIdsSet.add(memberId);
                memberIdsFromPayload.push(memberId);

                const existing = existingMemberMap.get(memberId);
                const newRole =
                    typeof m.role === "string" && m.role.trim()
                        ? m.role.trim()
                        : null;
                const newIsCreator =
                    typeof m.isCreator === "boolean" ? !!m.isCreator : !!existing?.isCreator;

                if (existing) {
                    console.log(
                        "[PUT /api/projects/:slug] updating memberProject row for memberId",
                        memberId,
                        "role ->",
                        newRole,
                        "isCreator ->",
                        newIsCreator,
                    );
                    await prisma.memberProject.update({
                        where: {
                            memberId_projectId: {
                                memberId,
                                projectId: updated.id,
                            },
                        },
                        data: {
                            role: newRole,
                            isCreator: newIsCreator,
                        },
                    });
                } else {
                    console.log(
                        "[PUT /api/projects/:slug] creating memberProject row for new memberId",
                        memberId,
                    );
                    await prisma.memberProject.create({
                        data: {
                            memberId,
                            projectId: updated.id,
                            role: newRole,
                            contribution: null,
                            isCreator: newIsCreator,
                        },
                    });
                }
            }
        }

        // Remove members not in payload (but keep creator rows)
        for (const existing of project.members || []) {
            if (newMemberIdsSet.has(existing.memberId)) continue;
            if (existing.isCreator) {
                console.log(
                    "[PUT /api/projects/:slug] not removing creator memberId",
                    existing.memberId,
                );
                continue;
            }
            console.log(
                "[PUT /api/projects/:slug] removing memberProject row for memberId not in payload",
                existing.memberId,
            );
            await prisma.memberProject.delete({
                where: {
                    memberId_projectId: {
                        memberId: existing.memberId,
                        projectId: updated.id,
                    },
                },
            });
        }

        // Invites from rawMembers (emails + existing members) – unchanged
        for (const m of rawMembers) {
            if (!m || typeof m !== "object") continue;
            let role = null;
            if (typeof m.role === "string" && m.role.trim()) role = m.role.trim();

            let addr = null;
            if (typeof m.email === "string") addr = m.email.trim();
            else if (typeof m.value === "string") addr = m.value.trim();
            if (!addr || !emailRegex.test(addr)) continue;
            const lower = addr.toLowerCase();
            if (existingInviteEmails.has(lower)) {
                console.log(
                    "[PUT /api/projects/:slug] skipping already invited email (no re-invite):",
                    lower,
                );
                continue;
            }
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }

        if (memberIdsFromPayload.length) {
            console.log(
                "[PUT /api/projects/:slug] looking up users for memberIds =",
                memberIdsFromPayload,
            );
            const usersForMembers = await prisma.user.findMany({
                where: { memberId: { in: memberIdsFromPayload } },
                select: { email: true, memberId: true },
            });
            console.log("[PUT /api/projects/:slug] usersForMembers =", usersForMembers);
            for (const u of usersForMembers) {
                if (!u.email) continue;
                const lower = u.email.toLowerCase();
                if (existingInviteEmails.has(lower)) {
                    console.log(
                        "[PUT /api/projects/:slug] skipping already invited member email (no re-invite):",
                        lower,
                    );
                    continue;
                }
                const fromPayload = rawMembers.find(
                    (m) =>
                        m &&
                        typeof m === "object" &&
                        m.memberId === u.memberId &&
                        typeof m.role === "string" &&
                        m.role.trim(),
                );
                const role = fromPayload ? fromPayload.role.trim() : null;

                if (!inviteMap.has(lower)) {
                    inviteMap.set(lower, { email: lower, role });
                } else if (role && !inviteMap.get(lower).role) {
                    inviteMap.get(lower).role = role;
                }
            }
        }

        const editorEmailLower = (user.email || "").toLowerCase();
        if (editorEmailLower) {
            inviteMap.delete(editorEmailLower);
        }

        const invites = Array.from(inviteMap.values());
        console.log("[PUT /api/projects/:slug] final inviteEmails array (new only) =", invites);

        if (invites.length) {
            const webBase = WEB_ORIGIN.replace(/\/$/, "");
            const projectUrl = `${webBase}/projects/${updated.slug}`;

            for (const inv of invites) {
                const email = inv.email;
                const roleLabel = inv.role || "Contributor";

                console.log("[PUT /api/projects/:slug] creating invite for email =", email);
                const { raw, hash } = genInviteToken();
                console.log(
                    "[PUT /api/projects/:slug] generated invite token (hash only logged) tokenHash =",
                    hash,
                );

                await prisma.projectInvite.create({
                    data: {
                        projectId: updated.id,
                        email,
                        role: inv.role || null,
                        tokenHash: hash,
                        status: "PENDING",
                        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                    },
                });

                const acceptUrl = `${webBase}/accept-invite?token=${raw}`;

                const subject = `You've been invited to join project: ${updated.title}`;
                const text = `Hi,

You've been invited to join the project "${updated.title}" at PUM.

Role on the project: ${roleLabel}

Approve your invite:
${acceptUrl}

Project page: ${projectUrl}

This invite was sent from ${MAIL_FROM}.
`;

                void sendInviteEmail(email, subject, text);
            }
        }
    }

    console.log("========== [PUT /api/projects/:slug] END (success) ==========");
    return res.status(200).json({ ok: true, slug: updated.slug, id: updated.id });
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

/* --------------------------- Upload: project photo --------------------------- */
const projectsDir = path.join(UPLOAD_ROOT, "projects");
fs.mkdirSync(projectsDir, { recursive: true });

const projectStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/.test(ext) ? ext : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});
const uploadProjectPhoto = multer({
    storage: projectStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 }, // 8 MB
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) cb(null, true);
        else cb(new Error("Unsupported file type"));
    },
});

app.post("/api/uploads/project-photo", async (req, res, next) => {
    console.log("[POST /api/uploads/project-photo] incoming upload");
    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[POST /api/uploads/project-photo] blocked: unauthenticated");
        return;
    }
    return uploadProjectPhoto.single("photo")(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return res.status(400).json({ ok: false, error: "No file" });
        const url = abs(`/uploads/projects/${req.file.filename}`, req);
        console.log("[POST /api/uploads/project-photo] stored file =", req.file.filename);
        return res.status(201).json({ ok: true, url });
    });
});

/* ------------------------------ Blogs ------------------------------ */
app.get("/api/blogs", async (req, res) => {
    const page = Number.isFinite(Number(req.query.page)) ? Number(req.query.page) : 1;
    const size = Math.min(
        Number.isFinite(Number(req.query.size)) ? Number(req.query.size) : 24,
        1000,
    );

    const q = (req.query.q || "").toString().trim();
    const techCsv = (req.query.tech || "").toString();
    const tagCsv = (req.query.tag || "").toString();
    const authorCsv = (req.query.author || "").toString();

    const techs = techCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const tags = tagCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const authors = authorCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

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
    for (const a of authors)
        AND.push({ authors: { some: { member: { slug: a } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.blog.count({ where }),
        prisma.blog.findMany({
            where,
            include: {
                techs: { include: { tech: true } },
                tags: { include: { tag: true } },
                authors: {
                    include: {
                        member: {
                            select: {
                                slug: true,
                                name: true,
                                avatarUrl: true,
                                headline: true,
                            },
                        },
                    },
                },
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
    console.error(
        "[error] during",
        req.method,
        req.originalUrl,
        "\n",
        err && err.stack ? err.stack : err,
    );

    const msg =
        err?.message?.includes("CORS")
            ? "CORS: Origin not allowed"
            : err?.message?.includes("Unsupported file type")
                ? "Unsupported file type"
                : err?.message || "Server error";
    if (res.headersSent) return;
    res.status(400).json({ ok: false, error: msg });
});

/* ------------------------------ Start ------------------------------ */
const PORT = Number(process.env.PORT || 3001);
console.log("[config] PORT =", PORT);

app.listen(PORT, () =>
    console.log(
        `API on :${PORT} (WEB_ORIGIN=${WEB_ORIGIN}, PUBLIC_API_BASE=${
            PUBLIC_API_BASE || "n/a"
        })`,
    ),
);
