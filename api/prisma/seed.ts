import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // Phase 1: import your existing seeds (members/projects/events).
    // Keep this as a no-op in Phase 0 to avoid migration drift.
    console.log("Seed: nothing to do in Phase 0.");
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
