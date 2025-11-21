// api/src/config.ts

const {
    PORT,
    NODE_ENV,
    DATABASE_URL,
    JWT_ACCESS_SECRET,
    JWT_ACCESS_TTL_SEC,
    JWT_REFRESH_TTL_DAYS,
    REFRESH_COOKIE_NAME,
    CSRF_COOKIE_NAME,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
    COOKIE_DOMAIN,
    COOKIE_PATH,
    PUBLIC_API_BASE,
    WEB_ORIGIN,
    MAIL_FROM,
    NEWSLETTER_SECRET,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS
} = process.env;

export interface Config {
    PORT: number;
    NODE_ENV: string;
    DATABASE_URL?: string;
    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_TTL_SEC: number;
    JWT_REFRESH_TTL_DAYS: number;
    REFRESH_COOKIE_NAME: string;
    CSRF_COOKIE_NAME: string;
    COOKIE_SECURE: boolean;
    COOKIE_SAMESITE: string;
    COOKIE_DOMAIN?: string;
    COOKIE_PATH: string;
    PUBLIC_API_BASE?: string;
    WEB_ORIGIN: string;
    MAIL_FROM: string;
    NEWSLETTER_SECRET: string;
    SMTP_HOST?: string;
    SMTP_PORT: number;
    SMTP_USER?: string;
    SMTP_PASS?: string;
}

const config: Config = {
    PORT: Number(PORT || 3001),
    NODE_ENV: NODE_ENV || 'development',
    DATABASE_URL: DATABASE_URL,

    JWT_ACCESS_SECRET: JWT_ACCESS_SECRET || "dev-only-change-me",
    JWT_ACCESS_TTL_SEC: Number(JWT_ACCESS_TTL_SEC || 15 * 60),
    JWT_REFRESH_TTL_DAYS: Number(JWT_REFRESH_TTL_DAYS || 30),

    REFRESH_COOKIE_NAME: REFRESH_COOKIE_NAME || "refreshToken",
    CSRF_COOKIE_NAME: CSRF_COOKIE_NAME || "XSRF-TOKEN",
    COOKIE_SECURE: (COOKIE_SECURE || "true") !== "false",
    COOKIE_SAMESITE: COOKIE_SAMESITE || "Lax",
    COOKIE_DOMAIN: COOKIE_DOMAIN || undefined,
    COOKIE_PATH: COOKIE_PATH || "/api/auth",

    PUBLIC_API_BASE: PUBLIC_API_BASE || undefined,
    WEB_ORIGIN: WEB_ORIGIN || "http://localhost:3000",

    MAIL_FROM: MAIL_FROM || "contact@the-pum.com",
    NEWSLETTER_SECRET: NEWSLETTER_SECRET || "dev-only-newsletter-secret",

    SMTP_HOST: SMTP_HOST,
    SMTP_PORT: Number(SMTP_PORT || 587),
    SMTP_USER: SMTP_USER || undefined,
    SMTP_PASS: SMTP_PASS || undefined
};

export default config;