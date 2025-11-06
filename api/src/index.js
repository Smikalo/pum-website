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
const argon2 = require("argon2"); // ← for invite-based signups

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
    console.log(
        `[req] ${req.method} ${req.originalUrl} origin=${
            req.headers.origin || "n/a"
        }`,
    );
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
        res.setHeader(
            "Content-Security-Policy",
            `frame-ancestors 'self' ${WEB_ORIGIN}`,
        );
        next();
    },
    express.static(UPLOAD_ROOT, { maxAge: "1h", etag: true }),
);

/* ------------------------ Helpers ------------------------ */
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;
const JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || "dev-only-change-me";

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
    console.log(
        "[mail] SMTP_HOST not set; invite emails will be logged only",
    );
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

function hashInviteToken(raw) {
    if (!raw) return null;
    return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

async function requireUser(req, res) {
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) {
        console.warn(
            "[auth] missing access token for",
            req.method,
            req.originalUrl,
        );
        res.status(401).json({ ok: false, error: "Missing access token" });
        return null;
    }
    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, {
            algorithms: ["HS256"],
        });
        console.log("[auth] token OK for user id", decoded.sub);
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            include: { roles: true, member: true },
        });
        if (!user) {
            console.warn(
                "[auth] token user not found in DB",
                decoded.sub,
            );
            res.status(401).json({ ok: false, error: "Unknown user" });
            return null;
        }
        return user;
    } catch (err) {
        console.warn(
            "[auth] invalid access token for",
            req.method,
            req.originalUrl,
            err?.message,
        );
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
        res.status(500).json({
            ok: false,
            service: "api",
            db: false,
            error: String(e),
        });
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

    const skills = (qp.skill || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const techs = (qp.tech || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

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
    for (const s of skills)
        AND.push({ skills: { some: { skill: { name: s } } } });
    for (const t of techs)
        AND.push({ techs: { some: { tech: { name: t } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.member.count({ where }),
        prisma.member.findMany({
            where,
            include: {
                skills: { include: { skill: true } },
                techs: { include: { tech: true } },
            },
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
        console.log(
            "[members/:slug] not found by slug; trying user email link",
        );
        const u = await prisma.user.findFirst({
            where: {
                email: {
                    startsWith: `${req.params.slug}@`,
                    mode: "insensitive",
                },
                memberId: { not: null },
            },
            select: { memberId: true },
        });
        if (u?.memberId) {
            m = await prisma.member.findUnique({
                where: { id: u.memberId },
                include,
            });
        }
    }

    if (!m) {
        console.warn("[members/:slug] 404 for slug", req.params.slug);
        return res.status(404).json({ error: "Not found" });
    }

    let cvUrl = null;
    const uForCv = await prisma.user.findFirst({
        where: { memberId: m.id },
        select: { id: true },
    });
    if (uForCv) {
        const p = path.join(UPLOAD_ROOT, "cv", `${uForCv.id}-latest.pdf`);
        if (fs.existsSync(p))
            cvUrl = abs(`/uploads/cv/${uForCv.id}-latest.pdf`, req);
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
            cover: abs(
                r.project.cover || r.project.imageUrl || null,
                req,
            ),
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
    const page = Number.isFinite(Number(req.query.page))
        ? Number(req.query.page)
        : 1;
    const size = Math.min(
        Number.isFinite(Number(req.query.size))
            ? Number(req.query.size)
            : 24,
        1000,
    );

    const q = (req.query.q || "").toString().trim();
    const techCsv = (req.query.tech || "").toString();
    const tagCsv = (req.query.tag || "").toString();
    const techs = techCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const tags = tagCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

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
    for (const t of techs)
        AND.push({ techs: { some: { tech: { name: t } } } });
    for (const t of tags)
        AND.push({ tags: { some: { tag: { name: t } } } });

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
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                avatarUrl: true,
                            },
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
                        select: {
                            slug: true,
                            name: true,
                            avatarUrl: true,
                            id: true,
                        },
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
            invites: true,
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
                    cover: abs(
                        pb.blog.cover || pb.blog.imageUrl || null,
                        req,
                    ),
                    imageUrl: abs(pb.blog.imageUrl || null, req),
                    publishedAt: pb.blog.publishedAt || null,
                    tags: Array.isArray(pb.blog.tags)
                        ? pb.blog.tags.map((t) => t.tag.name)
                        : [],
                }))
            : [];

    const invites =
        Array.isArray(p.invites) && p.invites.length
            ? p.invites.map((inv) => ({
                id: inv.id,
                email: inv.email,
                role: inv.role || null,
                status: inv.status || null,
                createdAt: inv.createdAt || null,
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
        repoUrl: p.repoUrl || null,
        links: p.links || {},
        imageUrl: abs(p.imageUrl || null, req),
        cover: abs(p.cover || null, req),
        images: Array.isArray(p.images)
            ? p.images.map((u) => abs(u, req))
            : [],
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
        invites,
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
    techStack: z
        .array(z.string().min(1).max(40))
        .max(50)
        .optional(),
    tags: z
        .array(z.string().min(1).max(40))
        .max(50)
        .optional(),
    members: z.array(z.any()).optional(),
    blogSlugs: z.array(z.string().min(1)).max(200).optional(),
    eventSlugs: z.array(z.string().min(1)).max(200).optional(),
    links: z.array(projectLinkSchema).max(50).optional(),
});

async function uniqueProjectSlug(base) {
    const b =
        slugify(base || "project", { lower: true, strict: true }) ||
        "project";
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
        console.log(
            "========== [POST /api/projects] END (unauthenticated) ==========",
        );
        return;
    }

    const userRoles = (user.roles || []).map((r) => r.role);
    console.log(
        "[POST /api/projects] authenticated user id =",
        user.id,
        "roles =",
        userRoles,
    );

    const hasMemberRole = userRoles.some((r) =>
        ["ADMIN", "MODERATOR", "MEMBER"].includes(r),
    );
    if (!hasMemberRole) {
        console.warn(
            "[POST /api/projects] blocked: insufficient role for user",
            user.id,
        );
        console.log(
            "========== [POST /api/projects] END (forbidden) ==========",
        );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year:
            typeof req.body?.year === "string"
                ? Number(req.body.year)
                : req.body?.year,
    });
    if (!parsed.success) {
        console.warn(
            "[POST /api/projects] validation error",
            parsed.error.flatten(),
        );
        console.log(
            "========== [POST /api/projects] END (validation error) ==========",
        );
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
        techStackCount: Array.isArray(d.techStack)
            ? d.techStack.length
            : 0,
        tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
        membersCount: Array.isArray(d.members) ? d.members.length : 0,
        blogSlugsCount: Array.isArray(d.blogSlugs)
            ? d.blogSlugs.length
            : 0,
        eventSlugsCount: Array.isArray(d.eventSlugs)
            ? d.eventSlugs.length
            : 0,
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
            year:
                typeof d.year === "number" && Number.isFinite(d.year)
                    ? d.year
                    : null,
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
                data: techIds.map((id) => ({
                    projectId: project.id,
                    techId: id,
                })),
                skipDuplicates: true,
            });
        }
    }

    if (tagNames.length) {
        const tagIds = await upsertStringList(tagNames, "tag");
        if (tagIds.length) {
            await prisma.projectTag.createMany({
                data: tagIds.map((id) => ({
                    projectId: project.id,
                    tagId: id,
                })),
                skipDuplicates: true,
            });
        }
    }

    const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
    if (blogSlugs.length) {
        console.log(
            "[POST /api/projects] linking related blogs by slugs =",
            blogSlugs,
        );
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
        console.log(
            "[POST /api/projects] linking related events by slugs =",
            eventSlugs,
        );
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
        (m) =>
            m &&
            typeof m === "object" &&
            typeof m.memberId === "string",
    );
    const creatorMemberId =
        user && user.member && user.member.id ? user.member.id : null;

    // Ensure creator has a row (respect payload role/isCreator if present)
    if (creatorMemberId) {
        const fromPayload = membersWithId.find(
            (m) => m.memberId === creatorMemberId,
        );
        const creatorRole =
            fromPayload &&
            typeof fromPayload.role === "string" &&
            fromPayload.role.trim()
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

    // --- Invites ---
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const memberIdsFromPayload = [];
    const inviteMap = new Map();

    for (const m of rawMembers) {
        if (!m || typeof m !== "object") continue;
        let role = null;
        if (typeof m.role === "string" && m.role.trim())
            role = m.role.trim();

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
        console.log(
            "[POST /api/projects] usersForMembers =",
            usersForMembers,
        );
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

            console.log(
                "[POST /api/projects] creating invite for email =",
                email,
            );
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
                    expiresAt: new Date(
                        Date.now() + 1000 * 60 * 60 * 24 * 7,
                    ),
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
    return res
        .status(201)
        .json({ ok: true, slug: project.slug, id: project.id });
});

app.put("/api/projects/:slug", async (req, res) => {
    console.log("========== [PUT /api/projects/:slug] BEGIN ==========");
    console.log("[PUT /api/projects/:slug] slug =", req.params.slug);
    console.log(
        "[PUT /api/projects/:slug] raw body =",
        JSON.stringify(req.body),
    );

    const user = await requireUser(req, res);
    if (!user) {
        console.warn(
            "[PUT /api/projects/:slug] blocked: unauthenticated",
        );
        console.log(
            "========== [PUT /api/projects/:slug] END (unauthenticated) ==========",
        );
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
        console.warn(
            "[PUT /api/projects/:slug] 404 for slug",
            req.params.slug,
        );
        console.log(
            "========== [PUT /api/projects/:slug] END (not found) ==========",
        );
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
        console.log(
            "========== [PUT /api/projects/:slug] END (forbidden) ==========",
        );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year:
            typeof req.body?.year === "string"
                ? Number(req.body.year)
                : req.body?.year,
    });
    if (!parsed.success) {
        console.warn(
            "[PUT /api/projects/:slug] validation error",
            parsed.error.flatten(),
        );
        console.log(
            "========== [PUT /api/projects/:slug] END (validation error) ==========",
        );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;
    const hasTechStack = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "techStack",
    );
    const hasTags = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "tags",
    );
    const hasBlogSlugs = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "blogSlugs",
    );
    const hasMembers = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "members",
    );
    const hasEventSlugs = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "eventSlugs",
    );
    const hasLinks = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "links",
    );

    console.log("[PUT /api/projects/:slug] parsed data (without photos) =", {
        title: d.title,
        year: d.year,
        status: d.status,
        summary: d.summary ? d.summary.slice(0, 100) + "…" : null,
        demoUrl: d.demoUrl || null,
        repoUrl: d.repoUrl || null,
        techStackCount: Array.isArray(d.techStack)
            ? d.techStack.length
            : 0,
        tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
        hasBlogSlugs,
        blogSlugsCount: Array.isArray(d.blogSlugs)
            ? d.blogSlugs.length
            : 0,
        hasMembers,
        membersCount: Array.isArray(d.members)
            ? d.members.length
            : 0,
        hasEventSlugs,
        eventSlugsCount: Array.isArray(d.eventSlugs)
            ? d.eventSlugs.length
            : 0,
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
            year:
                typeof d.year === "number" && Number.isFinite(d.year)
                    ? d.year
                    : null,
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
        console.log(
            "[PUT /api/projects/:slug] updating techStack =",
            techNames,
        );
        await prisma.projectTech.deleteMany({
            where: { projectId: updated.id },
        });
        if (techNames.length) {
            const techIds = await upsertStringList(techNames, "tech");
            if (techIds.length) {
                await prisma.projectTech.createMany({
                    data: techIds.map((id) => ({
                        projectId: updated.id,
                        techId: id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasTags) {
        const tagNames = Array.isArray(d.tags) ? d.tags : [];
        console.log("[PUT /api/projects/:slug] updating tags =", tagNames);
        await prisma.projectTag.deleteMany({
            where: { projectId: updated.id },
        });
        if (tagNames.length) {
            const tagIds = await upsertStringList(tagNames, "tag");
            if (tagIds.length) {
                await prisma.projectTag.createMany({
                    data: tagIds.map((id) => ({
                        projectId: updated.id,
                        tagId: id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasBlogSlugs) {
        const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
        console.log(
            "[PUT /api/projects/:slug] updating related blogs, slugs =",
            blogSlugs,
        );

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
        const eventSlugs = Array.isArray(d.eventSlugs)
            ? d.eventSlugs
            : [];
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

    // --- TEAM & invites (unchanged from your previous version) ---
    if (hasMembers) {
        const rawMembers = Array.isArray(d.members) ? d.members : [];
        rawMembers.forEach((m, idx) => {
            console.log(
                `[PUT /api/projects/:slug] members[${idx}] =`,
                m,
            );
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
                    typeof m.isCreator === "boolean"
                        ? !!m.isCreator
                        : !!existing?.isCreator;

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

        // Invites from rawMembers (emails + existing members)
        for (const m of rawMembers) {
            if (!m || typeof m !== "object") continue;
            let role = null;
            if (typeof m.role === "string" && m.role.trim())
                role = m.role.trim();

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
            console.log(
                "[PUT /api/projects/:slug] usersForMembers =",
                usersForMembers,
            );
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
        console.log(
            "[PUT /api/projects/:slug] final inviteEmails array (new only) =",
            invites,
        );

        if (invites.length) {
            const webBase = WEB_ORIGIN.replace(/\/$/, "");
            const projectUrl = `${webBase}/projects/${updated.slug}`;

            for (const inv of invites) {
                const email = inv.email;
                const roleLabel = inv.role || "Contributor";

                console.log(
                    "[PUT /api/projects/:slug] creating invite for email =",
                    email,
                );
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
                        expiresAt: new Date(
                            Date.now() + 1000 * 60 * 60 * 24 * 7,
                        ),
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
    return res
        .status(200)
        .json({ ok: true, slug: updated.slug, id: updated.id });
});

/* --------------------------- Upload: event photo --------------------------- */
const eventsDir = path.join(UPLOAD_ROOT, "events");
fs.mkdirSync(eventsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, eventsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin")
            .toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/.test(ext)
            ? ext
            : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 }, // 8 MB
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
            cb(null, true);
        else cb(new Error("Unsupported file type"));
    },
});

app.post("/api/uploads/event-photo", async (req, res, next) => {
    console.log("[POST /api/uploads/event-photo] incoming upload");
    const user = await requireUser(req, res);
    if (!user) {
        console.warn(
            "[POST /api/uploads/event-photo] blocked: unauthenticated",
        );
        return;
    }
    return upload.single("photo")(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file)
            return res
                .status(400)
                .json({ ok: false, error: "No file" });
        const url = abs(`/uploads/events/${req.file.filename}`, req);
        console.log(
            "[POST /api/uploads/event-photo] stored file =",
            req.file.filename,
        );
        return res.status(201).json({ ok: true, url });
    });
});

/* --------------------------- Upload: project photo --------------------------- */
const projectsDir = path.join(UPLOAD_ROOT, "projects");
fs.mkdirSync(projectsDir, { recursive: true });

const projectStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin")
            .toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/.test(ext)
            ? ext
            : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});
const uploadProjectPhoto = multer({
    storage: projectStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 }, // 8 MB
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
            cb(null, true);
        else cb(new Error("Unsupported file type"));
    },
});

app.post("/api/uploads/project-photo", async (req, res, next) => {
    console.log("[POST /api/uploads/project-photo] incoming upload");
    const user = await requireUser(req, res);
    if (!user) {
        console.warn(
            "[POST /api/uploads/project-photo] blocked: unauthenticated",
        );
        return;
    }
    return uploadProjectPhoto.single("photo")(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file)
            return res
                .status(400)
                .json({ ok: false, error: "No file" });
        const url = abs(`/uploads/projects/${req.file.filename}`, req);
        console.log(
            "[POST /api/uploads/project-photo] stored file =",
            req.file.filename,
        );
        return res.status(201).json({ ok: true, url });
    });
});

/* ------------------------------ Blogs ------------------------------ */
app.get("/api/blogs", async (req, res) => {
    const page = Number.isFinite(Number(req.query.page))
        ? Number(req.query.page)
        : 1;
    const size = Math.min(
        Number.isFinite(Number(req.query.size))
            ? Number(req.query.size)
            : 24,
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
    for (const t of techs)
        AND.push({ techs: { some: { tech: { name: t } } } });
    for (const t of tags)
        AND.push({ tags: { some: { tag: { name: t } } } });
    for (const a of authors)
        AND.push({
            authors: { some: { member: { slug: a } } },
        });

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

/* ------------------------------ Events (list + detail) ------------------------------ */

app.get("/api/events", async (req, res) => {
    const page = Number.isFinite(Number(req.query.page))
        ? Number(req.query.page)
        : 1;
    const size = Math.min(
        Number.isFinite(Number(req.query.size))
            ? Number(req.query.size)
            : 200,
        1000,
    );

    const q = (req.query.q || "").toString().trim();

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { locationName: { contains: q, mode: "insensitive" } },
            ],
        });
    }

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.event.count({ where }),
        prisma.event.findMany({
            where,
            include: {
                relatedProjects: {
                    include: { project: true },
                },
                attendees: {
                    include: { member: true },
                },
                invites: true,
            },
            orderBy: [{ dateStart: "desc" }, { name: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    res.json({
        items: rows.map((e) => {
            const photos = Array.isArray(e.photos) ? e.photos : [];
            const cover =
                e.cover || e.imageUrl || (photos.length ? photos[0] : null);

            return {
                id: e.id,
                slug: e.slug,
                name: e.name,
                summary: null,
                description: e.description || null,
                dateStart: e.dateStart,
                dateEnd: e.dateEnd,
                locationName: e.locationName || null,
                lat: e.lat ?? null,
                lng: e.lng ?? null,
                cover: abs(cover, req),
                photos: photos.map((u) => abs(u, req)),
                projects: (e.relatedProjects || [])
                    .map((rel) => rel.project)
                    .filter(Boolean)
                    .map((p) => ({
                        slug: p.slug,
                        title: p.title,
                        cover: abs(p.cover || p.imageUrl || null, req),
                        year: p.year || null,
                    })),
            };
        }),
        page,
        size,
        total,
    });
});

app.get("/api/events/:slug", async (req, res) => {
    const e = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: {
            relatedProjects: {
                include: { project: true },
            },
            attendees: {
                include: { member: true },
            },
            invites: true,
        },
    });
    if (!e) return res.status(404).json({ error: "Not found" });

    const photos = Array.isArray(e.photos) ? e.photos : [];
    const cover = e.cover || e.imageUrl || (photos.length ? photos[0] : null);

    const attendees = (e.attendees || []).map((ae) => ({
        memberId: ae.memberId,
        slug: ae.member?.slug || null,
        name: ae.member?.name || null,
        role: ae.role || null,
    }));

    const invites =
        Array.isArray(e.invites) && e.invites.length
            ? e.invites.map((inv) => ({
                id: inv.id,
                email: inv.email,
                status: inv.status || null,
            }))
            : [];

    const projects = (e.relatedProjects || [])
        .map((rel) => rel.project)
        .filter(Boolean)
        .map((p) => ({
            slug: p.slug,
            title: p.title,
            cover: abs(p.cover || p.imageUrl || null, req),
            year: p.year || null,
        }));

    res.json({
        id: e.id,
        slug: e.slug,
        name: e.name,
        summary: null,
        description: e.description || null,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        locationName: e.locationName || null,
        lat: e.lat ?? null,
        lng: e.lng ?? null,
        cover: abs(cover, req),
        photos: photos.map((u) => abs(u, req)),
        attendees,
        invites,
        projects,
    });
});

/* ------------------------ Events: create / update ------------------------ */

const attendeeSchema = z.object({
    type: z.enum(["member", "invite"]),
    memberId: z.string().optional(),
    memberSlug: z.string().optional(),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    value: z.string().optional().nullable(), // for invite-only
});

const eventCreateSchema = z.object({
    name: z.string().min(1).max(200),
    locationName: z.string().max(500).optional().nullable(),
    dateStart: z.string().nullable().optional(),
    dateEnd: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    description: z.string().max(20_000).optional().nullable(),
    photos: z.array(z.string().url()).max(20).optional(),
    attendees: z.array(attendeeSchema).optional(),
    projectSlugs: z.array(z.string()).max(200).optional(),
});

async function uniqueEventSlug(base) {
    const b =
        slugify(base || "event", { lower: true, strict: true }) ||
        "event";
    let slug = b;
    let i = 1;
    while (await prisma.event.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

/**
 * POST /api/events
 * Ensure creator is always an attendee with role "CREATOR"
 * and cannot later be removed.
 */
app.post("/api/events", async (req, res) => {
    console.log("========== [POST /api/events] BEGIN ==========");
    console.log("[POST /api/events] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[POST /api/events] blocked: unauthenticated");
        console.log(
            "========== [POST /api/events] END (unauthenticated) ==========",
        );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    const hasMemberRole = roles.some((r) =>
        ["ADMIN", "MODERATOR", "MEMBER"].includes(r),
    );
    if (!hasMemberRole) {
        console.warn(
            "[POST /api/events] blocked: insufficient permissions",
        );
        console.log(
            "========== [POST /api/events] END (forbidden) ==========",
        );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = eventCreateSchema.safeParse({
        ...req.body,
        lat:
            typeof req.body?.lat === "string"
                ? Number(req.body.lat)
                : req.body?.lat,
        lng:
            typeof req.body?.lng === "string"
                ? Number(req.body.lng)
                : req.body?.lng,
    });
    if (!parsed.success) {
        console.warn(
            "[POST /api/events] validation error",
            parsed.error.flatten(),
        );
        console.log(
            "========== [POST /api/events] END (validation error) ==========",
        );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;

    const slug = await uniqueEventSlug(d.name);
    console.log("[POST /api/events] generated slug =", slug);

    const photos = Array.isArray(d.photos) ? d.photos : [];
    const coverRel = photos.length ? photos[0] : null;
    const imagesRel = photos;

    const dateStart =
        d.dateStart && typeof d.dateStart === "string"
            ? new Date(d.dateStart)
            : null;
    const dateEnd =
        d.dateEnd && typeof d.dateEnd === "string"
            ? new Date(d.dateEnd)
            : null;

    // who is the creator as a member
    const creatorMemberId =
        user && user.member && user.member.id ? user.member.id : null;

    // Create event
    const event = await prisma.event.create({
        data: {
            slug,
            name: d.name,
            locationName: d.locationName || null,
            dateStart: dateStart && !Number.isNaN(dateStart.getTime())
                ? dateStart
                : null,
            dateEnd: dateEnd && !Number.isNaN(dateEnd.getTime())
                ? dateEnd
                : null,
            lat:
                typeof d.lat === "number" && Number.isFinite(d.lat)
                    ? d.lat
                    : null,
            lng:
                typeof d.lng === "number" && Number.isFinite(d.lng)
                    ? d.lng
                    : null,
            description: d.description || null,
            photos: imagesRel,
            // optionally: imageUrl: coverRel, IF your Event model has `imageUrl`
        },
    });

    console.log("[POST /api/events] created event id =", event.id);

    // Ensure creator is always an attendee with role "CREATOR"
    if (creatorMemberId) {
        try {
            await prisma.memberEvent.upsert({
                where: {
                    memberId_eventId: {
                        memberId: creatorMemberId,
                        eventId: event.id,
                    },
                },
                create: {
                    memberId: creatorMemberId,
                    eventId: event.id,
                    role: "CREATOR",
                },
                update: {
                    role: "CREATOR",
                },
            });
            console.log(
                "[POST /api/events] ensured creator memberEvent row for memberId",
                creatorMemberId,
            );
        } catch (err) {
            console.error(
                "[POST /api/events] failed to upsert creator memberEvent row",
                err,
            );
        }
    } else {
        console.warn(
            "[POST /api/events] creator user has no member profile; cannot attach as attendee",
        );
    }

    // Attach projects
    const projectSlugs = Array.isArray(d.projectSlugs)
        ? d.projectSlugs
        : [];
    if (projectSlugs.length) {
        const projects = await prisma.project.findMany({
            where: { slug: { in: projectSlugs } },
            select: { id: true, slug: true },
        });
        if (projects.length) {
            await prisma.eventProject.createMany({
                data: projects.map((p) => ({
                    eventId: event.id,
                    projectId: p.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    // Attendees + email invites
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const attendees = Array.isArray(d.attendees) ? d.attendees : [];

    // MemberEvent rows (other attendees; creator already ensured)
    for (const a of attendees) {
        if (a.type === "member" && a.memberId) {
            if (creatorMemberId && a.memberId === creatorMemberId) {
                console.log(
                    "[POST /api/events] skipping creator in attendee loop; already ensured as CREATOR",
                );
                continue;
            }
            try {
                await prisma.memberEvent.create({
                    data: {
                        memberId: a.memberId,
                        eventId: event.id,
                        role: null,
                    },
                });
            } catch (err) {
                console.error(
                    "[POST /api/events] failed to create memberEvent",
                    err,
                );
            }
        }
    }

    // Collect invite emails (from invite entries + memberIds -> users)
    const inviteMap = new Map();

    // direct invite objects (type="invite")
    for (const a of attendees) {
        if (a.type !== "invite") continue;
        let addr = a.value || a.email || "";
        addr = (addr || "").trim();
        if (!addr || !emailRegex.test(addr)) continue;
        const lower = addr.toLowerCase();
        if (!inviteMap.has(lower)) {
            inviteMap.set(lower, { email: lower });
        }
    }

    // also auto-invite email addresses of member attendees
    const memberIds = attendees
        .filter((a) => a.type === "member" && a.memberId)
        .map((a) => a.memberId);
    if (memberIds.length) {
        const users = await prisma.user.findMany({
            where: { memberId: { in: memberIds } },
            select: { email: true },
        });
        for (const u of users) {
            if (!u.email) continue;
            const lower = u.email.toLowerCase();
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower });
            }
        }
    }

    const creatorEmailLower = (user.email || "").toLowerCase();
    if (creatorEmailLower) {
        inviteMap.delete(creatorEmailLower);
    }

    const eventInvites = Array.from(inviteMap.values());
    console.log("[POST /api/events] eventInvites =", eventInvites);

    if (eventInvites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const eventUrl = `${webBase}/events/${event.slug}`;

        for (const inv of eventInvites) {
            const email = inv.email;
            console.log(
                "[POST /api/events] creating invite for email =",
                email,
            );
            const { raw, hash } = genInviteToken();

            await prisma.eventInvite.create({
                data: {
                    eventId: event.id,
                    email,
                    tokenHash: hash,
                    status: "PENDING",
                    expiresAt: new Date(
                        Date.now() + 1000 * 60 * 60 * 24 * 7,
                    ),
                },
            });

            const acceptUrl = `${webBase}/accept-invite?token=${raw}`;

            const subject = `You've been invited to event: ${event.name}`;
            const text = `Hi,

You've been invited to join the event "${event.name}" at PUM.

Accept your invite:
${acceptUrl}

Event page: ${eventUrl}

This invite was sent from ${MAIL_FROM}.
`;

            void sendInviteEmail(email, subject, text);
        }
    }

    console.log("========== [POST /api/events] END (success) ==========");
    return res
        .status(201)
        .json({ ok: true, slug: event.slug, id: event.id });
});

/**
 * PUT /api/events/:slug
 * Used by the EditEventPage form.
 * IMPORTANT: event creators (role="CREATOR") are always kept as attendees,
 * even if they are missing from the incoming attendees payload.
 */
app.put("/api/events/:slug", async (req, res) => {
    console.log("========== [PUT /api/events/:slug] BEGIN ==========");
    console.log("[PUT /api/events/:slug] slug =", req.params.slug);
    console.log(
        "[PUT /api/events/:slug] raw body =",
        JSON.stringify(req.body),
    );

    const user = await requireUser(req, res);
    if (!user) {
        console.warn("[PUT /api/events/:slug] blocked: unauthenticated");
        console.log(
            "========== [PUT /api/events/:slug] END (unauthenticated) ==========",
        );
        return;
    }

    const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: {
            attendees: {
                include: { member: true },
            },
            invites: true,
            relatedProjects: true,
        },
    });

    if (!event) {
        console.warn(
            "[PUT /api/events/:slug] 404 for slug",
            req.params.slug,
        );
        console.log(
            "========== [PUT /api/events/:slug] END (not found) ==========",
        );
        return res.status(404).json({ ok: false, error: "Not found" });
    }

    // Permissions: admins + moderators can edit anything; attendees can edit their own events.
    const roles = (user.roles || []).map((r) => r.role);
    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    let canEdit = isAdminOrModerator;
    if (!canEdit && user.member && user.member.id) {
        const isCreatorOrAttendee =
            (event.attendees || []).some(
                (a) => a.memberId === user.member.id,
            ) || (user.email || "").toLowerCase() ===
            (MAIL_FROM || "").toLowerCase();
        if (isCreatorOrAttendee) canEdit = true;
    }

    if (!canEdit) {
        console.warn(
            "[PUT /api/events/:slug] blocked: insufficient permissions",
        );
        console.log(
            "========== [PUT /api/events/:slug] END (forbidden) ==========",
        );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = eventCreateSchema.safeParse({
        ...req.body,
        lat:
            typeof req.body?.lat === "string"
                ? Number(req.body.lat)
                : req.body?.lat,
        lng:
            typeof req.body?.lng === "string"
                ? Number(req.body.lng)
                : req.body?.lng,
    });
    if (!parsed.success) {
        console.warn(
            "[PUT /api/events/:slug] validation error",
            parsed.error.flatten(),
        );
        console.log(
            "========== [PUT /api/events/:slug] END (validation error) ==========",
        );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;

    const photos = Array.isArray(d.photos)
        ? d.photos
        : Array.isArray(event.photos)
            ? event.photos
            : [];
    const coverRel = photos.length
        ? photos[0]
        : event.cover || event.imageUrl || null;
    const imagesRel = photos;

    const dateStart =
        d.dateStart && typeof d.dateStart === "string"
            ? new Date(d.dateStart)
            : null;
    const dateEnd =
        d.dateEnd && typeof d.dateEnd === "string"
            ? new Date(d.dateEnd)
            : null;

    const updated = await prisma.event.update({
        where: { id: event.id },
        data: {
            name: d.name,
            locationName: d.locationName || null,
            dateStart: dateStart && !Number.isNaN(dateStart.getTime())
                ? dateStart
                : null,
            dateEnd: dateEnd && !Number.isNaN(dateEnd.getTime())
                ? dateEnd
                : null,
            lat:
                typeof d.lat === "number" && Number.isFinite(d.lat)
                    ? d.lat
                    : null,
            lng:
                typeof d.lng === "number" && Number.isFinite(d.lng)
                    ? d.lng
                    : null,
            description: d.description || null,
            photos: imagesRel,
            // optionally: imageUrl: coverRel, IF your Event model has `imageUrl`
        },
    });

    console.log("[PUT /api/events/:slug] updated event id =", updated.id);

    // --- Related projects ---
    const projectSlugs = Array.isArray(d.projectSlugs)
        ? d.projectSlugs
        : [];
    await prisma.eventProject.deleteMany({
        where: { eventId: updated.id },
    });
    if (projectSlugs.length) {
        const projects = await prisma.project.findMany({
            where: { slug: { in: projectSlugs } },
            select: { id: true, slug: true },
        });
        if (projects.length) {
            await prisma.eventProject.createMany({
                data: projects.map((p) => ({
                    eventId: updated.id,
                    projectId: p.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    // --- Attendees + invites ---
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const attendees = Array.isArray(d.attendees) ? d.attendees : [];
    const existingInvites = new Set(
        (event.invites || [])
            .map((i) => (i.email || "").toLowerCase())
            .filter(Boolean),
    );

    const existingAttendees = Array.isArray(event.attendees)
        ? event.attendees
        : [];

    // Identify creator member IDs (role="CREATOR")
    const creatorMemberIdSet = new Set(
        existingAttendees
            .filter(
                (a) =>
                    a &&
                    a.memberId &&
                    typeof a.role === "string" &&
                    a.role === "CREATOR",
            )
            .map((a) => a.memberId),
    );

    // For legacy events that don't have a CREATOR yet, if the editing user
    // is already an attendee, promote them to CREATOR so they can't remove themself.
    if (
        creatorMemberIdSet.size === 0 &&
        user &&
        user.member &&
        user.member.id
    ) {
        const userMemberId = user.member.id;
        const isUserAttendee = existingAttendees.some(
            (a) => a && a.memberId === userMemberId,
        );
        if (isUserAttendee) {
            try {
                await prisma.memberEvent.update({
                    where: {
                        memberId_eventId: {
                            memberId: userMemberId,
                            eventId: event.id,
                        },
                    },
                    data: { role: "CREATOR" },
                });
                creatorMemberIdSet.add(userMemberId);
                console.log(
                    "[PUT /api/events/:slug] promoted editing user to CREATOR for legacy event",
                );
            } catch (err) {
                console.error(
                    "[PUT /api/events/:slug] failed to promote user to CREATOR",
                    err,
                );
            }
        }
    }

    // Replace MemberEvent rows with current payload, but NEVER delete creators
    if (creatorMemberIdSet.size > 0) {
        await prisma.memberEvent.deleteMany({
            where: {
                eventId: updated.id,
                memberId: {
                    notIn: Array.from(creatorMemberIdSet),
                },
            },
        });
    } else {
        // no explicit creators; fall back to old behavior
        await prisma.memberEvent.deleteMany({
            where: { eventId: updated.id },
        });
    }

    // Recreate non-creator attendees from payload
    for (const a of attendees) {
        if (a.type === "member" && a.memberId) {
            if (creatorMemberIdSet.has(a.memberId)) {
                console.log(
                    "[PUT /api/events/:slug] skipping creator memberId in attendee loop; preserved as CREATOR",
                    a.memberId,
                );
                continue;
            }
            try {
                await prisma.memberEvent.create({
                    data: {
                        memberId: a.memberId,
                        eventId: updated.id,
                        role: null,
                    },
                });
            } catch (err) {
                console.error(
                    "[PUT /api/events/:slug] failed to create memberEvent",
                    err,
                );
            }
        }
    }

    const inviteMap = new Map();

    // direct email invites
    for (const a of attendees) {
        if (a.type !== "invite") continue;
        let addr = a.value || a.email || "";
        addr = (addr || "").trim();
        if (!addr || !emailRegex.test(addr)) continue;
        const lower = addr.toLowerCase();
        if (existingInvites.has(lower)) continue;
        if (!inviteMap.has(lower)) {
            inviteMap.set(lower, { email: lower });
        }
    }

    // also optionally invite users of member attendees
    const memberIds = attendees
        .filter((a) => a.type === "member" && a.memberId)
        .map((a) => a.memberId);
    if (memberIds.length) {
        const users = await prisma.user.findMany({
            where: { memberId: { in: memberIds } },
            select: { email: true },
        });
        for (const u of users) {
            if (!u.email) continue;
            const lower = u.email.toLowerCase();
            if (existingInvites.has(lower)) continue;
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower });
            }
        }
    }

    const editorEmailLower = (user.email || "").toLowerCase();
    if (editorEmailLower) {
        inviteMap.delete(editorEmailLower);
    }

    const newInvites = Array.from(inviteMap.values());
    console.log(
        "[PUT /api/events/:slug] new event invites =",
        newInvites,
    );

    if (newInvites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const eventUrl = `${webBase}/events/${updated.slug}`;

        for (const inv of newInvites) {
            const email = inv.email;
            const { raw, hash } = genInviteToken();

            await prisma.eventInvite.create({
                data: {
                    eventId: updated.id,
                    email,
                    tokenHash: hash,
                    status: "PENDING",
                    expiresAt: new Date(
                        Date.now() + 1000 * 60 * 60 * 24 * 7,
                    ),
                },
            });

            const acceptUrl = `${webBase}/accept-invite?token=${raw}`;

            const subject = `You've been invited to event: ${updated.name}`;
            const text = `Hi,

You've been invited to join the event "${updated.name}" at PUM.

Approve your invite:
${acceptUrl}

Event page: ${eventUrl}

This invite was sent from ${MAIL_FROM}.
`;

            void sendInviteEmail(email, subject, text);
        }
    }

    console.log("========== [PUT /api/events/:slug] END (success) ==========");
    return res
        .status(200)
        .json({ ok: true, slug: updated.slug, id: updated.id });
});

/* -------------------------- Invite consumption -------------------------- */

const inviteConsumeSchema = z.object({
    token: z.string().min(10),
    name: z.string().optional(), // used for new-user flow
    password: z.string().optional(),
    passwordRepeat: z.string().optional(),
});

app.post("/api/auth/invite/consume", async (req, res) => {
    console.log("========== [POST /api/auth/invite/consume] BEGIN ==========");
    console.log("[invite/consume] raw body =", JSON.stringify(req.body));

    const parsed = inviteConsumeSchema.safeParse(req.body);
    if (!parsed.success) {
        console.warn(
            "[invite/consume] validation error",
            parsed.error.flatten(),
        );
        console.log(
            "========== [POST /api/auth/invite/consume] END (validation error) ==========",
        );
        return res
            .status(400)
            .json({ ok: false, error: "Invalid token payload" });
    }

    const { token, name, password, passwordRepeat } = parsed.data;
    const tokenHash = hashInviteToken(token);
    if (!tokenHash) {
        console.warn("[invite/consume] missing token hash");
        console.log(
            "========== [POST /api/auth/invite/consume] END (no token) ==========",
        );
        return res
            .status(400)
            .json({ ok: false, error: "Invite invalid or expired." });
    }

    // Try project invite first
    let projectInvite = await prisma.projectInvite.findFirst({
        where: {
            tokenHash,
            status: "PENDING",
            expiresAt: { gt: new Date() },
        },
        include: {
            project: {
                include: {
                    members: true,
                },
            },
        },
    });

    // Then event invite
    let eventInvite = null;
    if (!projectInvite) {
        eventInvite = await prisma.eventInvite.findFirst({
            where: {
                tokenHash,
                status: "PENDING",
                expiresAt: { gt: new Date() },
            },
            include: {
                event: true,
            },
        });
    }

    if (!projectInvite && !eventInvite) {
        console.warn(
            "[invite/consume] no invite found for tokenHash",
            tokenHash,
        );
        console.log(
            "========== [POST /api/auth/invite/consume] END (not found) ==========",
        );
        return res
            .status(400)
            .json({ ok: false, error: "Invite invalid or expired." });
    }

    const inviteObj = projectInvite || eventInvite;
    const emailLower = (inviteObj.email || "").toLowerCase();

    // Look up user by email
    let user = await prisma.user.findUnique({
        where: { email: emailLower },
        include: { member: true, roles: true },
    });

    const isNewUser = !user;

    if (isNewUser) {
        // New-user flow: require password + name
        if (!password || !passwordRepeat || password !== passwordRepeat) {
            console.warn(
                "[invite/consume] new-user password mismatch/empty for",
                emailLower,
            );
            console.log(
                "========== [POST /api/auth/invite/consume] END (password mismatch) ==========",
            );
            return res.status(400).json({
                ok: false,
                error:
                    "To accept this invite, please provide a valid password and make sure both fields match.",
                needsPassword: true,
            });
        }
        if (!name || !name.trim()) {
            console.warn(
                "[invite/consume] new-user missing name for",
                emailLower,
            );
            console.log(
                "========== [POST /api/auth/invite/consume] END (missing name) ==========",
            );
            return res.status(400).json({
                ok: false,
                error: "Please provide your name to complete the invite.",
                needsName: true,
            });
        }

        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
        });

        // Minimal member profile
        const baseSlug =
            slugify(name, { lower: true, strict: true }) ||
            emailLower.split("@")[0] ||
            "user";
        let slug = baseSlug;
        let i = 0;
        while (await prisma.member.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${++i}`;
            if (i > 20) break;
        }

        const member = await prisma.member.create({
            data: {
                slug,
                name: name.trim(),
                bio: "",
                links: {},
                avatarUrl: null,
                focusArea: null,
            },
        });

        user = await prisma.user.create({
            data: {
                email: emailLower,
                passwordHash,
                memberId: member.id,
                roles: {
                    create: [{ role: "MEMBER" }],
                },
            },
            include: { member: true, roles: true },
        });

        console.log(
            "[invite/consume] created new user from invite",
            emailLower,
            "userId =",
            user.id,
        );
    }

    // Ensure member profile exists
    let member = user.member;
    if (!member) {
        const baseName = user.email.split("@")[0] || "user";
        const slugBase =
            slugify(baseName, { lower: true, strict: true }) || "user";
        let slug = slugBase;
        let i = 0;
        while (await prisma.member.findUnique({ where: { slug } })) {
            slug = `${slugBase}-${++i}`;
            if (i > 20) break;
        }
        member = await prisma.member.create({
            data: {
                slug,
                name: baseName,
                bio: "",
                links: {},
                avatarUrl: null,
                focusArea: null,
            },
        });
        await prisma.user.update({
            where: { id: user.id },
            data: { memberId: member.id },
        });
    }

    let projectSlug = null;
    let eventSlug = null;

    if (projectInvite && projectInvite.project) {
        const project = projectInvite.project;
        projectSlug = project.slug;

        // Check if MemberProject row already exists
        const existingMemberProject =
            await prisma.memberProject.findUnique({
                where: {
                    memberId_projectId: {
                        memberId: member.id,
                        projectId: project.id,
                    },
                },
            });

        if (!existingMemberProject) {
            await prisma.memberProject.create({
                data: {
                    memberId: member.id,
                    projectId: project.id,
                    role: projectInvite.role || "Contributor",
                    contribution: null,
                    isCreator: false,
                },
            });
        }

        // Mark invite as accepted
        await prisma.projectInvite.update({
            where: { id: projectInvite.id },
            data: {
                status: "ACCEPTED",
                consumedAt: new Date(),
            },
        });

        console.log(
            "[invite/consume] accepted project invite for email",
            emailLower,
            "projectSlug =",
            projectSlug,
            "newUser =",
            isNewUser,
        );
    }

    if (eventInvite && eventInvite.event) {
        const eventObj = eventInvite.event;
        eventSlug = eventObj.slug;

        const existingMemberEvent = await prisma.memberEvent.findUnique({
            where: {
                memberId_eventId: {
                    memberId: member.id,
                    eventId: eventObj.id,
                },
            },
        });

        if (!existingMemberEvent) {
            await prisma.memberEvent.create({
                data: {
                    memberId: member.id,
                    eventId: eventObj.id,
                    role: null,
                },
            });
        }

        await prisma.eventInvite.update({
            where: { id: eventInvite.id },
            data: {
                status: "ACCEPTED",
                consumedAt: new Date(),
            },
        });

        console.log(
            "[invite/consume] accepted event invite for email",
            emailLower,
            "eventSlug =",
            eventSlug,
            "newUser =",
            isNewUser,
        );
    }

    console.log("========== [POST /api/auth/invite/consume] END (success) ==========");
    return res.json({
        ok: true,
        newUser: isNewUser,
        projectSlug,
        eventSlug,
        email: emailLower,
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
