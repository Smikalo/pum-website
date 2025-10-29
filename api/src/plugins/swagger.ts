import { type FastifyInstance, type FastifyPluginAsync } from "fastify";
import swagger from "@fastify/swagger";

export const registerSwagger: FastifyPluginAsync = async (app: FastifyInstance) => {
    await app.register(swagger, {
        openapi: {
            info: {
                title: "PUM API",
                version: "0.1.0",
                description: "Backend for PUM site (members, projects, events, blog)"
            },
            servers: [{ url: "/" }]
        }
    });
};
