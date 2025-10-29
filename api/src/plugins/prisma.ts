import { type FastifyInstance, type FastifyPluginAsync } from "fastify";

declare module "fastify" {
    interface FastifyInstance {
        prisma?: any;
    }
}

export const registerPrisma: FastifyPluginAsync = async (app: FastifyInstance) => {
    try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        app.decorate("prisma", prisma);
        app.addHook("onClose", async () => prisma.$disconnect());
        app.log.info("Prisma connected");
    } catch (err) {
        app.log.warn({ err }, "Prisma not initialized, continuing without DB.");
    }
};
