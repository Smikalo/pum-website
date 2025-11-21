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
const { BadRequestError } = require("../errors");

/* -------------------------------------------------------------------------
 *  Step 15: Centralized Upload Rules & Policy
 * -------------------------------------------------------------------------
 *
 * 1. CVs:
 *    - Types: application/pdf only
 *    - Extension: .pdf
 *    - Max Size: 16 MB
 *    - Storage: /uploads/cv (renamed to {userId}-latest.pdf)
 *    - Validation: MIME check + Extension check + Magic Byte check (%PDF-)
 *
 * 2. Avatars:
 *    - Types: image/jpeg, image/png, image/webp, image/gif
 *    - Max Size: 8 MB
 *    - Storage: /uploads/avatars
 *
 * 3. Content Images (Events/Projects/Blogs):
 *    - Types: Same as Avatar
 *    - Max Size: 8 MB
 *    - Storage: /uploads/{events|projects|blogs}
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

/**
 * Validates a file object (from Multer) against a specific rule set.
 * Checks: Existence, Size, MIME type, File Extension.
 */
function validateFile(file, ruleType) {
    const rules = UPLOAD_RULES[ruleType];
    if (!rules) throw new Error(`Unknown upload rule type: ${ruleType}`);

    if (!file) {
        throw new BadRequestError("Missing file");
    }

    // 1. Size Check
    if (file.size > rules.maxBytes) {
        throw new BadRequestError("File too large");
    }

    // 2. MIME Check
    if (!rules.allowedMime.includes(file.mimetype)) {
        throw new BadRequestError(rules.errorMsg);
    }

    // 3. Extension Check
    // We trust originalname extension to match the mimetype, but verify it's allowed.
    if (file.originalname) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!rules.allowedExtensions.includes(ext)) {
            // If the extension doesn't match the allowed list for this category
            throw new BadRequestError(rules.errorMsg);
        }
    }
}

/**
 * Content Sniffing for PDF
 * Reads the first 5 bytes to check for "%PDF-".
 */
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

/**
 * Helpers for CV paths
 */
function cvLatestPath(userId) {
    return path.join(CV_DIR, `${userId}-latest.pdf`);
}
function cvLatestUrl(userId) {
    return `/uploads/cv/${userId}-latest.pdf`;
}

/* ----------------- Multer Configs ----------------- */

// CV Storage
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
        // Fail fast if MIME is wrong
        if (UPLOAD_RULES.cv.allowedMime.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(UPLOAD_RULES.cv.errorMsg), false);
        }
    },
});

// Avatar Storage
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

// Generic Image Storage Generator
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

/**
 * Process a CV upload:
 * 1. Validate against rules (PDF, size).
 * 2. Verify content signature (%PDF-).
 * 3. Move to user-specific "latest" path.
 * 4. Update Member record if applicable.
 * 5. Extract keywords (Skills/Tech).
 */
async function processCvUpload({ userId, memberId, file }) {
    // 1. Centralized Validation
    validateFile(file, "cv");

    // 2. Content Signature Check
    if (!looksLikePdf(file.path)) {
        try {
            fs.unlinkSync(file.path);
        } catch {
            /* ignore cleanup error */
        }
        throw new BadRequestError("Invalid PDF file");
    }

    // 3. Move/Rename
    const latest = cvLatestPath(userId);
    try {
        // Rename is atomic on same filesystem
        fs.renameSync(file.path, latest);
    } catch {
        // Fallback for cross-device
        fs.copyFileSync(file.path, latest);
        try {
            fs.unlinkSync(file.path);
        } catch {
            /* ignore */
        }
    }

    const publicUrl = cvLatestUrl(userId);

    // 4. Update Member
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

    // 5. Keyword Extraction
    const extracted = await parsePdfForKeywords(latest);

    return {
        url: publicUrl,
        extractedSkills: extracted.skills,
        extractedTech: extracted.tech,
    };
}

/**
 * Process an Avatar upload:
 * 1. Validate against rules.
 * 2. Remove old local avatar if exists.
 * 3. Update Member record.
 */
async function processAvatarUpload({ userId, memberId, file }) {
    validateFile(file, "avatar");

    const rel = `/uploads/avatars/${file.filename}`;

    if (memberId) {
        const member = await prisma.member.findUnique({
            where: { id: memberId },
        });
        // Cleanup old avatar if it was a local file
        if (
            member &&
            member.avatarUrl &&
            member.avatarUrl.startsWith("/uploads/avatars/")
        ) {
            const oldName = member.avatarUrl.split("/").pop();
            const oldPath = path.join(AVATAR_DIR, oldName);
            // Don't delete the file we just wrote if names somehow collide
            if (oldPath !== file.path && fs.existsSync(oldPath)) {
                try {
                    fs.unlinkSync(oldPath);
                } catch {
                    /* ignore */
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

/**
 * Process generic image upload (Events, Projects, Blogs):
 * 1. Validate against rules.
 * 2. Return relative URL.
 */
async function processImageUpload({ file, subDir }) {
    validateFile(file, "image");
    const relPath = `/uploads/${subDir}/${file.filename}`;
    return { url: relPath };
}

/* ----------------- Internal Helper ----------------- */

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