// api/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs'); const path = require('path');
const prisma = new PrismaClient();

async function upsertSkill(name){ return prisma.skill.upsert({ where:{ name }, create:{ name }, update:{} }); }
async function upsertTech(name){  return prisma.tech.upsert({  where:{ name }, create:{ name }, update:{} }); }
async function upsertTag(name){   return prisma.tag.upsert({   where:{ name }, create:{ name }, update:{} }); }

async function main(){
    const dataDir = path.join(__dirname,'..','src','data');
    const members  = JSON.parse(fs.readFileSync(path.join(dataDir,'members.json'),'utf8'));
    const projects = JSON.parse(fs.readFileSync(path.join(dataDir,'projects.json'),'utf8'));
    const events   = JSON.parse(fs.readFileSync(path.join(dataDir,'events.json'),'utf8'));

    const evMap = new Map();
    for (const e of events) {
        const ev = await prisma.event.upsert({
            where:{ slug:e.slug },
            create:{
                id:e.id, slug:e.slug, name:e.name,
                dateStart:e.dateStart?new Date(e.dateStart):null,
                dateEnd:e.dateEnd?new Date(e.dateEnd):null,
                locationName:e.locationName||null,
                lat:e.lat||null, lng:e.lng||null,
                description:e.description||null,
                photos:e.photos||[]
            },
            update:{
                name:e.name,
                dateStart:e.dateStart?new Date(e.dateStart):null,
                dateEnd:e.dateEnd?new Date(e.dateEnd):null,
                locationName:e.locationName||null,
                lat:e.lat||null, lng:e.lng||null,
                description:e.description||null,
                photos:e.photos||[]
            },
        });
        evMap.set(e.slug, ev);
    }

    const memMap = new Map();
    for (const m of members) {
        const row = await prisma.member.upsert({
            where:{ slug:m.slug },
            create:{
                id:m.id, slug:m.slug, name:m.name,
                avatarUrl:m.avatarUrl||null, avatar:m.avatar||null,
                shortBio:m.shortBio||null, longBio:m.longBio||null, bio:m.bio||null,
                headline:m.headline||null, location:m.location||null,
                links:m.links||{}, photos:m.photos||[]
            },
            update:{
                name:m.name,
                avatarUrl:m.avatarUrl||null, avatar:m.avatar||null,
                shortBio:m.shortBio||null, longBio:m.longBio||null, bio:m.bio||null,
                headline:m.headline||null, location:m.location||null,
                links:m.links||{}, photos:m.photos||[]
            },
        });
        memMap.set(m.slug, row);

        for (const s of (m.skills||[]))
            await prisma.memberSkill.upsert({
                where:{ memberId_skillId:{ memberId:row.id, skillId:(await upsertSkill(String(s))).id } },
                create:{ memberId:row.id, skillId:(await upsertSkill(String(s))).id },
                update:{}
            });

        for (const t of (m.techStack||[]))
            await prisma.memberTech.upsert({
                where:{ memberId_techId:{ memberId:row.id, techId:(await upsertTech(String(t))).id } },
                create:{ memberId:row.id, techId:(await upsertTech(String(t))).id },
                update:{}
            });

        // NEW: member <-> event (attendees)
        for (const rel of (m.events || [])) {
            const ev = rel.slug ? evMap.get(rel.slug) : undefined;
            if (!ev) continue;
            await prisma.memberEvent.upsert({
                where:{ memberId_eventId:{ memberId: row.id, eventId: ev.id } },
                create:{ memberId: row.id, eventId: ev.id, role: rel.role || null },
                update:{ role: rel.role || null },
            });
        }
    }

    const projMap = new Map();
    for (const p of projects) {
        const eventId = p.event && evMap.get(p.event.slug)?.id;
        const row = await prisma.project.upsert({
            where:{ slug:p.slug },
            create:{
                id:p.id, slug:p.slug, title:p.title,
                summary:p.summary||null, description:p.description||null, status:p.status||null,
                demoUrl:p.demoUrl||null, imageUrl:p.imageUrl||null, cover:p.cover||null,
                images:p.images||[], year:p.year||null, eventId:eventId||null
            },
            update:{
                title:p.title,
                summary:p.summary||null, description:p.description||null, status:p.status||null,
                demoUrl:p.demoUrl||null, imageUrl:p.imageUrl||null, cover:p.cover||null,
                images:p.images||[], year:p.year||null, eventId:eventId||null
            },
        });
        projMap.set(p.slug, row);

        for (const t of (p.techStack||[]))
            await prisma.projectTech.upsert({
                where:{ projectId_techId:{ projectId:row.id, techId:(await upsertTech(String(t))).id } },
                create:{ projectId:row.id, techId:(await upsertTech(String(t))).id },
                update:{}
            });

        for (const tagName of (p.tags||[]))
            await prisma.projectTag.upsert({
                where:{ projectId_tagId:{ projectId:row.id, tagId:(await upsertTag(String(tagName))).id } },
                create:{ projectId:row.id, tagId:(await upsertTag(String(tagName))).id },
                update:{}
            });
    }

    // Link members <-> events from member-side seed (preferred)
    for (const m of members) {
        const mr = memMap.get(m.slug);
        if (!mr) continue;
        for (const rel of (m.events || [])) {
            const ev = evMap.get(rel.slug);
            if (!ev) continue;
            await prisma.memberEvent.upsert({
                where: { memberId_eventId: { memberId: mr.id, eventId: ev.id } },
                create: { memberId: mr.id, eventId: ev.id, role: rel.role || null },
                update: { role: rel.role || null },
            });
        }
    }

// (Optional) also link from event-side seed if your events.json lists attendees
    for (const e of events) {
        const ev = evMap.get(e.slug);
        if (!ev) continue;
        for (const a of (e.attendees || [])) {
            const mr = memMap.get(a.slug);
            if (!mr) continue;
            await prisma.memberEvent.upsert({
                where: { memberId_eventId: { memberId: mr.id, eventId: ev.id } },
                create: { memberId: mr.id, eventId: ev.id, role: a.role || null },
                update: { role: a.role || null },
            });
        }
    }

    // --- link attendees from events.json -> MemberEvent ---
    for (const e of events) {
        const eRow = evMap.get(e.slug);
        if (!eRow) continue;
        for (const a of (e.attendees || [])) {
            // match by slug first; allow fallbacks
            const mRow =
                memMap.get(a.slug) ||
                memMap.get(a.memberSlug) ||
                [...memMap.values()].find(x => x.id === a.memberId);
            if (!mRow) {
                console.warn('[seed] attendee not linked (missing member):', a);
                continue;
            }
            await prisma.memberEvent.upsert({
                where: { memberId_eventId: { memberId: mRow.id, eventId: eRow.id } },
                create: { memberId: mRow.id, eventId: eRow.id, role: a.role || null },
                update: { role: a.role || null },
            });
        }
    }

    for (const m of members) {
        const mRow = memMap.get(m.slug);
        if (!mRow) continue;
        for (const evRef of (m.events || [])) {
            const eRow = evMap.get(evRef.slug);
            if (!eRow) continue;
            await prisma.memberEvent.upsert({
                where: { memberId_eventId: { memberId: mRow.id, eventId: eRow.id } },
                create: { memberId: mRow.id, eventId: eRow.id, role: evRef.role || null },
                update: { role: evRef.role || null },
            });
        }
    }


    // member <-> project (roles/contrib)
    for (const m of members) {
        const mr = memMap.get(m.slug);
        if (!mr) continue;
        for (const rel of (m.projects||[])) {
            const p = projects.find(pp => pp.id === rel.projectId) || projects.find(pp => pp.slug === rel.projectSlug);
            if (!p) continue;
            const pr = projMap.get(p.slug);
            if (!pr) continue;
            await prisma.memberProject.upsert({
                where:{ memberId_projectId:{ memberId:mr.id, projectId:pr.id } },
                create:{ memberId:mr.id, projectId:pr.id, role:rel.role||null, contribution:rel.contribution||null },
                update:{ role:rel.role||null, contribution:rel.contribution||null },
            });
        }
    }
}

main().then(()=>prisma.$disconnect()).catch(async e=>{ console.error(e); await prisma.$disconnect(); process.exit(1); });
