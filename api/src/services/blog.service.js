// api/src/services/blog.service.js
// NOTE: list-like updates for tech stack, tags, authors, and relations must use DB transaction.

const slugify = require("slugify");
const { prisma } = require("../db");
const logger = require("../logger");
const {
    upsertStringList,
    renderBaseEmailHtml,
    signNewsletterUnsubToken,
    mailTransporter,
    MAIL_FROM,
    WEB_ORIGIN,
    abs
} = require("../utils/shared");
const { getPaginationParams, toPagedResponse } = require("../utils/lists");
const { NotFoundError } = require("../errors");

function makeReq(baseUrl) {
    if (!baseUrl) return { protocol: "http", get: () => "localhost" };
    const u = new URL(baseUrl);
    return {
        protocol: u.protocol.replace(":", ""),
        get: (key) => (key === "host" ? u.host : "")
    };
}

async function uniqueBlogSlug(base, ctx = prisma) {
    const b = slugify(base || "blog", { lower: true, strict: true }) || "blog";
    let slug = b;
    let i = 1;
    while (await ctx.blog.findUnique({ where: { slug } })) {
        i += 1;
        slug = `${b}-${i}`;
        if (i > 9999) break;
    }
    return slug;
}

async function listBlogs(query, baseUrl) {
    const { page, size } = getPaginationParams(query);
    const q = (query.q || "").toString().trim();
    const techCsv = (query.tech || "").toString();
    const tagCsv = (query.tag || "").toString();
    const authorCsv = (query.author || "").toString();

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

    const req = makeReq(baseUrl);

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

    return toPagedResponse(items, total, page, size);
}

async function getBlogBySlug(slug, baseUrl) {
    const b = await prisma.blog.findUnique({
        where: { slug },
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
    if (!b) throw new NotFoundError("Not found");

    const req = makeReq(baseUrl);

    const images = Array.isArray(b.images) ? b.images : [];
    const cover = b.cover || b.imageUrl || (images.length ? images[0] : null);

    return {
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
    };
}

async function createBlog(data, user) {
    const d = data;
    const photos = Array.isArray(d.photos) ? d.photos : [];
    const coverRel = photos.length ? photos[0] : null;
    const imagesRel = photos;
    const publishedAt = d.publishedAt && typeof d.publishedAt === "string" ? new Date(d.publishedAt) : null;
    const creatorMemberId = user && user.member && user.member.id ? user.member.id : null;
    const authorSlugSet = new Set(Array.isArray(d.authorSlugs) ? d.authorSlugs.map(s => String(s || "").trim()).filter(Boolean) : []);

    if (user && user.member && user.member.slug) authorSlugSet.add(user.member.slug);

    const { blog, subscribersToNotify } = await prisma.$transaction(async (tx) => {
        const slug = await uniqueBlogSlug(d.title, tx);

        const blog = await tx.blog.create({
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
            const techIds = await upsertStringList(techNames, "tech", tx);
            if (techIds.length) {
                await tx.blogTech.createMany({
                    data: techIds.map((id) => ({ blogId: blog.id, techId: id })),
                    skipDuplicates: true,
                });
            }
        }

        const tagNames = Array.isArray(d.tags) ? d.tags : [];
        if (tagNames.length) {
            const tagIds = await upsertStringList(tagNames, "tag", tx);
            if (tagIds.length) {
                await tx.blogTag.createMany({
                    data: tagIds.map((id) => ({ blogId: blog.id, tagId: id })),
                    skipDuplicates: true,
                });
            }
        }

        if (authorSlugSet.size) {
            const authorSlugs = Array.from(authorSlugSet);
            const members = await tx.member.findMany({ where: { slug: { in: authorSlugs } }, select: { id: true, slug: true } });

            if (members.length) {
                for (const m of members) {
                    const role = creatorMemberId && m.id === creatorMemberId ? "CREATOR" : null;
                    await tx.blogAuthor.upsert({
                        where: { blogId_memberId: { blogId: blog.id, memberId: m.id } },
                        create: { blogId: blog.id, memberId: m.id, role },
                        update: { role },
                    });
                }
            }
        } else if (creatorMemberId) {
            await tx.blogAuthor.upsert({
                where: { blogId_memberId: { blogId: blog.id, memberId: creatorMemberId } },
                create: { blogId: blog.id, memberId: creatorMemberId, role: "CREATOR" },
                update: { role: "CREATOR" },
            });
        }

        const projectSlugs = Array.isArray(d.projectSlugs) ? d.projectSlugs : [];
        if (projectSlugs.length) {
            const projects = await tx.project.findMany({ where: { slug: { in: projectSlugs } }, select: { id: true, slug: true } });
            if (projects.length) {
                await tx.projectBlog.createMany({
                    data: projects.map((p) => ({ projectId: p.id, blogId: blog.id })),
                    skipDuplicates: true,
                });
            }
        }

        const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
        if (eventSlugs.length) {
            const events = await tx.event.findMany({ where: { slug: { in: eventSlugs } }, select: { id: true, slug: true } });
            if (events.length) {
                await tx.eventBlog.createMany({
                    data: events.map((e) => ({ eventId: e.id, blogId: blog.id })),
                    skipDuplicates: true,
                });
            }
        }

        // Gather subscribers for notification
        let subscribers = [];
        try {
            subscribers = await tx.newsletterSubscriber.findMany({ where: { unsubscribedAt: null, verifiedAt: { not: null } } });
        } catch {
            // ignore
        }

        return { blog, subscribersToNotify: subscribers };
    });

    // -------------- Newsletter sending --------------
    if (subscribersToNotify && subscribersToNotify.length && mailTransporter) {
        const webBase = WEB_ORIGIN.replace(/\/$/, "");
        const blogUrl = `${webBase}/blogs/${blog.slug}`;

        for (const sub of subscribersToNotify) {
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

            // Fire and forget
            void mailTransporter.sendMail({ from: MAIL_FROM, to, subject, text, html }).catch(() => {});
        }
    }

    logger.info("Blog post created", {
        userId: user?.id || null,
        postSlug: blog.slug,
        postId: blog.id
    });

    return { ok: true, slug: blog.slug, id: blog.id };
}

async function updateBlog(slug, data, user, existingBlog = null) {
    let blog = existingBlog;
    if (!blog) {
        blog = await prisma.blog.findUnique({
            where: { slug },
            include: { authors: { include: { member: { select: { id: true, slug: true } } } } },
        });
    }

    if (!blog) throw new NotFoundError("Not found");

    const d = data;
    const hasTechStack = Object.prototype.hasOwnProperty.call(d, "techStack");
    const hasTags = Object.prototype.hasOwnProperty.call(d, "tags");
    const hasAuthorSlugs = Object.prototype.hasOwnProperty.call(d, "authorSlugs");
    const hasProjectSlugs = Object.prototype.hasOwnProperty.call(d, "projectSlugs");
    const hasEventSlugs = Object.prototype.hasOwnProperty.call(d, "eventSlugs");

    const photos = Array.isArray(d.photos) ? d.photos : Array.isArray(blog.images) ? blog.images : [];
    const coverRel = photos.length ? photos[0] : blog.cover || blog.imageUrl || null;
    const imagesRel = photos;
    const publishedAt = d.publishedAt && typeof d.publishedAt === "string" ? new Date(d.publishedAt) : null;

    const { updated } = await prisma.$transaction(async (tx) => {
        const updated = await tx.blog.update({
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
            await tx.blogTech.deleteMany({ where: { blogId: updated.id } });
            if (techNames.length) {
                const techIds = await upsertStringList(techNames, "tech", tx);
                if (techIds.length) {
                    await tx.blogTech.createMany({
                        data: techIds.map((id) => ({ blogId: updated.id, techId: id })),
                        skipDuplicates: true,
                    });
                }
            }
        }

        if (hasTags) {
            const tagNames = Array.isArray(d.tags) ? d.tags : [];
            await tx.blogTag.deleteMany({ where: { blogId: updated.id } });
            if (tagNames.length) {
                const tagIds = await upsertStringList(tagNames, "tag", tx);
                if (tagIds.length) {
                    await tx.blogTag.createMany({
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
                members = await tx.member.findMany({ where: { slug: { in: authorSlugs } }, select: { id: true, slug: true } });
            }

            const memberIdsToKeep = members.map(m => m.id);
            if (memberIdsToKeep.length) {
                await tx.blogAuthor.deleteMany({ where: { blogId: updated.id, memberId: { notIn: memberIdsToKeep } } });
            } else {
                if (creatorMemberIds.size) {
                    await tx.blogAuthor.deleteMany({ where: { blogId: updated.id, memberId: { notIn: Array.from(creatorMemberIds) } } });
                } else {
                    await tx.blogAuthor.deleteMany({ where: { blogId: updated.id } });
                }
            }

            for (const m of members) {
                const role = creatorMemberIds.has(m.id) ? "CREATOR" : null;
                await tx.blogAuthor.upsert({
                    where: { blogId_memberId: { blogId: updated.id, memberId: m.id } },
                    create: { blogId: updated.id, memberId: m.id, role },
                    update: { role },
                });
            }
        }

        if (hasProjectSlugs) {
            const projectSlugs = Array.isArray(d.projectSlugs) ? d.projectSlugs : [];
            await tx.projectBlog.deleteMany({ where: { blogId: updated.id } });
            if (projectSlugs.length) {
                const projects = await tx.project.findMany({ where: { slug: { in: projectSlugs } }, select: { id: true, slug: true } });
                if (projects.length) {
                    await tx.projectBlog.createMany({
                        data: projects.map((p) => ({ projectId: p.id, blogId: updated.id })),
                        skipDuplicates: true,
                    });
                }
            }
        }

        if (hasEventSlugs) {
            const eventSlugs = Array.isArray(d.eventSlugs) ? d.eventSlugs : [];
            await tx.eventBlog.deleteMany({ where: { blogId: updated.id } });
            if (eventSlugs.length) {
                const events = await tx.event.findMany({ where: { slug: { in: eventSlugs } }, select: { id: true, slug: true } });
                if (events.length) {
                    await tx.eventBlog.createMany({
                        data: events.map((e) => ({ eventId: e.id, blogId: updated.id })),
                        skipDuplicates: true,
                    });
                }
            }
        }

        return { updated };
    });

    logger.info("Blog post updated", {
        userId: user?.id || null,
        postSlug: updated.slug,
        postId: updated.id
    });

    return { ok: true, slug: updated.slug, id: updated.id };
}

async function deleteBlog(slug, confirmSlug, user) {
    const blog = await prisma.blog.findUnique({ where: { slug } });
    if (!blog) throw new NotFoundError("Not found");

    if (confirmSlug !== blog.slug) throw new BadRequestError("Slug confirmation does not match");

    await prisma.$transaction(async (tx) => {
        await tx.blogTech.deleteMany({ where: { blogId: blog.id } });
        await tx.blogTag.deleteMany({ where: { blogId: blog.id } });
        await tx.blogAuthor.deleteMany({ where: { blogId: blog.id } });
        await tx.projectBlog.deleteMany({ where: { blogId: blog.id } });
        await tx.eventBlog.deleteMany({ where: { blogId: blog.id } });
        await tx.blog.delete({ where: { id: blog.id } });
    });

    logger.info("Blog post deleted", {
        userId: user?.id || null,
        postSlug: slug,
        postId: blog.id
    });

    return { ok: true };
}

module.exports = {
    listBlogs,
    getBlogBySlug,
    createBlog,
    updateBlog,
    deleteBlog
};