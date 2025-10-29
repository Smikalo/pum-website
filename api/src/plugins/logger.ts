import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

/**
 * No-op logger plugin.
 * We keep this file so the include pattern compiles cleanly,
 * but logging is configured directly in buildApp() via Fastify's logger.
 */
export const registerLogger: FastifyPluginAsync = fp(async (_app) => {
    // Using Fastify's built-in pino logger configured in app.ts
});
