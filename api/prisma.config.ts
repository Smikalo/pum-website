// prisma.config.ts
import "dotenv/config";
import * as path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 6 config: https://www.prisma.io/docs/orm/reference/prisma-config-reference
export default defineConfig({
    schema: path.join("prisma", "schema.prisma"),
    migrations: {
        path: path.join("prisma", "migrations"),
        seed: "tsx --env-file=.env prisma/seed.ts",
    },
});
