const express = require("express");
const z = require("zod");
const slugify = require("slugify");
const { prisma } = require("../db");
const {
    sendOk,
    sendCreated,
    asyncHandler
} = require("../utils/http");
const { getPaginationParams, toPagedResponse } = require("../utils/lists");
const {
    requireAuth,
    requireMember,
    requireAdminOrModeratorOrCreator,
} = require("../middleware/auth");
const {
    abs,
    upsertStringList,
    genInviteToken,
    renderBaseEmailHtml,
    sendInviteEmail,
    MAIL_FROM,
    WEB_ORIGIN
} = require("../utils/shared");
const {
    NotFoundError,
    BadRequestError
} = require("../errors");

const router = express.Router();

const projectLinkSchema = z.object({
    label: z.string().max(200).optional().nullable(),
    url: z.string().url(),
});

const createProjectSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(2000).optional().nullable(),
    description: z.string().max(20_000).optional().nullable(),
    status: z.string().max(200).optional().nullable(),
    year: z.number().int().optional().nullable(),
    demoUrl: z.string().url().optional().nullable(),
    repoUrl: z.string().url().optional().nullable(),
    photos: z.array(z.string().url()).max(20).optional(),
    techStack: z.array(z.string().min(1).max(4)).max(50).optional(),
    tags: z.array(z.string().min(1).max(40)).max(50).optional(),
    members: z.array(z.any()).optional(),
    blogSlugs: z.array(z.string().min(1)).max(200).optional(),
    eventSlugs: z.array(z.string().min(1)).max(200).optional(),
    links: z.array(projectLinkSchema).max(50).optional(),
});

const deleteBySlugSchema = z.object({
    confirmSlug: z.string().min(1),
});

async function uniqueProjectSlug(base) {
    const b = slugify(base || "project", { lower: true, strict: true }) || "project";
    let slug = b;
    let i = 1;
    while (await prisma.project.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

router.get("/", asyncHandler(async (req, res) => {
    const { page, size } = getPaginationParams(req.query);

    const q = (req.query.q || "").toString().trim();
    const techCsv = (req.query.tech || "").toString();
    const tagCsv = (req.query.tag || "").toString();
    const techs = techCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const tags = tagCsv.split(",").map((s) => s.trim()).filter(Boolean);

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
            ],
        });
    }
    for (const t of techs)
        AND.push({ techs: { some: { tech: { name: t } } } });
    for (const t of tags)
        AND.push({ tags: { some: { tag: { name: t } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.findMany({
            where,
            include: {
                techs: { include: { tech: true } },
                tags: { include: { tag: true } },
                members: {
                    include: {
                        member: {
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ year: "desc" }, { title: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    const items = rows.map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary || null,
        cover: abs(p.cover || p.imageUrl || null, req),
        imageUrl: abs(p.imageUrl || p.cover || null, req),
        year: p.year || null,
        techStack: p.techs.map((x) => x.tech.name),
        tags: p.tags.map((x) => x.tag.name),
        members: p.members.map((r) => ({
            memberId: r.member.id,
            memberSlug: r.member.slug,
            memberName: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
            role: r.role || null,
            isCreator: !!r.isCreator,
        })),
    }));

    sendOk(res, toPagedResponse(items, total, page, size));
}));

router.get("/:slug", asyncHandler(async (req, res) => {
    const p = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: {
            techs: { include: { tech: true } },
            tags: { include: { tag: true } },
            members: {
                include: {
                    member: {
                        select: {
                            slug: true,
                            name: true,
                            avatarUrl: true,
                            id: true,
                        },
                    },
                },
            },
            event: true,
            relatedEvents: {
                include: {
                    event: true,
                },
            },
            blogs: {
                include: {
                    blog: {
                        include: {
                            tags: { include: { tag: true } },
                        },
                    },
                },
            },
            invites: true,
        },
    });
    if (!p) throw new NotFoundError("Not found");

    const eventsMap = new Map();
    if (p.event) {
        eventsMap.set(p.event.id, p.event);
    }
    for (const rel of p.relatedEvents || []) {
        if (rel.event) {
            eventsMap.set(rel.event.id, rel.event);
        }
    }
    const events = Array.from(eventsMap.values()).map((e) => ({
        slug: e.slug,
        name: e.name,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        locationName: e.locationName,
    }));

    const blogPosts = Array.isArray(p.blogs) && p.blogs.length
        ? p.blogs
            .filter((pb) => !!pb.blog)
            .map((pb) => ({
                slug: pb.blog.slug,
                title: pb.blog.title,
                summary: pb.blog.summary || null,
                cover: abs(pb.blog.cover || pb.blog.imageUrl || null, req),
                imageUrl: abs(pb.blog.imageUrl || null, req),
                publishedAt: pb.blog.publishedAt || null,
                tags: Array.isArray(pb.blog.tags)
                    ? pb.blog.tags.map((t) => t.tag.name)
                    : [],
            }))
        : [];

    const invites = Array.isArray(p.invites) && p.invites.length
        ? p.invites.map((inv) => ({
            id: inv.id,
            email: inv.email,
            role: inv.role || null,
            status: inv.status || null,
            createdAt: inv.createdAt || null,
        }))
        : [];

    sendOk(res, {
        id: p.id,
        slug: p.slug,
        title: p.title,
        summary: p.summary || null,
        description: p.description || null,
        status: p.status || null,
        demoUrl: p.demoUrl || null,
        repoUrl: p.repoUrl || null,
        links: p.links || {},
        imageUrl: abs(p.imageUrl || null, req),
        cover: abs(p.cover || null, req),
        images: Array.isArray(p.images)
            ? p.images.map((u) => abs(u, req))
            : [],
        year: p.year || null,
        event: p.event
            ? {
                slug: p.event.slug,
                name: p.event.name,
                dateStart: p.event.dateStart,
            }
            : null,
        events,
        techStack: p.techs.map((x) => x.tech.name),
        tags: p.tags.map((x) => x.tag.name),
        members: p.members.map((r) => ({
            slug: r.member.slug,
            name: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
            role: r.role || null,
            isCreator: !!r.isCreator,
        })),
        blogPosts,
        invites,
    });
}));

router.post("/", requireAuth, requireMember, asyncHandler(async (req, res) => {
    const user = req.user;
    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year: typeof req.body?.year === "string" ? Number(req.body.year) : req.body?.year,
    });
    if (!parsed.success) {
        throw new BadRequestError("Invalid input", parsed.error.flatten());
    }

    const d = parsed.data;
    const rawMembers = Array.isArray(d.members) ? d.members : [];
    const slug = await uniqueProjectSlug(d.title);
    const photos = Array.isArray(d.photos) ? d.photos : [];
    const coverRel = photos.length ? photos[0] : null;
    const imagesRel = photos;

    const linksArr = Array.isArray(d.links) ? d.links : [];
    const linksMap = {};
    for (const l of linksArr) {
        if (!l || typeof l !== "object") continue;
        const url = typeof l.url === "string" ? l.url.trim() : "";
        if (!url) continue;
        const label = typeof l.label === "string" && l.label.trim() ? l.label.trim() : "";
        linksMap[label] = url;
    }

    const project = await prisma.project.create({
        data: {
            slug,
            title: d.title,
            summary: d.summary || null,
            description: d.description || null,
            status: d.status || null,
            year: typeof d.year === "number" && Number.isFinite(d.year) ? d.year : null,
            demoUrl: d.demoUrl || null,
            repoUrl: d.repoUrl || null,
            cover: coverRel,
            imageUrl: coverRel,
            images: imagesRel,
            links: Object.keys(linksMap).length ? linksMap : {},
        },
    });

    const techNames = Array.isArray(d.techStack) ? d.techStack : [];
    const tagNames = Array.isArray(d.tags) ? d.tags : [];

    if (techNames.length) {
        const techIds = await upsertStringList(techNames, "tech");
        if (techIds.length) {
            await prisma.projectTech.createMany({
                data: techIds.map((id) => ({ projectId: project.id, techId: id })),
                skipDuplicates: true,
            });
        }
    }

    if (tagNames.length) {
        const tagIds = await upsertStringList(tagNames, "tag");
        if (tagIds.length) {
            await prisma.projectTag.createMany({
                data: tagIds.map((id) => ({ projectId: project.id, tagId: id })),
                skipDuplicates: true,
            });
        }
    }

    const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
    if (blogSlugs.length) {
        const blogs = await prisma.blog.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true, slug: true },
        });

        if (blogs.length) {
            await prisma.projectBlog.createMany({
                data: blogs.map((b) => ({ projectId: project.id, blogId: b.id })),
                skipDuplicates: true,
            });
        }
    }

    const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
    if (eventSlugs.length) {
        const events = await prisma.event.findMany({
            where: { slug: { in: eventSlugs } },
            select: { id: true, slug: true },
        });
        if (events.length) {
            await prisma.eventProject.createMany({
                data: events.map((e) => ({ eventId: e.id, projectId: project.id })),
                skipDuplicates: true,
            });
        }
    }

    const membersWithId = rawMembers.filter(m => m && typeof m === "object" && typeof m.memberId === "string");
    const creatorMemberId = user && user.member && user.member.id ? user.member.id : null;

    if (creatorMemberId) {
        const fromPayload = membersWithId.find(m => m.memberId === creatorMemberId);
        const creatorRole = fromPayload && typeof fromPayload.role === "string" && fromPayload.role.trim() ? fromPayload.role.trim() : "Creator";
        const creatorIsCreator = fromPayload && typeof fromPayload.isCreator === "boolean" ? !!fromPayload.isCreator : true;

        try {
            await prisma.memberProject.create({
                data: {
                    memberId: creatorMemberId,
                    projectId: project.id,
                    role: creatorRole,
                    contribution: null,
                    isCreator: creatorIsCreator,
                },
            });
        } catch (err) {
            // ignore
        }
    }

    for (const m of membersWithId) {
        if (creatorMemberId && m.memberId === creatorMemberId) continue;
        const role = typeof m.role === "string" && m.role.trim() ? m.role.trim() : null;
        const isCreator = typeof m.isCreator === "boolean" ? !!m.isCreator : false;

        try {
            await prisma.memberProject.create({
                data: {
                    memberId: m.memberId,
                    projectId: project.id,
                    role,
                    contribution: null,
                    isCreator,
                },
            });
        } catch (err) {
            // ignore
        }
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const memberIdsFromPayload = [];
    const inviteMap = new Map();

    for (const m of rawMembers) {
        if (!m || typeof m !== "object") continue;
        let role = null;
        if (typeof m.role === "string" && m.role.trim()) role = m.role.trim();

        if (typeof m.memberId === "string") {
            memberIdsFromPayload.push(m.memberId);
        }

        let addr = null;
        if (typeof m.email === "string") addr = m.email.trim();
        else if (typeof m.value === "string") addr = m.value.trim();
        if (addr && emailRegex.test(addr)) {
            const lower = addr.toLowerCase();
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }
    }

    if (memberIdsFromPayload.length) {
        const usersForMembers = await prisma.user.findMany({
            where: { memberId: { in: memberIdsFromPayload } },
            select: { email: true, memberId: true },
        });
        for (const u of usersForMembers) {
            if (!u.email) continue;
            const lower = u.email.toLowerCase();
            const fromPayload = rawMembers.find(m => m && typeof m === "object" && m.memberId === u.memberId && typeof m.role === "string" && m.role.trim());
            const role = fromPayload ? fromPayload.role.trim() : null;

            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }
    }

    const creatorEmailLower = (user.email || "").toLowerCase();
    if (creatorEmailLower) {
        inviteMap.delete(creatorEmailLower);
    }

    const invites = Array.from(inviteMap.values());

    if (invites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const projectUrl = `${webBase}/projects/${project.slug}`;

        for (const inv of invites) {
            const email = inv.email;
            const roleLabel = inv.role || "Contributor";
            const { raw, hash } = genInviteToken();

            await prisma.projectInvite.create({
                data: {
                    projectId: project.id,
                    email,
                    role: inv.role || null,
                    tokenHash: hash,
                    status: "PENDING",
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                },
            });

            const acceptUrl = `${webBase}/accept-invite?token=${raw}`;
            const subject = `You've been invited to join project: ${project.title}`;
            const text = `Hi,

You've been invited to join the project "${project.title}" at PUM.

Role on the project: ${roleLabel}

Approve your invite:
${acceptUrl}

Project page: ${projectUrl}

This invite was sent from ${MAIL_FROM}.
`;
            const html = renderBaseEmailHtml({
                title: "Project invite",
                preheader: `You've been invited to join "${project.title}" on PUM.`,
                bodyHtml: `<p>Hi,</p>
<p>You've been invited to join the project <strong>${project.title}</strong> at PUM.</p>
<p><strong>Role on the project:</strong> ${roleLabel}</p>
<p><a href="${acceptUrl}">Approve your invite</a></p>
<p>Project page: <a href="${projectUrl}">${projectUrl}</a></p>
<p>This invite was sent from ${MAIL_FROM}.</p>`,
            });

            void sendInviteEmail(email, subject, text, html);
        }
    }

    sendCreated(res, { ok: true, slug: project.slug, id: project.id });
}));

router.put("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const user = req.user;
    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: { members: true },
    });
    if (!project) return false;
    req.project = project;

    if (user.member && user.member.id) {
        const mp = (project.members || []).find(m => m.memberId === user.member.id);
        return !!mp;
    }
    return false;
}), asyncHandler(async (req, res) => {
    const user = req.user;
    let project = req.project;
    if (!project) {
        project = await prisma.project.findUnique({
            where: { slug: req.params.slug },
            include: { members: true, invites: true },
        });
    } else {
        project = await prisma.project.findUnique({
            where: { id: project.id },
            include: { members: true, invites: true },
        });
    }

    if (!project) {
        throw new NotFoundError("Not found");
    }

    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year: typeof req.body?.year === "string" ? Number(req.body.year) : req.body?.year,
    });
    if (!parsed.success) {
        throw new BadRequestError("Invalid input", parsed.error.flatten());
    }

    const d = parsed.data;
    const hasTechStack = Object.prototype.hasOwnProperty.call(req.body || {}, "techStack");
    const hasTags = Object.prototype.hasOwnProperty.call(req.body || {}, "tags");
    const hasBlogSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "blogSlugs");
    const hasMembers = Object.prototype.hasOwnProperty.call(req.body || {}, "members");
    const hasEventSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "eventSlugs");
    const hasLinks = Object.prototype.hasOwnProperty.call(req.body || {}, "links");

    const photos = Array.isArray(d.photos) ? d.photos : Array.isArray(project.images) ? project.images : [];
    const coverRel = photos.length ? photos[0] : project.cover || null;
    const imagesRel = photos;

    let linksToStore = project.links || {};
    if (hasLinks) {
        const linksArr = Array.isArray(d.links) ? d.links : [];
        const map = {};
        for (const l of linksArr) {
            if (!l || typeof l !== "object") continue;
            const url = typeof l.url === "string" ? l.url.trim() : "";
            if (!url) continue;
            const label = typeof l.label === "string" && l.label.trim() ? l.label.trim() : "";
            map[label] = url;
        }
        linksToStore = map;
    }

    const updated = await prisma.project.update({
        where: { id: project.id },
        data: {
            title: d.title,
            summary: d.summary || null,
            description: d.description || null,
            status: d.status || null,
            year: typeof d.year === "number" && Number.isFinite(d.year) ? d.year : null,
            demoUrl: d.demoUrl || null,
            repoUrl: d.repoUrl || null,
            cover: coverRel,
            imageUrl: coverRel || project.imageUrl,
            images: imagesRel,
            links: linksToStore,
        },
    });

    if (hasTechStack) {
        const techNames = Array.isArray(d.techStack) ? d.techStack : [];
        await prisma.projectTech.deleteMany({ where: { projectId: updated.id } });
        if (techNames.length) {
            const techIds = await upsertStringList(techNames, "tech");
            if (techIds.length) {
                await prisma.projectTech.createMany({
                    data: techIds.map((id) => ({ projectId: updated.id, techId: id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasTags) {
        const tagNames = Array.isArray(d.tags) ? d.tags : [];
        await prisma.projectTag.deleteMany({ where: { projectId: updated.id } });
        if (tagNames.length) {
            const tagIds = await upsertStringList(tagNames, "tag");
            if (tagIds.length) {
                await prisma.projectTag.createMany({
                    data: tagIds.map((id) => ({ projectId: updated.id, tagId: id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasBlogSlugs) {
        const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
        await prisma.projectBlog.deleteMany({ where: { projectId: updated.id } });
        if (blogSlugs.length) {
            const blogs = await prisma.blog.findMany({
                where: { slug: { in: blogSlugs } },
                select: { id: true, slug: true },
            });
            if (blogs.length) {
                await prisma.projectBlog.createMany({
                    data: blogs.map((b) => ({ projectId: updated.id, blogId: b.id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasEventSlugs) {
        const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
        await prisma.eventProject.deleteMany({ where: { projectId: updated.id } });
        if (eventSlugs.length) {
            const events = await prisma.event.findMany({
                where: { slug: { in: eventSlugs } },
                select: { id: true, slug: true },
            });
            if (events.length) {
                await prisma.eventProject.createMany({
                    data: events.map((e) => ({ eventId: e.id, projectId: updated.id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasMembers) {
        const rawMembers = Array.isArray(d.members) ? d.members : [];
        const existingInviteEmails = new Set((project.invites || []).map(i => (i.email || "").toLowerCase()).filter(e => !!e));
        const existingMemberMap = new Map((project.members || []).map(m => [m.memberId, m]));

        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
        const memberIdsFromPayload = [];
        const inviteMap = new Map();
        const newMemberIdsSet = new Set();

        for (const m of rawMembers) {
            if (!m || typeof m !== "object") continue;
            if (typeof m.memberId === "string") {
                const memberId = m.memberId;
                newMemberIdsSet.add(memberId);
                memberIdsFromPayload.push(memberId);

                const existing = existingMemberMap.get(memberId);
                const newRole = typeof m.role === "string" && m.role.trim() ? m.role.trim() : null;
                const newIsCreator = typeof m.isCreator === "boolean" ? !!m.isCreator : !!existing?.isCreator;

                if (existing) {
                    await prisma.memberProject.update({
                        where: { memberId_projectId: { memberId, projectId: updated.id } },
                        data: { role: newRole, isCreator: newIsCreator },
                    });
                } else {
                    await prisma.memberProject.create({
                        data: { memberId, projectId: updated.id, role: newRole, contribution: null, isCreator: newIsCreator },
                    });
                }
            }
        }

        for (const existing of project.members || []) {
            if (newMemberIdsSet.has(existing.memberId)) continue;
            if (existing.isCreator) continue;
            await prisma.memberProject.delete({
                where: { memberId_projectId: { memberId: existing.memberId, projectId: updated.id } },
            });
        }

        for (const m of rawMembers) {
            if (!m || typeof m !== "object") continue;
            let role = null;
            if (typeof m.role === "string" && m.role.trim()) role = m.role.trim();
            let addr = null;
            if (typeof m.email === "string") addr = m.email.trim();
            else if (typeof m.value === "string") addr = m.value.trim();
            if (!addr || !emailRegex.test(addr)) continue;
            const lower = addr.toLowerCase();
            if (existingInviteEmails.has(lower)) continue;
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower, role });
            } else if (role && !inviteMap.get(lower).role) {
                inviteMap.get(lower).role = role;
            }
        }

        if (memberIdsFromPayload.length) {
            const usersForMembers = await prisma.user.findMany({
                where: { memberId: { in: memberIdsFromPayload } },
                select: { email: true, memberId: true },
            });
            for (const u of usersForMembers) {
                if (!u.email) continue;
                const lower = u.email.toLowerCase();
                if (existingInviteEmails.has(lower)) continue;
                const fromPayload = rawMembers.find(m => m && typeof m === "object" && m.memberId === u.memberId && typeof m.role === "string" && m.role.trim());
                const role = fromPayload ? fromPayload.role.trim() : null;
                if (!inviteMap.has(lower)) inviteMap.set(lower, { email: lower, role });
                else if (role && !inviteMap.get(lower).role) inviteMap.get(lower).role = role;
            }
        }

        const editorEmailLower = (user.email || "").toLowerCase();
        if (editorEmailLower) inviteMap.delete(editorEmailLower);

        const invites = Array.from(inviteMap.values());

        if (invites.length) {
            const webBase = WEB_ORIGIN.replace(/\/$/, "");
            const projectUrl = `${webBase}/projects/${updated.slug}`;

            for (const inv of invites) {
                const email = inv.email;
                const roleLabel = inv.role || "Contributor";
                const { raw, hash } = genInviteToken();

                await prisma.projectInvite.create({
                    data: {
                        projectId: updated.id,
                        email,
                        role: inv.role || null,
                        tokenHash: hash,
                        status: "PENDING",
                        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                    },
                });

                const acceptUrl = `${webBase}/accept-invite?token=${raw}`;
                const subject = `You've been invited to join project: ${updated.title}`;
                const text = `Hi,

You've been invited to join the project "${updated.title}" at PUM.

Role on the project: ${roleLabel}

Approve your invite:
${acceptUrl}

Project page: ${projectUrl}

This invite was sent from ${MAIL_FROM}.
`;

                const html = renderBaseEmailHtml({
                    title: "Project invite",
                    preheader: `You've been invited to join "${updated.title}" on PUM.`,
                    bodyHtml: `<p>Hi,</p>
<p>You've been invited to join the project <strong>${updated.title}</strong> at PUM.</p>
<p><strong>Role on the project:</strong> ${roleLabel}</p>
<p><a href="${acceptUrl}">Approve your invite</a></p>
<p>Project page: <a href="${projectUrl}">${projectUrl}</a></p>
<p>This invite was sent from ${MAIL_FROM}.</p>`,
                });

                void sendInviteEmail(email, subject, text, html);
            }
        }
    }

    sendOk(res, { ok: true, slug: updated.slug, id: updated.id });
}));

router.delete("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const user = req.user;
    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: { members: true },
    });
    if (!project) return false;
    req.project = project;

    if (user.member && user.member.id) {
        return (project.members || []).some(m => m.memberId === user.member.id && !!m.isCreator);
    }
    return false;
}), asyncHandler(async (req, res) => {
    let project = req.project;
    if (!project) {
        project = await prisma.project.findUnique({ where: { slug: req.params.slug } });
    }

    if (!project) throw new NotFoundError("Not found");

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== project.slug) throw new BadRequestError("Slug confirmation does not match");

    await prisma.$transaction(async (tx) => {
        await tx.projectTech.deleteMany({ where: { projectId: project.id } });
        await tx.projectTag.deleteMany({ where: { projectId: project.id } });
        await tx.projectBlog.deleteMany({ where: { projectId: project.id } });
        await tx.eventProject.deleteMany({ where: { projectId: project.id } });
        await tx.memberProject.deleteMany({ where: { projectId: project.id } });
        await tx.projectInvite.deleteMany({ where: { projectId: project.id } });
        await tx.project.delete({ where: { id: project.id } });
    });

    sendOk(res, { ok: true });
}));

module.exports = router;