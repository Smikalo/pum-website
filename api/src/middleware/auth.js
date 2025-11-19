// api/src/middleware/auth.js
const jwt = require("jsonwebtoken");
const { prisma } = require("../db");
const { sendUnauthorized, sendForbidden } = require("../utils/http");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-only-change-me";

/**
 * Authentication middleware.
 * Verifies the Bearer token, looks up the user (with roles/member), and attaches it to req.user.
 */
async function requireAuth(req, res, next) {
    const auth = req.get("authorization") || "";
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) {
        return sendUnauthorized(res, "Missing access token");
    }

    try {
        const decoded = jwt.verify(m[1], JWT_ACCESS_SECRET, {
            algorithms: ["HS256"],
        });
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            include: { roles: true, member: true },
        });

        if (!user) {
            return sendUnauthorized(res, "Unknown user");
        }

        req.user = user;
        next();
    } catch (err) {
        return sendUnauthorized(res, "Invalid access token");
    }
}

/**
 * Middleware to check if user has at least MEMBER role (or ADMIN/MODERATOR).
 * Equivalent to checking if roles includes 'MEMBER', 'ADMIN', or 'MODERATOR'.
 */
function requireMember(req, res, next) {
    if (!req.user) return sendUnauthorized(res);
    const roles = (req.user.roles || []).map((r) => r.role);
    const hasMemberRole = roles.some((r) =>
        ["ADMIN", "MODERATOR", "MEMBER"].includes(r)
    );

    if (!hasMemberRole) {
        return sendForbidden(res, "Insufficient permissions");
    }
    next();
}

/**
 * Role-based authorization middleware: Admin or Moderator.
 * Assumes requireAuth has already run.
 */
function requireAdminOrModerator(req, res, next) {
    if (!req.user) return sendUnauthorized(res);

    const roles = (req.user.roles || []).map((r) => r.role);
    const isAdminOrModerator = roles.some((r) =>
        ["ADMIN", "MODERATOR"].includes(r)
    );

    if (!isAdminOrModerator) {
        return sendForbidden(res, "Insufficient permissions");
    }
    next();
}

/**
 * Authorization middleware: Admin, Moderator, or Resource Creator.
 * Assumes requireAuth has already run.
 *
 * @param {Function} isCreatorFn - Async function(req) returning boolean if user is the creator/authorized.
 */
function requireAdminOrModeratorOrCreator(isCreatorFn) {
    return async (req, res, next) => {
        if (!req.user) return sendUnauthorized(res);

        const roles = (req.user.roles || []).map((r) => r.role);
        const isAdminOrModerator = roles.some((r) =>
            ["ADMIN", "MODERATOR"].includes(r)
        );

        if (isAdminOrModerator) {
            return next();
        }

        // Not admin/mod? Check if creator/authorized.
        let isCreator = false;
        try {
            isCreator = await isCreatorFn(req);
        } catch (err) {
            // If checking creator fails (e.g. DB error or not found), assume not creator
            isCreator = false;
        }

        if (isCreator) {
            return next();
        }

        return sendForbidden(res, "Insufficient permissions");
    };
}

module.exports = {
    requireAuth,
    requireMember,
    requireAdminOrModerator,
    requireAdminOrModeratorOrCreator,
};