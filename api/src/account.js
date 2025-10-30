// api/src/account.js
const express = require("express");
const z = require("zod");
const jwt = require("jsonwebtoken");
const { prisma } = require("./db");
const slugify = require("slugify");
const { nanoid } = require("nanoid");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const mime = require("mime-types");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-only-change-me";
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");
const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;

fs.mkdirSync(AVATAR_DIR, { recursive: true });

function abs(u, req) {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    const base = PUBLIC_API_BASE || `${req.protocol}://${req.get("host")}`;
    const rel = u.startsWith("/") ? u : `/${u}`;
    return `${base}${rel}`;
}

function authRequired(req, res, next) {
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) return res.status(401).json({ ok: false, error: "Missing access token" });
    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
        req.userId = decoded.sub;
        next();
    } catch {
        return res.status(401).json({ ok: false, error: "Invalid access token" });
    }
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
        filename: (req, file, cb) => {
            const ext = mime.extension(file.mimetype) || "bin";
            cb(null, `${req.userId}-${Date.now()}.${ext}`);
        },
    }),
    fileFilter: (_req, file, cb) => {
        const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
        cb(ok ? null : new Error("Invalid image type"), ok);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

async function ensureMemberForUser(user) {
    if (user.memberId) return prisma.member.findUnique({ where: { id: user.memberId } });
    const base = slugify(user.email.split("@")[0] || "user", { lower: true, strict: true }) || "user";
    let slug = base;
    let i = 0;
    while (await prisma.member.findUnique({ where: { slug } })) {
        slug = `${base}-${nanoid(6).toLowerCase()}`;
        if (++i > 5) break;
    }
    const member = await prisma.member.create({
        data: { slug, name: user.email.split("@")[0], bio: "", links: {}, avatarUrl: null, focusArea: null },
    });
    await prisma.user.update({ where: { id: user.id }, data: { memberId: member.id } });
    return member;
}

function presentMember(m, skills = [], techs = [], req) {
    return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        headline: m.headline,
        shortBio: m.shortBio,
        markdown: m.bio || "",
        links: m.links || {},
        avatarUrl: abs(m.avatarUrl || null, req),
        focusArea: m.focusArea || null,
        skills,
        techStack: techs,
    };
}

async function upsertStringList(list, modelName) {
    const out = [];
    for (const nameRaw of list) {
        const name = nameRaw.trim();
        if (!name) continue;
        const model = await prisma[modelName].upsert({
            where: { name },
            create: { name },
            update: {},
            select: { id: true },
        });
        out.push(model.id);
    }
    return out;
}

const router = express.Router();
router.use(authRequired);

// GET profile
router.get("/profile", async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
    if (!user) return res.status(401).json({ ok: false, error: "Unknown user" });
    const member = user.member || (await ensureMemberForUser(user));

    const [skills, techs] = await Promise.all([
        prisma.memberSkill.findMany({ where: { memberId: member.id }, include: { skill: true } }),
        prisma.memberTech.findMany({ where: { memberId: member.id }, include: { tech: true } }),
    ]);

    return res.json({
        ok: true,
        profile: presentMember(
            member,
            skills.map((s) => s.skill.name),
            techs.map((t) => t.tech.name),
            req
        ),
    });
});

// Update profile
router.put("/profile", async (req, res) => {
    const schema = z.object({
        name: z.string().min(1).max(120).optional(),
        headline: z.string().max(200).nullable().optional(),
        shortBio: z.string().max(500).nullable().optional(),
        markdown: z.string().max(100_000).optional(),
        links: z.record(z.string().url()).optional(),
        focusArea: z.enum(["FRONTEND", "BACKEND", "ML", "DATA", "DEVOPS", "DESIGN", "PM", "OTHER"]).nullable().optional(),
        skills: z.array(z.string().min(1)).optional(),
        techStack: z.array(z.string().min(1)).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid input" });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
    if (!user) return res.status(401).json({ ok: false, error: "Unknown user" });
    const member = user.member || (await ensureMemberForUser(user));

    const data = {};
    const { name, headline, shortBio, markdown, links, focusArea } = parsed.data;
    if (typeof name !== "undefined") data.name = name;
    if (typeof headline !== "undefined") data.headline = headline;
    if (typeof shortBio !== "undefined") data.shortBio = shortBio;
    if (typeof markdown !== "undefined") data.bio = markdown;
    if (typeof links !== "undefined") data.links = links;
    if (typeof focusArea !== "undefined") data.focusArea = focusArea;

    const skills = parsed.data.skills || null;
    const techStack = parsed.data.techStack || null;

    await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length) {
            await tx.member.update({ where: { id: member.id }, data });
        }
        if (skills) {
            const ids = await upsertStringList(skills, "skill");
            await tx.memberSkill.deleteMany({ where: { memberId: member.id, NOT: { skillId: { in: ids } } } });
            for (const sid of ids) {
                await tx.memberSkill.upsert({
                    where: { memberId_skillId: { memberId: member.id, skillId: sid } },
                    update: {},
                    create: { memberId: member.id, skillId: sid },
                });
            }
        }
        if (techStack) {
            const ids = await upsertStringList(techStack, "tech");
            await tx.memberTech.deleteMany({ where: { memberId: member.id, NOT: { techId: { in: ids } } } });
            for (const tid of ids) {
                await tx.memberTech.upsert({
                    where: { memberId_techId: { memberId: member.id, techId: tid } },
                    update: {},
                    create: { memberId: member.id, techId: tid },
                });
            }
        }
    });

    const updated = await prisma.member.findUnique({ where: { id: member.id } });
    const [skillsOut, techsOut] = await Promise.all([
        prisma.memberSkill.findMany({ where: { memberId: member.id }, include: { skill: true } }),
        prisma.memberTech.findMany({ where: { memberId: member.id }, include: { tech: true } }),
    ]);

    return res.json({
        ok: true,
        profile: presentMember(
            updated,
            skillsOut.map((s) => s.skill.name),
            techsOut.map((t) => t.tech.name),
            req
        ),
    });
});

// Avatar upload
router.post("/avatar", upload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Missing file" });
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
    if (!user || !user.memberId) return res.status(401).json({ ok: false, error: "Unknown user" });

    const rel = `/uploads/avatars/${req.file.filename}`;
    await prisma.member.update({ where: { id: user.memberId }, data: { avatarUrl: rel } });

    return res.status(201).json({ ok: true, url: abs(rel, req) });
});

module.exports = { accountRouter: router };
