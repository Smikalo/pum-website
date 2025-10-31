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

// --- NEW: pdf parsing (tiny, local) ---
const pdfParse = require("pdf-parse"); // safe text extraction only

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-only-change-me";
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");
const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
// --- NEW: dedicated CV dir ---
const CV_DIR = path.join(UPLOAD_ROOT, "cv");

const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;

// ensure dirs exist
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(CV_DIR, { recursive: true });

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

// avatar uploader (existing)
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

// --- NEW: CV uploader (PDF only, 10 MB, allow-list + magic number check) ---
const uploadPdf = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, CV_DIR),
        filename: (req, _file, cb) => cb(null, `${req.userId}-${Date.now()}.pdf`),
    }),
    fileFilter: (_req, file, cb) => {
        cb(file.mimetype === "application/pdf" ? null : new Error("Only PDF allowed"), file.mimetype === "application/pdf");
    },
    limits: { fileSize: 10 * 1024 * 1024 },
});

function cvLatestPath(userId) {
    return path.join(CV_DIR, `${userId}-latest.pdf`);
}
function cvLatestUrl(userId) {
    return `/uploads/cv/${userId}-latest.pdf`;
}

// --- NEW: basic PDF magic header verification (defense-in-depth) ---
function looksLikePdf(filePath) {
    try {
        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(5);
        fs.readSync(fd, buf, 0, 5, 0);
        fs.closeSync(fd);
        return buf.toString() === "%PDF-";
    } catch {
        return false;
    }
}

// --- NEW: extract skills/tech names by simple case-insensitive match ---
async function parsePdfForKeywords(filePath) {
    let text = "";
    try {
        const data = await pdfParse(fs.readFileSync(filePath));
        text = String(data.text || "");
    } catch {
        text = "";
    }
    const norm = (s) => s.toLowerCase();
    const hay = norm(text);

    // fetch canonical names from DB to avoid hardcoding
    const [skills, techs] = await Promise.all([
        prisma.skill.findMany({ select: { name: true } }),
        prisma.tech.findMany({ select: { name: true } }),
    ]);

    const foundSkills = [];
    const foundTechs = [];

    for (const { name } of skills) {
        const n = name.trim();
        if (!n) continue;
        if (hay.includes(norm(n))) foundSkills.push(n);
    }
    for (const { name } of techs) {
        const n = name.trim();
        if (!n) continue;
        if (hay.includes(norm(n))) foundTechs.push(n);
    }
    // de-dup
    return {
        skills: [...new Set(foundSkills)],
        tech: [...new Set(foundTechs)],
    };
}

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

    // --- NEW: include cvUrl if present ---
    const cvPath = cvLatestPath(req.userId);
    const cvUrl = fs.existsSync(cvPath) ? abs(cvLatestUrl(req.userId), req) : null;

    return res.json({
        ok: true,
        profile: {
            ...presentMember(
                member,
                skills.map((s) => s.skill.name),
                techs.map((t) => t.tech.name),
                req
            ),
            cvUrl,
        },
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

    // include cvUrl again for convenience
    const cvPath = cvLatestPath(req.userId);
    const cvUrl = fs.existsSync(cvPath) ? abs(cvLatestUrl(req.userId), req) : null;

    return res.json({
        ok: true,
        profile: {
            ...presentMember(
                updated,
                skillsOut.map((s) => s.skill.name),
                techsOut.map((t) => t.tech.name),
                req
            ),
            cvUrl,
        },
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

// --- NEW: CV upload + parse, expose stable public URL under /uploads/cv/<user>-latest.pdf
router.post("/cv", uploadPdf.single("cv"), async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: "Missing file" });

    try {
        // Magic number verification (don't trust only MIME). Delete if not a PDF.
        if (!looksLikePdf(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ ok: false, error: "Invalid PDF file" });
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { member: true } });
        if (!user || !user.memberId) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(401).json({ ok: false, error: "Unknown user" });
        }

        // Atomically set/overwrite a deterministic "latest" filename
        const latest = cvLatestPath(req.userId);
        try { fs.renameSync(req.file.path, latest); } catch {
            // fallback to copy+unlink if cross-device
            fs.copyFileSync(req.file.path, latest);
            try { fs.unlinkSync(req.file.path); } catch {}
        }

        // Optional: also expose as link in member.links["CV"] so it shows on the public page with zero extra UI changes
        const publicUrl = cvLatestUrl(req.userId);
        const member = user.member || (await ensureMemberForUser(user));
        const links = { ...(member.links || {}) , CV: publicUrl };
        await prisma.member.update({ where: { id: member.id }, data: { links } });

        // Extract skills/technologies for suggestions
        const extracted = await parsePdfForKeywords(latest);

        return res.status(201).json({
            ok: true,
            url: abs(publicUrl, req),
            extractedSkills: extracted.skills,
            extractedTech: extracted.tech,
        });
    } catch (e) {
        // best-effort cleanup
        try { if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch {}
        return res.status(500).json({ ok: false, error: "CV upload failed" });
    }
});

module.exports = { accountRouter: router };
