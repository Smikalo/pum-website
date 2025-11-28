// api/src/config.js
// Backend-only configuration module.
// Do NOT import this into client-side code.

// Normalize env first
const EFFECTIVE_NODE_ENV = process.env.NODE_ENV || "development";

// ✅ Security guard: in production, required secrets must be present
if (EFFECTIVE_NODE_ENV === "production") {
    if (!process.env.JWT_ACCESS_SECRET) {
        throw new Error("Missing JWT_ACCESS_SECRET in production");
    }
    if (!process.env.DATABASE_URL) {
        throw new Error("Missing DATABASE_URL in production");
    }
}

/**
 * Note: this is plain JS, not TS.
 * Other code uses:
 *   const config = require("../src/config");
 * so we export with module.exports.
 */
const config = {
    PORT: Number(process.env.PORT || 3001),
    NODE_ENV: EFFECTIVE_NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,

    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-only-change-me",
    JWT_ACCESS_TTL_SEC: Number(process.env.JWT_ACCESS_TTL_SEC || 15 * 60),
    JWT_REFRESH_TTL_DAYS: Number(process.env.JWT_REFRESH_TTL_DAYS || 30),

    REFRESH_COOKIE_NAME: process.env.REFRESH_COOKIE_NAME || "refreshToken",
    CSRF_COOKIE_NAME: process.env.CSRF_COOKIE_NAME || "XSRF-TOKEN",
    COOKIE_SECURE: (process.env.COOKIE_SECURE || "true") !== "false",
    COOKIE_SAMESITE: process.env.COOKIE_SAMESITE || "Lax",
    COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
    COOKIE_PATH: process.env.COOKIE_PATH || "/api/auth",

    PUBLIC_API_BASE: process.env.PUBLIC_API_BASE || undefined,
    WEB_ORIGIN: process.env.WEB_ORIGIN || "http://localhost:3000",

    MAIL_FROM: process.env.MAIL_FROM || "contact@the-pum.com",
    NEWSLETTER_SECRET:
        process.env.NEWSLETTER_SECRET || "dev-only-newsletter-secret",

    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: Number(process.env.SMTP_PORT || 587),
    SMTP_USER: process.env.SMTP_USER || undefined,
    SMTP_PASS: process.env.SMTP_PASS || undefined
};

module.exports = config;
