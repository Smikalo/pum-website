import { type FastifyInstance, type FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", async () => ({
        ok: true,
        service: "pum-api",
        port: Number(process.env.API_PORT || 3001)
    }));

    app.get("/z", async () => ({
        ok: true,
        uptime: process.uptime(),
        version: "0.1.0"
    }));
};
