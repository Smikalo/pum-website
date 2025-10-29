import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// ---------- helpers ----------
const readJSON = <T = any>(relPath: string): T => {
    const p = path.resolve(process.cwd(), relPath);
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
};

// Run each SQL statement separately (Prisma doesn't allow multi-statement raw SQL).
// https://github.com/prisma/prisma/discussions/24820
async function ensureFts() {
    const exec = (sql: string) => prisma.$executeRawUnsafe(sql);

    await exec(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await exec(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await exec(`ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "search" tsvector`);
    await exec(`
    CREATE OR REPLACE FUNCTION set_member_search() RETURNS trigger AS $$
    BEGIN
      NEW.search :=
        setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.headline, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.bio, '')), 'C') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW.skills, ARRAY[]::text[]), ' ')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW."techStack", ARRAY[]::text[]), ' ')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);
    await exec(`DROP TRIGGER IF EXISTS member_search_tsv ON "Member"`);
    await exec(`
    CREATE TRIGGER member_search_tsv
      BEFORE INSERT OR UPDATE ON "Member"
      FOR EACH ROW EXECUTE FUNCTION set_member_search();
  `);
    await exec(`CREATE INDEX IF NOT EXISTS member_search_idx ON "Member" USING GIN ("search")`);

    await exec(`ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "search" tsvector`);
    await exec(`
    CREATE OR REPLACE FUNCTION set_project_search() RETURNS trigger AS $$
    BEGIN
      NEW.search :=
        setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.summary, '')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tech, ARRAY[]::text[]), ' ')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);
    await exec(`DROP TRIGGER IF EXISTS project_search_tsv ON "Project"`);
    await exec(`
    CREATE TRIGGER project_search_tsv
      BEFORE INSERT OR UPDATE ON "Project"
      FOR EACH ROW EXECUTE FUNCTION set_project_search();
  `);
    await exec(`CREATE INDEX IF NOT EXISTS project_search_idx ON "Project" USING GIN ("search")`);

    await exec(`ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "search" tsvector`);
    await exec(`
    CREATE OR REPLACE FUNCTION set_event_search() RETURNS trigger AS $$
    BEGIN
      NEW.search :=
        setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.city, '') || ' ' || coalesce(NEW.country, '')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);
    await exec(`DROP TRIGGER IF EXISTS event_search_tsv ON "Event"`);
    await exec(`
    CREATE TRIGGER event_search_tsv
      BEFORE INSERT OR UPDATE ON "Event"
      FOR EACH ROW EXECUTE FUNCTION set_event_search();
  `);
    await exec(`CREATE INDEX IF NOT EXISTS event_search_idx ON "Event" USING GIN ("search")`);

    await exec(`ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "search" tsvector`);
    await exec(`
    CREATE OR REPLACE FUNCTION set_blog_search() RETURNS trigger AS $$
    BEGIN
      NEW.search :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW."bodyMd", '')), 'B') ||
        setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ')), 'B');
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
  `);
    await exec(`DROP TRIGGER IF EXISTS blog_search_tsv ON "BlogPost"`);
    await exec(`
    CREATE TRIGGER blog_search_tsv
      BEFORE INSERT OR UPDATE ON "BlogPost"
      FOR EACH ROW EXECUTE FUNCTION set_blog_search();
  `);
    await exec(`CREATE INDEX IF NOT EXISTS blog_search_idx ON "BlogPost" USING GIN ("search")`);
}

// ---------- seed types (JSON fields typed as Prisma.InputJsonValue) ----------
type MemberSeed = {
    slug: string;
    name: string;
    avatarUrl?: string;
    headline?: string;
    bio?: string;
    skills?: string[];
    techStack?: string[];
    links?: Prisma.InputJsonValue;   // <- key change
    photos?: string[];
};

type ProjectSeed = {
    slug: string;
    name: string;
    summary?: string;
    cover?: string;
    year?: number;
    tech?: string[];
    tags?: string[];
    links?: Prisma.InputJsonValue;   // <- key change
    members?: { memberSlug: string; role?: string }[];
};

type EventSeed = {
    slug: string;
    name: string;
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
    dateStart?: string;
    dateEnd?: string;
    tags?: string[];
    images?: string[];
    members?: { memberSlug: string; role?: string }[];
    projects?: string[]; // project slugs
};

type BlogSeed = {
    slug: string;
    title: string;
    bodyMd: string;
    authorSlug: string;
    tags?: string[];
    published?: boolean;
};

type AchievementSeed = {
    slug: string;
    name: string;
    description?: string;
    iconUrl?: string;
};

// ---------- seeders ----------
async function seedMembers(arr: MemberSeed[]) {
    for (const m of arr) {
        await prisma.member.upsert({
            where: { slug: m.slug },
            update: {
                name: m.name,
                avatarUrl: m.avatarUrl,
                headline: m.headline,
                bio: m.bio,
                skills: m.skills ?? [],
                techStack: m.techStack ?? [],
                links: m.links ?? undefined,     // undefined => don't touch column
                photos: m.photos ?? [],
            },
            create: {
                slug: m.slug,
                name: m.name,
                avatarUrl: m.avatarUrl,
                headline: m.headline,
                bio: m.bio,
                skills: m.skills ?? [],
                techStack: m.techStack ?? [],
                links: m.links ?? {},            // {} satisfies InputJsonValue
                photos: m.photos ?? [],
            },
        });
    }
}

async function seedProjects(arr: ProjectSeed[]) {
    for (const p of arr) {
        const created = await prisma.project.upsert({
            where: { slug: p.slug },
            update: {
                name: p.name,
                summary: p.summary,
                cover: p.cover,
                year: p.year,
                tech: p.tech ?? [],
                tags: p.tags ?? [],
                links: p.links ?? undefined,
            },
            create: {
                slug: p.slug,
                name: p.name,
                summary: p.summary,
                cover: p.cover,
                year: p.year,
                tech: p.tech ?? [],
                tags: p.tags ?? [],
                links: p.links ?? {},
            },
        });

        if (p.members?.length) {
            for (const link of p.members) {
                const member = await prisma.member.findUnique({ where: { slug: link.memberSlug } });
                if (!member) continue;
                await prisma.projectMember.upsert({
                    where: { projectId_memberId: { projectId: created.id, memberId: member.id } },
                    update: { role: link.role ?? null },
                    create: { projectId: created.id, memberId: member.id, role: link.role ?? null },
                });
            }
        }
    }
}

async function seedEvents(arr: EventSeed[]) {
    for (const e of arr) {
        const created = await prisma.event.upsert({
            where: { slug: e.slug },
            update: {
                name: e.name,
                city: e.city,
                country: e.country,
                lat: e.lat,
                lng: e.lng,
                dateStart: e.dateStart ? new Date(e.dateStart) : null,
                dateEnd: e.dateEnd ? new Date(e.dateEnd) : null,
                tags: e.tags ?? [],
                images: e.images ?? [],
            },
            create: {
                slug: e.slug,
                name: e.name,
                city: e.city,
                country: e.country,
                lat: e.lat,
                lng: e.lng,
                dateStart: e.dateStart ? new Date(e.dateStart) : null,
                dateEnd: e.dateEnd ? new Date(e.dateEnd) : null,
                tags: e.tags ?? [],
                images: e.images ?? [],
            },
        });

        if (e.members?.length) {
            for (const link of e.members) {
                const member = await prisma.member.findUnique({ where: { slug: link.memberSlug } });
                if (!member) continue;
                await prisma.eventMember.upsert({
                    where: { eventId_memberId: { eventId: created.id, memberId: member.id } },
                    update: { role: link.role ?? null },
                    create: { eventId: created.id, memberId: member.id, role: link.role ?? null },
                });
            }
        }

        if (e.projects?.length) {
            const projects = await prisma.project.findMany({ where: { slug: { in: e.projects } } });
            await prisma.event.update({
                where: { id: created.id },
                data: { projects: { set: [], connect: projects.map((p) => ({ id: p.id })) } },
            });
        }
    }
}

async function seedBlog(arr: BlogSeed[]) {
    for (const b of arr) {
        const author = await prisma.member.findUnique({ where: { slug: b.authorSlug } });
        if (!author) continue;
        await prisma.blogPost.upsert({
            where: { slug: b.slug },
            update: {
                title: b.title,
                bodyMd: b.bodyMd,
                authorId: author.id,
                tags: b.tags ?? [],
                published: !!b.published,
            },
            create: {
                slug: b.slug,
                title: b.title,
                bodyMd: b.bodyMd,
                authorId: author.id,
                tags: b.tags ?? [],
                published: !!b.published,
            },
        });
    }
}

async function seedAchievements(arr: AchievementSeed[]) {
    for (const a of arr) {
        await prisma.achievement.upsert({
            where: { slug: a.slug },
            update: {
                name: a.name,
                description: a.description ?? null,
                iconUrl: a.iconUrl ?? null,
            },
            create: {
                slug: a.slug,
                name: a.name,
                description: a.description ?? null,
                iconUrl: a.iconUrl ?? null,
            },
        });
    }
}

// ---------- main ----------
async function main() {
    await ensureFts(); // single-statement raw SQL only. :contentReference[oaicite:2]{index=2}

    const members = readJSON<MemberSeed[]>("prisma/seed-data/members.json");
    const projects = readJSON<ProjectSeed[]>("prisma/seed-data/projects.json");
    const events = readJSON<EventSeed[]>("prisma/seed-data/events.json");
    const blog = readJSON<BlogSeed[]>("prisma/seed-data/blog.json");
    const achievements = readJSON<AchievementSeed[]>("prisma/seed-data/achievements.json");

    await seedMembers(members);
    await seedProjects(projects);
    await seedEvents(events);
    await seedBlog(blog);
    await seedAchievements(achievements);

    console.log("✅ Seed complete.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
