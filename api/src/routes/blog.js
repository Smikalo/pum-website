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
    requireMember,
    requireAdminOrModeratorOrCreator,
} = require("../middleware/auth");
const {
    abs,
    upsertStringList,
    renderBaseEmailHtml,
    signNewsletterUnsubToken,
    mailTransporter,
    MAIL_FROM,
    WEB_ORIGIN
} = require("../utils/shared");

const router = express.Router();

const blogCreateSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(2000).optional().nullable(),
    content: z.string().max(100_000).optional().nullable(),
    tags: z.array(z.string().min(1)).optional(),
    techStack: z.array(z.string().min(1)).optional(),
    photos: z.array(z.string().url()).max(20).optional(),
    authorSlugs: z.array(z.string().min(1)).optional(),
    projectSlugs: z.array(z.string().min(1)).optional(),
    eventSlugs: z.array(z.string().min(1)).optional(),
    publishedAt: z.string().optional().nullable(),
});

const deleteBySlugSchema = z.object({
    confirmSlug: z.string().min(1),
});

async function uniqueBlogSlug(base) {
    const b = slugify(base || "blog", { lower: true, strict: true }) || "blog";
    let slug = b;
    let i = 1;
    while (await prisma.blog.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

router.get("/", async (req, res) => {
    const { page, size } = getPaginationParams(req.query);
    const q = (req.query.q || "").toString().trim();
    const techCsv = (req.query.tech || "").toString();
    const tagCsv = (req.query.tag || "").toString();
    const authorCsv = (req.query.author || "").toString();

    const techs = techCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const tags = tagCsv.split(",").map((s) => s.trim()).filter(Boolean);
    const authors = authorCsv.split(",").map((s) => s.trim()).filter(Boolean);

    const AND = [];
    if (q) {
        AND.push({
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { content: { contains: q, mode: "insensitive" } },
            ],
        });
    }
    for (const t of techs) AND.push({ techs: { some: { tech: { name: t } } } });
    for (const t of tags) AND.push({ tags: { some: { tag: { name: t } } } });
    for (const a of authors) AND.push({ authors: { some: { member: { slug: a } } } });

    const where = AND.length ? { AND } : undefined;

    const [total, rows] = await Promise.all([
        prisma.blog.count({ where }),
        prisma.blog.findMany({
            where,
            include: {
                techs: { include: { tech: true } },
                tags: { include: { tag: true } },
                authors: {
                    include: {
                        member: {
                            select: { slug: true, name: true, avatarUrl: true, headline: true },
                        },
                    },
                },
                projects: { include: { project: { select: { slug: true } } } },
                events: { include: { event: { select: { slug: true } } } },
            },
            orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
            skip: (page - 1) * size,
            take: size,
        }),
    ]);

    const items = rows.map((b) => ({
        id: b.id,
        slug: b.slug,
        title: b.title,
        summary: b.summary || null,
        cover: abs(b.cover || b.imageUrl || null, req),
        imageUrl: abs(b.imageUrl || null, req),
        publishedAt: b.publishedAt || null,
        techStack: b.techs.map((x) => x.tech.name),
        tags: b.tags.map((x) => x.tag.name),
        authors: b.authors.map((r) => ({
            slug: r.member.slug,
            name: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
            headline: r.member.headline || null,
            role: typeof r.role === "string" && r.role.trim() ? r.role.trim() : null,
        })),
        projectSlugs: Array.isArray(b.projects) ? b.projects.map((pb) => pb.project).filter(Boolean).map((p) => p.slug) : [],
        eventSlugs: Array.isArray(b.events) ? b.events.map((eb) => eb.event).filter(Boolean).map((e) => e.slug) : [],
    }));

    sendOk(res, toPagedResponse(items, total, page, size));
});

router.get("/:slug", async (req, res) => {
    const b = await prisma.blog.findUnique({
        where: { slug: req.params.slug },
        include: {
            techs: { include: { tech: true } },
            tags: { include: { tag: true } },
            authors: {
                include: {
                    member: {
                        select: { slug: true, name: true, avatarUrl: true, headline: true },
                    },
                },
            },
            projects: { include: { project: { select: { slug: true } } } },
            events: { include: { event: { select: { slug: true } } } },
        },
    });
    if (!b) return sendJson(res, 404, { error: "Not found" });

    const images = Array.isArray(b.images) ? b.images : [];
    const cover = b.cover || b.imageUrl || (images.length ? images[0] : null);

    sendOk(res, {
        id: b.id,
        slug: b.slug,
        title: b.title,
        summary: b.summary || null,
        content: b.content || null,
        cover: abs(cover, req),
        imageUrl: abs(b.imageUrl || cover || null, req),
        images: images.map((u) => abs(u, req)),
        publishedAt: b.publishedAt || null,
        techStack: b.techs.map((x) => x.tech.name),
        tags: b.tags.map((x) => x.tag.name),
        authors: (b.authors || []).map((r) => ({
            slug: r.member.slug,
            name: r.member.name,
            avatarUrl: abs(r.member.avatarUrl || null, req),
            headline: r.member.headline || null,
            role: typeof r.role === "string" && r.role.trim() ? r.role.trim() : null,
        })),
        projectSlugs: Array.isArray(b.projects) ? b.projects.map((pb) => pb.project).filter(Boolean).map((p) => p.slug) : [],
        eventSlugs: Array.isArray(b.events) ? b.events.map((eb) => eb.event).filter(Boolean).map((e) => e.slug) : [],
    });
});

router.post("/", requireAuth, requireMember, async (req, res) => {
    const user = req.user;
    const parsed = blogCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return sendBadRequest(res, "Invalid input", parsed.error.flatten());

    const d = parsed.data;
    const slug = await uniqueBlogSlug(d.title);
    const photos = Array.isArray(d.photos) ? d.photos : [];
    const coverRel = photos.length ? photos[0] : null;
    const imagesRel = photos;

    const publishedAt = d.publishedAt && typeof d.publishedAt === "string" ? new Date(d.publishedAt) : null;

    const blog = await prisma.blog.create({
        data: {
            slug,
            title: d.title,
            summary: d.summary || null,
            content: d.content || null,
            publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
            cover: coverRel,
            imageUrl: coverRel,
            images: imagesRel,
        },
    });

    const techNames = Array.isArray(d.techStack) ? d.techStack : [];
    if (techNames.length) {
        const techIds = await upsertStringList(techNames, "tech");
        if (techIds.length) {
            await prisma.blogTech.createMany({
                data: techIds.map((id) => ({ blogId: blog.id, techId: id })),
                skipDuplicates: true,
            });
        }
    }

    const tagNames = Array.isArray(d.tags) ? d.tags : [];
    if (tagNames.length) {
        const tagIds = await upsertStringList(tagNames, "tag");
        if (tagIds.length) {
            await prisma.blogTag.createMany({
                data: tagIds.map((id) => ({ blogId: blog.id, tagId: id })),
                skipDuplicates: true,
            });
        }
    }

    const creatorMemberId = user && user.member && user.member.id ? user.member.id : null;
    const authorSlugSet = new Set(Array.isArray(d.authorSlugs) ? d.authorSlugs.map(s => String(s || "").trim()).filter(Boolean) : []);

    if (user && user.member && user.member.slug) authorSlugSet.add(user.member.slug);

    if (authorSlugSet.size) {
        const authorSlugs = Array.from(authorSlugSet);
        const members = await prisma.member.findMany({ where: { slug: { in: authorSlugs } }, select: { id: true, slug: true } });

        if (members.length) {
            for (const m of members) {
                const role = creatorMemberId && m.id === creatorMemberId ? "CREATOR" : null;
                try {
                    await prisma.blogAuthor.upsert({
                        where: { blogId_memberId: { blogId: blog.id, memberId: m.id } },
                        create: { blogId: blog.id, memberId: m.id, role },
                        update: { role },
                    });
                } catch (err) {
                    // ignore
                }
            }
        }
    } else if (creatorMemberId) {
        try {
            await prisma.blogAuthor.upsert({
                where: { blogId_memberId: { blogId: blog.id, memberId: creatorMemberId } },
                create: { blogId: blog.id, memberId: creatorMemberId, role: "CREATOR" },
                update: { role: "CREATOR" },
            });
        } catch (err) {
            // ignore
        }
    }

    const projectSlugs = Array.isArray(d.projectSlugs) ? d.projectSlugs : [];
    if (projectSlugs.length) {
        const projects = await prisma.project.findMany({ where: { slug: { in: projectSlugs } }, select: { id: true, slug: true } });
        if (projects.length) {
            await prisma.projectBlog.createMany({
                data: projects.map((p) => ({ projectId: p.id, blogId: blog.id })),
                skipDuplicates: true,
            });
        }
    }

    const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
    if (eventSlugs.length) {
        const events = await prisma.event.findMany({ where: { slug: { in: eventSlugs } }, select: { id: true, slug: true } });
        if (events.length) {
            await prisma.eventBlog.createMany({
                data: events.map((e) => ({ eventId: e.id, blogId: blog.id })),
                skipDuplicates: true,
            });
        }
    }

    // -------------- Newsletter sending --------------
    try {
        if (prisma.newsletterSubscriber && mailTransporter) {
            const subscribers = await prisma.newsletterSubscriber.findMany({ where: { unsubscribedAt: null, verifiedAt: { not: null } } });

            if (subscribers.length) {
                const webBase = WEB_ORIGIN.replace(/\/$/, "");
                const blogUrl = `${webBase}/blogs/${blog.slug}`;

                for (const sub of subscribers) {
                    const to = sub.email;
                    if (!to) continue;

                    const unsubToken = signNewsletterUnsubToken({ id: sub.id, email: sub.email });
                    const unsubscribeUrl = `${webBase}/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}`;

                    const subject = `New blog post on PUM: ${blog.title}`;
                    const text = `Hi${sub.name ? " " + sub.name : ""}!\n\nWe've just published a new blog post on PUM:\n\nTitle: ${blog.title}\n${blog.summary ? `\n${blog.summary}\n` : "\n"}Read it here:\n${blogUrl}\n\nYou're receiving this because you subscribed to updates from PUM.\nIf you no longer wish to receive these, you can unsubscribe here:\n${unsubscribeUrl}\n`;

                    const html = renderBaseEmailHtml({
                        title: "New blog post on PUM",
                        preheader: blog.summary ? blog.summary.slice(0, 150) : `New blog post: ${blog.title}`,
                        bodyHtml: `<p>Hi${sub.name ? " " + sub.name : ""}!</p><p>We've just published a new blog post on PUM:</p><p><strong>${blog.title}</strong></p>${blog.summary ? `<p>${blog.summary.replace(/\n/g, "<br/>")}</p>` : ""}<p><a href="${blogUrl}">Read the full post</a></p><p>You're receiving this because you subscribed to updates from PUM.</p><p>If you no longer wish to receive these, you can unsubscribe here:<br/><a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>`,
                    });

                    await mailTransporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
                }
            }
        }
    } catch (err) {
        // ignore
    }

    sendCreated(res, { ok: true, slug: blog.slug, id: blog.id });
});

router.put("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const user = req.user;
    const blog = await prisma.blog.findUnique({
        where: { slug: req.params.slug },
        include: { authors: { include: { member: { select: { id: true, slug: true } } } } },
    });
    if (!blog) return false;
    req.blog = blog;

    const authors = Array.isArray(blog.authors) ? blog.authors : [];
    const hasAnyAuthor = authors.length > 0;
    const userMemberId = user.member?.id || null;
    const isAuthor = !!userMemberId && authors.some((a) => a.memberId === userMemberId);

    if (hasAnyAuthor) return isAuthor;
    return false;
}), async (req, res) => {
    const blog = req.blog || await prisma.blog.findUnique({
        where: { slug: req.params.slug },
        include: { authors: { include: { member: { select: { id: true, slug: true } } } } },
    });
    if (!blog) return sendNotFound(res);

    const parsed = blogCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return sendBadRequest(res, "Invalid input", parsed.error.flatten());

    const d = parsed.data;
    const hasTechStack = Object.prototype.hasOwnProperty.call(req.body || {}, "techStack");
    const hasTags = Object.prototype.hasOwnProperty.call(req.body || {}, "tags");
    const hasAuthorSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "authorSlugs");
    const hasProjectSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "projectSlugs");
    const hasEventSlugs = Object.prototype.hasOwnProperty.call(req.body || {}, "eventSlugs");

    const photos = Array.isArray(d.photos) ? d.photos : Array.isArray(blog.images) ? blog.images : [];
    const coverRel = photos.length ? photos[0] : blog.cover || blog.imageUrl || null;
    const imagesRel = photos;

    const publishedAt = d.publishedAt && typeof d.publishedAt === "string" ? new Date(d.publishedAt) : null;

    const updated = await prisma.blog.update({
        where: { id: blog.id },
        data: {
            title: d.title,
            summary: d.summary || null,
            content: d.content || null,
            publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
            cover: coverRel,
            imageUrl: coverRel || blog.imageUrl,
            images: imagesRel,
        },
    });

    if (hasTechStack) {
        const techNames = Array.isArray(d.techStack) ? d.techStack : [];
        await prisma.blogTech.deleteMany({ where: { blogId: updated.id } });
        if (techNames.length) {
            const techIds = await upsertStringList(techNames, "tech");
            if (techIds.length) {
                await prisma.blogTech.createMany({
                    data: techIds.map((id) => ({ blogId: updated.id, techId: id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasTags) {
        const tagNames = Array.isArray(d.tags) ? d.tags : [];
        await prisma.blogTag.deleteMany({ where: { blogId: updated.id } });
        if (tagNames.length) {
            const tagIds = await upsertStringList(tagNames, "tag");
            if (tagIds.length) {
                await prisma.blogTag.createMany({
                    data: tagIds.map((id) => ({ blogId: updated.id, tagId: id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasAuthorSlugs) {
        const existingAuthors = Array.isArray(blog.authors) ? blog.authors : [];
        const creatorMemberIds = new Set(existingAuthors.filter(a => a && a.memberId && typeof a.role === "string" && a.role === "CREATOR").map(a => a.memberId));
        const incomingSlugSet = new Set(Array.isArray(d.authorSlugs) ? d.authorSlugs.map(s => String(s || "").trim()).filter(Boolean) : []);

        const creatorSlugs = existingAuthors.filter(a => a && a.member && a.role === "CREATOR").map(a => a.member.slug).filter(Boolean);
        for (const slug of creatorSlugs) incomingSlugSet.add(slug);

        const authorSlugs = Array.from(incomingSlugSet);
        let members = [];
        if (authorSlugs.length) {
            members = await prisma.member.findMany({ where: { slug: { in: authorSlugs } }, select: { id: true, slug: true } });
        }

        const memberIdsToKeep = members.map(m => m.id);
        if (memberIdsToKeep.length) {
            await prisma.blogAuthor.deleteMany({ where: { blogId: updated.id, memberId: { notIn: memberIdsToKeep } } });
        } else {
            if (creatorMemberIds.size) {
                await prisma.blogAuthor.deleteMany({ where: { blogId: updated.id, memberId: { notIn: Array.from(creatorMemberIds) } } });
            } else {
                await prisma.blogAuthor.deleteMany({ where: { blogId: updated.id } });
            }
        }

        for (const m of members) {
            const role = creatorMemberIds.has(m.id) ? "CREATOR" : null;
            try {
                await prisma.blogAuthor.upsert({
                    where: { blogId_memberId: { blogId: updated.id, memberId: m.id } },
                    create: { blogId: updated.id, memberId: m.id, role },
                    update: { role },
                });
            } catch (err) {
                // ignore
            }
        }
    }

    if (hasProjectSlugs) {
        const projectSlugs = Array.isArray(d.projectSlugs) ? d.projectSlugs : [];
        await prisma.projectBlog.deleteMany({ where: { blogId: updated.id } });
        if (projectSlugs.length) {
            const projects = await prisma.project.findMany({ where: { slug: { in: projectSlugs } }, select: { id: true, slug: true } });
            if (projects.length) {
                await prisma.projectBlog.createMany({
                    data: projects.map((p) => ({ projectId: p.id, blogId: updated.id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    if (hasEventSlugs) {
        const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
        await prisma.eventBlog.deleteMany({ where: { blogId: updated.id } });
        if (eventSlugs.length) {
            const events = await prisma.event.findMany({ where: { slug: { in: eventSlugs } }, select: { id: true, slug: true } });
            if (events.length) {
                await prisma.eventBlog.createMany({
                    data: events.map((e) => ({ eventId: e.id, blogId: updated.id })),
                    skipDuplicates: true,
                });
            }
        }
    }

    sendOk(res, { ok: true, slug: updated.slug, id: updated.id });
});

router.delete("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const user = req.user;
    const blog = await prisma.blog.findUnique({
        where: { slug: req.params.slug },
        include: { authors: true },
    });
    if (!blog) return false;
    req.blog = blog;

    if (user.member && user.member.id) {
        return (blog.authors || []).some(a => a.memberId === user.member.id && typeof a.role === "string" && a.role === "CREATOR");
    }
    return false;
}), async (req, res) => {
    const blog = req.blog || await prisma.blog.findUnique({ where: { slug: req.params.slug } });
    if (!blog) return sendNotFound(res);

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) return sendBadRequest(res, "Invalid input", parsed.error.flatten());

    const { confirmSlug } = parsed.data;
    if (confirmSlug !== blog.slug) return sendBadRequest(res, "Slug confirmation does not match");

    try {
        await prisma.$transaction(async (tx) => {
            await tx.blogTech.deleteMany({ where: { blogId: blog.id } });
            await tx.blogTag.deleteMany({ where: { blogId: blog.id } });
            await tx.blogAuthor.deleteMany({ where: { blogId: blog.id } });
            await tx.projectBlog.deleteMany({ where: { blogId: blog.id } });
            await tx.eventBlog.deleteMany({ where: { blogId: blog.id } });
            await tx.blog.delete({ where: { id: blog.id } });
        });

        sendOk(res, { ok: true });
    } catch (err) {
        sendServerError(res, "Failed to delete blog");
    }
});

module.exports = router;