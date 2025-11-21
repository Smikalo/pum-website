// api/src/services/uploads.service.js
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const multer = require("multer");
const mime = require("mime-types");
const pdfParse = require("pdf-parse");
const crypto = require("crypto");
const { prisma } = require("../db");
const logger = require("../logger");
const {
    CV_DIR,
    AVATAR_DIR,
    eventsDir,
    projectsDir,
    blogsDir,
} = require("../utils/shared");
const { BadRequestError } = require("../errors");

/* -------------------------------------------------------------------------
 *  Centralized Upload Rules & Policy
 * -------------------------------------------------------------------------
 */

const UPLOAD_RULES = {
    cv: {
        allowedMime: ["application/pdf"],
        allowedExtensions: [".pdf"],
        maxBytes: 16 * 1024 * 1024, // 16MB
        errorMsg: "Invalid input: Only PDF allowed",
    },
    avatar: {
        allowedMime: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
        maxBytes: 8 * 1024 * 1024, // 8MB
        errorMsg: "Invalid input: Invalid image type",
    },
    image: {
        allowedMime: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
        maxBytes: 8 * 1024 * 1024, // 8MB
        errorMsg: "Invalid input: Invalid image type",
    },
};

/* ----------------- Validation Helpers ----------------- */

function validateFile(file, ruleType) {
    const rules = UPLOAD_RULES[ruleType];
    if (!rules) throw new Error(`Unknown upload rule type: ${ruleType}`);

    if (!file) {
        throw new BadRequestError("Missing file");
    }

    if (file.size > rules.maxBytes) {
        throw new BadRequestError("File too large");
    }

    if (!rules.allowedMime.includes(file.mimetype)) {
        throw new BadRequestError(rules.errorMsg);
    }

    if (file.originalname) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!rules.allowedExtensions.includes(ext)) {
            throw new BadRequestError(rules.errorMsg);
        }
    }
}

/**
 * Content Sniffing for PDF
 * Reads the first 5 bytes to check for "%PDF-".
 * Converted to async.
 */
async function looksLikePdf(filePath) {
    let fh = null;
    try {
        fh = await fsp.open(filePath, "r");
        const buf = Buffer.alloc(5);
        await fh.read(buf, 0, 5, 0);
        return buf.toString() === "%PDF-";
    } catch (err) {
        logger.debug("looksLikePdf check failed", { error: err.message, path: filePath });
        return false;
    } finally {
        if (fh) await fh.close();
    }
}

function cvLatestPath(userId) {
    return path.join(CV_DIR, `${userId}-latest.pdf`);
}
function cvLatestUrl(userId) {
    return `/uploads/cv/${userId}-latest.pdf`;
}

/* ----------------- Multer Configs ----------------- */

const cvStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CV_DIR),
    filename: (req, _file, cb) => {
        const id = req.userId || "upload";
        cb(null, `${id}-${Date.now()}-${crypto.randomUUID()}.pdf`);
    },
});

const cvUploadMiddleware = multer({
    storage: cvStorage,
    limits: { fileSize: UPLOAD_RULES.cv.maxBytes },
    fileFilter: (_req, file, cb) => {
        if (UPLOAD_RULES.cv.allowedMime.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(UPLOAD_RULES.cv.errorMsg), false);
        }
    },
});

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
    limits: { fileSize: UPLOAD_RULES.avatar.maxBytes },
    fileFilter: (_req, file, cb) => {
        if (UPLOAD_RULES.avatar.allowedMime.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(UPLOAD_RULES.avatar.errorMsg), false);
        }
    },
});

function createImageMiddleware(destDir) {
    return multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => cb(null, destDir),
            filename: (_req, file, cb) => {
                const ext = mime.extension(file.mimetype) || "bin";
                cb(null, `${Date.now()}-${crypto.randomUUID()}.${ext}`);
            },
        }),
        limits: { fileSize: UPLOAD_RULES.image.maxBytes },
        fileFilter: (_req, file, cb) => {
            if (UPLOAD_RULES.image.allowedMime.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(UPLOAD_RULES.image.errorMsg), false);
            }
        },
    });
}

const eventPhotoMiddleware = createImageMiddleware(eventsDir);
const projectPhotoMiddleware = createImageMiddleware(projectsDir);
const blogPhotoMiddleware = createImageMiddleware(blogsDir);

/* ----------------- Service Logic ----------------- */

async function processCvUpload({ userId, memberId, file }) {
    validateFile(file, "cv");

    const isPdf = await looksLikePdf(file.path);
    if (!isPdf) {
        try {
            await fsp.unlink(file.path);
        } catch (err) {
            logger.warn("Failed to cleanup invalid CV file", { path: file.path, error: err.message });
        }
        throw new BadRequestError("Invalid PDF file");
    }

    const latest = cvLatestPath(userId);
    try {
        // Atomic rename if possible
        await fsp.rename(file.path, latest);
    } catch (err) {
        // Fallback if cross-device
        try {
            await fsp.copyFile(file.path, latest);
            await fsp.unlink(file.path);
        } catch (copyErr) {
            logger.error("Failed to move CV file", { error: copyErr.message, src: file.path, dest: latest });
            throw new Error("File save failed");
        }
    }

    const publicUrl = cvLatestUrl(userId);

    if (memberId) {
        const member = await prisma.member.findUnique({
            where: { id: memberId },
        });
        if (member) {
            const links = { ...(member.links || {}), CV: publicUrl };
            await prisma.member.update({
                where: { id: member.id },
                data: { links },
            });
        }
    }

    const extracted = await parsePdfForKeywords(latest);

    return {
        url: publicUrl,
        extractedSkills: extracted.skills,
        extractedTech: extracted.tech,
    };
}

async function processAvatarUpload({ userId, memberId, file }) {
    validateFile(file, "avatar");

    const rel = `/uploads/avatars/${file.filename}`;

    if (memberId) {
        const member = await prisma.member.findUnique({
            where: { id: memberId },
        });

        if (
            member &&
            member.avatarUrl &&
            member.avatarUrl.startsWith("/uploads/avatars/")
        ) {
            const oldName = member.avatarUrl.split("/").pop();
            const oldPath = path.join(AVATAR_DIR, oldName);
            // Ensure we don't delete what we just uploaded
            if (oldPath !== file.path) {
                try {
                    await fsp.unlink(oldPath);
                } catch (err) {
                    // Ignore ENOENT (file missing), warn on others
                    if (err.code !== "ENOENT") {
                        logger.warn("Failed to delete old avatar", { path: oldPath, error: err.message });
                    }
                }
            }
        }

        await prisma.member.update({
            where: { id: memberId },
            data: { avatarUrl: rel },
        });
    }

    return { url: rel };
}

async function processImageUpload({ file, subDir }) {
    validateFile(file, "image");
    const relPath = `/uploads/${subDir}/${file.filename}`;
    return { url: relPath };
}

/* ----------------- Internal Helper ----------------- */

async function parsePdfForKeywords(filePath) {
    let text = "";
    try {
        const buffer = await fsp.readFile(filePath);
        const data = await pdfParse(buffer);
        text = String(data.text || "");
    } catch (err) {
        logger.warn("PDF parsing failed for keywords", { path: filePath, error: err.message });
        text = "";
    }

    const norm = (s) => s.toLowerCase();
    const hay = norm(text);
    const [skills, techs] = await Promise.all([
        prisma.skill.findMany({ select: { name: true } }),
        prisma.tech.findMany({ select: { name: true } }),
    ]);
    const foundSkills = [],
        foundTechs = [];
    for (const { name } of skills) {
        if (hay.includes(norm(name))) foundSkills.push(name);
    }
    for (const { name } of techs) {
        if (hay.includes(norm(name))) foundTechs.push(name);
    }
    return {
        skills: [...new Set(foundSkills)],
        tech: [...new Set(foundTechs)],
    };
}

module.exports = {
    UPLOAD_RULES,
    cvUploadMiddleware,
    avatarUploadMiddleware,
    eventPhotoMiddleware,
    projectPhotoMiddleware,
    blogPhotoMiddleware,
    processCvUpload,
    processAvatarUpload,
    processImageUpload,
    cvLatestPath,
    cvLatestUrl,
    looksLikePdf,
};