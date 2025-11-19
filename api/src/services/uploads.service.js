// api/src/services/uploads.service.js
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mime = require("mime-types");
const pdfParse = require("pdf-parse");
const crypto = require("crypto");
const { prisma } = require("../db");
const {
    CV_DIR,
    AVATAR_DIR,
    eventsDir,
    projectsDir,
    blogsDir,
} = require("../utils/shared");

/* ----------------- Helpers ----------------- */

function looksLikePdf(filePath) {
    try {
        const fd = fs.openSync(filePath, "r");
        const buf = Buffer.alloc(5);
        fs.readSync(fd, buf, 0, 5, 0);
        fs.closeSync(fd);
        return buf.toString() === "%PDF-";
    } catch { return false; }
}

async function parsePdfForKeywords(filePath) {
    let text = "";
    try {
        const data = await pdfParse(fs.readFileSync(filePath));
        text = String(data.text || "");
    } catch { text = ""; }
    const norm = (s) => s.toLowerCase();
    const hay = norm(text);
    const [skills, techs] = await Promise.all([
        prisma.skill.findMany({ select: { name: true } }),
        prisma.tech.findMany({ select: { name: true } }),
    ]);
    const foundSkills = [], foundTechs = [];
    for (const { name } of skills) if (hay.includes(norm(name))) foundSkills.push(name);
    for (const { name } of techs) if (hay.includes(norm(name))) foundTechs.push(name);
    return { skills: [...new Set(foundSkills)], tech: [...new Set(foundTechs)] };
}

function cvLatestPath(userId) { return path.join(CV_DIR, `${userId}-latest.pdf`); }
function cvLatestUrl(userId) { return `/uploads/cv/${userId}-latest.pdf`; }

/* ----------------- Multer Configs ----------------- */

// Unified CV storage: 16MB limit, PDF only
const cvStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CV_DIR),
    filename: (req, _file, cb) => {
        const id = req.userId || "upload";
        cb(null, `${id}-${Date.now()}-${crypto.randomUUID()}.pdf`);
    },
});

const cvUploadMiddleware = multer({
    storage: cvStorage,
    limits: { fileSize: 16 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        // Prefix with "Invalid input" so global error handler returns 400
        cb(file.mimetype === "application/pdf" ? null : new Error("Invalid input: Only PDF allowed"), file.mimetype === "application/pdf");
    },
});

// Unified Avatar storage: 8MB limit, Images only
const avatarStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
        const ext = mime.extension(file.mimetype) || "bin";
        const id = req.userId || "upload";
        cb(null, `${id}-${Date.now()}-${crypto.randomUUID()}.${ext}`);
    },
});

const avatarUploadMiddleware = multer({
    storage: avatarStorage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
        cb(ok ? null : new Error("Invalid input: Invalid image type"), ok);
    },
});

// Generic helpers for other image uploads (Event, Project, Blog)
function createImageMiddleware(destDir, limitMb = 8) {
    return multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, destDir),
            filename: (_req, file, cb) => {
                const ext = mime.extension(file.mimetype) || "bin";
                cb(null, `${Date.now()}-${crypto.randomUUID()}.${ext}`);
            }
        }),
        limits: { fileSize: limitMb * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype);
            cb(ok ? null : new Error("Invalid input: Invalid image type"), ok);
        }
    });
}

const eventPhotoMiddleware = createImageMiddleware(eventsDir);
const projectPhotoMiddleware = createImageMiddleware(projectsDir);
const blogPhotoMiddleware = createImageMiddleware(blogsDir);

/* ----------------- Service Logic ----------------- */

async function processCvUpload({ userId, memberId, file }) {
    if (!file) throw new Error("Missing file");

    // Validate PDF signature
    if (!looksLikePdf(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
        throw new Error("Invalid PDF file");
    }

    // Move/Rename to user-specific latest file
    const latest = cvLatestPath(userId);
    try {
        fs.renameSync(file.path, latest);
    } catch {
        fs.copyFileSync(file.path, latest);
        try { fs.unlinkSync(file.path); } catch {}
    }

    const publicUrl = cvLatestUrl(userId);

    // Update Member links
    if (memberId) {
        const member = await prisma.member.findUnique({ where: { id: memberId } });
        if (member) {
            const links = { ...(member.links || {}), CV: publicUrl };
            await prisma.member.update({ where: { id: member.id }, data: { links } });
        }
    }

    // Parse for keywords
    const extracted = await parsePdfForKeywords(latest);

    return {
        url: publicUrl,
        extractedSkills: extracted.skills,
        extractedTech: extracted.tech
    };
}

async function processAvatarUpload({ userId, memberId, file }) {
    if (!file) throw new Error("Missing file");

    const rel = `/uploads/avatars/${file.filename}`;

    if (memberId) {
        // Clean up old avatar if local
        const member = await prisma.member.findUnique({ where: { id: memberId } });
        if (member && member.avatarUrl && member.avatarUrl.startsWith("/uploads/avatars/")) {
            const oldName = member.avatarUrl.split("/").pop();
            const oldPath = path.join(AVATAR_DIR, oldName);
            // Prevent deleting the file we just uploaded if filenames somehow collided
            if (oldPath !== file.path && fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch {}
            }
        }

        await prisma.member.update({ where: { id: memberId }, data: { avatarUrl: rel } });
    }

    return { url: rel };
}

module.exports = {
    cvUploadMiddleware,
    avatarUploadMiddleware,
    eventPhotoMiddleware,
    projectPhotoMiddleware,
    blogPhotoMiddleware,
    processCvUpload,
    processAvatarUpload,
    cvLatestPath,
    cvLatestUrl,
    looksLikePdf
};