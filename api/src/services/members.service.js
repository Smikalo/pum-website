// api/src/services/members.service.js
// NOTE: list-like updates for skills and techs must use DB transaction to avoid partial updates.

const fs = require("fs");
const path = require("path");
const { prisma } = require("../db");
const logger = require("../logger");
const { getPaginationParams, toPagedResponse } = require("../utils/lists");
const { abs, upsertStringList, CV_DIR } = require("../utils/shared");
const { NotFoundError, BadRequestError } = require("../errors");

function makeReq(baseUrl) {
    if (!baseUrl) return { protocol: "http", get: () => "localhost" };
    const u = new URL(baseUrl);
    return {
        protocol: u.protocol.replace(":", ""),
        get: (key) => (key === "host" ? u.host : "")
    };
}

async function listMembers(query, baseUrl) {
    const { page, size } = getPaginationParams(query);

    const skills = (query.skill || "").split(",").map((s) => s.trim()).filter(Boolean);
    const techs = (query.tech || "").split(",").map((s) => s.trim()).filter(Boolean);
    const q = (query.q || "").toString().trim();

    const AND = [];
    if (q)
        AND.push({
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { shortBio: { contains: q, mode: "insensitive" } },
                { longBio: { contains: q, mode: "insensitive" } },
                { bio: { contains: q, mode: "insensitive" } },
                { headline: { contains: q, mode: "insensitive" } },
            ],
        });
    for (const s of skills)
        AND.push({ skills: { some: { skill: { name: s } } } });
    for (const t of techs)
        AND.push({ techs: { some: { tech: { name: t } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.member.count({ where }),
        prisma.member.findMany({
            where,
            include: {
                skills: { include: { skill: true } },
                techs: { include: { tech: true } },
            },
            orderBy: { name: "asc" },
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    const req = makeReq(baseUrl);

    const items = rows.map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        avatarUrl: abs(m.avatarUrl || m.avatar || null, req),
        shortBio: m.shortBio || m.bio || null,
        headline: m.headline || null,
        skills: m.skills.map((x) => x.skill.name),
        techStack: m.techs.map((x) => x.tech.name),
        focusArea: m.focusArea || null,
        links: m.links || {},
    }));

    return toPagedResponse(items, total, page, size);
}

async function getMemberBySlug(slug, baseUrl) {
    const include = {
        skills: { include: { skill: true } },
        techs: { include: { tech: true } },
        projects: { include: { project: true } },
        events: { include: { event: true } },
    };

    let m = await prisma.member.findUnique({
        where: { slug },
        include,
    });

    if (!m) {
        const u = await prisma.user.findFirst({
            where: {
                email: {
                    startsWith: `${slug}@`,
                    mode: "insensitive",
                },
                memberId: { not: null },
            },
            select: { memberId: true },
        });
        if (u?.memberId) {
            m = await prisma.member.findUnique({
                where: { id: u.memberId },
                include,
            });
        }
    }

    if (!m) {
        throw new NotFoundError("Not found");
    }

    const req = makeReq(baseUrl);
    let cvUrl = null;
    const userRolesSet = new Set();

    const usersForMember = await prisma.user.findMany({
        where: { memberId: m.id },
        include: { roles: true },
    });

    if (usersForMember.length) {
        for (const u of usersForMember) {
            for (const r of u.roles || []) {
                if (r.role) userRolesSet.add(r.role);
            }
        }

        for (const u of usersForMember) {
            const p = path.join(CV_DIR, `${u.id}-latest.pdf`);
            if (fs.existsSync(p)) {
                cvUrl = abs(`/uploads/cv/${u.id}-latest.pdf`, req);
                break;
            }
        }
    }

    const userRoles = Array.from(userRolesSet);
    const isAdminMember = userRoles.includes("ADMIN");

    return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        avatar: abs(m.avatar || m.avatarUrl || null, req),
        avatarUrl: abs(m.avatarUrl || m.avatar || null, req),
        headline: m.headline,
        shortBio: m.shortBio,
        bio: m.bio || m.longBio,
        markdown: m.bio || m.longBio || "",
        location: m.location,
        links: m.links || {},
        photos: m.photos || [],
        skills: m.skills.map((x) => x.skill.name),
        techStack: m.techs.map((x) => x.tech.name),
        focusArea: m.focusArea || null,
        projects: m.projects.map((r) => ({
            id: r.project.id,
            slug: r.project.slug,
            title: r.project.title,
            role: r.role,
            contribution: r.contribution,
            cover: abs(r.project.cover || r.project.imageUrl || null, req),
            year: r.project.year,
            tech: [],
            techStack: [],
            summary: r.project.summary || null,
        })),
        events: m.events.map((r) => ({
            id: r.event.id,
            slug: r.event.slug,
            name: r.event.name,
            role: r.role || null,
            dateStart: r.event.dateStart,
            dateEnd: r.event.dateEnd,
        })),
        userRoles,
        isAdminMember,
        cvUrl,
    };
}

async function updateMember(slug, data, user, baseUrl) {
    const member = await prisma.member.findUnique({
        where: { slug },
    });

    if (!member) {
        throw new NotFoundError("Not found");
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const d = data;
    const updateData = {};
    const { name, headline, shortBio, markdown, links, focusArea, accessRole } = d;
    if (typeof name !== "undefined") updateData.name = name;
    if (typeof headline !== "undefined") updateData.headline = headline;
    if (typeof shortBio !== "undefined") updateData.shortBio = shortBio;
    if (typeof markdown !== "undefined") updateData.bio = markdown;
    if (typeof links !== "undefined") updateData.links = links;
    if (typeof focusArea !== "undefined") updateData.focusArea = focusArea;

    const skills = d.skills || null;
    const techStack = d.techStack || null;

    await prisma.$transaction(async (tx) => {
        if (Object.keys(updateData).length) {
            await tx.member.update({
                where: { id: member.id },
                data: updateData,
            });
        }

        if (skills) {
            const ids = await upsertStringList(skills, "skill", tx);
            await tx.memberSkill.deleteMany({
                where: { memberId: member.id, NOT: { skillId: { in: ids } } },
            });
            for (const sid of ids) {
                await tx.memberSkill.upsert({
                    where: { memberId_skillId: { memberId: member.id, skillId: sid } },
                    update: {},
                    create: { memberId: member.id, skillId: sid },
                });
            }
        }

        if (techStack) {
            const ids = await upsertStringList(techStack, "tech", tx);
            await tx.memberTech.deleteMany({
                where: { memberId: member.id, NOT: { techId: { in: ids } } },
            });
            for (const tid of ids) {
                await tx.memberTech.upsert({
                    where: { memberId_techId: { memberId: member.id, techId: tid } },
                    update: {},
                    create: { memberId: member.id, techId: tid },
                });
            }
        }

        if (accessRole && usersForMember.length) {
            const userIds = usersForMember.map((u) => u.id);

            await tx.userRole.deleteMany({
                where: { userId: { in: userIds }, role: { in: ["MEMBER", "MODERATOR"] } },
            });

            await tx.userRole.createMany({
                data: userIds.map((uid) => ({ userId: uid, role: accessRole })),
                skipDuplicates: true,
            });
        }
    });

    const updated = await prisma.member.findUnique({
        where: { id: member.id },
        include: {
            skills: { include: { skill: true } },
            techs: { include: { tech: true } },
            projects: { include: { project: true } },
            events: { include: { event: true } },
        },
    });

    const refreshedUsers = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const roleSet = new Set();
    let cvUrl = null;
    const req = makeReq(baseUrl);

    for (const u of refreshedUsers) {
        for (const r of u.roles || []) {
            if (r.role) roleSet.add(r.role);
        }
        if (!cvUrl) {
            const p = path.join(CV_DIR, `${u.id}-latest.pdf`);
            if (fs.existsSync(p)) {
                cvUrl = abs(`/uploads/cv/${u.id}-latest.pdf`, req);
            }
        }
    }

    const userRoles = Array.from(roleSet);
    const isAdminMemberAfter = userRoles.includes("ADMIN");

    logger.info("Member profile updated", {
        userId: user?.id || null,
        memberSlug: slug,
        memberId: member.id
    });

    return {
        member: {
            id: updated.id,
            slug: updated.slug,
            name: updated.name,
            avatar: abs(updated.avatar || updated.avatarUrl || null, req),
            avatarUrl: abs(updated.avatarUrl || updated.avatar || null, req),
            headline: updated.headline,
            shortBio: updated.shortBio,
            bio: updated.bio || updated.longBio,
            markdown: updated.bio || updated.longBio || "",
            location: updated.location,
            links: updated.links || {},
            photos: updated.photos || [],
            skills: updated.skills.map((x) => x.skill.name),
            techStack: updated.techs.map((x) => x.tech.name),
            focusArea: updated.focusArea || null,
            projects: updated.projects.map((r) => ({
                id: r.project.id,
                slug: r.project.slug,
                title: r.project.title,
                role: r.role,
                contribution: r.contribution,
                cover: abs(r.project.cover || r.project.imageUrl || null, req),
                year: r.project.year,
                tech: [],
                techStack: [],
                summary: r.project.summary || null,
            })),
            events: updated.events.map((r) => ({
                id: r.event.id,
                slug: r.event.slug,
                name: r.event.name,
                role: r.role || null,
                dateStart: r.event.dateStart,
                dateEnd: r.event.dateEnd,
            })),
            userRoles,
            isAdminMember: isAdminMemberAfter,
            cvUrl,
        },
    };
}

async function deleteMember(slug, confirmSlug, user) {
    const member = await prisma.member.findUnique({
        where: { slug },
    });

    if (!member) {
        throw new NotFoundError("Not found");
    }

    if (confirmSlug !== member.slug) {
        throw new BadRequestError("Slug confirmation does not match");
    }

    await prisma.$transaction(async (tx) => {
        await tx.memberSkill.deleteMany({ where: { memberId: member.id } });
        await tx.memberTech.deleteMany({ where: { memberId: member.id } });
        await tx.memberProject.deleteMany({ where: { memberId: member.id } });
        await tx.memberEvent.deleteMany({ where: { memberId: member.id } });
        await tx.user.updateMany({ where: { memberId: member.id }, data: { memberId: null } });
        await tx.member.delete({ where: { id: member.id } });
    });

    logger.info("Member deleted", {
        userId: user?.id || null,
        memberSlug: slug,
        memberId: member.id
    });

    return { ok: true };
}

module.exports = {
    listMembers,
    getMemberBySlug,
    updateMember,
    deleteMember
};