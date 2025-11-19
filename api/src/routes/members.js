// api/src/routes/members.js
const express = require("express");
const z = require("zod");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../db");
const {
    sendOk,
    sendCreated,
    sendJson,
    sendBadRequest,
    sendForbidden,
    sendNotFound,
    sendServerError,
} = require("../utils/http");
const { getPaginationParams, toPagedResponse } = require("../utils/lists");
const {
    requireAuth,
    requireAdminOrModerator,
} = require("../middleware/auth");
const {
    abs,
    upsertStringList,
    CV_DIR,
} = require("../utils/shared");
const {
    cvUploadMiddleware,
    avatarUploadMiddleware,
    processCvUpload,
    processAvatarUpload
} = require("../services/uploads.service");

const router = express.Router();

const qpSchema = z.object({
    q: z.string().optional(),
    skill: z.string().optional(),
    tech: z.string().optional(),
    page: z.string().optional(),
    size: z.string().optional(),
});

const memberProfileUpdateSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    headline: z.string().max(200).nullable().optional(),
    shortBio: z.string().max(500).nullable().optional(),
    markdown: z.string().max(100_000).optional(),
    links: z.record(z.string().url()).optional(),
    focusArea: z.enum(["FRONTEND", "BACKEND", "ML", "DATA", "DEVOPS", "DESIGN", "PM", "OTHER"]).nullable().optional(),
    skills: z.array(z.string().min(1)).optional(),
    techStack: z.array(z.string().min(1)).optional(),
    accessRole: z.enum(["MEMBER", "MODERATOR"]).optional(),
});

const deleteBySlugSchema = z.object({
    confirmSlug: z.string().min(1),
});

router.get("/", async (req, res) => {
    const qp = qpSchema.parse(req.query);
    const { page, size } = getPaginationParams(qp);

    const skills = (qp.skill || "").split(",").map((s) => s.trim()).filter(Boolean);
    const techs = (qp.tech || "").split(",").map((s) => s.trim()).filter(Boolean);

    const AND = [];
    if (qp.q)
        AND.push({
            OR: [
                { name: { contains: qp.q, mode: "insensitive" } },
                { shortBio: { contains: qp.q, mode: "insensitive" } },
                { longBio: { contains: qp.q, mode: "insensitive" } },
                { bio: { contains: qp.q, mode: "insensitive" } },
                { headline: { contains: qp.q, mode: "insensitive" } },
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

    sendOk(res, toPagedResponse(items, total, page, size));
});

router.get("/:slug", async (req, res) => {
    const include = {
        skills: { include: { skill: true } },
        techs: { include: { tech: true } },
        projects: { include: { project: true } },
        events: { include: { event: true } },
    };

    let m = await prisma.member.findUnique({
        where: { slug: req.params.slug },
        include,
    });

    if (!m) {
        const u = await prisma.user.findFirst({
            where: {
                email: {
                    startsWith: `${req.params.slug}@`,
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
        return sendJson(res, 404, { error: "Not found" });
    }

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

    sendOk(res, {
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
    });
});

router.put("/:slug", requireAuth, requireAdminOrModerator, async (req, res) => {
    const roles = (req.user.roles || []).map((r) => r.role);
    const isAdmin = roles.includes("ADMIN");

    const member = await prisma.member.findUnique({
        where: { slug: req.params.slug },
    });

    if (!member) {
        return sendNotFound(res);
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const isAdminMember = usersForMember.some((u) =>
        (u.roles || []).some((r) => r.role === "ADMIN"),
    );

    if (isAdminMember) {
        return sendForbidden(res, "Cannot edit admin member from this page");
    }

    const parsed = memberProfileUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
        return sendBadRequest(res, "Invalid input", parsed.error.flatten());
    }

    const bodyHasAccessRole = Object.prototype.hasOwnProperty.call(req.body || {}, "accessRole");

    if (bodyHasAccessRole && !isAdmin) {
        return sendForbidden(res, "Only admins can change member access role");
    }

    const d = parsed.data;
    const data = {};
    const { name, headline, shortBio, markdown, links, focusArea, accessRole } = d;
    if (typeof name !== "undefined") data.name = name;
    if (typeof headline !== "undefined") data.headline = headline;
    if (typeof shortBio !== "undefined") data.shortBio = shortBio;
    if (typeof markdown !== "undefined") data.bio = markdown;
    if (typeof links !== "undefined") data.links = links;
    if (typeof focusArea !== "undefined") data.focusArea = focusArea;

    const skills = d.skills || null;
    const techStack = d.techStack || null;

    try {
        await prisma.$transaction(async (tx) => {
            if (Object.keys(data).length) {
                await tx.member.update({
                    where: { id: member.id },
                    data,
                });
            }

            if (skills) {
                const ids = await upsertStringList(skills, "skill");
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
                const ids = await upsertStringList(techStack, "tech");
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

            if (bodyHasAccessRole && accessRole && usersForMember.length) {
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

        sendOk(res, {
            ok: true,
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
        });
    } catch (err) {
        sendServerError(res, "Failed to update member");
    }
});

router.delete("/:slug", requireAuth, requireAdminOrModerator, async (req, res) => {
    const member = await prisma.member.findUnique({
        where: { slug: req.params.slug },
    });

    if (!member) {
        return sendNotFound(res);
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const isAdminMemberDelete = usersForMember.some((u) =>
        (u.roles || []).some((r) => r.role === "ADMIN"),
    );

    if (isAdminMemberDelete) {
        return sendForbidden(res, "Cannot delete admin member");
    }

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) {
        return sendBadRequest(res, "Invalid input", parsed.error.flatten());
    }

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== member.slug) {
        return sendBadRequest(res, "Slug confirmation does not match");
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.memberSkill.deleteMany({ where: { memberId: member.id } });
            await tx.memberTech.deleteMany({ where: { memberId: member.id } });
            await tx.memberProject.deleteMany({ where: { memberId: member.id } });
            await tx.memberEvent.deleteMany({ where: { memberId: member.id } });
            await tx.user.updateMany({ where: { memberId: member.id }, data: { memberId: null } });
            await tx.member.delete({ where: { id: member.id } });
        });

        sendOk(res, { ok: true });
    } catch (err) {
        sendServerError(res, "Failed to delete member");
    }
});

// --- CV Upload (Service-backed) ---

router.post(
    "/:slug/cv",
    requireAuth,
    requireAdminOrModerator,
    async (req, res, next) => {
        const member = await prisma.member.findUnique({
            where: { slug: req.params.slug },
        });
        if (!member) {
            return sendNotFound(res, "Member not found");
        }
        req._member = member;
        next();
    },
    cvUploadMiddleware.single("cv"),
    async (req, res) => {
        const member = req._member;
        const usersForMember = await prisma.user.findMany({
            where: { memberId: member.id },
            include: { roles: true },
        });

        const isAdminMember = usersForMember.some((u) =>
            (u.roles || []).some((r) => r.role === "ADMIN"),
        );
        if (isAdminMember) {
            try { if(req.file?.path) fs.unlinkSync(req.file.path); } catch {}
            return sendForbidden(res, "Cannot modify admin member from this page");
        }

        if (!usersForMember.length) {
            try { if(req.file?.path) fs.unlinkSync(req.file.path); } catch {}
            return sendBadRequest(res, "No user account linked to this member");
        }

        try {
            // Use first user ID for the CV naming if multiple exist
            const userId = usersForMember[0].id;
            const result = await processCvUpload({ userId, memberId: member.id, file: req.file });
            sendCreated(res, { ok: true, url: abs(result.url, req) });
        } catch (e) {
            return sendBadRequest(res, e.message || "CV upload failed");
        }
    },
);

// --- Avatar Upload (Service-backed) ---

router.post(
    "/:slug/avatar",
    requireAuth,
    requireAdminOrModerator,
    async (req, res, next) => {
        const member = await prisma.member.findUnique({
            where: { slug: req.params.slug },
        });
        if (!member) return sendNotFound(res, "Member not found");
        req._member = member;
        next();
    },
    avatarUploadMiddleware.single("avatar"),
    async (req, res) => {
        const member = req._member;
        const usersForMember = await prisma.user.findMany({
            where: { memberId: member.id },
            include: { roles: true },
        });

        const isAdminMember = usersForMember.some((u) =>
            (u.roles || []).some((r) => r.role === "ADMIN"),
        );
        if (isAdminMember) {
            try { if(req.file?.path) fs.unlinkSync(req.file.path); } catch {}
            return sendForbidden(res, "Cannot modify admin member from this page");
        }

        const userId = usersForMember[0]?.id || null;

        try {
            const result = await processAvatarUpload({ userId, memberId: member.id, file: req.file });
            sendCreated(res, {
                ok: true,
                url: abs(result.url, req),
                relativePath: result.url,
            });
        } catch (e) {
            return sendBadRequest(res, e.message || "Avatar upload failed");
        }
    },
);

module.exports = router;