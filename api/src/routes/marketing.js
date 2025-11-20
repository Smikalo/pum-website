const express = require("express");
const z = require("zod");
const jwt = require("jsonwebtoken");
const { prisma } = require("../db");
const {
    sendOk,
    asyncHandler
} = require("../utils/http");
const {
    sanitizePlainText,
    sanitizeEmailInput,
    sanitizeHeaderValue,
    safeReplyTo,
} = require("../utils/validation");
const {
    MAIL_FROM,
    NEWSLETTER_SECRET,
    mailTransporter,
    renderBaseEmailHtml,
    signNewsletterVerifyToken,
    WEB_ORIGIN
} = require("../utils/shared");
const {
    BadRequestError
} = require("../errors");

const router = express.Router();

// Simple in-memory IP rate limiter
const contactIpBuckets = new Map();
function allowContactFromIp(ip) {
    const now = Date.now();
    const bucket = contactIpBuckets.get(ip) || [];
    const recent = bucket.filter(t => now - t < 60 * 60 * 1000);
    if (recent.length >= 3) return false;
    recent.push(now);
    contactIpBuckets.set(ip, recent);
    return true;
}

function clientIp(req) {
    return (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || req.ip || "unknown";
}

const contactSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().optional(),
    topic: z.string().optional(),
    message: z.string().min(1),
    subscribe: z.boolean().optional(),
    source: z.string().optional(),
});

router.post("/contact", asyncHandler(async (req, res) => {
    const ip = clientIp(req);
    if (!allowContactFromIp(ip)) {
        return res.status(429).json({ ok: false, error: "Too many contact requests from this IP. Please try again later." });
    }

    const parsed = contactSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const raw = parsed.data;
    const name = sanitizePlainText(raw.name, { maxLen: 200 });
    const email = sanitizeEmailInput(raw.email);
    const role = sanitizePlainText(raw.role, { maxLen: 100 });
    const topic = sanitizePlainText(raw.topic, { maxLen: 100 });
    const message = sanitizePlainText(raw.message, { maxLen: 10_000 });
    const subscribe = !!raw.subscribe;
    const source = raw.source ? sanitizePlainText(raw.source, { maxLen: 100 }) : null;

    if (!email) throw new BadRequestError("Invalid email address.");

    try {
        const toAddress = MAIL_FROM || "contact@the-pum.com";
        const subject = sanitizeHeaderValue(`[PUM contact] ${topic} — ${name} (${role})`);
        const text = `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nRole: ${role}\nTopic: ${topic}\nSubscribe to newsletter: ${subscribe ? "YES" : "no"}\nSource: ${source || "n/a"}\nIP: ${ip}\n\nMessage:\n${message}\n`;
        const html = renderBaseEmailHtml({
            title: "New contact form submission",
            preheader: `${name} sent a message via the contact form.`,
            bodyHtml: `<p>New contact form submission:</p><p><strong>Name:</strong> ${name}<br/><strong>Email:</strong> ${email}<br/><strong>Role:</strong> ${role}<br/><strong>Topic:</strong> ${topic}<br/><strong>Subscribe to newsletter:</strong> ${subscribe ? "YES" : "no"}<br/><strong>Source:</strong> ${source || "n/a"}<br/><strong>IP:</strong> ${ip}</p><p><strong>Message:</strong></p><p>${message.replace(/\n/g, "<br/>")}</p>`,
        });

        if (mailTransporter) {
            await mailTransporter.sendMail({ from: MAIL_FROM, to: toAddress, replyTo: safeReplyTo(email), subject, text, html });
        }
    } catch (err) {
        // ignore
    }

    try {
        if (prisma.contactMessage) {
            await prisma.contactMessage.create({
                data: { name, email, role, topic, message, source: source || null, subscribeRequested: !!subscribe, ipAddress: ip },
            });
        }
    } catch (err) {
        // ignore
    }

    try {
        if (subscribe && prisma.newsletterSubscriber) {
            const emailLower = email.toLowerCase();
            const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: emailLower } });
            let sub;
            if (!existing) {
                sub = await prisma.newsletterSubscriber.create({
                    data: { email: emailLower, name, lastSource: source || "contact-form", unsubscribedAt: null, verifiedAt: null },
                });
            } else {
                if (existing.unsubscribedAt) sub = existing;
                else sub = await prisma.newsletterSubscriber.update({ where: { email: emailLower }, data: { name, lastSource: source || "contact-form" } });
            }

            if (!sub.unsubscribedAt && !sub.verifiedAt && mailTransporter) {
                const webBase = WEB_ORIGIN.replace(/\/$/, "");
                const verifyToken = signNewsletterVerifyToken({ id: sub.id, email: sub.email });
                const verifyUrl = `${webBase}/newsletter/verify?token=${encodeURIComponent(verifyToken)}`;
                const subject = sanitizeHeaderValue("Please confirm your subscription to PUM updates");
                const text = `Hi${sub.name ? " " + sub.name : ""},\n\nThanks for staying in touch with PUM!\n\nPlease confirm your subscription by clicking the link below:\n${verifyUrl}\n\nIf you did not request this, you can safely ignore this email and you won't be subscribed.\n`;
                const html = renderBaseEmailHtml({
                    title: "Confirm your subscription",
                    preheader: "Please confirm your subscription to PUM updates.",
                    bodyHtml: `<p>Hi${sub.name ? " " + sub.name : ""},</p><p>Thanks for staying in touch with PUM!</p><p>Please confirm your subscription by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you did not request this, you can safely ignore this email and you won't be subscribed.</p>`,
                });

                try {
                    await mailTransporter.sendMail({ from: MAIL_FROM, to: sub.email, subject, text, html });
                } catch (err) {
                    // ignore
                }
            }
        }
    } catch (err) {
        // ignore
    }

    sendOk(res, { ok: true, message: "Thanks! We’ll be in touch soon." });
}));

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

router.post("/newsletter/subscribe", asyncHandler(async (req, res) => {
    if (!prisma.newsletterSubscriber) return res.status(501).json({ ok: false, error: "Newsletter feature not enabled on this server" });

    const ip = clientIp(req);
    if (!allowContactFromIp(ip)) return res.status(429).json({ ok: false, error: "Too many subscription requests from this IP. Please try again later." });

    const parsed = newsletterSubscribeSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const raw = parsed.data;
    const email = sanitizeEmailInput(raw.email);
    const name = raw.name ? sanitizePlainText(raw.name, { maxLen: 200 }) : null;
    const source = raw.source ? sanitizePlainText(raw.source, { maxLen: 100 }) : null;

    if (!email) throw new BadRequestError("Invalid email address.");

    const emailLower = email.toLowerCase();

    let sub = await prisma.newsletterSubscriber.findUnique({ where: { email: emailLower } });

    if (!sub) {
        sub = await prisma.newsletterSubscriber.create({
            data: { email: emailLower, name: name || null, lastSource: source || "newsletter-form", unsubscribedAt: null, verifiedAt: null },
        });
    } else {
        if (!sub.unsubscribedAt) {
            sub = await prisma.newsletterSubscriber.update({
                where: { email: emailLower },
                data: { name: name || sub.name, lastSource: source || sub.lastSource || "newsletter-form" },
            });
        }
    }

    if (!sub.unsubscribedAt && !sub.verifiedAt && mailTransporter) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const verifyToken = signNewsletterVerifyToken({ id: sub.id, email: sub.email });
        const verifyUrl = `${webBase}/newsletter/verify?token=${encodeURIComponent(verifyToken)}`;
        const subject = sanitizeHeaderValue("Please confirm your subscription to PUM updates");
        const text = `Hi${sub.name ? " " + sub.name : ""},\n\nThanks for staying in touch with PUM!\n\nPlease confirm your subscription by clicking the link below:\n${verifyUrl}\n\nIf you did not request this, you can safely ignore this email and you won't be subscribed.\n`;
        const html = renderBaseEmailHtml({
            title: "Confirm your subscription",
            preheader: "Please confirm your subscription to PUM updates.",
            bodyHtml: `<p>Hi${sub.name ? " " + sub.name : ""},</p><p>Thanks for staying in touch with PUM!</p><p>Please confirm your subscription by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you did not request this, you can safely ignore this email and you won't be subscribed.</p>`,
        });

        try {
            await mailTransporter.sendMail({ from: MAIL_FROM, to: sub.email, subject, text, html });
        } catch (err) {
            // ignore
        }
    }

    return res.json({ ok: true, email: sub.email, status: sub.verifiedAt ? "already-verified" : "pending-verification" });
}));

router.post("/newsletter/verify", asyncHandler(async (req, res) => {
    if (!prisma.newsletterSubscriber) return res.status(501).json({ ok: false, error: "Newsletter feature not enabled on this server" });

    const parsed = newsletterVerifySchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid verification token.", { code: "INVALID_INPUT" });

    const { token } = parsed.data;
    let decoded;
    try {
        decoded = jwt.verify(token, NEWSLETTER_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
        const isExpired = err && err.name === "TokenExpiredError";
        throw new BadRequestError(
            isExpired ? "This verification link has expired." : "This verification link is invalid.",
            { code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID" }
        );
    }

    if (!decoded || decoded.scope !== "newsletter-verify") throw new BadRequestError("This link is not valid for newsletter verification.", { code: "BAD_SCOPE" });

    const subscriberId = decoded.sub;
    const tokenEmail = (decoded.email || "").toLowerCase();

    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
    if (!subscriber) throw new BadRequestError("We couldn’t find a matching subscription for this link.", { code: "NOT_FOUND" });

    const subEmailLower = (subscriber.email || "").toLowerCase();
    if (tokenEmail && tokenEmail !== subEmailLower) throw new BadRequestError("This verification link does not match this subscription.", { code: "EMAIL_MISMATCH" });

    if (subscriber.verifiedAt) return res.json({ ok: true, status: "already-verified", email: subscriber.email });
    if (subscriber.unsubscribedAt) throw new BadRequestError("This subscription was cancelled and cannot be verified.", { code: "UNSUBSCRIBED" });

    const updated = await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { verifiedAt: new Date(), lastSource: "newsletter-verify-link" },
    });

    return res.json({ ok: true, status: "verified", email: updated.email });
}));

router.post("/newsletter/unsubscribe", asyncHandler(async (req, res) => {
    if (!prisma.newsletterSubscriber) return res.status(501).json({ ok: false, error: "Newsletter feature not enabled on this server" });

    const parsed = newsletterUnsubscribeSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid unsubscribe token.", { code: "INVALID_INPUT" });

    const { token } = parsed.data;
    let decoded;
    try {
        decoded = jwt.verify(token, NEWSLETTER_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
        const isExpired = err && err.name === "TokenExpiredError";
        throw new BadRequestError(
            isExpired ? "This unsubscribe link has expired." : "This unsubscribe link is invalid.",
            { code: isExpired ? "TOKEN_EXPIRED" : "TOKEN_INVALID" }
        );
    }

    if (!decoded || decoded.scope !== "newsletter-unsub") throw new BadRequestError("This unsubscribe link is not valid for newsletter settings.", { code: "BAD_SCOPE" });

    const subscriberId = decoded.sub;
    const tokenEmail = (decoded.email || "").toLowerCase();

    const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
    if (!subscriber) throw new BadRequestError("We couldn’t find a matching subscription for this link.", { code: "NOT_FOUND" });

    const subEmailLower = (subscriber.email || "").toLowerCase();
    if (tokenEmail && tokenEmail !== subEmailLower) throw new BadRequestError("This unsubscribe link does not match this subscription.", { code: "EMAIL_MISMATCH" });

    if (subscriber.unsubscribedAt) return res.json({ ok: true, status: "already-unsubscribed", email: subscriber.email });

    const updated = await prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { unsubscribedAt: new Date(), lastSource: "unsubscribe-link" },
    });

    return res.json({ ok: true, status: "unsubscribed", email: updated.email });
}));

module.exports = router;