const express = require("express");
const z = require("zod");
const slugify = require("slugify");
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
    requireAdminOrModeratorOrCreator,
    requireAdminOrModerator
} = require("../middleware/auth");
const {
    abs,
    genInviteToken,
    renderBaseEmailHtml,
    sendInviteEmail,
    MAIL_FROM,
    WEB_ORIGIN
} = require("../utils/shared");

const router = express.Router();

const attendeeSchema = z.object({
    type: z.enum(["member", "invite"]),
    memberId: z.string().optional(),
    memberSlug: z.string().optional(),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    value: z.string().optional().nullable(),
});

const eventCreateSchema = z.object({
    name: z.string().min(1).max(200),
    locationName: z.string().max(500).optional().nullable(),
    dateStart: z.string().nullable().optional(),
    dateEnd: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lng: z.number().nullable().optional(),
    description: z.string().max(20_000).optional().nullable(),
    photos: z.array(z.string().url()).max(20).optional(),
    attendees: z.array(attendeeSchema).optional(),
    projectSlugs: z.array(z.string()).max(200).optional(),
    blogSlugs: z.array(z.string()).max(200).optional(),
});

const deleteBySlugSchema = z.object({
    confirmSlug: z.string().min(1),
});

async function uniqueEventSlug(base) {
    const b = slugify(base || "event", { lower: true, strict: true }) || "event";
    let slug = b;
    let i = 1;
    while (await prisma.event.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

router.get("/", async (req, res) => {
    const { page, size } = getPaginationParams(req.query);
    const q = (req.query.q || "").toString().trim();

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { name: { contains: q, mode: "insensitive" } },
                { slug: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { locationName: { contains: q, mode: "insensitive" } },
            ],
        });
    }

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.event.count({ where }),
        prisma.event.findMany({
            where,
            include: {
                relatedProjects: { include: { project: true } },
                attendees: { include: { member: true } },
                invites: true,
                blogs: { include: { blog: true } },
            },
            orderBy: [{ dateStart: "desc" }, { name: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    const items = rows.map((e) => {
        const photos = Array.isArray(e.photos) ? e.photos : [];
        const cover = e.cover || e.imageUrl || (photos.length ? photos[0] : null);

        return {
            id: e.id,
            slug: e.slug,
            name: e.name,
            summary: null,
            description: e.description || null,
            dateStart: e.dateStart,
            dateEnd: e.dateEnd,
            locationName: e.locationName || null,
            lat: e.lat ?? null,
            lng: e.lng ?? null,
            cover: abs(cover, req),
            photos: photos.map((u) => abs(u, req)),
            projects: (e.relatedProjects || [])
                .map((rel) => rel.project)
                .filter(Boolean)
                .map((p) => ({
                    slug: p.slug,
                    title: p.title,
                    cover: abs(p.cover || p.imageUrl || null, req),
                    year: p.year || null,
                })),
            blogs: (e.blogs || [])
                .map((rel) => rel.blog)
                .filter(Boolean)
                .map((b) => ({
                    slug: b.slug,
                    title: b.title,
                    cover: abs(b.cover || b.imageUrl || null, req),
                    publishedAt: b.publishedAt || null,
                })),
        };
    });

    sendOk(res, toPagedResponse(items, total, page, size));
});

router.get("/:slug", async (req, res) => {
    const e = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: {
            relatedProjects: { include: { project: true } },
            attendees: { include: { member: true } },
            invites: true,
            blogs: {
                include: {
                    blog: {
                        include: {
                            tags: { include: { tag: true } },
                        },
                    },
                },
            },
        },
    });
    if (!e) return sendJson(res, 404, { error: "Not found" });

    const photos = Array.isArray(e.photos) ? e.photos : [];
    const cover = e.cover || e.imageUrl || (photos.length ? photos[0] : null);

    const attendees = (e.attendees || []).map((ae) => ({
        memberId: ae.memberId,
        slug: ae.member?.slug || null,
        name: ae.member?.name || null,
        role: ae.role || null,
        avatarUrl: abs(ae.member?.avatarUrl, req),
        headline: ae.member?.headline || null,
        pending: false
    }));

    const invites = Array.isArray(e.invites) && e.invites.length
        ? e.invites.map((inv) => ({
            id: inv.id,
            email: inv.email,
            status: inv.status || null,
        }))
        : [];

    const projects = (e.relatedProjects || [])
        .map((rel) => rel.project)
        .filter(Boolean)
        .map((p) => ({
            slug: p.slug,
            title: p.title,
            cover: abs(p.cover || p.imageUrl || null, req),
            year: p.year || null,
        }));

    const blogs = Array.isArray(e.blogs) && e.blogs.length
        ? e.blogs
            .map((rel) => rel.blog)
            .filter(Boolean)
            .map((b) => ({
                slug: b.slug,
                title: b.title,
                summary: b.summary || null,
                cover: abs(b.cover || b.imageUrl || null, req),
                imageUrl: abs(b.imageUrl || null, req),
                publishedAt: b.publishedAt || null,
                tags: Array.isArray(b.tags)
                    ? b.tags.map((t) => t.tag.name)
                    : [],
            }))
        : [];

    sendOk(res, {
        id: e.id,
        slug: e.slug,
        name: e.name,
        summary: null,
        description: e.description || null,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        locationName: e.locationName || null,
        lat: e.lat ?? null,
        lng: e.lng ?? null,
        cover: abs(cover, req),
        photos: photos.map((u) => abs(u, req)),
        attendees,
        invites,
        projects,
        blogs,
    });
});

router.post("/", requireAuth, async (req, res) => {
    const user = req.user;
    const roles = (user.roles || []).map((r) => r.role);
    const hasMemberRole = roles.some((r) => ["ADMIN", "MODERATOR", "MEMBER"].includes(r));
    if (!hasMemberRole) {
        return sendForbidden(res, "Insufficient permissions");
    }

    const parsed = eventCreateSchema.safeParse({
        ...req.body,
        lat: typeof req.body?.lat === "string" ? Number(req.body.lat) : req.body?.lat,
        lng: typeof req.body?.lng === "string" ? Number(req.body.lng) : req.body?.lng,
    });
    if (!parsed.success) {
        return sendBadRequest(res, "Invalid input", parsed.error.flatten());
    }

    const d = parsed.data;

    const slug = await uniqueEventSlug(d.name);
    const photos = Array.isArray(d.photos) ? d.photos : [];
    const imagesRel = photos;

    const dateStart = d.dateStart && typeof d.dateStart === "string" ? new Date(d.dateStart) : null;
    const dateEnd = d.dateEnd && typeof d.dateEnd === "string" ? new Date(d.dateEnd) : null;

    const creatorMemberId = user && user.member && user.member.id ? user.member.id : null;

    const event = await prisma.event.create({
        data: {
            slug,
            name: d.name,
            locationName: d.locationName || null,
            dateStart: dateStart && !Number.isNaN(dateStart.getTime()) ? dateStart : null,
            dateEnd: dateEnd && !Number.isNaN(dateEnd.getTime()) ? dateEnd : null,
            lat: typeof d.lat === "number" && Number.isFinite(d.lat) ? d.lat : null,
            lng: typeof d.lng === "number" && Number.isFinite(d.lng) ? d.lng : null,
            description: d.description || null,
            photos: imagesRel,
        },
    });

    if (creatorMemberId) {
        try {
            await prisma.memberEvent.upsert({
                where: { memberId_eventId: { memberId: creatorMemberId, eventId: event.id } },
                create: { memberId: creatorMemberId, eventId: event.id, role: "CREATOR" },
                update: { role: "CREATOR" },
            });
        } catch (err) {
            // ignore
        }
    }

    const projectSlugs = Array.isArray(d.projectSlugs) ? d.projectSlugs : [];
    if (projectSlugs.length) {
        const projects = await prisma.project.findMany({
            where: { slug: { in: projectSlugs } },
            select: { id: true, slug: true },
        });
        if (projects.length) {
            await prisma.eventProject.createMany({
                data: projects.map((p) => ({ eventId: event.id, projectId: p.id })),
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
            await prisma.eventBlog.createMany({
                data: blogs.map((b) => ({ eventId: event.id, blogId: b.id })),
                skipDuplicates: true,
            });
        }
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const attendees = Array.isArray(d.attendees) ? d.attendees : [];

    for (const a of attendees) {
        if (a.type === "member" && a.memberId) {
            if (creatorMemberId && a.memberId === creatorMemberId) {
                continue;
            }
            try {
                await prisma.memberEvent.create({
                    data: { memberId: a.memberId, eventId: event.id, role: null },
                });
            } catch (err) {
                // ignore
            }
        }
    }

    const inviteMap = new Map();
    for (const a of attendees) {
        if (a.type !== "invite") continue;
        let addr = a.value || a.email || "";
        addr = (addr || "").trim();
        if (!addr || !emailRegex.test(addr)) continue;
        const lower = addr.toLowerCase();
        if (!inviteMap.has(lower)) {
            inviteMap.set(lower, { email: lower });
        }
    }

    const memberIds = attendees.filter((a) => a.type === "member" && a.memberId).map((a) => a.memberId);
    if (memberIds.length) {
        const users = await prisma.user.findMany({
            where: { memberId: { in: memberIds } },
            select: { email: true },
        });
        for (const u of users) {
            if (!u.email) continue;
            const lower = u.email.toLowerCase();
            if (!inviteMap.has(lower)) {
                inviteMap.set(lower, { email: lower });
            }
        }
    }

    const creatorEmailLower = (user.email || "").toLowerCase();
    if (creatorEmailLower) {
        inviteMap.delete(creatorEmailLower);
    }

    const eventInvites = Array.from(inviteMap.values());

    if (eventInvites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const eventUrl = `${webBase}/events/${event.slug}`;

        for (const inv of eventInvites) {
            const email = inv.email;
            const { raw, hash } = genInviteToken();

            await prisma.eventInvite.create({
                data: {
                    eventId: event.id,
                    email,
                    tokenHash: hash,
                    status: "PENDING",
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                },
            });

            const acceptUrl = `${webBase}/accept-invite?token=${raw}`;

            const subject = `You've been invited to event: ${event.name}`;
            const text = `Hi,

You've been invited to join the event "${event.name}" at PUM.

Accept your invite:
${acceptUrl}

Event page: ${eventUrl}

This invite was sent from ${MAIL_FROM}.
`;

            const html = renderBaseEmailHtml({
                title: "Event invite",
                preheader: `You've been invited to "${event.name}" on PUM.`,
                bodyHtml: `<p>Hi,</p>
<p>You've been invited to join the event <strong>${event.name}</strong> at PUM.</p>
<p><a href="${acceptUrl}">Approve your invite</a></p>
<p>Event page: <a href="${eventUrl}">${eventUrl}</a></p>
<p>This invite was sent from ${MAIL_FROM}.</p>`,
            });

            void sendInviteEmail(email, subject, text, html);
        }
    }

    sendCreated(res, { ok: true, slug: event.slug, id: event.id });
});

router.put("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const user = req.user;
    const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: { attendees: true },
    });
    if (!event) return false;
    req.event = event;

    if (user.member && user.member.id) {
        const isCreatorOrAttendee =
            (event.attendees || []).some((a) => a.memberId === user.member.id) ||
            (user.email || "").toLowerCase() === (MAIL_FROM || "").toLowerCase();
        if (isCreatorOrAttendee) return true;
    }
    return false;
}), async (req, res) => {
    const user = req.user;
    let event = req.event;
    if (!event) {
        event = await prisma.event.findUnique({
            where: { slug: req.params.slug },
            include: {
                attendees: { include: { member: true } },
                invites: true,
                relatedProjects: true,
            },
        });
    } else {
        // Need full relations if middleware didn't load them
        event = await prisma.event.findUnique({
            where: { id: event.id },
            include: {
                attendees: { include: { member: true } },
                invites: true,
                relatedProjects: true,
            },
        });
    }

    if (!event) return sendNotFound(res);

    const parsed = eventCreateSchema.safeParse({
        ...req.body,
        lat: typeof req.body?.lat === "string" ? Number(req.body.lat) : req.body?.lat,
        lng: typeof req.body?.lng === "string" ? Number(req.body.lng) : req.body?.lng,
    });
    if (!parsed.success) return sendBadRequest(res, "Invalid input", parsed.error.flatten());

    const d = parsed.data;

    const photos = Array.isArray(d.photos) ? d.photos : Array.isArray(event.photos) ? event.photos : [];
    const imagesRel = photos;

    const dateStart = d.dateStart && typeof d.dateStart === "string" ? new Date(d.dateStart) : null;
    const dateEnd = d.dateEnd && typeof d.dateEnd === "string" ? new Date(d.dateEnd) : null;

    const updated = await prisma.event.update({
        where: { id: event.id },
        data: {
            name: d.name,
            locationName: d.locationName || null,
            dateStart: dateStart && !Number.isNaN(dateStart.getTime()) ? dateStart : null,
            dateEnd: dateEnd && !Number.isNaN(dateEnd.getTime()) ? dateEnd : null,
            lat: typeof d.lat === "number" && Number.isFinite(d.lat) ? d.lat : null,
            lng: typeof d.lng === "number" && Number.isFinite(d.lng) ? d.lng : null,
            description: d.description || null,
            photos: imagesRel,
        },
    });

    const projectSlugs = Array.isArray(d.projectSlugs) ? d.projectSlugs : [];
    await prisma.eventProject.deleteMany({ where: { eventId: updated.id } });
    if (projectSlugs.length) {
        const projects = await prisma.project.findMany({
            where: { slug: { in: projectSlugs } },
            select: { id: true, slug: true },
        });
        if (projects.length) {
            await prisma.eventProject.createMany({
                data: projects.map((p) => ({ eventId: updated.id, projectId: p.id })),
                skipDuplicates: true,
            });
        }
    }

    const blogSlugs = Array.isArray(d.blogSlugs) ? d.blogSlugs : [];
    await prisma.eventBlog.deleteMany({ where: { eventId: updated.id } });
    if (blogSlugs.length) {
        const blogs = await prisma.blog.findMany({
            where: { slug: { in: blogSlugs } },
            select: { id: true, slug: true },
        });
        if (blogs.length) {
            await prisma.eventBlog.createMany({
                data: blogs.map((b) => ({ eventId: updated.id, blogId: b.id })),
                skipDuplicates: true,
            });
        }
    }

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/i;
    const attendees = Array.isArray(d.attendees) ? d.attendees : [];
    const existingInvites = new Set((event.invites || []).map(i => (i.email || "").toLowerCase()).filter(Boolean));
    const existingAttendees = Array.isArray(event.attendees) ? event.attendees : [];

    const creatorMemberIdSet = new Set(existingAttendees.filter(a => a && a.memberId && typeof a.role === "string" && a.role === "CREATOR").map(a => a.memberId));

    if (creatorMemberIdSet.size === 0 && user && user.member && user.member.id) {
        const userMemberId = user.member.id;
        const isUserAttendee = existingAttendees.some(a => a && a.memberId === userMemberId);
        if (isUserAttendee) {
            try {
                await prisma.memberEvent.update({
                    where: { memberId_eventId: { memberId: userMemberId, eventId: event.id } },
                    data: { role: "CREATOR" },
                });
                creatorMemberIdSet.add(userMemberId);
            } catch (err) {
                // ignore
            }
        }
    }

    if (creatorMemberIdSet.size > 0) {
        await prisma.memberEvent.deleteMany({
            where: { eventId: updated.id, memberId: { notIn: Array.from(creatorMemberIdSet) } },
        });
    } else {
        await prisma.memberEvent.deleteMany({ where: { eventId: updated.id } });
    }

    for (const a of attendees) {
        if (a.type === "member" && a.memberId) {
            if (creatorMemberIdSet.has(a.memberId)) continue;
            try {
                await prisma.memberEvent.create({
                    data: { memberId: a.memberId, eventId: updated.id, role: null },
                });
            } catch (err) {
                // ignore
            }
        }
    }

    const inviteMap = new Map();
    for (const a of attendees) {
        if (a.type !== "invite") continue;
        let addr = a.value || a.email || "";
        addr = (addr || "").trim();
        if (!addr || !emailRegex.test(addr)) continue;
        const lower = addr.toLowerCase();
        if (existingInvites.has(lower)) continue;
        if (!inviteMap.has(lower)) inviteMap.set(lower, { email: lower });
    }

    const memberIds2 = attendees.filter((a) => a.type === "member" && a.memberId).map((a) => a.memberId);
    if (memberIds2.length) {
        const users = await prisma.user.findMany({
            where: { memberId: { in: memberIds2 } },
            select: { email: true },
        });
        for (const u of users) {
            if (!u.email) continue;
            const lower = u.email.toLowerCase();
            if (existingInvites.has(lower)) continue;
            if (!inviteMap.has(lower)) inviteMap.set(lower, { email: lower });
        }
    }

    const editorEmailLower = (user.email || "").toLowerCase();
    if (editorEmailLower) inviteMap.delete(editorEmailLower);

    const newInvites = Array.from(inviteMap.values());

    if (newInvites.length) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const eventUrl = `${webBase}/events/${updated.slug}`;

        for (const inv of newInvites) {
            const email = inv.email;
            const { raw, hash } = genInviteToken();

            await prisma.eventInvite.create({
                data: {
                    eventId: updated.id,
                    email,
                    tokenHash: hash,
                    status: "PENDING",
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                },
            });

            const acceptUrl = `${webBase}/accept-invite?token=${raw}`;
            const subject = `You've been invited to event: ${updated.name}`;
            const text = `Hi,

You've been invited to join the event "${updated.name}" at PUM.

Approve your invite:
${acceptUrl}

Event page: ${eventUrl}

This invite was sent from ${MAIL_FROM}.
`;

            const html = renderBaseEmailHtml({
                title: "Event invite",
                preheader: `You've been invited to "${updated.name}" on PUM.`,
                bodyHtml: `<p>Hi,</p>
<p>You've been invited to join the event <strong>${updated.name}</strong> at PUM.</p>
<p><a href="${acceptUrl}">Approve your invite</a></p>
<p>Event page: <a href="${eventUrl}">${eventUrl}</a></p>
<p>This invite was sent from ${MAIL_FROM}.</p>`,
            });

            void sendInviteEmail(email, subject, text, html);
        }
    }

    sendOk(res, { ok: true, slug: updated.slug, id: updated.id });
});

router.delete("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const user = req.user;
    const event = await prisma.event.findUnique({
        where: { slug: req.params.slug },
        include: { attendees: true },
    });
    if (!event) return false;
    req.event = event;

    if (user.member && user.member.id) {
        return (event.attendees || []).some(
            (a) =>
                a.memberId === user.member.id &&
                typeof a.role === "string" &&
                a.role === "CREATOR",
        );
    }
    return false;
}), async (req, res) => {
    const event = req.event || await prisma.event.findUnique({ where: { slug: req.params.slug } });

    if (!event) return sendNotFound(res);

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) return sendBadRequest(res, "Invalid input", parsed.error.flatten());

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== event.slug) return sendBadRequest(res, "Slug confirmation does not match");

    try {
        await prisma.$transaction(async (tx) => {
            await tx.project.updateMany({ where: { eventId: event.id }, data: { eventId: null } });
            await tx.eventProject.deleteMany({ where: { eventId: event.id } });
            await tx.eventBlog.deleteMany({ where: { eventId: event.id } });
            await tx.memberEvent.deleteMany({ where: { eventId: event.id } });
            await tx.eventInvite.deleteMany({ where: { eventId: event.id } });
            await tx.event.delete({ where: { id: event.id } });
        });

        sendOk(res, { ok: true });
    } catch (err) {
        sendServerError(res, "Failed to delete event");
    }
});

module.exports = router;
