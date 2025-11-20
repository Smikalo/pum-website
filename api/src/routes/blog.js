const express = require("express");
const z = require("zod");
const { prisma } = require("../db");
const {
    sendOk,
    sendCreated,
    asyncHandler
} = require("../utils/http");
const {
    requireAuth,
    requireMember,
    requireAdminOrModeratorOrCreator,
} = require("../middleware/auth");
const {
    NotFoundError,
    BadRequestError
} = require("../errors");
const {
    listBlogs,
    getBlogBySlug,
    createBlog,
    updateBlog,
    deleteBlog
} = require("../services/blog.service");

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

router.get("/", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await listBlogs(req.query, baseUrl);
    sendOk(res, result);
}));

router.get("/:slug", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await getBlogBySlug(req.params.slug, baseUrl);
    sendOk(res, result);
}));

router.post("/", requireAuth, requireMember, asyncHandler(async (req, res) => {
    const user = req.user;
    const parsed = blogCreateSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const result = await createBlog(parsed.data, user);
    sendCreated(res, result);
}));

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
}), asyncHandler(async (req, res) => {
    const user = req.user;
    const parsed = blogCreateSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const result = await updateBlog(req.params.slug, parsed.data, user, req.blog);
    sendOk(res, result);
}));

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
}), asyncHandler(async (req, res) => {
    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const result = await deleteBlog(req.params.slug, parsed.data.confirmSlug, req.user);
    sendOk(res, result);
}));

module.exports = router;