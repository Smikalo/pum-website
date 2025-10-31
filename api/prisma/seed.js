// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const argon2 = require("argon2");
const prisma = new PrismaClient();

async function upsertSkill(name){ return prisma.skill.upsert({ where:{ name }, create:{ name }, update:{} }); }
async function upsertTech(name){  return prisma.tech.upsert({  where:{ name }, create:{ name }, update:{} }); }
async function upsertTag(name){   return prisma.tag.upsert({   where:{ name }, create:{ name }, update:{} }); }

/** Ensure a minimal Member row exists (by slug); return the row */
async function ensureMember(slug, name){
    const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g,'-');
    const display = name || slug;
    return prisma.member.upsert({
        where: { slug: safeSlug },
        create: {
            slug: safeSlug,
            name: display,
            links: {},
            photos: [],
            shortBio: null,
            longBio: null,
            bio: null,
        },
        update: {},
    });
}

/** Ensure a User with roles exists, linked to a Member */
async function ensureUserWithRoles({ email, passwordHash, roles, memberSlug, memberName }) {
    const member = await ensureMember(memberSlug, memberName);

    let user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true },
    });

    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                memberId: member.id,
                roles: { create: roles.map((r) => ({ role: r })) },
            },
            include: { roles: true },
        });
    } else {
        // Link member if missing
        if (!user.memberId) {
            await prisma.user.update({ where: { email }, data: { memberId: member.id } });
        }
        // Ensure required roles exist
        const has = new Set(user.roles.map((r) => r.role));
        for (const role of roles) {
            if (!has.has(role)) {
                await prisma.userRole.create({ data: { userId: user.id, role } });
            }
        }
    }

    return user;
}

async function main(){
    const dataDir = path.join(__dirname,'..','src','data');

    const members  = JSON.parse(fs.readFileSync(path.join(dataDir,'members.json'),'utf8'));
    const projects = JSON.parse(fs.readFileSync(path.join(dataDir,'projects.json'),'utf8'));
    const events   = JSON.parse(fs.readFileSync(path.join(dataDir,'events.json'),'utf8'));
    const blogs    = fs.existsSync(path.join(dataDir,'blogs.json'))
        ? JSON.parse(fs.readFileSync(path.join(dataDir,'blogs.json'),'utf8'))
        : [];

    /* --------- EVENTS (unchanged) --------- */
    const evMap = new Map();
    for (const e of events) {
        const ev = await prisma.event.upsert({
            where:{ slug:e.slug },
            create:{ id:e.id, slug:e.slug, name:e.name,
                dateStart:e.dateStart?new Date(e.dateStart):null,
                dateEnd:e.dateEnd?new Date(e.dateEnd):null,
                locationName:e.locationName||null, lat:e.lat||null, lng:e.lng||null,
                description:e.description||null, photos:e.photos||[] },
            update:{ name:e.name,
                dateStart:e.dateStart?new Date(e.dateStart):null,
                dateEnd:e.dateEnd?new Date(e.dateEnd):null,
                locationName:e.locationName||null, lat:e.lat||null, lng:e.lng||null,
                description:e.description||null, photos:e.photos||[] },
        });
        evMap.set(e.slug, ev);
    }

    /* --------- MEMBERS (unchanged) --------- */
    const memMap = new Map();
    for (const m of members) {
        const row = await prisma.member.upsert({
            where:{ slug:m.slug },
            create:{ id:m.id, slug:m.slug, name:m.name,
                avatarUrl:m.avatarUrl||null, avatar:m.avatar||null,
                shortBio:m.shortBio||null, longBio:m.longBio||null, bio:m.bio||null,
                headline:m.headline||null, location:m.location||null,
                links:m.links||{}, photos:m.photos||[] },
            update:{ name:m.name, avatarUrl:m.avatarUrl||null, avatar:m.avatar||null,
                shortBio:m.shortBio||null, longBio:m.longBio||null, bio:m.bio||null,
                headline:m.headline||null, location:m.location||null,
                links:m.links||{}, photos:m.photos||[] },
        });
        memMap.set(m.slug, row);
        for (const s of (m.skills||[])) await prisma.memberSkill.upsert({
            where:{ memberId_skillId:{ memberId:row.id, skillId:(await upsertSkill(String(s))).id } },
            create:{ memberId:row.id, skillId:(await upsertSkill(String(s))).id },
            update:{} });
        for (const t of (m.techStack||[])) await prisma.memberTech.upsert({
            where:{ memberId_techId:{ memberId:row.id, techId:(await upsertTech(String(t))).id } },
            create:{ memberId:row.id, techId:(await upsertTech(String(t))).id },
            update:{} });
    }

    /* --------- PROJECTS (unchanged) --------- */
    const projMap = new Map();
    for (const p of projects) {
        const eventId = p.event && evMap.get(p.event.slug)?.id;
        const row = await prisma.project.upsert({
            where:{ slug:p.slug },
            create:{ id:p.id, slug:p.slug, title:p.title, summary:p.summary||null,
                description:p.description||null, status:p.status||null, demoUrl:p.demoUrl||null,
                imageUrl:p.imageUrl||null, cover:p.cover||null, images:p.images||[],
                year:p.year||null, eventId:eventId||null },
            update:{ title:p.title, summary:p.summary||null, description:p.description||null,
                status:p.status||null, demoUrl:p.demoUrl||null, imageUrl:p.imageUrl||null,
                cover:p.cover||null, images:p.images||[], year:p.year||null, eventId:eventId||null },
        });
        projMap.set(p.slug, row);
        for (const t of (p.techStack||[])) await prisma.projectTech.upsert({
            where:{ projectId_techId:{ projectId:row.id, techId:(await upsertTech(String(t))).id } },
            create:{ projectId:row.id, techId:(await upsertTech(String(t))).id },
            update:{} });
        for (const tagName of (p.tags||[])) await prisma.projectTag.upsert({
            where:{ projectId_tagId:{ projectId:row.id, tagId:(await upsertTag(String(tagName))).id } },
            create:{ projectId:row.id, tagId:(await upsertTag(String(tagName))).id },
            update:{} });
    }

    // Project memberships
    for (const m of members) {
        const mr = memMap.get(m.slug);
        for (const rel of (m.projects||[])) {
            const p = projects.find(pp => pp.id === rel.projectId) || projects.find(pp => pp.slug === rel.projectSlug);
            if (!p) continue;
            const pr = projMap.get(p.slug);
            await prisma.memberProject.upsert({
                where:{ memberId_projectId:{ memberId:mr.id, projectId:pr.id } },
                create:{ memberId:mr.id, projectId:pr.id, role:rel.role||null, contribution:rel.contribution||null },
                update:{ role:rel.role||null, contribution:rel.contribution||null },
            });
        }
    }

    /* ================= BLOGS (NEW) ================= */
    const blogMap = new Map();
    for (const b of blogs) {
        const row = await prisma.blog.upsert({
            where:{ slug:b.slug },
            create:{
                id:b.id, slug:b.slug, title:b.title, summary:b.summary||null,
                content:b.content||null, publishedAt: b.publishedAt? new Date(b.publishedAt): null,
                imageUrl:b.imageUrl||null, cover:b.cover||null, images:b.images||[]
            },
            update:{
                title:b.title, summary:b.summary||null, content:b.content||null,
                publishedAt: b.publishedAt? new Date(b.publishedAt): null,
                imageUrl:b.imageUrl||null, cover:b.cover||null, images:b.images||[]
            }
        });
        blogMap.set(b.slug, row);

        for (const t of (b.techStack||[])) await prisma.blogTech.upsert({
            where:{ blogId_techId:{ blogId:row.id, techId:(await upsertTech(String(t))).id } },
            create:{ blogId:row.id, techId:(await upsertTech(String(t))).id },
            update:{} });

        for (const tagName of (b.tags||[])) await prisma.blogTag.upsert({
            where:{ blogId_tagId:{ blogId:row.id, tagId:(await upsertTag(String(tagName))).id } },
            create:{ blogId:row.id, tagId:(await upsertTag(String(tagName))).id },
            update:{} });
    }

    // Blog authors
    for (const b of blogs) {
        const br = blogMap.get(b.slug);
        for (const a of (b.authors||[])) {
            const mr = memMap.get(a.slug) || [...memMap.values()].find(x => x.id === a.memberId);
            if (!mr) { console.warn('[seed] blog author missing:', a); continue; }
            await prisma.blogAuthor.upsert({
                where:{ blogId_memberId:{ blogId:br.id, memberId:mr.id } },
                create:{ blogId:br.id, memberId:mr.id, role:a.role||null },
                update:{ role:a.role||null }
            });
        }
    }

    /* ================= USERS (ADMIN + MODS + MEMBERS) ================= */
    const email = process.env.SEED_ADMIN_EMAIL || "admin@pum.local";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!123";
    const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || adminPassword;

    const adminPasswordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
    const defaultPasswordHash = await argon2.hash(defaultPassword, { type: argon2.argon2id });

    // Admin (keep existing behavior)
    const adminUser = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            passwordHash: adminPasswordHash,
            roles: { create: [{ role: "ADMIN" }, { role: "MEMBER" }] },
        },
        include: { roles: true },
    });

    // Link admin to a member profile if available or create minimal one
    const adminLocal = email.split("@")[0];
    const adminMember = await ensureMember(adminLocal, "Admin");
    if (!adminUser.memberId) {
        await prisma.user.update({ where: { email }, data: { memberId: adminMember.id } });
    }

    // 2 Moderators (also members)
    await ensureUserWithRoles({
        email: "mod1@pum.local",
        passwordHash: defaultPasswordHash,
        roles: ["MODERATOR", "MEMBER"],
        memberSlug: "mod1",
        memberName: "Moderator One",
    });
    await ensureUserWithRoles({
        email: "mod2@pum.local",
        passwordHash: defaultPasswordHash,
        roles: ["MODERATOR", "MEMBER"],
        memberSlug: "mod2",
        memberName: "Moderator Two",
    });

    // 2 Members
    await ensureUserWithRoles({
        email: "mem1@pum.local",
        passwordHash: defaultPasswordHash,
        roles: ["MEMBER"],
        memberSlug: "mem1",
        memberName: "Member One",
    });
    await ensureUserWithRoles({
        email: "mem2@pum.local",
        passwordHash: defaultPasswordHash,
        roles: ["MEMBER"],
        memberSlug: "mem2",
        memberName: "Member Two",
    });

    console.log("✅ Seeded users:");
    console.table([
        { email, role: "ADMIN+MEMBER", password: adminPassword },
        { email: "mod1@pum.local", role: "MODERATOR+MEMBER", password: defaultPassword },
        { email: "mod2@pum.local", role: "MODERATOR+MEMBER", password: defaultPassword },
        { email: "mem1@pum.local", role: "MEMBER", password: defaultPassword },
        { email: "mem2@pum.local", role: "MEMBER", password: defaultPassword },
    ]);
    console.log("   (change passwords in production via /api/auth/password/reset)");
}

main().then(()=>prisma.$disconnect()).catch(async e=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
