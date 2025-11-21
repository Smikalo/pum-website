const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { prisma } = require("../db");
const config = require("../config");

/* ------------------------ Config & Paths ------------------------ */
const {
    WEB_ORIGIN,
    PUBLIC_API_BASE,
    MAIL_FROM,
    NEWSLETTER_SECRET,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS
} = config;

const UPLOAD_ROOT = path.resolve(__dirname, "..", "..", "uploads");
// Ensure root exists
if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const CV_DIR = path.join(UPLOAD_ROOT, "cv");
const AVATAR_DIR = path.join(UPLOAD_ROOT, "avatars");
const eventsDir = path.join(UPLOAD_ROOT, "events");
const projectsDir = path.join(UPLOAD_ROOT, "projects");
const blogsDir = path.join(UPLOAD_ROOT, "blogs");

[CV_DIR, AVATAR_DIR, eventsDir, projectsDir, blogsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* ------------------------ Mailer ------------------------ */

let mailTransporter = null;
if (SMTP_HOST) {
    mailTransporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
}

/* ------------------------ Helpers ------------------------ */
function abs(u, req) {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    const base = PUBLIC_API_BASE || `${req.protocol}://${req.get("host")}`;
    const rel = u.startsWith("/") ? u : `/${u}`;
    return `${base}${rel}`;
}

async function upsertStringList(list, modelName, ctx = prisma) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const nameRaw of list) {
        const name = String(nameRaw || "").trim();
        if (!name) continue;
        const row = await ctx[modelName].upsert({
            where: { name },
            create: { name },
            update: {},
            select: { id: true },
        });
        out.push(row.id);
    }
    return out;
}

function renderBaseEmailHtml({ title, preheader, bodyHtml }) {
    const safeTitle = (title || "PUM").toString().slice(0, 200);
    const safePreheader = (preheader || "").toString().slice(0, 300);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin:0; padding:0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background-color:#f5f5f7; color:#111827; }
  .wrapper { width:100%; background-color:#f5f5f7; padding:24px 0; }
  .container { max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e5e7eb; }
  .header { padding:16px 24px; border-bottom:1px solid #e5e7eb; background:#111827; color:#f9fafb; }
  .header h1 { margin:0; font-size:20px; line-height:1.3; }
  .preheader { display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; height:0; width:0; }
  .content { padding:24px; font-size:14px; line-height:1.6; color:#111827; }
  .content a { color:#2563eb; }
  .footer { padding:16px 24px; font-size:12px; line-height:1.4; color:#6b7280; border-top:1px solid #e5e7eb; background:#f9fafb; }
</style>
</head>
<body>
<span class="preheader">${safePreheader}</span>
<div class="wrapper"><div class="container">
    <div class="header"><h1>${safeTitle}</h1></div>
    <div class="content">${bodyHtml || ""}</div>
    <div class="footer"><div>PUM – Projects of United Minds</div><div style="margin-top:4px;">This message was sent from ${MAIL_FROM}.</div></div>
</div></div>
</body>
</html>`;
}

async function sendInviteEmail(to, subject, text, html) {
    if (!to) return;
    if (!mailTransporter) return;
    try {
        await mailTransporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
    } catch (err) {
        // ignore
    }
}

function genInviteToken() {
    const raw = crypto.randomBytes(32).toString("hex");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}

function signNewsletterVerifyToken(subscriber) {
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

module.exports = {
    WEB_ORIGIN,
    PUBLIC_API_BASE,
    MAIL_FROM,
    NEWSLETTER_SECRET,
    UPLOAD_ROOT,
    CV_DIR,
    AVATAR_DIR,
    eventsDir,
    projectsDir,
    blogsDir,
    mailTransporter,
    abs,
    upsertStringList,
    renderBaseEmailHtml,
    sendInviteEmail,
    genInviteToken,
    signNewsletterVerifyToken,
    signNewsletterUnsubToken
};