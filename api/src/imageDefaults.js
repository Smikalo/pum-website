const fs = require("fs");
const path = require("path");
const https = require("https");
const { prisma } = require("./db");
const PImage = require("pureimage");

// Shared upload root (matches other modules)
const UPLOAD_ROOT = path.resolve(__dirname, "..", "uploads");

const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
const EVENT_HEADER_DIR = path.join(UPLOAD_ROOT, "events");
const PROJECT_HEADER_DIR = path.join(UPLOAD_ROOT, "projects");
const BLOG_HEADER_DIR = path.join(UPLOAD_ROOT, "blogs");

// Ensure directories exist
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(EVENT_HEADER_DIR, { recursive: true });
fs.mkdirSync(PROJECT_HEADER_DIR, { recursive: true });
fs.mkdirSync(BLOG_HEADER_DIR, { recursive: true });

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

    // Dark grey gradient background for the website's dark theme
    params.set("backgroundColor", "020617,0f172a");
    params.set("backgroundType", "gradientLinear");
    params.set("backgroundRotation", "320,360");

    // Overall shapes in grey-ish tones
    params.set("shapeColor", "111827,1f2937,020617");

    // Distinguishably colored facial features
    params.set("eyesColor", "22c55e,3b82f6,f97316,ec4899,a855f7");
    params.set("mouthColor", "e5e7eb,fbbf24,22c55e,38bdf8");

    // Slight rounding
    params.set("radius", "10");

    return `${DICEBEAR_BASE}?${params.toString()}`;
}

/**
 * Ensure a member has a generated avatar saved to /uploads/avatars and persisted in DB.
 * - Deterministic per member (based on slug or id)
 * - Only writes if avatar is missing
 */
async function ensureMemberAvatar(member) {
    if (!member || !member.id) return member;

    // If avatar already set, nothing to do
    if (member.avatarUrl) {
        return member;
    }

    const seed = member.slug || String(member.id);
    const safeId = String(member.id).replace(/[^a-zA-Z0-9_-]/g, "-");
    const filename = `member-${safeId}.png`;
    const rel = `/uploads/avatars/${filename}`;
    const filePath = path.join(AVATAR_DIR, filename);

    // If file exists but DB doesn't point there yet, just update DB
    if (fs.existsSync(filePath)) {
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

        fs.writeFileSync(filePath, buf);
        await prisma.member.update({
            where: { id: member.id },
            data: { avatarUrl: rel },
        });
        member.avatarUrl = rel;
    } catch (err) {
        // Best-effort: on failure, just keep going without blocking user flows
        // You could plug this into a real logger if you have one.
        // console.error("Failed to generate member avatar", err);
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
 * Returns the *relative* URL (e.g. "/uploads/events/default-event-my-slug.png").
 */
async function ensureDefaultHeaderImage(kind, slugOrId) {
    const { dir, subdir } = headerDirForKind(kind);
    const base = String(slugOrId || `${kind}`).toLowerCase();
    const safe = base.replace(/[^a-z0-9_-]+/g, "-") || kind;

    const filename = `default-${kind}-${safe}.png`;
    const filePath = path.join(dir, filename);
    const rel = `/uploads/${subdir}/${filename}`;

    if (fs.existsSync(filePath)) {
        return rel;
    }

    const width = 1200;
    const height = 630;

    const img = PImage.make(width, height);
    const ctx = img.getContext("2d");

    // Vertical dark gradient: top slightly lighter, bottom slightly darker
    const topHex = "020617"; // near black / slate-950
    const bottomHex = "111827"; // slate-900-ish

    for (let y = 0; y < height; y++) {
        const t = y / (height - 1);
        const col = lerpColorHex(topHex, bottomHex, t);
        ctx.fillStyle = rgbToCss(col);
        ctx.fillRect(0, y, width, 1);
    }

    // Subtle diagonal accent band for a bit of visual interest
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "rgb(30, 64, 175)"; // very dark blue-ish
    const bandHeight = Math.round(height * 0.18);
    ctx.translate(0, height * 0.35);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.fillRect(-width, 0, width * 3, bandHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    ctx.globalAlpha = 1;

    // Encode to PNG on disk
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(filePath);
        PImage.encodePNGToStream(img, out)
            .then(() => resolve())
            .catch((err) => {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch {
                    // ignore
                }
                reject(err);
            });
    });

    return rel;
}

module.exports = {
    ensureMemberAvatar,
    ensureDefaultHeaderImage,
};
