// index.js
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
const argon2 = require("argon2");
const xss = require("xss");
const validator = require("validator");

const { prisma } = require("./db");
const { authRouter } = require("./auth");
const { accountRouter } = require("./account");
const { ensureMemberAvatar } = require("./imageDefaults");

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

// console.log("[config] WEB_ORIGIN =", WEB_ORIGIN);

app.use((req, _res, next) => {
    // console.log(
    //     `[req] ${req.method} ${req.originalUrl} origin=${req.headers.origin || "n/a"}`,
    // );
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

/* CV directory (shared with account CV uploads) */
const CV_DIR = path.join(UPLOAD_ROOT, "cv");
fs.mkdirSync(CV_DIR, { recursive: true });

/* Avatars directory (for member/account avatars) */
const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

/* Events / projects / blogs upload dirs */
const eventsDir = path.join(UPLOAD_ROOT, "events");
fs.mkdirSync(eventsDir, { recursive: true });

const projectsDir = path.join(UPLOAD_ROOT, "projects");
fs.mkdirSync(projectsDir, { recursive: true });

const blogsDir = path.join(UPLOAD_ROOT, "blogs");
fs.mkdirSync(blogsDir, { recursive: true });

/* ------------------------ Helpers ------------------------ */
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;
const JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || "dev-only-change-me";
const NEWSLETTER_SECRET =
    process.env.NEWSLETTER_SECRET || "dev-only-newsletter-secret";

// console.log("[config] PUBLIC_API_BASE =", PUBLIC_API_BASE || "(not set)");

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
    // console.log("[mail] configuring SMTP transport", {
    //     host: SMTP_HOST,
    //     port: SMTP_PORT,
    //     user: SMTP_USER ? "(set)" : "(none)",
    // });
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
    // console.log(
    //     "[mail] SMTP_HOST not set; invite emails will be logged only",
    // );
}

async function sendInviteEmail(to, subject, text) {
    if (!to) return;
    if (!mailTransporter) {
        // console.log(
        //     `[invite-email] (no SMTP configured) Would send mail from ${MAIL_FROM} to ${to}:\nSubject: ${subject}\n\n${text}`,
        // );
        return;
    }
    try {
        // console.log("[invite-email] sending mail to", to);
        await mailTransporter.sendMail({
            from: MAIL_FROM,
            to,
            subject,
            text,
        });
        // console.log("[invite-email] sent OK to", to);
    } catch (err) {
        // console.error("[invite-email] send error", err);
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
        // console.warn(
        //     "[auth] missing access token for",
        //     req.method,
        //     req.originalUrl,
        // );
        res.status(401).json({ ok: false, error: "Missing access token" });
        return null;
    }
    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, {
            algorithms: ["HS256"],
        });
        // console.log("[auth] token OK for user id", decoded.sub);
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            include: { roles: true, member: true },
        });
        if (!user) {
            // console.warn(
            //     "[auth] token user not found in DB",
            //     decoded.sub,
            // );
            res.status(401).json({ ok: false, error: "Unknown user" });
            return null;
        }
        return user;
    } catch (err) {
        // console.warn(
        //     "[auth] invalid access token for",
        //     req.method,
        //     req.originalUrl,
        //     err?.message,
        // );
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

const deleteBySlugSchema = z.object({
    confirmSlug: z.string().min(1),
});

const memberProfileUpdateSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    headline: z.string().max(200).nullable().optional(),
    shortBio: z.string().max(500).nullable().optional(),
    markdown: z.string().max(100_000).optional(),
    links: z.record(z.string().url()).optional(),
    focusArea: z
        .enum([
            "FRONTEND",
            "BACKEND",
            "ML",
            "DATA",
            "DEVOPS",
            "DESIGN",
            "PM",
            "OTHER",
        ])
        .nullable()
        .optional(),
    skills: z.array(z.string().min(1)).optional(),
    techStack: z.array(z.string().min(1)).optional(),
    accessRole: z.enum(["MEMBER", "MODERATOR"]).optional(),
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

    // console.log("[members/:slug] slug =", req.params.slug);

    let m = await prisma.member.findUnique({
        where: { slug: req.params.slug },
        include,
    });

    if (!m) {
        // console.log(
        //     "[members/:slug] not found by slug; trying user email link",
        // );
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
        // console.warn("[members/:slug] 404 for slug", req.params.slug);
        return res.status(404).json({ error: "Not found" });
    }

    let cvUrl = null;
    const userRolesSet = new Set();

    const usersForMember = await prisma.user.findMany({
        where: { memberId: m.id },
        include: { roles: true },
    });

    if (usersForMember.length) {
        for (const u of usersForMember) {
            for (const r of u.roles || []) {
                if (r.role) userRolesSet.add(r.role);
            }
        }

        for (const u of usersForMember) {
            const p = path.join(CV_DIR, `${u.id}-latest.pdf`);
            if (fs.existsSync(p)) {
                cvUrl = abs(`/uploads/cv/${u.id}-latest.pdf`, req);
                break;
            }
        }
    }

    const userRoles = Array.from(userRolesSet);
    const isAdminMember = userRoles.includes("ADMIN");

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
            name: r.role || r.event.name,
            role: r.role || null,
            dateStart: r.event.dateStart,
            dateEnd: r.event.dateEnd,
        })),
        userRoles,
        isAdminMember,
        cvUrl,
    });
});

app.put("/api/members/:slug", async (req, res) => {
    // console.log("========== [PUT /api/members/:slug] BEGIN ==========");
    // console.log("[PUT /api/members/:slug] slug =", req.params.slug);
    // console.log(
    //     "[PUT /api/members/:slug] raw body =",
    //     JSON.stringify(req.body),
    // );

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[PUT /api/members/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );
    const isAdmin = roles.includes("ADMIN");

    if (!isAdminOrModerator) {
        // console.warn(
        //     "[PUT /api/members/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const member = await prisma.member.findUnique({
        where: { slug: req.params.slug },
    });

    if (!member) {
        // console.warn(
        //     "[PUT /api/members/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (not found) ==========",
        // );
        return res.status(404).json({ ok: false, error: "Not found" });
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const isAdminMember = usersForMember.some((u) =>
        (u.roles || []).some((r) => r.role === "ADMIN"),
    );

    if (isAdminMember) {
        // console.warn(
        //     "[PUT /api/members/:slug] blocked: attempted edit of admin member id",
        //     member.id,
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (admin blocked) ==========",
        // );
        return res.status(403).json({
            ok: false,
            error: "Cannot edit admin member from this page",
        });
    }

    const parsed = memberProfileUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[PUT /api/members/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const bodyHasAccessRole = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "accessRole",
    );

    if (bodyHasAccessRole && !isAdmin) {
        // console.warn(
        //     "[PUT /api/members/:slug] blocked: non-admin attempting to change accessRole",
        //     user.id,
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (accessRole forbidden) ==========",
        // );
        return res.status(403).json({
            ok: false,
            error: "Only admins can change member access role",
        });
    }

    const d = parsed.data;
    const data = {};
    const {
        name,
        headline,
        shortBio,
        markdown,
        links,
        focusArea,
        accessRole,
    } = d;
    if (typeof name !== "undefined") data.name = name;
    if (typeof headline !== "undefined") data.headline = headline;
    if (typeof shortBio !== "undefined") data.shortBio = shortBio;
    if (typeof markdown !== "undefined") data.bio = markdown;
    if (typeof links !== "undefined") data.links = links;
    if (typeof focusArea !== "undefined") data.focusArea = focusArea;

    const skills = d.skills || null;
    const techStack = d.techStack || null;

    try {
        await prisma.$transaction(async (tx) => {
            if (Object.keys(data).length) {
                await tx.member.update({
                    where: { id: member.id },
                    data,
                });
            }

            if (skills) {
                const ids = await upsertStringList(skills, "skill");
                await tx.memberSkill.deleteMany({
                    where: {
                        memberId: member.id,
                        NOT: { skillId: { in: ids } },
                    },
                });
                for (const sid of ids) {
                    await tx.memberSkill.upsert({
                        where: {
                            memberId_skillId: {
                                memberId: member.id,
                                skillId: sid,
                            },
                        },
                        update: {},
                        create: { memberId: member.id, skillId: sid },
                    });
                }
            }

            if (techStack) {
                const ids = await upsertStringList(techStack, "tech");
                await tx.memberTech.deleteMany({
                    where: {
                        memberId: member.id,
                        NOT: { techId: { in: ids } },
                    },
                });
                for (const tid of ids) {
                    await tx.memberTech.upsert({
                        where: {
                            memberId_techId: {
                                memberId: member.id,
                                techId: tid,
                            },
                        },
                        update: {},
                        create: { memberId: member.id, techId: tid },
                    });
                }
            }

            if (bodyHasAccessRole && accessRole && usersForMember.length) {
                const userIds = usersForMember.map((u) => u.id);

                await tx.userRole.deleteMany({
                    where: {
                        userId: { in: userIds },
                        role: { in: ["MEMBER", "MODERATOR"] },
                    },
                });

                await tx.userRole.createMany({
                    data: userIds.map((uid) => ({
                        userId: uid,
                        role: accessRole,
                    })),
                    skipDuplicates: true,
                });
            }
        });

        const updated = await prisma.member.findUnique({
            where: { id: member.id },
            include: {
                skills: { include: { skill: true } },
                techs: { include: { tech: true } },
                projects: { include: { project: true } },
                events: { include: { event: true } },
            },
        });

        const refreshedUsers = await prisma.user.findMany({
            where: { memberId: member.id },
            include: { roles: true },
        });

        const roleSet = new Set();
        let cvUrl = null;

        for (const u of refreshedUsers) {
            for (const r of u.roles || []) {
                if (r.role) roleSet.add(r.role);
            }
            if (!cvUrl) {
                const p = path.join(CV_DIR, `${u.id}-latest.pdf`);
                if (fs.existsSync(p)) {
                    cvUrl = abs(`/uploads/cv/${u.id}-latest.pdf`, req);
                }
            }
        }

        const userRoles = Array.from(roleSet);
        const isAdminMemberAfter = userRoles.includes("ADMIN");

        // console.log(
        //     "[PUT /api/members/:slug] END (success) member id =",
        //     updated?.id,
        // );
        return res.status(200).json({
            ok: true,
            member: {
                id: updated.id,
                slug: updated.slug,
                name: updated.name,
                avatar: abs(updated.avatar || updated.avatarUrl || null, req),
                avatarUrl: abs(
                    updated.avatarUrl || updated.avatar || null,
                    req,
                ),
                headline: updated.headline,
                shortBio: updated.shortBio,
                bio: updated.bio || updated.longBio,
                markdown: updated.bio || updated.longBio || "",
                location: updated.location,
                links: updated.links || {},
                photos: updated.photos || [],
                skills: updated.skills.map((x) => x.skill.name),
                techStack: updated.techs.map((x) => x.tech.name),
                focusArea: updated.focusArea || null,
                projects: updated.projects.map((r) => ({
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
                events: updated.events.map((r) => ({
                    id: r.event.id,
                    slug: r.event.slug,
                    name: r.event.name,
                    role: r.role || null,
                    dateStart: r.event.dateStart,
                    dateEnd: r.event.dateEnd,
                })),
                userRoles,
                isAdminMember: isAdminMemberAfter,
                cvUrl,
            },
        });
    } catch (err) {
        // console.error(
        //     "[PUT /api/members/:slug] error during update",
        //     err,
        // );
        // console.log(
        //     "========== [PUT /api/members/:slug] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error: "Failed to update member",
        });
    }
});

app.delete("/api/members/:slug", async (req, res) => {
    // console.log("========== [DELETE /api/members/:slug] BEGIN ==========");
    // console.log("[DELETE /api/members/:slug] slug =", req.params.slug);

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[DELETE /api/members/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    if (!isAdminOrModerator) {
        // console.warn(
        //     "[DELETE /api/members/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const member = await prisma.member.findUnique({
        where: { slug: req.params.slug },
    });

    if (!member) {
        // console.warn(
        //     "[DELETE /api/members/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (not found) ==========",
        // );
        return res
            .status(404)
            .json({ ok: false, error: "Not found" });
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const isAdminMemberDelete = usersForMember.some((u) =>
        (u.roles || []).some((r) => r.role === "ADMIN"),
    );

    if (isAdminMemberDelete) {
        // console.warn(
        //     "[DELETE /api/members/:slug] blocked: attempted delete of admin member id",
        //     member.id,
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (admin blocked) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Cannot delete admin member" });
    }

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[DELETE /api/members/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== member.slug) {
        // console.warn(
        //     "[DELETE /api/members/:slug] slug confirmation mismatch, got",
        //     confirmSlug,
        //     "expected",
        //     member.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (slug mismatch) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Slug confirmation does not match",
        });
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.memberSkill.deleteMany({
                where: { memberId: member.id },
            });
            await tx.memberTech.deleteMany({
                where: { memberId: member.id },
            });
            await tx.memberProject.deleteMany({
                where: { memberId: member.id },
            });
            await tx.memberEvent.deleteMany({
                where: { memberId: member.id },
            });

            await tx.user.updateMany({
                where: { memberId: member.id },
                data: { memberId: null },
            });

            await tx.member.delete({
                where: { id: member.id },
            });
        });

        // console.log(
        //     "========== [DELETE /api/members/:slug] END (success) ==========",
        // );
        return res.status(200).json({ ok: true });
    } catch (err) {
        // console.error(
        //     "[DELETE /api/members/:slug] error during deletion",
        //     err,
        // );
        // console.log(
        //     "========== [DELETE /api/members/:slug] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error: "Failed to delete member",
        });
    }
});

/* ------------------------- Member CV upload (admin) ------------------------- */

const memberCvStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CV_DIR),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "pdf").toLowerCase();
        const safeExt = ext === "pdf" ? "pdf" : "pdf";
        const tmpName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, tmpName);
    },
});

const uploadMemberCv = multer({
    storage: memberCvStorage,
    limits: { fileSize: 16 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === "application/pdf") cb(null, true);
        else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "cv"));
    },
});

app.post(
    "/api/members/:slug/cv",
    async (req, res, next) => {
        // console.log("[POST /api/members/:slug/cv] incoming upload");
        const user = await requireUser(req, res);
        if (!user) {
            // console.warn(
            //     "[POST /api/members/:slug/cv] blocked: unauthenticated",
            // );
            return;
        }

        const roles = (user.roles || []).map((r) => r.role);
        const isAdminOrModerator = roles.some((r) =>
            ["ADMIN", "MODERATOR"].includes(r),
        );
        if (!isAdminOrModerator) {
            // console.warn(
            //     "[POST /api/members/:slug/cv] blocked: insufficient permissions",
            //     user.id,
            // );
            return res.status(403).json({
                ok: false,
                error: "Insufficient permissions",
            });
        }

        const member = await prisma.member.findUnique({
            where: { slug: req.params.slug },
        });
        if (!member) {
            // console.warn(
            //     "[POST /api/members/:slug/cv] member not found for slug",
            //     req.params.slug,
            // );
            return res
                .status(404)
                .json({ ok: false, error: "Member not found" });
        }

        const usersForMember = await prisma.user.findMany({
            where: { memberId: member.id },
            include: { roles: true },
        });

        const isAdminMember = usersForMember.some((u) =>
            (u.roles || []).some((r) => r.role === "ADMIN"),
        );
        if (isAdminMember) {
            // console.warn(
            //     "[POST /api/members/:slug/cv] blocked: attempt to upload CV for admin member",
            //     member.id,
            // );
            return res.status(403).json({
                ok: false,
                error: "Cannot modify admin member from this page",
            });
        }

        if (!usersForMember.length) {
            // console.warn(
            //     "[POST /api/members/:slug/cv] no users linked to member id",
            //     member.id,
            // );
            return res.status(400).json({
                ok: false,
                error: "No user account linked to this member",
            });
        }

        req._memberForCv = member;
        req._usersForCv = usersForMember;
        return uploadMemberCv.single("cv")(req, res, (err) => {
            if (err) return next(err);
            return next();
        });
    },
    async (req, res) => {
        const member = req._memberForCv;
        const usersForMember = req._usersForCv || [];
        if (!req.file) {
            return res
                .status(400)
                .json({ ok: false, error: "No file uploaded" });
        }

        const userForCv = usersForMember[0];
        const userId = userForCv.id;

        const finalName = `${userId}-latest.pdf`;
        const finalPath = path.join(CV_DIR, finalName);

        try {
            fs.renameSync(req.file.path, finalPath);
        } catch (err) {
            // console.error(
            //     "[POST /api/members/:slug/cv] failed to move CV file",
            //     err,
            // );
            return res.status(500).json({
                ok: false,
                error: "Failed to store CV file",
            });
        }

        const url = abs(`/uploads/cv/${finalName}`, req);
        // console.log(
        //     "[POST /api/members/:slug/cv] stored CV for userId",
        //     userId,
        //     "at",
        //     url,
        // );

        return res.status(201).json({ ok: true, url });
    },
);

/* ------------------------- Member avatar upload (admin/mod) ------------------------- */

const memberAvatarStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : "jpg";
        const tmpName = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, tmpName);
    },
});

const uploadMemberAvatar = multer({
    storage: memberAvatarStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
            cb(null, true);
        else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "avatar"));
    },
});

app.post(
    "/api/members/:slug/avatar",
    async (req, res, next) => {
        // console.log("[POST /api/members/:slug/avatar] incoming upload");
        const user = await requireUser(req, res);
        if (!user) {
            // console.warn(
            //     "[POST /api/members/:slug/avatar] blocked: unauthenticated",
            // );
            return;
        }

        const roles = (user.roles || []).map((r) => r.role);
        const isAdminOrModerator = roles.some((r) =>
            ["ADMIN", "MODERATOR"].includes(r),
        );
        if (!isAdminOrModerator) {
            // console.warn(
            //     "[POST /api/members/:slug/avatar] blocked: insufficient permissions",
            //     user.id,
            // );
            return res.status(403).json({
                ok: false,
                error: "Insufficient permissions",
            });
        }

        const member = await prisma.member.findUnique({
            where: { slug: req.params.slug },
        });
        if (!member) {
            // console.warn(
            //     "[POST /api/members/:slug/avatar] member not found for slug",
            //     req.params.slug,
            // );
            return res
                .status(404)
                .json({ ok: false, error: "Member not found" });
        }

        const usersForMember = await prisma.user.findMany({
            where: { memberId: member.id },
            include: { roles: true },
        });

        const isAdminMember = usersForMember.some((u) =>
            (u.roles || []).some((r) => r.role === "ADMIN"),
        );
        if (isAdminMember) {
            // console.warn(
            //     "[POST /api/members/:slug/avatar] blocked: attempt to upload avatar for admin member",
            //     member.id,
            // );
            return res.status(403).json({
                ok: false,
                error: "Cannot modify admin member from this page",
            });
        }

        req._memberForAvatar = member;
        return uploadMemberAvatar.single("avatar")(req, res, (err) => {
            if (err) return next(err);
            return next();
        });
    },
    async (req, res) => {
        const member = req._memberForAvatar;
        if (!req.file) {
            return res
                .status(400)
                .json({ ok: false, error: "No file uploaded" });
        }

        const relPath = `/uploads/avatars/${req.file.filename}`;
        const absUrl = abs(relPath, req);

        try {
            if (
                member.avatarUrl &&
                member.avatarUrl.startsWith("/uploads/avatars/")
            ) {
                const oldFsPath = path.join(
                    UPLOAD_ROOT,
                    member.avatarUrl.replace(/^\/uploads\//, ""),
                );
                if (fs.existsSync(oldFsPath)) {
                    fs.unlinkSync(oldFsPath);
                }
            }
        } catch (err) {
            // console.warn(
            //     "[POST /api/members/:slug/avatar] failed to delete old avatar",
            //     err,
            // );
        }

        await prisma.member.update({
            where: { id: member.id },
            data: { avatarUrl: relPath },
        });

        // console.log(
        //     "[POST /api/members/:slug/avatar] stored avatar for memberId",
        //     member.id,
        //     "at",
        //     absUrl,
        // );

        return res.status(201).json({
            ok: true,
            url: absUrl,
            relativePath: relPath,
        });
    },
);

/* ------------------------------ Projects ------------------------------ */

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
            ? {
                slug: p.event.slug,
                name: p.event.name,
                dateStart: p.event.dateStart,
            }
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

app.post("/api/projects", async (req, res) => {
    // console.log("========== [POST /api/projects] BEGIN ==========");
    // console.log("[POST /api/projects] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn("[POST /api/projects] blocked: unauthenticated");
        // console.log(
        //     "========== [POST /api/projects] END (unauthenticated) ==========",
        // );
        return;
    }

    const userRoles = (user.roles || []).map((r) => r.role);
    // console.log(
    //     "[POST /api/projects] authenticated user id =",
    //     user.id,
    //     "roles =",
    //     userRoles,
    // );

    const hasMemberRole = userRoles.some((r) =>
        ["ADMIN", "MODERATOR", "MEMBER"].includes(r),
    );
    if (!hasMemberRole) {
        // console.warn(
        //     "[POST /api/projects] blocked: insufficient role for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [POST /api/projects] END (forbidden) ==========",
        // );
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
        // console.warn(
        //     "[POST /api/projects] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/projects] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;
    // console.log("[POST /api/projects] parsed data (without photos) =", {
    //     title: d.title,
    //     year: d.year,
    //     status: d.status,
    //     summary: d.summary ? d.summary.slice(0, 100) + "…" : null,
    //     demoUrl: d.demoUrl || null,
    //     repoUrl: d.repoUrl || null,
    //     techStackCount: Array.isArray(d.techStack)
    //         ? d.techStack.length
    //         : 0,
    //     tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
    //     membersCount: Array.isArray(d.members) ? d.members.length : 0,
    //     blogSlugsCount: Array.isArray(d.blogSlugs)
    //         ? d.blogSlugs.length
    //         : 0,
    //     eventSlugsCount: Array.isArray(d.eventSlugs)
    //         ? d.eventSlugs.length
    //         : 0,
    //     linksCount: Array.isArray(d.links) ? d.links.length : 0,
    // });

    const rawMembers = Array.isArray(d.members) ? d.members : [];
    rawMembers.forEach((m, idx) => {
        // console.log(`[POST /api/projects] members[${idx}] =`, m);
    });

    const slug = await uniqueProjectSlug(d.title);
    // console.log("[POST /api/projects] generated slug =", slug);

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

    // console.log("[POST /api/projects] creating project record in DB…");
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

    // console.log("[POST /api/projects] created project id =", project.id);

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
        // console.log(
        //     "[POST /api/projects] linking related blogs by slugs =",
        //     blogSlugs,
        // );
        const blogs = await prisma.blog.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true, slug: true },
        });
        // console.log(
        //     "[POST /api/projects] found blogs for relation =",
        //     blogs.map((b) => b.slug),
        // );

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
        // console.log(
        //     "[POST /api/projects] linking related events by slugs =",
        //     eventSlugs,
        // );
        const events = await prisma.event.findMany({
            where: { slug: { in: eventSlugs } },
            select: { id: true, slug: true },
        });
        // console.log(
        //     "[POST /api/projects] found events for relation =",
        //     events.map((e) => e.slug),
        // );
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

    const membersWithId = rawMembers.filter(
        (m) =>
            m &&
            typeof m === "object" &&
            typeof m.memberId === "string",
    );
    const creatorMemberId =
        user && user.member && user.member.id ? user.member.id : null;

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
            // console.error(
            //     "[POST /api/projects] failed to create memberProject CREATOR record",
            //     err,
            // );
        }
    } else {
        // console.log(
        //     "[POST /api/projects] user has no member profile; skipping creator memberProject",
        // );
    }

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
            // console.error(
            //     "[POST /api/projects] failed to create memberProject row for memberId",
            //     m.memberId,
            //     err,
            // );
        }
    }

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
        // console.log(
        //     "[POST /api/projects] looking up users for memberIds =",
        //     memberIdsFromPayload,
        // );
        const usersForMembers = await prisma.user.findMany({
            where: { memberId: { in: memberIdsFromPayload } },
            select: { email: true, memberId: true },
        });
        // console.log(
        //     "[POST /api/projects] usersForMembers =",
        //     usersForMembers,
        // );
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
    // console.log("[POST /api/projects] final invite specs =", invites);

    if (invites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const projectUrl = `${webBase}/projects/${project.slug}`;

        for (const inv of invites) {
            const email = inv.email;
            const roleLabel = inv.role || "Contributor";

            // console.log(
            //     "[POST /api/projects] creating invite for email =",
            //     email,
            // );
            const { raw, hash } = genInviteToken();
            // console.log(
            //     "[POST /api/projects] generated invite token (hash only logged) tokenHash =",
            //     hash,
            // );

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

    // console.log("========== [POST /api/projects] END (success) ==========");
    return res
        .status(201)
        .json({ ok: true, slug: project.slug, id: project.id });
});

app.put("/api/projects/:slug", async (req, res) => {
    // console.log("========== [PUT /api/projects/:slug] BEGIN ==========");
    // console.log("[PUT /api/projects/:slug] slug =", req.params.slug);
    // console.log(
    //     "[PUT /api/projects/:slug] raw body =",
    //     JSON.stringify(req.body),
    // );

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[PUT /api/projects/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [PUT /api/projects/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const userRoles = (user.roles || []).map((r) => r.role);
    // console.log(
    //     "[PUT /api/projects/:slug] authenticated user id =",
    //     user.id,
    //     "roles =",
    //     userRoles,
    // );

    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: {
            members: true,
            invites: true,
        },
    });

    if (!project) {
        // console.warn(
        //     "[PUT /api/projects/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [PUT /api/projects/:slug] END (not found) ==========",
        // );
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
        // console.warn(
        //     "[PUT /api/projects/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [PUT /api/projects/:slug] END (forbidden) ==========",
        // );
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
        // console.warn(
        //     "[PUT /api/projects/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [PUT /api/projects/:slug] END (validation error) ==========",
        // );
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

    // console.log("[PUT /api/projects/:slug] parsed data (without photos) =", {
    //     title: d.title,
    //     year: d.year,
    //     status: d.status,
    //     summary: d.summary ? d.summary.slice(0, 100) + "…" : null,
    //     demoUrl: d.demoUrl || null,
    //     repoUrl: d.repoUrl || null,
    //     techStackCount: Array.isArray(d.techStack)
    //         ? d.techStack.length
    //         : 0,
    //     tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
    //     hasBlogSlugs,
    //     blogSlugsCount: Array.isArray(d.blogSlugs)
    //         ? d.blogSlugs.length
    //         : 0,
    //     hasMembers,
    //     membersCount: Array.isArray(d.members)
    //         ? d.members.length
    //         : 0,
    //     hasEventSlugs,
    //     eventSlugsCount: Array.isArray(d.eventSlugs)
    //         ? d.eventSlugs.length
    //         : 0,
    //     hasLinks,
    //     linksCount: Array.isArray(d.links) ? d.links.length : 0,
    // });

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

    // console.log("[PUT /api/projects/:slug] updating project record in DB…");
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

    // console.log("[PUT /api/projects/:slug] updated project id =", updated.id);

    if (hasTechStack) {
        const techNames = Array.isArray(d.techStack) ? d.techStack : [];
        // console.log(
        //     "[PUT /api/projects/:slug] updating techStack =",
        //     techNames,
        // );
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
        // console.log("[PUT /api/projects/:slug] updating tags =", tagNames);
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
        // console.log(
        //     "[PUT /api/projects/:slug] updating related blogs, slugs =",
        //     blogSlugs,
        // );

        await prisma.projectBlog.deleteMany({
            where: { projectId: updated.id },
        });

        if (blogSlugs.length) {
            const blogs = await prisma.blog.findMany({
                where: { slug: { in: blogSlugs } },
                select: { id: true, slug: true },
            });
            // console.log(
            //     "[PUT /api/projects/:slug] found blogs for new relations =",
            //     blogs.map((b) => b.slug),
            // );

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
        // console.log(
        //     "[PUT /api/projects/:slug] updating related events, slugs =",
        //     eventSlugs,
        // );

        await prisma.eventProject.deleteMany({
            where: { projectId: updated.id },
        });

        if (eventSlugs.length) {
            const events = await prisma.event.findMany({
                where: { slug: { in: eventSlugs } },
                select: { id: true, slug: true },
            });
            // console.log(
            //     "[PUT /api/projects/:slug] found events for new relations =",
            //     events.map((e) => e.slug),
            // );

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

    if (hasMembers) {
        const rawMembers = Array.isArray(d.members) ? d.members : [];
        rawMembers.forEach((m, idx) => {
            // console.log(
            //     `[PUT /api/projects/:slug] members[${idx}] =`,
            //     m,
            // );
        });

        const existingInviteEmails = new Set(
            (project.invites || [])
                .map((i) => (i.email || "").toLowerCase())
                .filter((e) => !!e),
        );
        // console.log(
        //     "[PUT /api/projects/:slug] existingInviteEmails =",
        //     Array.from(existingInviteEmails),
        // );

        const existingMemberMap = new Map(
            (project.members || []).map((m) => [m.memberId, m]),
        );

        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
        const memberIdsFromPayload = [];
        const inviteMap = new Map();
        const newMemberIdsSet = new Set();

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
                    // console.log(
                    //     "[PUT /api/projects/:slug] updating memberProject row for memberId",
                    //     memberId,
                    //     "role ->",
                    //     newRole,
                    //     "isCreator ->",
                    //     newIsCreator,
                    // );
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
                    // console.log(
                    //     "[PUT /api/projects/:slug] creating memberProject row for new memberId",
                    //     memberId,
                    // );
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

        for (const existing of project.members || []) {
            if (newMemberIdsSet.has(existing.memberId)) continue;
            if (existing.isCreator) {
                // console.log(
                //     "[PUT /api/projects/:slug] not removing creator memberId",
                //     existing.memberId,
                // );
                continue;
            }
            // console.log(
            //     "[PUT /api/projects/:slug] removing memberProject row for memberId not in payload",
            //     existing.memberId,
            // );
            await prisma.memberProject.delete({
                where: {
                    memberId_projectId: {
                        memberId: existing.memberId,
                        projectId: updated.id,
                    },
                },
            });
        }

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
                // console.log(
                //     "[PUT /api/projects/:slug] skipping already invited email (no re-invite):",
                //     lower,
                // );
                continue;
            }
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }

        if (memberIdsFromPayload.length) {
            // console.log(
            //     "[PUT /api/projects/:slug] looking up users for memberIds =",
            //     memberIdsFromPayload,
            // );
            const usersForMembers = await prisma.user.findMany({
                where: { memberId: { in: memberIdsFromPayload } },
                select: { email: true, memberId: true },
            });
            // console.log(
            //     "[PUT /api/projects/:slug] usersForMembers =",
            //     usersForMembers,
            // );
            for (const u of usersForMembers) {
                if (!u.email) continue;
                const lower = u.email.toLowerCase();
                if (existingInviteEmails.has(lower)) {
                    // console.log(
                    //     "[PUT /api/projects/:slug] skipping already invited member email (no re-invite):",
                    //     lower,
                    // );
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
        // console.log(
        //     "[PUT /api/projects/:slug] final inviteEmails array (new only) =",
        //     invites,
        // );

        if (invites.length) {
            const webBase = WEB_ORIGIN.replace(/\/$/, "");
            const projectUrl = `${webBase}/projects/${updated.slug}`;

            for (const inv of invites) {
                const email = inv.email;
                const roleLabel = inv.role || "Contributor";

                // console.log(
                //     "[PUT /api/projects/:slug] creating invite for email =",
                //     email,
                // );
                const { raw, hash } = genInviteToken();
                // console.log(
                //     "[PUT /api/projects/:slug] generated invite token (hash only logged) tokenHash =",
                //     hash,
                // );

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

    // console.log("========== [PUT /api/projects/:slug] END (success) ==========");
    return res
        .status(200)
        .json({ ok: true, slug: updated.slug, id: updated.id });
});

app.delete("/api/projects/:slug", async (req, res) => {
    // console.log("========== [DELETE /api/projects/:slug] BEGIN ==========");
    // console.log("[DELETE /api/projects/:slug] slug =", req.params.slug);

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[DELETE /api/projects/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const userRoles = (user.roles || []).map((r) => r.role);
    // console.log(
    //     "[DELETE /api/projects/:slug] authenticated user id =",
    //     user.id,
    //     "roles =",
    //     userRoles,
    // );

    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: {
            members: true,
        },
    });

    if (!project) {
        // console.warn(
        //     "[DELETE /api/projects/:slug] 404 for slug",
        //     req.params.slug,
        // );
    }
    if (!project) {
        // console.warn(
        //     "[DELETE /api/projects/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (not found) ==========",
        // );
        return res
            .status(404)
            .json({ ok: false, error: "Not found" });
    }

    const isAdminOrModerator = userRoles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    let isCreator = false;
    if (user.member && user.member.id) {
        isCreator = (project.members || []).some(
            (m) => m.memberId === user.member.id && !!m.isCreator,
        );
    }

    if (!isAdminOrModerator && !isCreator) {
        // console.warn(
        //     "[DELETE /api/projects/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[DELETE /api/projects/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== project.slug) {
        // console.warn(
        //     "[DELETE /api/projects/:slug] slug confirmation mismatch, got",
        //     confirmSlug,
        //     "expected",
        //     project.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (slug mismatch) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Slug confirmation does not match",
        });
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.projectTech.deleteMany({
                where: { projectId: project.id },
            });
            await tx.projectTag.deleteMany({
                where: { projectId: project.id },
            });
            await tx.projectBlog.deleteMany({
                where: { projectId: project.id },
            });
            await tx.eventProject.deleteMany({
                where: { projectId: project.id },
            });
            await tx.memberProject.deleteMany({
                where: { projectId: project.id },
            });
            await tx.projectInvite.deleteMany({
                where: { projectId: project.id },
            });

            await tx.project.delete({
                where: { id: project.id },
            });
        });

        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (success) ==========",
        // );
        return res.status(200).json({ ok: true });
    } catch (err) {
        // console.error(
        //     "[DELETE /api/projects/:slug] error during deletion",
        //     err,
        // );
        // console.log(
        //     "========== [DELETE /api/projects/:slug] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error: "Failed to delete project",
        });
    }
});

/* --------------------------- Upload: event photo --------------------------- */

const eventPhotoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, eventsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(ext)
            ? ext
            : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});

const uploadEventPhoto = multer({
    storage: eventPhotoStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
            cb(null, true);
        else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photo"));
    },
});

app.post("/api/uploads/event-photo", async (req, res, next) => {
    // console.log("[POST /api/uploads/event-photo] incoming upload");
    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[POST /api/uploads/event-photo] blocked: unauthenticated",
        // );
        return;
    }
    return uploadEventPhoto.single("photo")(req, res, (err) => {
        if (err) return next(err);
        if (!req.file)
            return res
                .status(400)
                .json({ ok: false, error: "No file" });
        const url = abs(`/uploads/events/${req.file.filename}`, req);
        // console.log(
        //     "[POST /api/uploads/event-photo] stored file =",
        //     req.file.filename,
        // );
        return res.status(201).json({ ok: true, url });
    });
});

/* --------------------------- Upload: project photo --------------------------- */

const projectPhotoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, projectsDir),
    filename: (_req, file, cb) => {
        const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/i.test(ext)
            ? ext
            : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});

const uploadProjectPhoto = multer({
    storage: projectPhotoStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 12 },
    fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype))
            cb(null, true);
        else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "photo"));
    },
});

app.post("/api/uploads/project-photo", async (req, res, next) => {
    // console.log("[POST /api/uploads/project-photo] incoming upload");
    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[POST /api/uploads/project-photo] blocked: unauthenticated",
        // );
        return;
    }
    return uploadProjectPhoto.single("photo")(req, res, (err) => {
        if (err) return next(err);
        if (!req.file)
            return res
                .status(400)
                .json({ ok: false, error: "No file" });
        const url = abs(`/uploads/projects/${req.file.filename}`, req);
        // console.log(
        //     "[POST /api/uploads/project-photo] stored file =",
        //     req.file.filename,
        // );
        return res.status(201).json({ ok: true, url });
    });
});

/* --------------------------- Upload: blog photo --------------------------- */
const blogStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, blogsDir),
    filename: (_req, file, cb) => {
        const orig = file.originalname || "unnamed";
        const ext = (orig.split(".").pop() || "bin").toLowerCase();
        const safeExt = /^(png|jpg|jpeg|webp|gif)$/.test(ext) ? ext : "bin";
        const name = `${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
        cb(null, name);
    },
});

const uploadBlogPhoto = multer({
    storage: blogStorage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 }, // 8 MB, expect a single "photo"
    fileFilter: (req, file, cb) => {
        // console.log("[uploadBlogPhoto.fileFilter] fieldname =", file.fieldname);
        // console.log(
        //     "[uploadBlogPhoto.fileFilter] originalname =",
        //     file.originalname,
        //     "mimetype =",
        //     file.mimetype,
        // );

        // When no file is actually chosen, some clients send an empty part
        // with mimetype application/octet-stream and no filename.
        const noRealFile =
            !file.originalname ||
            file.mimetype === "application/octet-stream";

        if (noRealFile) {
            // console.log(
            //     "[uploadBlogPhoto.fileFilter] detected empty file field; skipping file",
            // );
            // Tell Multer to silently skip this "file" instead of throwing.
            return cb(null, false);
        }

        if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
            // console.log(
            //     "[uploadBlogPhoto.fileFilter] accepting file with mimetype",
            //     file.mimetype,
            // );
            return cb(null, true);
        }

        // console.warn(
        //     "[uploadBlogPhoto.fileFilter] rejecting file due to unsupported mimetype:",
        //     file.mimetype,
        // );
        const err = new Error("Unsupported file type");
        err.code = "UNSUPPORTED_FILE_TYPE";
        return cb(err);
    },
});

app.post("/api/uploads/blog-photo", async (req, res) => {
    // console.log("========== [POST /api/uploads/blog-photo] BEGIN ==========");
    // console.log(
    //     "[POST /api/uploads/blog-photo] headers.content-type =",
    //     req.headers["content-type"],
    // );
    // console.log(
    //     "[POST /api/uploads/blog-photo] query =",
    //     JSON.stringify(req.query),
    // );

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[POST /api/uploads/blog-photo] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [POST /api/uploads/blog-photo] END (unauthenticated) ==========",
        // );
        return;
    }

    // console.log(
    //     "[POST /api/uploads/blog-photo] authenticated user id =",
    //     user.id,
    //     "email =",
    //     user.email,
    // );

    uploadBlogPhoto.single("photo")(req, res, (err) => {
        if (err) {
            // console.error(
            //     "[POST /api/uploads/blog-photo] Multer/fileFilter error =",
            //     err && err.stack ? err.stack : err,
            // );

            if (err.code === "UNSUPPORTED_FILE_TYPE") {
                // console.log(
                //     "========== [POST /api/uploads/blog-photo] END (unsupported file type) ==========",
                // );
                return res
                    .status(400)
                    .json({ ok: false, error: "Unsupported file type" });
            }

            // console.log(
            //     "========== [POST /api/uploads/blog-photo] END (multer error) ==========",
            // );
            return res
                .status(400)
                .json({ ok: false, error: "Upload failed" });
        }

        if (!req.file) {
            // console.warn(
            //     "[POST /api/uploads/blog-photo] no file accepted by Multer (empty field or filtered out)",
            // );
            // console.log(
            //     "========== [POST /api/uploads/blog-photo] END (no file) ==========",
            // );
            return res
                .status(400)
                .json({ ok: false, error: "No file uploaded" });
        }

        const url = abs(`/uploads/blogs/${req.file.filename}`, req);
        // console.log(
        //     "[POST /api/uploads/blog-photo] stored file =",
        //     req.file.filename,
        //     "-> url =",
        //     url,
        // );
        // console.log(
        //     "========== [POST /api/uploads/blog-photo] END (success) ==========",
        // );
        return res.status(201).json({ ok: true, url });
    });
});

/* ------------------------------ Contacts ------------------------------ */

function sanitizePlainText(input, { maxLen = 1000 } = {}) {
    const str = (input ?? "").toString();
    // Strip HTML tags & scripts
    const noHtml = xss(str, {
        whiteList: {}, // no tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script", "style", "iframe", "object"],
    });
    // Trim and clamp length
    return noHtml.trim().slice(0, maxLen);
}

function sanitizeEmailInput(input) {
    const str = (input ?? "").toString().trim();
    if (!validator.isEmail(str)) return "";
    // Ensure canonical, lower-cased email
    return (
        validator.normalizeEmail(str, { gmail_remove_dots: false }) ||
        str.toLowerCase()
    );
}

function sanitizeHeaderValue(input) {
    // Prevent header injection (\r, \n, etc.)
    return (input ?? "")
        .toString()
        .replace(/(\r|\n)/g, " ")
        .slice(0, 255)
        .trim();
}

/**
 * Anti-abuse: don't send mail "from" arbitrary user addresses.
 * We always send FROM our domain, and use Reply-To with the user email.
 */
function safeReplyTo(email) {
    const trimmed = (email || "").trim();
    const valid = validator.isEmail(trimmed);
    return valid ? trimmed : undefined;
}

const contactSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    role: z.string().min(1).max(100),
    topic: z.string().min(1).max(100),
    message: z.string().min(10).max(10_000),
    subscribe: z.boolean().optional().default(false),
    source: z.string().max(100).optional().nullable(),
    // NOTE: honeypot will be accepted from frontend but ignored here;
    // rate limiting & server-side protection happens below.
});

const newsletterSubscribeSchema = z.object({
    email: z.string().email(),
    name: z.string().max(200).optional().nullable(),
    source: z.string().max(100).optional().nullable(),
});

const newsletterVerifySchema = z.object({
    token: z.string().min(10),
});

const newsletterUnsubscribeSchema = z.object({
    token: z.string().min(10),
});

function signNewsletterVerifyToken(subscriber) {
    // subscriber: { id, email }
    return jwt.sign(
        {
            sub: subscriber.id,
            email: subscriber.email,
            scope: "newsletter-verify",
        },
        NEWSLETTER_SECRET,
        {
            algorithm: "HS256",
            expiresIn: "7d",
        },
    );
}

function signNewsletterUnsubToken(subscriber) {
    // subscriber: { id, email }
    return jwt.sign(
        {
            sub: subscriber.id,
            email: subscriber.email,
            scope: "newsletter-unsub",
        },
        NEWSLETTER_SECRET,
        {
            algorithm: "HS256",
            expiresIn: "180d",
        },
    );
}

/**
 * Lightweight per-IP rate limiting for contact + newsletter endpoints
 * to prevent mailbox floods / abuse. This is in addition to the global
 * express-rate-limit you already have.
 */
const CONTACT_WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const CONTACT_MAX_PER_IP = 3;

const contactIpBuckets = new Map();
/**
 * Returns true if this IP is allowed, false if blocked.
 */
function allowContactFromIp(ip) {
    const now = Date.now();
    const bucket = contactIpBuckets.get(ip) || [];
    const recent = bucket.filter((t) => now - t < CONTACT_WINDOW_MS);
    if (recent.length >= CONTACT_MAX_PER_IP) {
        return false;
    }
    recent.push(now);
    contactIpBuckets.set(ip, recent);
    return true;
}

function clientIp(req) {
    return (
        (req.headers["x-forwarded-for"] || "")
            .toString()
            .split(",")[0]
            .trim() ||
        req.ip ||
        "unknown"
    );
}

app.post("/api/contact", async (req, res) => {
    // console.log("========== [POST /api/contact] BEGIN ==========");
    // console.log("[POST /api/contact] raw body =", JSON.stringify(req.body));

    // Per-IP rate limit to protect mailbox / DB
    const ip = clientIp(req);
    if (!allowContactFromIp(ip)) {
        // console.warn("[POST /api/contact] rate-limit hit for IP", ip);
        return res.status(429).json({
            ok: false,
            error:
                "Too many contact requests from this IP. Please try again later.",
        });
    }

    // 1) Validate input
    const parsed = contactSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[POST /api/contact] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/contact] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    // 2) Sanitize user-controlled fields before using them anywhere (mail, DB, logs)
    const raw = parsed.data;
    const name = sanitizePlainText(raw.name, { maxLen: 200 });
    const email = sanitizeEmailInput(raw.email);
    const role = sanitizePlainText(raw.role, { maxLen: 100 });
    const topic = sanitizePlainText(raw.topic, { maxLen: 100 });
    const message = sanitizePlainText(raw.message, { maxLen: 10_000 });
    const subscribe = !!raw.subscribe;
    const source = raw.source
        ? sanitizePlainText(raw.source, { maxLen: 100 })
        : null;

    if (!email) {
        // console.warn("[POST /api/contact] sanitized email invalid");
        return res.status(400).json({
            ok: false,
            error: "Invalid email address.",
        });
    }

    // 3) Send email to your team (FROM your domain, Reply-To user)
    try {
        const toAddress = MAIL_FROM || "contact@the-pum.com";

        const subject = sanitizeHeaderValue(
            `[PUM contact] ${topic} — ${name} (${role})`,
        );

        const text = `New contact form submission:

Name: ${name}
Email: ${email}
Role: ${role}
Topic: ${topic}
Subscribe to newsletter: ${subscribe ? "YES" : "no"}
Source: ${source || "n/a"}
IP: ${ip}

Message:
${message}
`;

        if (!mailTransporter) {
            // console.log(
            //     "[POST /api/contact] (no SMTP configured) Would send mail from",
            //     MAIL_FROM,
            //     "to",
            //     toAddress,
            //     ":\nSubject:",
            //     subject,
            //     "\n\n",
            //     text,
            // );
        } else {
            // console.log("[POST /api/contact] sending mail to", toAddress);
            await mailTransporter.sendMail({
                from: MAIL_FROM,
                to: toAddress,
                replyTo: safeReplyTo(email), // key: avoid spoofing FROM user email
                subject,
                text, // text-only, sanitized
            });
            // console.log("[POST /api/contact] mail sent OK");
        }
    } catch (err) {
        // console.error("[POST /api/contact] mail send error", err);
        // Don't fail the whole request – just log.
    }

    // 4) Optionally store the contact message in DB
    try {
        if (prisma.contactMessage) {
            await prisma.contactMessage.create({
                data: {
                    name,
                    email,
                    role,
                    topic,
                    message,
                    source: source || null,
                    subscribeRequested: !!subscribe,
                    ipAddress: ip,
                },
            });
        }
    } catch (err) {
        // console.error(
        //     "[POST /api/contact] failed to store contactMessage in DB",
        //     err,
        // );
    }

    // 5) Newsletter subscription (if requested)
    try {
        if (subscribe && prisma.newsletterSubscriber) {
            const emailLower = email.toLowerCase();

            // Upsert subscriber but DO NOT auto-verify;
            // keep verifiedAt as-is or null.
            const existing = await prisma.newsletterSubscriber.findUnique({
                where: { email: emailLower },
            });

            let sub;
            if (!existing) {
                sub = await prisma.newsletterSubscriber.create({
                    data: {
                        email: emailLower,
                        name,
                        lastSource: source || "contact-form",
                        unsubscribedAt: null,
                        verifiedAt: null,
                    },
                });
                // console.log(
                //     "[POST /api/contact] created new newsletterSubscriber",
                //     sub.id,
                // );
            } else {
                // If previously unsubscribed, DO NOT silently re-subscribe
                if (existing.unsubscribedAt) {
                    // console.log(
                    //     "[POST /api/contact] email previously unsubscribed; not auto-resubscribing",
                    //     emailLower,
                    // );
                    sub = existing;
                } else {
                    sub = await prisma.newsletterSubscriber.update({
                        where: { email: emailLower },
                        data: {
                            name,
                            lastSource: source || "contact-form",
                        },
                    });
                    // console.log(
                    //     "[POST /api/contact] updated existing newsletterSubscriber",
                    //     sub.id,
                    // );
                }
            }

            // Only send verification email if:
            // - They are not yet verified
            // - They are not unsubscribed
            if (!sub.unsubscribedAt && !sub.verifiedAt && mailTransporter) {
                const webBase = WEB_ORIGIN.replace(/\/$/, "");
                const verifyToken = signNewsletterVerifyToken({
                    id: sub.id,
                    email: sub.email,
                });
                const verifyUrl = `${webBase}/newsletter/verify?token=${encodeURIComponent(
                    verifyToken,
                )}`;

                const subject = sanitizeHeaderValue(
                    "Please confirm your subscription to PUM updates",
                );
                const text = `Hi${sub.name ? " " + sub.name : ""},

Thanks for staying in touch with PUM!

Please confirm your subscription by clicking the link below:
${verifyUrl}

If you did not request this, you can safely ignore this email and you won't be subscribed.
`;

                try {
                    await mailTransporter.sendMail({
                        from: MAIL_FROM,
                        to: sub.email,
                        subject,
                        text,
                    });
                    // console.log(
                    //     "[POST /api/contact] sent newsletter verification email to",
                    //     sub.email,
                    // );
                } catch (err) {
                    // console.error(
                    //     "[POST /api/contact] failed to send newsletter verification email",
                    //     err,
                    // );
                }
            } else {
                // console.log(
                //     "[POST /api/contact] subscriber already verified or unsubscribed; no verify email sent",
                //     emailLower,
                // );
            }
        }
    } catch (err) {
        // console.error(
        //     "[POST /api/contact] failed to upsert/send newsletterSubscriber",
        //     err,
        // );
    }

    // console.log("========== [POST /api/contact] END (success) ==========");
    return res.json({
        ok: true,
        message: "Thanks! We’ll be in touch soon.",
    });
});

/* ------------------------------ Newsletter: subscribe / verify / unsubscribe ------------------------------ */

app.post("/api/newsletter/subscribe", async (req, res) => {
    // console.log(
    //     "========== [POST /api/newsletter/subscribe] BEGIN ==========",
    // );
    // console.log(
    //     "[POST /api/newsletter/subscribe] raw body =",
    //     JSON.stringify(req.body),
    // );

    if (!prisma.newsletterSubscriber) {
        // console.warn(
        //     "[POST /api/newsletter/subscribe] NewsletterSubscriber model not available",
        // );
        return res.status(501).json({
            ok: false,
            error: "Newsletter feature not enabled on this server",
        });
    }

    // Additional per-IP rate limit to avoid abuse
    const ip = clientIp(req);
    if (!allowContactFromIp(ip)) {
        // console.warn(
        //     "[POST /api/newsletter/subscribe] rate-limit hit for IP",
        //     ip,
        // );
        return res.status(429).json({
            ok: false,
            error:
                "Too many subscription requests from this IP. Please try again later.",
        });
    }

    const parsed = newsletterSubscribeSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[POST /api/newsletter/subscribe] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/newsletter/subscribe] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    // Sanitize
    const raw = parsed.data;
    const email = sanitizeEmailInput(raw.email);
    const name = raw.name
        ? sanitizePlainText(raw.name, { maxLen: 200 })
        : null;
    const source = raw.source
        ? sanitizePlainText(raw.source, { maxLen: 100 })
        : null;

    if (!email) {
        // console.warn(
        //     "[POST /api/newsletter/subscribe] sanitized email invalid",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid email address.",
        });
    }

    const emailLower = email.toLowerCase();

    try {
        let sub = await prisma.newsletterSubscriber.findUnique({
            where: { email: emailLower },
        });

        if (!sub) {
            sub = await prisma.newsletterSubscriber.create({
                data: {
                    email: emailLower,
                    name: name || null,
                    lastSource: source || "newsletter-form",
                    unsubscribedAt: null,
                    verifiedAt: null,
                },
            });
            // console.log(
            //     "[POST /api/newsletter/subscribe] created subscriber id =",
            //     sub.id,
            // );
        } else {
            // If unsubscribed, *do not* auto-resub; require manual flow if you want that.
            if (sub.unsubscribedAt) {
                // console.log(
                //     "[POST /api/newsletter/subscribe] email previously unsubscribed; not auto-resubscribing",
                //     emailLower,
                // );
            } else {
                sub = await prisma.newsletterSubscriber.update({
                    where: { email: emailLower },
                    data: {
                        name: name || sub.name,
                        lastSource:
                            source || sub.lastSource || "newsletter-form",
                    },
                });
                // console.log(
                //     "[POST /api/newsletter/subscribe] updated subscriber id =",
                //     sub.id,
                // );
            }
        }

        // Send verification email only if not yet verified and not unsubscribed
        if (!sub.unsubscribedAt && !sub.verifiedAt && mailTransporter) {
            const webBase = WEB_ORIGIN.replace(/\/$/, "");
            const verifyToken = signNewsletterVerifyToken({
                id: sub.id,
                email: sub.email,
            });
            const verifyUrl = `${webBase}/newsletter/verify?token=${encodeURIComponent(
                verifyToken,
            )}`;

            const subject = sanitizeHeaderValue(
                "Please confirm your subscription to PUM updates",
            );
            const text = `Hi${sub.name ? " " + sub.name : ""},

Thanks for staying in touch with PUM!

Please confirm your subscription by clicking the link below:
${verifyUrl}

If you did not request this, you can safely ignore this email and you won't be subscribed.
`;

            try {
                await mailTransporter.sendMail({
                    from: MAIL_FROM,
                    to: sub.email,
                    subject,
                    text,
                });
                // console.log(
                //     "[POST /api/newsletter/subscribe] sent verification email to",
                //     sub.email,
                // );
            } catch (err) {
                // console.error(
                //     "[POST /api/newsletter/subscribe] failed to send verification email",
                //     err,
                // );
            }
        } else {
            // console.log(
            //     "[POST /api/newsletter/subscribe] subscriber already verified or unsubscribed; no verify email sent",
            // );
        }

        // console.log(
        //     "========== [POST /api/newsletter/subscribe] END (success) ==========",
        // );
        return res.json({
            ok: true,
            email: sub.email,
            status: sub.verifiedAt
                ? "already-verified"
                : "pending-verification",
        });
    } catch (err) {
        // console.error(
        //     "[POST /api/newsletter/subscribe] DB error during upsert",
        //     err,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/subscribe] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error: "Failed to subscribe. Please try again later.",
        });
    }
});

app.post("/api/newsletter/verify", async (req, res) => {
    // console.log(
    //     "========== [POST /api/newsletter/verify] BEGIN ==========",
    // );
    // console.log(
    //     "[POST /api/newsletter/verify] raw body =",
    //     JSON.stringify(req.body),
    // );

    if (!prisma.newsletterSubscriber) {
        // console.warn(
        //     "[POST /api/newsletter/verify] NewsletterSubscriber model not available",
        // );
        return res.status(501).json({
            ok: false,
            error: "Newsletter feature not enabled on this server",
        });
    }

    const parsed = newsletterVerifySchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[POST /api/newsletter/verify] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/newsletter/verify] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid verification token.",
            code: "INVALID_INPUT",
        });
    }

    const { token } = parsed.data;

    let decoded;
    try {
        decoded = jwt.verify(token, NEWSLETTER_SECRET, {
            algorithms: ["HS256"],
        });
    } catch (err) {
        // console.warn(
        //     "[POST /api/newsletter/verify] token verify failed",
        //     err?.name,
        //     err?.message,
        // );

        const isExpired = err && err.name === "TokenExpiredError";
        // console.log(
        //     "========== [POST /api/newsletter/verify] END (invalid token) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: isExpired
                ? "This verification link has expired."
                : "This verification link is invalid.",
            code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
        });
    }

    if (!decoded || decoded.scope !== "newsletter-verify") {
        // console.warn(
        //     "[POST /api/newsletter/verify] token missing/invalid scope",
        //     decoded,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/verify] END (bad scope) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "This link is not valid for newsletter verification.",
            code: "BAD_SCOPE",
        });
    }

    const subscriberId = decoded.sub;
    const tokenEmail = (decoded.email || "").toLowerCase();

    try {
        const subscriber = await prisma.newsletterSubscriber.findUnique({
            where: { id: subscriberId },
        });

        if (!subscriber) {
            // console.warn(
            //     "[POST /api/newsletter/verify] subscriber not found for id",
            //     subscriberId,
            // );
            // console.log(
            //     "========== [POST /api/newsletter/verify] END (no subscriber) ==========",
            // );
            return res.status(400).json({
                ok: false,
                error:
                    "We couldn’t find a matching subscription for this link.",
                code: "NOT_FOUND",
            });
        }

        const subEmailLower = (subscriber.email || "").toLowerCase();
        if (tokenEmail && tokenEmail !== subEmailLower) {
            // console.warn(
            //     "[POST /api/newsletter/verify] token email mismatch",
            //     tokenEmail,
            //     "!=",
            //     subEmailLower,
            // );
            return res.status(400).json({
                ok: false,
                error:
                    "This verification link does not match this subscription.",
                code: "EMAIL_MISMATCH",
            });
        }

        // Idempotent: if already verified, just acknowledge.
        if (subscriber.verifiedAt) {
            // console.log(
            //     "[POST /api/newsletter/verify] already verified for email",
            //     subscriber.email,
            // );
            // console.log(
            //     "========== [POST /api/newsletter/verify] END (already verified) ==========",
            // );
            return res.json({
                ok: true,
                status: "already-verified",
                email: subscriber.email,
            });
        }

        // If unsubscribed, don't verify – treat as invalid.
        if (subscriber.unsubscribedAt) {
            // console.log(
            //     "[POST /api/newsletter/verify] subscriber is unsubscribed; refusing verification",
            //     subscriber.email,
            // );
            return res.status(400).json({
                ok: false,
                error:
                    "This subscription was cancelled and cannot be verified.",
                code: "UNSUBSCRIBED",
            });
        }

        const updated = await prisma.newsletterSubscriber.update({
            where: { id: subscriber.id },
            data: {
                verifiedAt: new Date(),
                lastSource: "newsletter-verify-link",
            },
        });

        // console.log(
        //     "[POST /api/newsletter/verify] verified email",
        //     updated.email,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/verify] END (success) ==========",
        // );

        return res.json({
            ok: true,
            status: "verified",
            email: updated.email,
        });
    } catch (err) {
        // console.error(
        //     "[POST /api/newsletter/verify] error during verification",
        //     err,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/verify] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error:
                "Failed to verify subscription. Please try again later.",
            code: "SERVER_ERROR",
        });
    }
});

app.post("/api/newsletter/unsubscribe", async (req, res) => {
    // console.log(
    //     "========== [POST /api/newsletter/unsubscribe] BEGIN ==========",
    // );
    // console.log(
    //     "[POST /api/newsletter/unsubscribe] raw body =",
    //     JSON.stringify(req.body),
    // );

    if (!prisma.newsletterSubscriber) {
        // console.warn(
        //     "[POST /api/newsletter/unsubscribe] NewsletterSubscriber model not available",
        // );
        return res.status(501).json({
            ok: false,
            error: "Newsletter feature not enabled on this server",
        });
    }

    const parsed = newsletterUnsubscribeSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[POST /api/newsletter/unsubscribe] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/newsletter/unsubscribe] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid unsubscribe token.",
            code: "INVALID_INPUT",
        });
    }

    const { token } = parsed.data;

    let decoded;
    try {
        decoded = jwt.verify(token, NEWSLETTER_SECRET, {
            algorithms: ["HS256"],
        });
    } catch (err) {
        // console.warn(
        //     "[POST /api/newsletter/unsubscribe] token verify failed",
        //     err?.name,
        //     err?.message,
        // );

        const isExpired = err && err.name === "TokenExpiredError";
        // console.log(
        //     "========== [POST /api/newsletter/unsubscribe] END (invalid token) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: isExpired
                ? "This unsubscribe link has expired."
                : "This unsubscribe link is invalid.",
            code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
        });
    }

    if (!decoded || decoded.scope !== "newsletter-unsub") {
        // console.warn(
        //     "[POST /api/newsletter/unsubscribe] token missing/invalid scope",
        //     decoded,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/unsubscribe] END (bad scope) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error:
                "This unsubscribe link is not valid for newsletter settings.",
            code: "BAD_SCOPE",
        });
    }

    const subscriberId = decoded.sub;
    const tokenEmail = (decoded.email || "").toLowerCase();

    try {
        const subscriber = await prisma.newsletterSubscriber.findUnique({
            where: { id: subscriberId },
        });

        if (!subscriber) {
            // console.warn(
            //     "[POST /api/newsletter/unsubscribe] subscriber not found for id",
            //     subscriberId,
            // );
            // console.log(
            //     "========== [POST /api/newsletter/unsubscribe] END (no subscriber) ==========",
            // );
            return res.status(400).json({
                ok: false,
                error:
                    "We couldn’t find a matching subscription for this link.",
                code: "NOT_FOUND",
            });
        }

        const subEmailLower = (subscriber.email || "").toLowerCase();
        if (tokenEmail && tokenEmail !== subEmailLower) {
            // console.warn(
            //     "[POST /api/newsletter/unsubscribe] token email mismatch",
            //     tokenEmail,
            //     "!=",
            //     subEmailLower,
            // );
            return res.status(400).json({
                ok: false,
                error:
                    "This unsubscribe link does not match this subscription.",
                code: "EMAIL_MISMATCH",
            });
        }

        if (subscriber.unsubscribedAt) {
            // console.log(
            //     "[POST /api/newsletter/unsubscribe] already unsubscribed for email",
            //     subscriber.email,
            // );
            // console.log(
            //     "========== [POST /api/newsletter/unsubscribe] END (already unsubscribed) ==========",
            // );
            return res.json({
                ok: true,
                status: "already-unsubscribed",
                email: subscriber.email,
            });
        }

        const updated = await prisma.newsletterSubscriber.update({
            where: { id: subscriber.id },
            data: {
                unsubscribedAt: new Date(),
                lastSource: "unsubscribe-link",
            },
        });

        // console.log(
        //     "[POST /api/newsletter/unsubscribe] unsubscribed email",
        //     updated.email,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/unsubscribe] END (success) ==========",
        // );

        return res.json({
            ok: true,
            status: "unsubscribed",
            email: updated.email,
        });
    } catch (err) {
        // console.error(
        //     "[POST /api/newsletter/unsubscribe] error during unsubscribe",
        //     err,
        // );
        // console.log(
        //     "========== [POST /api/newsletter/unsubscribe] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error:
                "Failed to update subscription. Please try again later.",
            code: "SERVER_ERROR",
        });
    }
});

/* ------------------------------ Blogs ------------------------------ */

const blogCreateSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(2000).optional().nullable(),
    content: z.string().max(100_000).optional().nullable(),
    publishedAt: z.string().optional().nullable(),
    photos: z.array(z.string().url()).max(20).optional(),
    techStack: z
        .array(z.string().min(1).max(40))
        .max(50)
        .optional(),
    tags: z
        .array(z.string().min(1).max(40))
        .max(50)
        .optional(),
    authorSlugs: z.array(z.string().min(1)).max(50).optional(),
    projectSlugs: z.array(z.string().min(1)).max(200).optional(),
    eventSlugs: z.array(z.string().min(1)).max(200).optional(),
});

async function uniqueBlogSlug(base) {
    const b =
        slugify(base || "blog", { lower: true, strict: true }) ||
        "blog";
    let slug = b;
    let i = 1;
    while (await prisma.blog.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

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
                // NEW: include related projects so we can surface projectSlugs
                projects: {
                    include: {
                        project: {
                            select: {
                                slug: true,
                            },
                        },
                    },
                },
                // NEW: include related events so we can surface eventSlugs
                events: {
                    include: {
                        event: {
                            select: {
                                slug: true,
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
                role:
                    typeof r.role === "string" && r.role.trim()
                        ? r.role.trim()
                        : null,
            })),
            // NEW: expose projectSlugs on each blog
            projectSlugs: Array.isArray(b.projects)
                ? b.projects
                    .map((pb) => pb.project)
                    .filter(Boolean)
                    .map((p) => p.slug)
                : [],
            // NEW: expose eventSlugs on each blog
            eventSlugs: Array.isArray(b.events)
                ? b.events
                    .map((eb) => eb.event)
                    .filter(Boolean)
                    .map((e) => e.slug)
                : [],
        })),
        page,
        size,
        total,
    });
});

app.get("/api/blogs/:slug", async (req, res) => {
    const b = await prisma.blog.findUnique({
        where: { slug: req.params.slug },
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
            // NEW: include related projects so we can return projectSlugs
            projects: {
                include: {
                    project: {
                        select: {
                            slug: true,
                        },
                    },
                },
            },
            // NEW: include related events so we can return eventSlugs
            events: {
                include: {
                    event: {
                        select: {
                            slug: true,
                        },
                    },
                },
            },
        },
    });
    if (!b) return res.status(404).json({ error: "Not found" });

    const images = Array.isArray(b.images) ? b.images : [];
    const cover =
        b.cover || b.imageUrl || (images.length ? images[0] : null);

    res.json({
        id: b.id,
        slug: b.slug,
        title: b.title,
        summary: b.summary || null,
        content: b.content || null,
        cover: abs(cover, req),
        imageUrl: abs(b.imageUrl || cover || null, req),
        images: images.map((u) => abs(u, req)),
        publishedAt: b.publishedAt || null,
        techStack: b.techs.map((x) => x.tech.name),
        tags: b.tags.map((x) => x.tag.name),
        authors: (b.authors || []).map((r) => ({
            slug: r.member.slug,
            name: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
            headline: r.member.headline || null,
            role:
                typeof r.role === "string" && r.role.trim()
                    ? r.role.trim()
                    : null,
        })),
        // NEW: projectSlugs for this blog – used by detail page and editor form
        projectSlugs: Array.isArray(b.projects)
            ? b.projects
                .map((pb) => pb.project)
                .filter(Boolean)
                .map((p) => p.slug)
            : [],
        // NEW: eventSlugs for this blog – used by detail page and editor form
        eventSlugs: Array.isArray(b.events)
            ? b.events
                .map((eb) => eb.event)
                .filter(Boolean)
                .map((e) => e.slug)
            : [],
    });
});

app.post("/api/blogs", async (req, res) => {
    // console.log("========== [POST /api/blogs] BEGIN ==========");
    // console.log("[POST /api/blogs] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn("[POST /api/blogs] blocked: unauthenticated");
        // console.log(
        //     "========== [POST /api/blogs] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    const hasMemberRole = roles.some((r) =>
        ["ADMIN", "MODERATOR", "MEMBER"].includes(r),
    );
    if (!hasMemberRole) {
        // console.warn(
        //     "[POST /api/blogs] blocked: insufficient permissions",
        // );
        // console.log(
        //     "========== [POST /api/blogs] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = blogCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[POST /api/blogs] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/blogs] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;
    // console.log("[POST /api/blogs] parsed data =", {
    //     title: d.title,
    //     hasSummary: !!d.summary,
    //     hasContent: !!d.content,
    //     publishedAt: d.publishedAt || null,
    //     techStackCount: Array.isArray(d.techStack)
    //         ? d.techStack.length
    //         : 0,
    //     tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
    //     authorSlugsCount: Array.isArray(d.authorSlugs)
    //         ? d.authorSlugs.length
    //         : 0,
    //     projectSlugsCount: Array.isArray(d.projectSlugs)
    //         ? d.projectSlugs.length
    //         : 0,
    //     eventSlugsCount: Array.isArray(d.eventSlugs)
    //         ? d.eventSlugs.length
    //         : 0,
    //     photosCount: Array.isArray(d.photos) ? d.photos.length : 0,
    // });

    const slug = await uniqueBlogSlug(d.title);
    // console.log("[POST /api/blogs] generated slug =", slug);

    const photos = Array.isArray(d.photos) ? d.photos : [];
    const coverRel = photos.length ? photos[0] : null;
    const imagesRel = photos;

    const publishedAt =
        d.publishedAt && typeof d.publishedAt === "string"
            ? new Date(d.publishedAt)
            : null;

    const blog = await prisma.blog.create({
        data: {
            slug,
            title: d.title,
            summary: d.summary || null,
            content: d.content || null,
            publishedAt:
                publishedAt && !Number.isNaN(publishedAt.getTime())
                    ? publishedAt
                    : null,
            cover: coverRel,
            imageUrl: coverRel,
            images: imagesRel,
        },
    });

    // console.log("[POST /api/blogs] created blog id =", blog.id);

    const techNames = Array.isArray(d.techStack) ? d.techStack : [];
    if (techNames.length) {
        const techIds = await upsertStringList(techNames, "tech");
        if (techIds.length) {
            await prisma.blogTech.createMany({
                data: techIds.map((id) => ({
                    blogId: blog.id,
                    techId: id,
                })),
                skipDuplicates: true,
            });
        }
    }

    const tagNames = Array.isArray(d.tags) ? d.tags : [];
    if (tagNames.length) {
        const tagIds = await upsertStringList(tagNames, "tag");
        if (tagIds.length) {
            await prisma.blogTag.createMany({
                data: tagIds.map((id) => ({
                    blogId: blog.id,
                    tagId: id,
                })),
                skipDuplicates: true,
            });
        }
    }

    const creatorMemberId =
        user && user.member && user.member.id ? user.member.id : null;
    const authorSlugSet = new Set(
        Array.isArray(d.authorSlugs)
            ? d.authorSlugs
                .map((s) => String(s || "").trim())
                .filter(Boolean)
            : [],
    );

    if (user && user.member && user.member.slug) {
        authorSlugSet.add(user.member.slug);
    }

    if (authorSlugSet.size) {
        const authorSlugs = Array.from(authorSlugSet);
        const members = await prisma.member.findMany({
            where: { slug: { in: authorSlugs } },
            select: { id: true, slug: true },
        });

        if (members.length) {
            for (const m of members) {
                const role =
                    creatorMemberId && m.id === creatorMemberId
                        ? "CREATOR"
                        : null;
                try {
                    await prisma.blogAuthor.upsert({
                        where: {
                            blogId_memberId: {
                                blogId: blog.id,
                                memberId: m.id,
                            },
                        },
                        create: {
                            blogId: blog.id,
                            memberId: m.id,
                            role,
                        },
                        update: {
                            role,
                        },
                    });
                } catch (err) {
                    // console.error(
                    //     "[POST /api/blogs] failed to upsert blogAuthor for memberId",
                    //     m.id,
                    //     err,
                    // );
                }
            }
        }
    } else if (creatorMemberId) {
        try {
            await prisma.blogAuthor.upsert({
                where: {
                    blogId_memberId: {
                        blogId: blog.id,
                        memberId: creatorMemberId,
                    },
                },
                create: {
                    blogId: blog.id,
                    memberId: creatorMemberId,
                    role: "CREATOR",
                },
                update: {
                    role: "CREATOR",
                },
            });
        } catch (err) {
            // console.error(
            //     "[POST /api/blogs] failed to upsert creator blogAuthor row",
            //     err,
            // );
        }
    }

    const projectSlugs = Array.isArray(d.projectSlugs)
        ? d.projectSlugs
        : [];
    if (projectSlugs.length) {
        const projects = await prisma.project.findMany({
            where: { slug: { in: projectSlugs } },
            select: { id: true, slug: true },
        });

        if (projects.length) {
            await prisma.projectBlog.createMany({
                data: projects.map((p) => ({
                    projectId: p.id,
                    blogId: blog.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    const eventSlugs = Array.isArray(d.eventSlugs)
        ? d.eventSlugs
        : [];
    if (eventSlugs.length) {
        const events = await prisma.event.findMany({
            where: { slug: { in: eventSlugs } },
            select: { id: true, slug: true },
        });

        if (events.length) {
            await prisma.eventBlog.createMany({
                data: events.map((e) => ({
                    eventId: e.id,
                    blogId: blog.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    // -------------- Newsletter sending with secure unsubscribe token --------------
    try {
        if (prisma.newsletterSubscriber && mailTransporter) {
            const subscribers = await prisma.newsletterSubscriber.findMany({
                where: {
                    unsubscribedAt: null,
                    verifiedAt: { not: null },
                },
            });

            if (subscribers.length) {
                const webBase = WEB_ORIGIN.replace(/\/$/, "");
                const blogUrl = `${webBase}/blogs/${blog.slug}`;

                for (const sub of subscribers) {
                    const to = sub.email;
                    if (!to) continue;

                    const unsubToken = signNewsletterUnsubToken({
                        id: sub.id,
                        email: sub.email,
                    });

                    const unsubscribeUrl = `${webBase}/newsletter/unsubscribe?token=${encodeURIComponent(
                        unsubToken,
                    )}`;

                    const subject = `New blog post on PUM: ${blog.title}`;
                    const text = `Hi${sub.name ? " " + sub.name : ""}!

We've just published a new blog post on PUM:

Title: ${blog.title}
${blog.summary ? `\n${blog.summary}\n` : "\n"}

Read it here:
${blogUrl}

You're receiving this because you subscribed to updates from PUM.
If you no longer wish to receive these, you can unsubscribe here:
${unsubscribeUrl}
`;

                    await mailTransporter.sendMail({
                        from: MAIL_FROM,
                        to,
                        subject,
                        text,
                    });
                    // console.log(
                    //     "[POST /api/blogs] newsletter mail sent to subscriber",
                    //     to,
                    // );
                }
            } else {
                // console.log(
                //     "[POST /api/blogs] no newsletterSubscriber rows; skipping newsletter send",
                // );
            }
        } else {
            // console.log(
            //     "[POST /api/blogs] newsletter feature disabled (no newsletterSubscriber model or no SMTP)",
            // );
        }
    } catch (err) {
        // console.error(
        //     "[POST /api/blogs] failed to send newsletter emails",
        //     err,
        // );
    }

    // console.log("========== [POST /api/blogs] END (success) ==========");
    return res
        .status(201)
        .json({ ok: true, slug: blog.slug, id: blog.id });
});

app.put("/api/blogs/:slug", async (req, res) => {
    // console.log("========== [PUT /api/blogs/:slug] BEGIN ==========");
    // console.log("[PUT /api/blogs/:slug] slug =", req.params.slug);
    // console.log(
    //     "[PUT /api/blogs/:slug] raw body =",
    //     JSON.stringify(req.body),
    // );

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[PUT /api/blogs/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [PUT /api/blogs/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    // console.log(
    //     "[PUT /api/blogs/:slug] authenticated user id =",
    //     user.id,
    //     "roles =",
    //     roles,
    // );

    const blog = await prisma.blog.findUnique({
        where: { slug: req.params.slug },
        include: {
            authors: {
                include: {
                    member: { select: { id: true, slug: true } },
                },
            },
        },
    });

    if (!blog) {
        // console.warn(
        //     "[PUT /api/blogs/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [PUT /api/blogs/:slug] END (not found) ==========",
        // );
        return res
            .status(404)
            .json({ ok: false, error: "Not found" });
    }

    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    const authors = Array.isArray(blog.authors) ? blog.authors : [];
    const hasAnyAuthor = authors.length > 0;

    const userMemberId = user.member?.id || null;
    const isAuthor =
        !!userMemberId &&
        authors.some((a) => a.memberId === userMemberId);

    // 🟢 THIS IS THE IMPORTANT CHANGE:
    // - Admin / moderator can edit any blog
    // - Otherwise, ANY author of the blog can edit (not just "CREATOR")
    let canEdit = isAdminOrModerator;

    if (!canEdit) {
        if (hasAnyAuthor) {
            canEdit = isAuthor;
        } else {
            canEdit = false;
        }
    }

    if (!canEdit) {
        // console.warn(
        //     "[PUT /api/blogs/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [PUT /api/blogs/:slug] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = blogCreateSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[PUT /api/blogs/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [PUT /api/blogs/:slug] END (validation error) ==========",
        // );
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
    const hasAuthorSlugs = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "authorSlugs",
    );
    const hasProjectSlugs = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "projectSlugs",
    );
    const hasEventSlugs = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "eventSlugs",
    );

    // console.log("[PUT /api/blogs/:slug] parsed data =", {
    //     title: d.title,
    //     hasSummary: !!d.summary,
    //     hasContent: !!d.content,
    //     publishedAt: d.publishedAt || null,
    //     hasTechStack,
    //     techStackCount: Array.isArray(d.techStack)
    //         ? d.techStack.length
    //         : 0,
    //     hasTags,
    //     tagsCount: Array.isArray(d.tags) ? d.tags.length : 0,
    //     hasAuthorSlugs,
    //     authorSlugsCount: Array.isArray(d.authorSlugs)
    //         ? d.authorSlugs.length
    //         : 0,
    //     hasProjectSlugs,
    //     projectSlugsCount: Array.isArray(d.projectSlugs)
    //         ? d.projectSlugs.length
    //         : 0,
    //     hasEventSlugs,
    //     eventSlugsCount: Array.isArray(d.eventSlugs)
    //         ? d.eventSlugs.length
    //         : 0,
    //     photosCount: Array.isArray(d.photos) ? d.photos.length : 0,
    // });

    const photos = Array.isArray(d.photos)
        ? d.photos
        : Array.isArray(blog.images)
            ? blog.images
            : [];
    const coverRel = photos.length
        ? photos[0]
        : blog.cover || blog.imageUrl || null;
    const imagesRel = photos;

    const publishedAt =
        d.publishedAt && typeof d.publishedAt === "string"
            ? new Date(d.publishedAt)
            : null;

    const updated = await prisma.blog.update({
        where: { id: blog.id },
        data: {
            title: d.title,
            summary: d.summary || null,
            content: d.content || null,
            publishedAt:
                publishedAt && !Number.isNaN(publishedAt.getTime())
                    ? publishedAt
                    : null,
            cover: coverRel,
            imageUrl: coverRel || blog.imageUrl,
            images: imagesRel,
        },
    });

    // console.log("[PUT /api/blogs/:slug] updated blog id =", updated.id);

    // --- tech stack ---
    if (hasTechStack) {
        const techNames = Array.isArray(d.techStack) ? d.techStack : [];
        // console.log(
        //     "[PUT /api/blogs/:slug] updating techStack =",
        //     techNames,
        // );
        await prisma.blogTech.deleteMany({
            where: { blogId: updated.id },
        });
        if (techNames.length) {
            const techIds = await upsertStringList(techNames, "tech");
            if (techIds.length) {
                await prisma.blogTech.createMany({
                    data: techIds.map((id) => ({
                        blogId: updated.id,
                        techId: id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    // --- tags ---
    if (hasTags) {
        const tagNames = Array.isArray(d.tags) ? d.tags : [];
        // console.log(
        //     "[PUT /api/blogs/:slug] updating tags =",
        //     tagNames,
        // );
        await prisma.blogTag.deleteMany({
            where: { blogId: updated.id },
        });
        if (tagNames.length) {
            const tagIds = await upsertStringList(tagNames, "tag");
            if (tagIds.length) {
                await prisma.blogTag.createMany({
                    data: tagIds.map((id) => ({
                        blogId: updated.id,
                        tagId: id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    // --- authors ---
    if (hasAuthorSlugs) {
        const existingAuthors = Array.isArray(blog.authors)
            ? blog.authors
            : [];
        const creatorMemberIds = new Set(
            existingAuthors
                .filter(
                    (a) =>
                        a &&
                        a.memberId &&
                        typeof a.role === "string" &&
                        a.role === "CREATOR",
                )
                .map((a) => a.memberId),
        );
        const creatorSlugs = new Set(
            existingAuthors
                .filter(
                    (a) =>
                        a &&
                        a.member &&
                        typeof a.role === "string" &&
                        a.role === "CREATOR",
                )
                .map((a) => a.member.slug)
                .filter(Boolean),
        );

        const incomingSlugSet = new Set(
            Array.isArray(d.authorSlugs)
                ? d.authorSlugs
                    .map((s) => String(s || "").trim())
                    .filter(Boolean)
                : [],
        );

        // Always keep creators even if UI didn't send them
        for (const slug of creatorSlugs) {
            incomingSlugSet.add(slug);
        }

        const authorSlugs = Array.from(incomingSlugSet);
        let members = [];
        if (authorSlugs.length) {
            members = await prisma.member.findMany({
                where: { slug: { in: authorSlugs } },
                select: { id: true, slug: true },
            });
        }

        const memberIdsToKeep = members.map((m) => m.id);
        if (memberIdsToKeep.length) {
            await prisma.blogAuthor.deleteMany({
                where: {
                    blogId: updated.id,
                    memberId: {
                        notIn: memberIdsToKeep,
                    },
                },
            });
        } else {
            if (creatorMemberIds.size) {
                await prisma.blogAuthor.deleteMany({
                    where: {
                        blogId: updated.id,
                        memberId: {
                            notIn: Array.from(creatorMemberIds),
                        },
                    },
                });
            } else {
                await prisma.blogAuthor.deleteMany({
                    where: { blogId: updated.id },
                });
            }
        }

        for (const m of members) {
            const role = creatorMemberIds.has(m.id)
                ? "CREATOR"
                : null;
            try {
                await prisma.blogAuthor.upsert({
                    where: {
                        blogId_memberId: {
                            blogId: updated.id,
                            memberId: m.id,
                        },
                    },
                    create: {
                        blogId: updated.id,
                        memberId: m.id,
                        role,
                    },
                    update: {
                        role,
                    },
                });
            } catch (err) {
                // console.error(
                //     "[PUT /api/blogs/:slug] failed to upsert blogAuthor for memberId",
                //     m.id,
                //     err,
                // );
            }
        }
    }

    // --- related projects ---
    if (hasProjectSlugs) {
        const projectSlugs = Array.isArray(d.projectSlugs)
            ? d.projectSlugs
            : [];
        // console.log(
        //     "[PUT /api/blogs/:slug] updating related projects, slugs =",
        //     projectSlugs,
        // );

        await prisma.projectBlog.deleteMany({
            where: { blogId: updated.id },
        });

        if (projectSlugs.length) {
            const projects = await prisma.project.findMany({
                where: { slug: { in: projectSlugs } },
                select: { id: true, slug: true },
            });
            if (projects.length) {
                await prisma.projectBlog.createMany({
                    data: projects.map((p) => ({
                        projectId: p.id,
                        blogId: updated.id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    // --- related events ---
    if (hasEventSlugs) {
        const eventSlugs = Array.isArray(d.eventSlugs)
            ? d.eventSlugs
            : [];
        // console.log(
        //     "[PUT /api/blogs/:slug] updating related events, slugs =",
        //     eventSlugs,
        // );

        await prisma.eventBlog.deleteMany({
            where: { blogId: updated.id },
        });

        if (eventSlugs.length) {
            const events = await prisma.event.findMany({
                where: { slug: { in: eventSlugs } },
                select: { id: true, slug: true },
            });
            if (events.length) {
                await prisma.eventBlog.createMany({
                    data: events.map((e) => ({
                        eventId: e.id,
                        blogId: updated.id,
                    })),
                    skipDuplicates: true,
                });
            }
        }
    }

    // console.log("========== [PUT /api/blogs/:slug] END (success) ==========");
    return res
        .status(200)
        .json({ ok: true, slug: updated.slug, id: updated.id });
});

app.delete("/api/blogs/:slug", async (req, res) => {
    // console.log("========== [DELETE /api/blogs/:slug] BEGIN ==========");
    // console.log("[DELETE /api/blogs/:slug] slug =", req.params.slug);

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[DELETE /api/blogs/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    // console.log(
    //     "[DELETE /api/blogs/:slug] authenticated user id =",
    //     user.id,
    //     "roles =",
    //     roles,
    // );

    const blog = await prisma.blog.findUnique({
        where: { slug: req.params.slug },
        include: {
            authors: true,
        },
    });

    if (!blog) {
        // console.warn(
        //     "[DELETE /api/blogs/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (not found) ==========",
        // );
        return res
            .status(404)
            .json({ ok: false, error: "Not found" });
    }

    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    let isCreator = false;
    if (user.member && user.member.id) {
        isCreator = (blog.authors || []).some(
            (a) =>
                a.memberId === user.member.id &&
                typeof a.role === "string" &&
                a.role === "CREATOR",
        );
    }

    if (!isAdminOrModerator && !isCreator) {
        // console.warn(
        //     "[DELETE /api/blogs/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[DELETE /api/blogs/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== blog.slug) {
        // console.warn(
        //     "[DELETE /api/blogs/:slug] slug confirmation mismatch, got",
        //     confirmSlug,
        //     "expected",
        //     blog.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (slug mismatch) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Slug confirmation does not match",
        });
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.blogTech.deleteMany({
                where: { blogId: blog.id },
            });
            await tx.blogTag.deleteMany({
                where: { blogId: blog.id },
            });
            await tx.blogAuthor.deleteMany({
                where: { blogId: blog.id },
            });
            await tx.projectBlog.deleteMany({
                where: { blogId: blog.id },
            });
            await tx.eventBlog.deleteMany({
                where: { blogId: blog.id },
            });

            await tx.blog.delete({
                where: { id: blog.id },
            });
        });

        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (success) ==========",
        // );
        return res.status(200).json({ ok: true });
    } catch (err) {
        // console.error(
        //     "[DELETE /api/blogs/:slug] error during deletion",
        //     err,
        // );
        // console.log(
        //     "========== [DELETE /api/blogs/:slug] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error: "Failed to delete blog",
        });
    }
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
                blogs: {
                    include: {
                        blog: true,
                    },
                },
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
                blogs: (e.blogs || [])
                    .map((rel) => rel.blog)
                    .filter(Boolean)
                    .map((b) => ({
                        slug: b.slug,
                        title: b.title,
                        cover: abs(b.cover || b.imageUrl || null, req),
                        publishedAt: b.publishedAt || null,
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

    const blogs =
        Array.isArray(e.blogs) && e.blogs.length
            ? e.blogs
                .map((rel) => rel.blog)
                .filter(Boolean)
                .map((b) => ({
                    slug: b.slug,
                    title: b.title,
                    summary: b.summary || null,
                    cover: abs(b.cover || b.imageUrl || null, req),
                    imageUrl: abs(b.imageUrl || null, req),
                    publishedAt: b.publishedAt || null,
                    tags: Array.isArray(b.tags)
                        ? b.tags.map((t) => t.tag.name)
                        : [],
                }))
            : [];

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
        blogs,
    });
});

/* ------------------------ Events: create / update ------------------------ */

const attendeeSchema = z.object({
    type: z.enum(["member", "invite"]),
    memberId: z.string().optional(),
    memberSlug: z.string().optional(),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    value: z.string().optional().nullable(),
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
    blogSlugs: z.array(z.string()).max(200).optional(),
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

app.post("/api/events", async (req, res) => {
    // console.log("========== [POST /api/events] BEGIN ==========");
    // console.log("[POST /api/events] raw body =", JSON.stringify(req.body));

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn("[POST /api/events] blocked: unauthenticated");
        // console.log(
        //     "========== [POST /api/events] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    const hasMemberRole = roles.some((r) =>
        ["ADMIN", "MODERATOR", "MEMBER"].includes(r),
    );
    if (!hasMemberRole) {
        // console.warn(
        //     "[POST /api/events] blocked: insufficient permissions",
        // );
        // console.log(
        //     "========== [POST /api/events] END (forbidden) ==========",
        // );
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
        // console.warn(
        //     "[POST /api/events] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [POST /api/events] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;

    const slug = await uniqueEventSlug(d.name);
    // console.log("[POST /api/events] generated slug =", slug);

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

    const creatorMemberId =
        user && user.member && user.member.id ? user.member.id : null;

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
        },
    });

    // console.log("[POST /api/events] created event id =", event.id);

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
            // console.log(
            //     "[POST /api/events] ensured creator memberEvent row for memberId",
            //     creatorMemberId,
            // );
        } catch (err) {
            // console.error(
            //     "[POST /api/events] failed to upsert creator memberEvent row",
            //     err,
            // );
        }
    } else {
        // console.warn(
        //     "[POST /api/events] creator user has no member profile; cannot attach as attendee",
        // );
    }

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

    const blogSlugs = Array.isArray(d.blogSlugs)
        ? d.blogSlugs
        : [];
    if (blogSlugs.length) {
        const blogs = await prisma.blog.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true, slug: true },
        });
        if (blogs.length) {
            await prisma.eventBlog.createMany({
                data: blogs.map((b) => ({
                    eventId: event.id,
                    blogId: b.id,
                })),
                skipDuplicates: true,
            });
        }
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const attendees = Array.isArray(d.attendees) ? d.attendees : [];

    for (const a of attendees) {
        if (a.type === "member" && a.memberId) {
            if (creatorMemberId && a.memberId === creatorMemberId) {
                // console.log(
                //     "[POST /api/events] skipping creator in attendee loop; already ensured as CREATOR",
                // );
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
                // console.error(
                //     "[POST /api/events] failed to create memberEvent",
                //     err,
                // );
            }
        }
    }

    const inviteMap = new Map();

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
    // console.log("[POST /api/events] eventInvites =", eventInvites);

    if (eventInvites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const eventUrl = `${webBase}/events/${event.slug}`;

        for (const inv of eventInvites) {
            const email = inv.email;
            // console.log(
            //     "[POST /api/events] creating invite for email =",
            //     email,
            // );
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

    // console.log("========== [POST /api/events] END (success) ==========");
    return res
        .status(201)
        .json({ ok: true, slug: event.slug, id: event.id });
});

app.put("/api/events/:slug", async (req, res) => {
    // console.log("========== [PUT /api/events/:slug] BEGIN ==========");
    // console.log("[PUT /api/events/:slug] slug =", req.params.slug);
    // console.log(
    //     "[PUT /api/events/:slug] raw body =",
    //     JSON.stringify(req.body),
    // );

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn("[PUT /api/events/:slug] blocked: unauthenticated");
        // console.log(
        //     "========== [PUT /api/events/:slug] END (unauthenticated) ==========",
        // );
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
        // console.warn(
        //     "[PUT /api/events/:slug] 404 for slug",
        //     req.params.slug,
        // );
    }
    if (!event) {
        // console.warn(
        //     "[PUT /api/events/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [PUT /api/events/:slug] END (not found) ==========",
        // );
        return res.status(404).json({ ok: false, error: "Not found" });
    }

    const roles = (user.roles || []).map((r) => r.role);
    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    let canEdit = isAdminOrModerator;
    if (!canEdit && user.member && user.member.id) {
        const isCreatorOrAttendee =
            (event.attendees || []).some(
                (a) => a.memberId === user.member.id,
            ) ||
            (user.email || "").toLowerCase() ===
            (MAIL_FROM || "").toLowerCase();
        if (isCreatorOrAttendee) canEdit = true;
    }

    if (!canEdit) {
        // console.warn(
        //     "[PUT /api/events/:slug] blocked: insufficient permissions",
        // );
        // console.log(
        //     "========== [PUT /api/events/:slug] END (forbidden) ==========",
        // );
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
        // console.warn(
        //     "[PUT /api/events/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [PUT /api/events/:slug] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const d = parsed.data;

    // console.log("[PUT /api/events/:slug] parsed data =", {
    //     name: d.name,
    //     hasDescription: !!d.description,
    //     dateStart: d.dateStart || null,
    //     dateEnd: d.dateEnd || null,
    //     projectSlugsCount: Array.isArray(d.projectSlugs)
    //         ? d.projectSlugs.length
    //         : 0,
    //     blogSlugsCount: Array.isArray(d.blogSlugs)
    //         ? d.blogSlugs.length
    //         : 0,
    //     attendeesCount: Array.isArray(d.attendees)
    //         ? d.attendees.length
    //         : 0,
    // });

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
        },
    });

    // console.log("[PUT /api/events/:slug] updated event id =", updated.id);

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

    const blogSlugs = Array.isArray(d.blogSlugs)
        ? d.blogSlugs
        : [];
    await prisma.eventBlog.deleteMany({
        where: { eventId: updated.id },
    });
    if (blogSlugs.length) {
        const blogs = await prisma.blog.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true, slug: true },
        });
        if (blogs.length) {
            await prisma.eventBlog.createMany({
                data: blogs.map((b) => ({
                    eventId: updated.id,
                    blogId: b.id,
                })),
                skipDuplicates: true,
            });
        }
    }

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
                // console.log(
                //     "[PUT /api/events/:slug] promoted editing user to CREATOR for legacy event",
                // );
            } catch (err) {
                // console.error(
                //     "[PUT /api/events/:slug] failed to promote user to CREATOR",
                //     err,
                // );
            }
        }
    }

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
        await prisma.memberEvent.deleteMany({
            where: { eventId: updated.id },
        });
    }

    for (const a of attendees) {
        if (a.type === "member" && a.memberId) {
            if (creatorMemberIdSet.has(a.memberId)) {
                // console.log(
                //     "[PUT /api/events/:slug] skipping creator memberId in attendee loop; preserved as CREATOR",
                //     a.memberId,
                // );
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
                // console.error(
                //     "[PUT /api/events/:slug] failed to create memberEvent",
                //     err,
                // );
            }
        }
    }

    const inviteMap = new Map();

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

    const memberIds2 = attendees
        .filter((a) => a.type === "member" && a.memberId)
        .map((a) => a.memberId);
    if (memberIds2.length) {
        const users = await prisma.user.findMany({
            where: { memberId: { in: memberIds2 } },
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
    // console.log(
    //     "[PUT /api/events/:slug] new event invites =",
    //     newInvites,
    // );

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

    // console.log("========== [PUT /api/events/:slug] END (success) ==========");
    return res
        .status(200)
        .json({ ok: true, slug: updated.slug, id: updated.id });
});

app.delete("/api/events/:slug", async (req, res) => {
    // console.log("========== [DELETE /api/events/:slug] BEGIN ==========");
    // console.log("[DELETE /api/events/:slug] slug =", req.params.slug);

    const user = await requireUser(req, res);
    if (!user) {
        // console.warn(
        //     "[DELETE /api/events/:slug] blocked: unauthenticated",
        // );
        // console.log(
        //     "========== [DELETE /api/events/:slug] END (unauthenticated) ==========",
        // );
        return;
    }

    const roles = (user.roles || []).map((r) => r.role);
    // console.log(
    //     "[DELETE /api/events/:slug] authenticated user id =",
    //     user.id,
    //     "roles =",
    //     roles,
    // );

    const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: {
            attendees: true,
        },
    });

    if (!event) {
        // console.warn(
        //     "[DELETE /api/events/:slug] 404 for slug",
        //     req.params.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/events/:slug] END (not found) ==========",
        // );
        return res
            .status(404)
            .json({ ok: false, error: "Not found" });
    }

    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r),
    );

    let isCreator = false;
    if (user.member && user.member.id) {
        isCreator = (event.attendees || []).some(
            (a) =>
                a.memberId === user.member.id &&
                typeof a.role === "string" &&
                a.role === "CREATOR",
        );
    }

    if (!isAdminOrModerator && !isCreator) {
        // console.warn(
        //     "[DELETE /api/events/:slug] blocked: insufficient permissions for user",
        //     user.id,
        // );
        // console.log(
        //     "========== [DELETE /api/events/:slug] END (forbidden) ==========",
        // );
        return res
            .status(403)
            .json({ ok: false, error: "Insufficient permissions" });
    }

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) {
        // console.warn(
        //     "[DELETE /api/events/:slug] validation error",
        //     parsed.error.flatten(),
        // );
        // console.log(
        //     "========== [DELETE /api/events/:slug] END (validation error) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Invalid input",
            details: parsed.error.flatten(),
        });
    }

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== event.slug) {
        // console.warn(
        //     "[DELETE /api/events/:slug] slug confirmation mismatch, got",
        //     confirmSlug,
        //     "expected",
        //     event.slug,
        // );
        // console.log(
        //     "========== [DELETE /api/events/:slug] END (slug mismatch) ==========",
        // );
        return res.status(400).json({
            ok: false,
            error: "Slug confirmation does not match",
        });
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.project.updateMany({
                where: { eventId: event.id },
                data: { eventId: null },
            });

            await tx.eventProject.deleteMany({
                where: { eventId: event.id },
            });

            await tx.eventBlog.deleteMany({
                where: { eventId: event.id },
            });

            await tx.memberEvent.deleteMany({
                where: { eventId: event.id },
            });

            await tx.eventInvite.deleteMany({
                where: { eventId: event.id },
            });

            await tx.event.delete({
                where: { id: event.id },
            });
        });

        // console.log(
        //     "========== [DELETE /api/events/:slug] END (success) ==========",
        // );
        return res.status(200).json({ ok: true });
    } catch (err) {
        // console.error(
        //     "[DELETE /api/events/:slug] error during deletion",
        //     err,
        // );
        // console.log(
        //     "========== [DELETE /api/events/:slug] END (error) ==========",
        // );
        return res.status(500).json({
            ok: false,
            error: "Failed to delete event",
        });
    }
});

/* -------------------------- Invite consumption -------------------------- */
//
// const inviteConsumeSchema = z.object({
//     token: z.string().min(10),
//     name: z.string().optional(),
//     password: z.string().optional(),
//     passwordRepeat: z.string().optional(),
// });
//
// app.post("/api/auth/invite/consume", async (req, res) => {
//     // console.log(
//     //     "========== [POST /api/auth/invite/consume] BEGIN ==========",
//     // );
//     // console.log(
//     //     "[invite/consume] raw body =",
//     //     JSON.stringify(req.body),
//     // );
//
//     const parsed = inviteConsumeSchema.safeParse(req.body);
//     if (!parsed.success) {
//         // console.warn(
//         //     "[invite/consume] validation error",
//         //     parsed.error.flatten(),
//         // );
//         // console.log(
//         //     "========== [POST /api/auth/invite/consume] END (validation error) ==========",
//         // );
//         return res
//             .status(400)
//             .json({ ok: false, error: "Invalid token payload" });
//     }
//
//     const { token, name, password, passwordRepeat } = parsed.data;
//     const tokenHash = hashInviteToken(token);
//     if (!tokenHash) {
//         // console.warn("[invite/consume] missing token hash");
//         // console.log(
//         //     "========== [POST /api/auth/invite/consume] END (no token) ==========",
//         // );
//         return res
//             .status(400)
//             .json({ ok: false, error: "Invite invalid or expired." });
//     }
//
//     let projectInvite = await prisma.projectInvite.findFirst({
//         where: {
//             tokenHash,
//             status: "PENDING",
//             expiresAt: { gt: new Date() },
//         },
//         include: {
//             project: {
//                 include: {
//                     members: true,
//                 },
//             },
//         },
//     });
//
//     let eventInvite = null;
//     if (!projectInvite) {
//         eventInvite = await prisma.eventInvite.findFirst({
//             where: {
//                 tokenHash,
//                 status: "PENDING",
//                 expiresAt: { gt: new Date() },
//             },
//             include: {
//                 event: true,
//             },
//         });
//     }
//
//     if (!projectInvite && !eventInvite) {
//         // console.warn(
//         //     "[invite/consume] no invite found for tokenHash",
//         //     tokenHash,
//         // );
//         // console.log(
//         //     "========== [POST /api/auth/invite/consume] END (not found) ==========",
//         // );
//         return res
//             .status(400)
//             .json({ ok: false, error: "Invite invalid or expired." });
//     }
//
//     const inviteObj = projectInvite || eventInvite;
//     const emailLower = (inviteObj.email || "").toLowerCase();
//
//     let user = await prisma.user.findUnique({
//         where: { email: emailLower },
//         include: { member: true, roles: true },
//     });
//
//     const isNewUser = !user;
//
//     if (isNewUser) {
//         if (!password || !passwordRepeat || password !== passwordRepeat) {
//             // console.warn(
//             //     "[invite/consume] new-user password mismatch/empty for",
//             //     emailLower,
//             // );
//             // console.log(
//             //     "========== [POST /api/auth/invite/consume] END (password mismatch) ==========",
//             // );
//             return res.status(400).json({
//                 ok: false,
//                 error:
//                     "To accept this invite, please provide a valid password and make sure both fields match.",
//                 needsPassword: true,
//             });
//         }
//         if (!name || !name.trim()) {
//             // console.warn(
//             //     "[invite/consume] new-user missing name for",
//             //     emailLower,
//             // );
//             // console.log(
//             //     "========== [POST /api/auth/invite/consume] END (missing name) ==========",
//             // );
//             return res.status(400).json({
//                 ok: false,
//                 error: "Please provide your name to complete the invite.",
//                 needsName: true,
//             });
//         }
//
//         const passwordHash = await argon2.hash(password, {
//             type: argon2.argon2id,
//         });
//
//         const baseSlug =
//             slugify(name, { lower: true, strict: true }) ||
//             emailLower.split("@")[0] ||
//             "user";
//         let slug = baseSlug;
//         let i = 0;
//         while (await prisma.member.findUnique({ where: { slug } })) {
//             slug = `${baseSlug}-${++i}`;
//             if (i > 20) break;
//         }
//
//         const member = await prisma.member.create({
//             data: {
//                 slug,
//                 name: name.trim(),
//                 bio: "",
//                 links: {},
//                 avatarUrl: null,
//                 focusArea: null,
//             },
//         });
//
//         await ensureMemberAvatar(member);
//
//         user = await prisma.user.create({
//             data: {
//                 email: emailLower,
//                 passwordHash,
//                 memberId: member.id,
//                 roles: {
//                     create: [{ role: "MEMBER" }],
//                 },
//             },
//             include: { member: true, roles: true },
//         });
//
//         // console.log(
//         //     "[invite/consume] created new user from invite",
//         //     emailLower,
//         //     "userId =",
//         //     user.id,
//         // );
//     }
//
//     let member = user.member;
//     if (!member) {
//         const baseName = user.email.split("@")[0] || "user";
//         const slugBase =
//             slugify(baseName, { lower: true, strict: true }) ||
//             "user";
//         let slug = slugBase;
//         let i = 0;
//         while (await prisma.member.findUnique({ where: { slug } })) {
//             slug = `${slugBase}-${++i}`;
//             if (i > 20) break;
//         }
//         member = await prisma.member.create({
//             data: {
//                 slug,
//                 name: baseName,
//                 bio: "",
//                 links: {},
//                 avatarUrl: null,
//                 focusArea: null,
//             },
//         });
//
//         member = await ensureMemberAvatar(member);
//
//         await prisma.user.update({
//             where: { id: user.id },
//             data: { memberId: member.id },
//         });
//     }
//
//     let projectSlug = null;
//     let eventSlug = null;
//
//     if (projectInvite && projectInvite.project) {
//         const project = projectInvite.project;
//         projectSlug = project.slug;
//
//         const existingMemberProject =
//             await prisma.memberProject.findUnique({
//                 where: {
//                     memberId_projectId: {
//                         memberId: member.id,
//                         projectId: project.id,
//                     },
//                 },
//             });
//
//         if (!existingMemberProject) {
//             await prisma.memberProject.create({
//                 data: {
//                     memberId: member.id,
//                     projectId: project.id,
//                     role: projectInvite.role || "Contributor",
//                     contribution: null,
//                     isCreator: false,
//                 },
//             });
//         }
//
//         await prisma.projectInvite.update({
//             where: { id: projectInvite.id },
//             data: {
//                 status: "ACCEPTED",
//                 consumedAt: new Date(),
//             },
//         });
//
//         // console.log(
//         //     "[invite/consume] accepted project invite for email",
//         //     emailLower,
//         //     "projectSlug =",
//         //     projectSlug,
//         //     "newUser =",
//         //     isNewUser,
//         // );
//     }
//
//     if (eventInvite && eventInvite.event) {
//         const eventObj = eventInvite.event;
//         eventSlug = eventObj.slug;
//
//         const existingMemberEvent = await prisma.memberEvent.findUnique({
//             where: {
//                 memberId_eventId: {
//                     memberId: member.id,
//                     eventId: eventObj.id,
//                 },
//             },
//         });
//
//         if (!existingMemberEvent) {
//             await prisma.memberEvent.create({
//                 data: {
//                     memberId: member.id,
//                     eventId: eventObj.id,
//                     role: null,
//                 },
//             });
//         }
//
//         await prisma.eventInvite.update({
//             where: { id: eventInvite.id },
//             data: {
//                 status: "ACCEPTED",
//                 consumedAt: new Date(),
//             },
//         });
//
//         // console.log(
//         //     "[invite/consume] accepted event invite for email",
//         //     emailLower,
//         //     "eventSlug =",
//         //     eventSlug,
//         //     "newUser =",
//         //     isNewUser,
//         // );
//     }
//
//     // console.log(
//     //     "========== [POST /api/auth/invite/consume] END (success) ==========",
//     // );
//     return res.json({
//         ok: true,
//         newUser: isNewUser,
//         projectSlug,
//         eventSlug,
//         email: emailLower,
//     });
// });

/* ------------------------------ Routers ------------------------------ */
app.use("/api/auth", authRouter);
app.use("/api/account", accountRouter);

/* ------------------------------ Error handler ------------------------------ */
app.use((err, req, res, _next) => {
    // console.error(
    //     "[error] during",
    //     req.method,
    //     req.originalUrl,
    //     "\n",
    //     err && err.stack ? err.stack : err,
    // );

    // Handle multer-specific errors clearly so non-upload requests
    // don't accidentally show a file-type message
    if (err instanceof multer.MulterError) {
        let error = "Upload error";
        if (err.code === "LIMIT_FILE_SIZE") {
            error = "File too large";
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
            error = "Unsupported file type";
        }

        if (!res.headersSent) {
            return res.status(400).json({ ok: false, error });
        }
        return;
    }

    const message = err?.message || "Server error";
    if (res.headersSent) return;

    // Default everything else to 500 unless you *know* it's a bad request
    const status =
        message.includes("Invalid input") ||
        message.includes("validation") ||
        message.includes("ZodError")
            ? 400
            : 500;

    res.status(status).json({ ok: false, error: message });
});

/* ------------------------------ Start ------------------------------ */
const PORT = Number(process.env.PORT || 3001);
// console.log("[config] PORT =", PORT);

app.listen(PORT, () =>
    console.log(
        // `API on :${PORT} (WEB_ORIGIN=${WEB_ORIGIN}, PUBLIC_API_BASE=${
        //     PUBLIC_API_BASE || "n/a"
        // })`,
    ),
);
