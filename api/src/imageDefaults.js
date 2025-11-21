const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const https = require("https");
const { prisma } = require("./db");
const PImage = require("pureimage");
const logger = require("./logger");

// Shared upload root (matches other modules)
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");

const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
const EVENT_HEADER_DIR = path.join(UPLOAD_ROOT, "events");
const PROJECT_HEADER_DIR = path.join(UPLOAD_ROOT, "projects");
const BLOG_HEADER_DIR = path.join(UPLOAD_ROOT, "blogs");

// Ensure directories exist (Sync is acceptable here for initialization)
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(EVENT_HEADER_DIR, { recursive: true });
fs.mkdirSync(PROJECT_HEADER_DIR, { recursive: true });
fs.mkdirSync(BLOG_HEADER_DIR, { recursive: true });

/* ----------------- Helpers ----------------- */

async function fileExists(p) {
    try {
        await fsp.access(p);
        return true;
    } catch {
        return false;
    }
}

// --- DiceBear thumbs avatar generation (dark grey gradient + colored facial features) ---

const DICEBEAR_BASE = "https://api.dicebear.com/7.x/thumbs/png";

/**
 * Simple HTTPS helper that returns a Buffer.
 */
function fetchBinary(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode !== 200) {
                    const chunks = [];
                    res.on("data", (c) => chunks.push(c));
                    res.on("end", () => {
                        reject(
                            new Error(
                                `DiceBear request failed with status ${res.statusCode}: ${Buffer.concat(chunks).toString(
                                    "utf8"
                                )}`
                            )
                        );
                    });
                    return;
                }
                const data = [];
                res.on("data", (chunk) => data.push(chunk));
                res.on("end", () => resolve(Buffer.concat(data)));
            })
            .on("error", reject);
    });
}

/**
 * Build DiceBear thumbs URL with grey gradient background and colored facial features.
 */
function buildDiceBearThumbUrl(seed) {
    const params = new URLSearchParams();
    params.set("seed", String(seed || "member"));
    params.set("size", "160");
    params.set("backgroundColor", "020617,0f172a");
    params.set("backgroundType", "gradientLinear");
    params.set("backgroundRotation", "320,360");
    params.set("shapeColor", "111827,1f2937,020617");
    params.set("eyesColor", "22c55e,3b82f6,f97316,ec4899,a855f7");
    params.set("mouthColor", "e5e7eb,fbbf24,22c55e,38bdf8");
    params.set("radius", "10");
    return `${DICEBEAR_BASE}?${params.toString()}`;
}

/**
 * Ensure a member has a generated avatar saved to /uploads/avatars and persisted in DB.
 */
async function ensureMemberAvatar(member) {
    if (!member || !member.id) return member;
    if (member.avatarUrl) {
        return member;
    }

    const seed = member.slug || String(member.id);
    const safeId = String(member.id).replace(/[^a-zA-Z0-9_-]/g, "-");
    const filename = `member-${safeId}.png`;
    const rel = `/uploads/avatars/${filename}`;
    const filePath = path.join(AVATAR_DIR, filename);

    if (await fileExists(filePath)) {
        if (member.avatarUrl !== rel) {
            await prisma.member.update({
                where: { id: member.id },
                data: { avatarUrl: rel },
            });
            member.avatarUrl = rel;
        }
        return member;
    }

    try {
        const url = buildDiceBearThumbUrl(seed);
        const buf = await fetchBinary(url);

        await fsp.writeFile(filePath, buf);
        await prisma.member.update({
            where: { id: member.id },
            data: { avatarUrl: rel },
        });
        member.avatarUrl = rel;
    } catch (err) {
        logger.warn("Failed to generate member avatar", { error: err.message, memberId: member.id });
    }

    return member;
}

// --- Dark header image generation for events / projects / blogs ---

function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColorHex(c1, c2, t) {
    const a = hexToRgb(c1);
    const b = hexToRgb(c2);
    return {
        r: Math.round(lerp(a.r, b.r, t)),
        g: Math.round(lerp(a.g, b.g, t)),
        b: Math.round(lerp(a.b, b.b, t)),
    };
}

function rgbToCss({ r, g, b }) {
    return `rgb(${r}, ${g}, ${b})`;
}

function headerDirForKind(kind) {
    switch (kind) {
        case "event":
            return { dir: EVENT_HEADER_DIR, subdir: "events" };
        case "project":
            return { dir: PROJECT_HEADER_DIR, subdir: "projects" };
        case "blog":
            return { dir: BLOG_HEADER_DIR, subdir: "blogs" };
        default:
            throw new Error(`Unknown header kind: ${kind}`);
    }
}

/**
 * Generates (if needed) and returns a dark grey gradient header image path for events, projects, blogs.
 */
async function ensureDefaultHeaderImage(kind, slugOrId) {
    const { dir, subdir } = headerDirForKind(kind);
    const base = String(slugOrId || `${kind}`).toLowerCase();
    const safe = base.replace(/[^a-z0-9_-]+/g, "-") || kind;

    const filename = `default-${kind}-${safe}.png`;
    const filePath = path.join(dir, filename);
    const rel = `/uploads/${subdir}/${filename}`;

    if (await fileExists(filePath)) {
        return rel;
    }

    const width = 1200;
    const height = 630;

    const img = PImage.make(width, height);
    const ctx = img.getContext("2d");

    const topHex = "020617";
    const bottomHex = "111827";

    for (let y = 0; y < height; y++) {
        const t = y / (height - 1);
        const col = lerpColorHex(topHex, bottomHex, t);
        ctx.fillStyle = rgbToCss(col);
        ctx.fillRect(0, y, width, 1);
    }

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "rgb(30, 64, 175)";
    const bandHeight = Math.round(height * 0.18);
    ctx.translate(0, height * 0.35);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.fillRect(-width, 0, width * 3, bandHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;

    try {
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            out.on('error', reject);
            PImage.encodePNGToStream(img, out)
                .then(() => resolve())
                .catch(reject);
        });
    } catch (err) {
        try {
            if (await fileExists(filePath)) await fsp.unlink(filePath);
        } catch {
            // ignore
        }
        throw err;
    }

    return rel;
}

module.exports = {
    ensureMemberAvatar,
    ensureDefaultHeaderImage,
};