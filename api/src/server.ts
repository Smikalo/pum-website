import { buildApp } from "./app.js";

const port = Number(process.env.API_PORT || 3001);
const host = process.env.API_HOST || "0.0.0.0";

(async () => {
    try {
        const app = await buildApp();
        await app.listen({ port, host });
        app.log.info(`API ready on http://${host}:${port}`);
    } catch (err) {
        console.error("Failed to start API", err);
        process.exit(1);
    }
})();
