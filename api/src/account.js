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

// ---- Config ----
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-only-change-me";
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");
const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");

// ensure upload dir exists
fs.mkdirSync(AVATAR_DIR, { recursive: true });

// ---- Auth middleware ----
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

// ---- Multer (avatar uploads) ----
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ---- Helpers ----
async function ensureMemberForUser(user) {
    if (user.memberId) {
        return prisma.member.findUnique({ where: { id: user.memberId } });
    }
    // create a minimal member
    const base = slugify(user.email.split("@")[0] || "user", { lower: true, strict: true }) || "user";
    let slug = base;
    let attempt = 0;
    while (await prisma.member.findUnique({ where: { slug } })) {
        slug = `${base}-${nanoid(6).toLowerCase()}`;
        if (++attempt > 5) break;
    }
    const member = await prisma.member.create({
        data: {
            slug,
            name: user.email.split("@")[0],
            headline: null,
            shortBio: null,
            bio: "", // store markdown in bio for now
            links: {},
            avatarUrl: null,
        },
    });
    await prisma.user.update({ where: { id: user.id }, data: { memberId: member.id } });
    return member;
}

function presentMember(m, skills = [], techs = []) {
    return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        headline: m.headline,
        shortBio: m.shortBio,
        markdown: m.bio || "", // we keep markdown in bio field
        links: m.links || {},
        avatarUrl: m.avatarUrl || null,
        skills,
        techStack: techs,
    };
}

async function upsertStringList(list, modelName) {
    // returns ids in same order as names
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

// GET /api/account/profile
router.get("/profile", async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
    if (!user) return res.status(401).json({ ok: false, error: "Unknown user" });
    const member = user.member || (await ensureMemberForUser(user));

    const [skills, techs] = await Promise.all([
        prisma.memberSkill.findMany({
            where: { memberId: member.id },
            include: { skill: true },
        }),
        prisma.memberTech.findMany({
            where: { memberId: member.id },
            include: { tech: true },
        }),
    ]);

    return res.json({
        ok: true,
        profile: presentMember(
            member,
            skills.map((s) => s.skill.name),
            techs.map((t) => t.tech.name)
        ),
    });
});

// PUT /api/account/profile  (JSON: name, headline, shortBio, markdown, links, skills[], techStack[])
router.put("/profile", async (req, res) => {
    const schema = z.object({
        name: z.string().min(1).max(120).optional(),
        headline: z.string().max(200).nullable().optional(),
        shortBio: z.string().max(500).nullable().optional(),
        markdown: z.string().max(100_000).optional(),
        links: z.record(z.string().url()).optional(), // { label: url }
        skills: z.array(z.string().min(1)).optional(),
        techStack: z.array(z.string().min(1)).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid input" });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
    if (!user) return res.status(401).json({ ok: false, error: "Unknown user" });
    const member = user.member || (await ensureMemberForUser(user));

    // Update core fields
    const data = {};
    const { name, headline, shortBio, markdown, links } = parsed.data;
    if (typeof name !== "undefined") data.name = name;
    if (typeof headline !== "undefined") data.headline = headline;
    if (typeof shortBio !== "undefined") data.shortBio = shortBio;
    if (typeof markdown !== "undefined") data.bio = markdown; // store markdown
    if (typeof links !== "undefined") data.links = links;

    // Skills & tech mapping
    const skills = parsed.data.skills || null;
    const techStack = parsed.data.techStack || null;

    await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length) {
            await tx.member.update({ where: { id: member.id }, data });
        }

        if (skills) {
            const skillIds = await upsertStringList(skills, "skill");
            await tx.memberSkill.deleteMany({ where: { memberId: member.id, NOT: { skillId: { in: skillIds } } } });
            // upsert links
            for (const sid of skillIds) {
                await tx.memberSkill.upsert({
                    where: { memberId_skillId: { memberId: member.id, skillId: sid } },
                    update: {},
                    create: { memberId: member.id, skillId: sid },
                });
            }
        }

        if (techStack) {
            const techIds = await upsertStringList(techStack, "tech");
            await tx.memberTech.deleteMany({ where: { memberId: member.id, NOT: { techId: { in: techIds } } } });
            for (const tid of techIds) {
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
            techsOut.map((t) => t.tech.name)
        ),
    });
});

// POST /api/account/avatar  (multipart/form-data: avatar=<file>)
router.post("/avatar", upload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Missing file" });

    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
    if (!user) return res.status(401).json({ ok: false, error: "Unknown user" });

    const rel = `/uploads/avatars/${req.file.filename}`;
    await prisma.member.update({ where: { id: user.memberId }, data: { avatarUrl: rel } });

    return res.status(201).json({ ok: true, url: rel });
});

module.exports = { accountRouter: router };
