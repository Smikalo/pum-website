import { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import helmet from "@fastify/helmet";

export const registerSecurity: FastifyPluginAsync = async (app: FastifyInstance) => {
    // baseline Helmet config; routes can override later
    await app.register(helmet, {
        // contentSecurityPolicy: { ... } // (enable and tune in prod)
    });
};
