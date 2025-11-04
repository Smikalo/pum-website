// api/src/auth.js
const express = require("express");
const z = require("zod");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { prisma } = require("./db");
const crypto = require("crypto");
const cookie = require("cookie");
const slugify = require("slugify"); // NEW: for member slug from name/email

const router = express.Router();

// --- Config (env + defaults) ---
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 15 * 60); // 15 minutes
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-only-change-me";
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || "XSRF-TOKEN";
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "true") !== "false";
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || "Lax";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const COOKIE_PATH = process.env.COOKIE_PATH || "/api/auth";
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || null;

function abs(u, req) {
    if (!u) return null;
    if (/^https?:\/\//i.test(u)) return u;
    const base = PUBLIC_API_BASE || `${req.protocol}://${req.get("host")}`;
    const rel = u.startsWith("/") ? u : `/${u}`;
    return `${base}${rel}`;
}

function setCookie(res, name, value, opts = {}) {
    res.cookie(name, value, {
        httpOnly: opts.httpOnly ?? true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAMESITE,
        domain: COOKIE_DOMAIN,
        path: COOKIE_PATH,
        ...opts,
    });
}
function clearCookie(res, name) {
    res.clearCookie(name, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAMESITE,
        domain: COOKIE_DOMAIN,
        path: COOKIE_PATH,
    });
}

function signAccessToken(user, roles) {
    const payload = { sub: user.id, email: user.email, roles };
    return jwt.sign(payload, JWT_ACCESS_SECRET, { algorithm: "HS256", expiresIn: ACCESS_TTL_SEC });
}
function genRefreshToken() {
    const raw = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}
function parseCookies(req) {
    return cookie.parse(req.headers.cookie || "");
}

// CSRF: double-submit cookie
function ensureCsrf(req, res, next) {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
    const cookies = parseCookies(req);
    const cookieVal = cookies[CSRF_COOKIE_NAME];
    const headerVal = req.get("X-CSRF-Token");
    if (!cookieVal || !headerVal || cookieVal !== headerVal) {
        return res.status(403).json({ ok: false, error: "CSRF token missing or invalid" });
    }
    next();
}

// Ensure CSRF token cookie exists
router.get("/csrf", (req, res) => {
    const cookies = parseCookies(req);
    if (!cookies[CSRF_COOKIE_NAME]) {
        res.cookie(CSRF_COOKIE_NAME, crypto.randomBytes(20).toString("base64url"), {
            httpOnly: false,
            secure: COOKIE_SECURE,
            sameSite: COOKIE_SAMESITE,
            domain: COOKIE_DOMAIN,
            path: "/",
        });
    }
    res.json({ ok: true });
});

// Schemas
const emailSchema = z.string().email().transform((e) => e.trim().toLowerCase());
const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(8).max(200),
});

// --- Login ---
router.post("/login", ensureCsrf, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "Invalid input" });
    const { email, password } = parsed.data;

    const invalid = () => res.status(401).json({ ok: false, error: "Invalid email or password" });

    const user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true, member: true },
    });
    if (!user) return invalid();

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return invalid();

    const roles = user.roles.map((r) => r.role);
    const accessToken = signAccessToken(user, roles);

    const { raw: refreshRaw, hash: refreshHash } = genRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
        data: {
            userId: user.id,
            refreshTokenHash: refreshHash,
            userAgent: req.get("user-agent") || null,
            ip: req.ip || null,
            expiresAt,
        },
    });
    setCookie(res, REFRESH_COOKIE_NAME, refreshRaw, { httpOnly: true, expires: expiresAt });

    return res.json({
        ok: true,
        accessToken,
        user: {
            id: user.id,
            email: user.email,
            roles,
            member: user.member
                ? {
                    slug: user.member.slug,
                    name: user.member.name,
                    avatarUrl: abs(user.member.avatarUrl || null, req),
                    focusArea: user.member.focusArea || null,
                }
                : null,
        },
    });
});

// --- Refresh ---
router.post("/refresh", ensureCsrf, async (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies[REFRESH_COOKIE_NAME];
    if (!token) return res.status(401).json({ ok: false, error: "Missing refresh token" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = await prisma.session.findFirst({
        where: { refreshTokenHash: tokenHash, expiresAt: { gt: new Date() } },
        include: { user: { include: { roles: true, member: true } } },
    });
    if (!session) return res.status(401).json({ ok: false, error: "Invalid refresh token" });

    const roles = session.user.roles.map((r) => r.role);
    const accessToken = signAccessToken(session.user, roles);

    const { raw: refreshRaw, hash: refreshHash } = genRefreshToken();
    const newExpiry = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.update({
        where: { id: session.id },
        data: {
            refreshTokenHash: refreshHash,
            expiresAt: newExpiry,
            userAgent: req.get("user-agent") || session.userAgent,
            ip: req.ip || session.ip,
        },
    });

    setCookie(res, REFRESH_COOKIE_NAME, refreshRaw, { httpOnly: true, expires: newExpiry });
    return res.json({ ok: true, accessToken });
});

// --- Logout ---
router.post("/logout", ensureCsrf, async (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies[REFRESH_COOKIE_NAME];
    if (token) {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await prisma.session.deleteMany({ where: { refreshTokenHash: tokenHash } }).catch(() => {});
    }
    clearCookie(res, REFRESH_COOKIE_NAME);
    res.json({ ok: true });
});

// --- Accept / complete event invitation ---
router.post("/invite/consume", ensureCsrf, async (req, res) => {
    const schema = z.object({
        token: z.string().min(20),
        name: z.string().min(2).max(200).optional(),
        password: z.string().min(8).max(200).optional(),
        passwordRepeat: z.string().min(8).max(200).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid input" });
    }

    const { token, name, password, passwordRepeat } = parsed.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await prisma.eventInvite.findFirst({
        where: {
            tokenHash,
            status: "PENDING",
            expiresAt: { gt: new Date() },
        },
        include: {
            event: true,
        },
    });

    if (!invite) {
        return res.status(400).json({ ok: false, error: "Invalid or expired invite" });
    }

    const email = invite.email.toLowerCase();
    let user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true, member: true },
    });

    let newUser = false;

    if (!user) {
        // New user path: we need name + password
        if (!password || !passwordRepeat || password !== passwordRepeat || !name) {
            return res.status(400).json({
                ok: false,
                needsPassword: true,
                email,
                eventSlug: invite.event.slug,
                error: !password || !name
                    ? "Missing fields"
                    : password !== passwordRepeat
                        ? "Passwords do not match"
                        : "Invalid input",
            });
        }

        const passwordHash = await argon2.hash(password);
        const memberName = name.trim();
        const localPart = email.split("@")[0];

        let base =
            (slugify(memberName, { lower: true, strict: true }) || "").trim() ||
            (slugify(localPart, { lower: true, strict: true }) || "").trim() ||
            localPart ||
            "member";

        let slug = base;
        let i = 1;
        while (await prisma.member.findUnique({ where: { slug } })) {
            i += 1;
            slug = `${base}-${i}`;
            if (i > 9999) break;
        }

        const member = await prisma.member.create({
            data: {
                slug,
                name: memberName,
            },
        });

        user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                member: { connect: { id: member.id } },
                roles: { create: [{ role: "MEMBER" }] },
            },
            include: { roles: true, member: true },
        });

        newUser = true;
    } else {
        // Existing user path: ensure they have MEMBER role and a member profile
        const hasMemberRole = (user.roles || []).some((r) => r.role === "MEMBER");
        if (!hasMemberRole) {
            await prisma.userRole.create({
                data: { userId: user.id, role: "MEMBER" },
            });
        }

        if (!user.member) {
            const localPart = email.split("@")[0];
            let base =
                (slugify(localPart, { lower: true, strict: true }) || "").trim() ||
                localPart ||
                "member";
            let slug = base;
            let i = 1;
            while (await prisma.member.findUnique({ where: { slug } })) {
                i += 1;
                slug = `${base}-${i}`;
                if (i > 9999) break;
            }

            const member = await prisma.member.create({
                data: {
                    slug,
                    name: localPart,
                },
            });

            await prisma.user.update({
                where: { id: user.id },
                data: { memberId: member.id },
            });
        }

        // Reload with updated roles/member
        user = await prisma.user.findUnique({
            where: { id: user.id },
            include: { roles: true, member: true },
        });
    }

    // Ensure user is attached as attendee of the event
    if (user && user.member && user.member.id) {
        const existing = await prisma.memberEvent.findFirst({
            where: { memberId: user.member.id, eventId: invite.eventId },
        });
        if (!existing) {
            await prisma.memberEvent.create({
                data: {
                    memberId: user.member.id,
                    eventId: invite.eventId,
                    role: null,
                },
            });
        }
    }

    // Mark invite as accepted
    await prisma.eventInvite.update({
        where: { id: invite.id },
        data: {
            status: "ACCEPTED",
            consumedAt: new Date(),
        },
    });

    // Create session and access token (same as login)
    const roles = (user.roles || []).map((r) => r.role);
    const accessToken = signAccessToken(user, roles);

    const { raw: refreshRaw, hash: refreshHash } = genRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
        data: {
            userId: user.id,
            refreshTokenHash: refreshHash,
            userAgent: req.get("user-agent") || null,
            ip: req.ip || null,
            expiresAt,
        },
    });
    setCookie(res, REFRESH_COOKIE_NAME, refreshRaw, { httpOnly: true, expires: expiresAt });

    return res.json({
        ok: true,
        accessToken,
        newUser,
        eventSlug: invite.event.slug,
        user: {
            id: user.id,
            email: user.email,
            roles,
            member: user.member
                ? {
                    slug: user.member.slug,
                    name: user.member.name,
                    avatarUrl: abs(user.member.avatarUrl || null, req),
                    focusArea: user.member.focusArea || null,
                }
                : null,
        },
    });
});

// --- Me ---
router.get("/me", async (req, res) => {
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) return res.status(401).json({ ok: false, error: "Missing access token" });
    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            include: { roles: true, member: true },
        });
        if (!user) return res.status(401).json({ ok: false, error: "Unknown user" });
        const roles = user.roles.map((r) => r.role);
        res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                roles,
                member: user.member
                    ? {
                        slug: user.member.slug,
                        name: user.member.name,
                        avatarUrl: abs(user.member.avatarUrl || null, req),
                        focusArea: user.member.focusArea || null,
                    }
                    : null,
            },
        });
    } catch (e) {
        return res.status(401).json({ ok: false, error: "Invalid access token" });
    }
});

module.exports = { authRouter: router };
