// api/src/auth.js
const express = require("express");
const z = require("zod");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const cookie = require("cookie");
const slugify = require("slugify");
const rateLimit = require("express-rate-limit");

const { prisma } = require("./db");
const { ensureMemberAvatar } = require("./imageDefaults");
const { sendOk, asyncHandler } = require("./utils/http");
const { UnauthorizedError, BadRequestError, ForbiddenError } = require("./errors");

const router = express.Router();

// --- Config ---
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 15 * 60);
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
    return jwt.sign(payload, JWT_ACCESS_SECRET, {
        algorithm: "HS256",
        expiresIn: ACCESS_TTL_SEC,
    });
}

function genRefreshToken() {
    const raw = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(raw).digest("hex");
    return { raw, hash };
}

function parseCookies(req) {
    return cookie.parse(req.headers.cookie || "");
}

// --- CSRF ---
function ensureCsrf(req, res, next) {
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
    const cookies = parseCookies(req);
    const cookieVal = cookies[CSRF_COOKIE_NAME];
    const headerVal = req.get("X-CSRF-Token");
    if (!cookieVal || !headerVal || cookieVal !== headerVal) {
        return next(new ForbiddenError("CSRF token missing or invalid"));
    }
    next();
}

router.get("/csrf", (req, res) => {
    const cookies = parseCookies(req);
    if (!cookies[CSRF_COOKIE_NAME]) {
        res.cookie(CSRF_COOKIE_NAME, crypto.randomBytes(20).toString("base64url"), {
            httpOnly: false, secure: COOKIE_SECURE, sameSite: COOKIE_SAMESITE, domain: COOKIE_DOMAIN, path: "/",
        });
    }
    sendOk(res, { ok: true });
});

const loginSchema = z.object({
    email: z.string().email().transform((e) => e.trim().toLowerCase()),
    password: z.string().min(8).max(200),
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { ok: false, error: "Too many attempts. Try again later." },
});

router.post("/login", authLimiter, ensureCsrf, asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestError("Invalid input");
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email }, include: { roles: true, member: true } });
    if (!user) throw new UnauthorizedError("Invalid email or password");
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedError("Invalid email or password");

    const roles = user.roles.map((r) => r.role);
    const accessToken = signAccessToken(user, roles);
    const { raw: refreshRaw, hash: refreshHash } = genRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
        data: { userId: user.id, refreshTokenHash: refreshHash, userAgent: req.get("user-agent") || null, ip: req.ip || null, expiresAt },
    });
    setCookie(res, REFRESH_COOKIE_NAME, refreshRaw, { httpOnly: true, expires: expiresAt });

    sendOk(res, {
        ok: true,
        accessToken,
        user: {
            id: user.id,
            email: user.email,
            roles,
            member: user.member ? { slug: user.member.slug, name: user.member.name, avatarUrl: abs(user.member.avatarUrl || null, req), focusArea: user.member.focusArea || null } : null,
        },
    });
}));

router.post("/refresh", ensureCsrf, asyncHandler(async (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies[REFRESH_COOKIE_NAME];
    if (!token) throw new UnauthorizedError("Missing refresh token");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = await prisma.session.findFirst({
        where: { refreshTokenHash: tokenHash, expiresAt: { gt: new Date() } },
        include: { user: { include: { roles: true, member: true } } },
    });
    if (!session) throw new UnauthorizedError("Invalid refresh token");

    const roles = session.user.roles.map((r) => r.role);
    const accessToken = signAccessToken(session.user, roles);
    const { raw: refreshRaw, hash: refreshHash } = genRefreshToken();
    const newExpiry = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: refreshHash, expiresAt: newExpiry, userAgent: req.get("user-agent") || session.userAgent, ip: req.ip || session.ip },
    });
    setCookie(res, REFRESH_COOKIE_NAME, refreshRaw, { httpOnly: true, expires: newExpiry });
    sendOk(res, { ok: true, accessToken });
}));

router.post("/logout", ensureCsrf, asyncHandler(async (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies[REFRESH_COOKIE_NAME];
    if (token) {
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await prisma.session.deleteMany({ where: { refreshTokenHash: tokenHash } }).catch(() => {});
    }
    clearCookie(res, REFRESH_COOKIE_NAME);
    sendOk(res, { ok: true });
}));

router.post("/invite/consume", authLimiter, ensureCsrf, asyncHandler(async (req, res) => {
    const schema = z.object({
        token: z.string().min(20),
        name: z.string().min(2).max(200).optional(),
        password: z.string().min(8).max(200).optional(),
        passwordRepeat: z.string().min(8).max(200).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        throw new BadRequestError("Invalid input");
    }

    const { token, name, password, passwordRepeat } = parsed.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    let projectInvite = await prisma.projectInvite.findFirst({
        where: { tokenHash, status: "PENDING", expiresAt: { gt: new Date() } },
        include: { project: true },
    });

    let eventInvite = null;
    if (!projectInvite) {
        eventInvite = await prisma.eventInvite.findFirst({
            where: { tokenHash, status: "PENDING", expiresAt: { gt: new Date() } },
            include: { event: true },
        });
    }

    if (!projectInvite && !eventInvite) {
        throw new BadRequestError("Invite invalid or expired.");
    }

    const inviteObj = projectInvite || eventInvite;
    const email = (inviteObj.email || "").toLowerCase();

    let user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true, member: true },
    });

    let newUser = false;

    if (!user) {
        if (!password || !passwordRepeat || password !== passwordRepeat) {
            return res.status(400).json({
                ok: false,
                error: "To accept this invite, please provide a valid password and make sure both fields match.",
                needsPassword: true,
                email,
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                ok: false,
                error: "Please provide your name to complete the invite.",
                needsName: true,
                email,
            });
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const emailLocalPart = email.split("@")[0] || "user";
        const baseSlug = slugify(name, { lower: true, strict: true }) || slugify(emailLocalPart, { lower: true, strict: true }) || emailLocalPart || "user";

        let slug = baseSlug;
        let i = 0;
        while (await prisma.member.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${++i}`;
            if (i > 20) break;
        }

        let member = await prisma.member.create({
            data: {
                slug,
                name: name.trim(),
                bio: "",
                links: {},
                avatarUrl: null,
                focusArea: null,
            },
        });

        member = await ensureMemberAvatar(member);

        user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                memberId: member.id,
                roles: { create: [{ role: "MEMBER" }] },
            },
            include: { member: true, roles: true },
        });

        newUser = true;
    } else {
        const hasMemberRole = (user.roles || []).some((r) => r.role === "MEMBER");
        if (!hasMemberRole) {
            await prisma.userRole.create({ data: { userId: user.id, role: "MEMBER" } });
        }

        if (!user.member) {
            const baseName = user.email.split("@")[0] || "user";
            const slugBase = slugify(baseName, { lower: true, strict: true }) || "user";
            let slug = slugBase;
            let i = 0;
            while (await prisma.member.findUnique({ where: { slug } })) {
                slug = `${slugBase}-${++i}`;
                if (i > 20) break;
            }

            let member = await prisma.member.create({
                data: {
                    slug,
                    name: baseName,
                    bio: "",
                    links: {},
                    avatarUrl: null,
                    focusArea: null,
                },
            });

            member = await ensureMemberAvatar(member);
            await prisma.user.update({ where: { id: user.id }, data: { memberId: member.id } });
        }

        user = await prisma.user.findUnique({ where: { id: user.id }, include: { roles: true, member: true } });
    }

    let projectSlug = null;
    let eventSlug = null;

    if (projectInvite && projectInvite.project && user.member) {
        const project = projectInvite.project;
        projectSlug = project.slug;

        const existingMemberProject = await prisma.memberProject.findUnique({
            where: { memberId_projectId: { memberId: user.member.id, projectId: project.id } },
        });

        if (!existingMemberProject) {
            await prisma.memberProject.create({
                data: {
                    memberId: user.member.id,
                    projectId: project.id,
                    role: projectInvite.role || "Contributor",
                    contribution: null,
                    isCreator: false,
                },
            });
        }

        await prisma.projectInvite.update({
            where: { id: projectInvite.id },
            data: { status: "ACCEPTED", consumedAt: new Date() },
        });
    }

    if (eventInvite && eventInvite.event && user.member) {
        const eventObj = eventInvite.event;
        eventSlug = eventObj.slug;

        const existingMemberEvent = await prisma.memberEvent.findUnique({
            where: { memberId_eventId: { memberId: user.member.id, eventId: eventObj.id } },
        });

        if (!existingMemberEvent) {
            await prisma.memberEvent.create({
                data: {
                    memberId: user.member.id,
                    eventId: eventObj.id,
                    role: null,
                },
            });
        }

        await prisma.eventInvite.update({
            where: { id: eventInvite.id },
            data: { status: "ACCEPTED", consumedAt: new Date() },
        });
    }

    const roles = (user.roles || []).map((r) => r.role);
    const accessToken = signAccessToken(user, roles);

    const { raw: refreshRaw, hash: refreshHash } = genRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
        data: { userId: user.id, refreshTokenHash: refreshHash, userAgent: req.get("user-agent") || null, ip: req.ip || null, expiresAt },
    });

    setCookie(res, REFRESH_COOKIE_NAME, refreshRaw, { httpOnly: true, expires: expiresAt });

    return res.json({
        ok: true,
        accessToken,
        newUser,
        projectSlug,
        eventSlug,
        email,
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
}));

router.get("/me", asyncHandler(async (req, res) => {
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) throw new UnauthorizedError("Missing access token");

    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
        const user = await prisma.user.findUnique({ where: { id: decoded.sub }, include: { roles: true, member: true } });
        if (!user) throw new UnauthorizedError("Unknown user");

        const roles = user.roles.map((r) => r.role);
        sendOk(res, {
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                roles,
                member: user.member ? { slug: user.member.slug, name: user.member.name, avatarUrl: abs(user.member.avatarUrl || null, req), focusArea: user.member.focusArea || null } : null,
            },
        });
    } catch (e) {
        throw new UnauthorizedError("Invalid access token");
    }
}));

module.exports = { authRouter: router };