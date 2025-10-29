import fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";

export async function buildApp() {
    const app = fastify({
        logger: {
            level: process.env.LOG_LEVEL || "info"
        }
    });

    // Security & QoS
    await app.register(helmet);
    await app.register(cors, {
        origin: [WEB_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"],
        credentials: true
    });
    await app.register(rateLimit, { max: 200, timeWindow: "1 minute" });

    // --- OpenAPI (register swagger BEFORE swagger-ui) ---
    // fastify-swagger v9.x is the line for Fastify ^5 (compat table).
    // swagger-ui v5.x supports Fastify v5.  :contentReference[oaicite:1]{index=1}
    await app.register(swagger, {
        openapi: {
            info: {
                title: "PUM API",
                description: "Backend for PUM (Project of United Minds)",
                version: "0.1.0"
            },
            servers: [{ url: "/" }]
        }
    });

    await app.register(swaggerUi, {
        routePrefix: "/docs", // e.g. http://localhost:3001/docs
        uiConfig: {
            deepLinking: true
        },
        staticCSP: true
    });

    // --- Routes ---
    app.get("/", async () => ({ ok: true, name: "PUM API", version: "0.1.0" }));

    app.get("/health", async () => ({
        ok: true,
        uptime: process.uptime(),
        version: "0.1.0"
    }));

    // legacy alias
    app.get("/health/z", async () => ({
        ok: true,
        uptime: process.uptime(),
        version: "0.1.0"
    }));

    return app;
}
