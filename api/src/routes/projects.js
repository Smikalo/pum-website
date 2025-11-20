const express = require("express");
const z = require("zod");
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
    listProjects,
    getProjectBySlug,
    createProject,
    updateProject,
    deleteProject
} = require("../services/projects.service");

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

router.get("/", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await listProjects(req.query, baseUrl);
    sendOk(res, result);
}));

router.get("/:slug", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await getProjectBySlug(req.params.slug, baseUrl);
    sendOk(res, result);
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

    const result = await createProject(parsed.data, user);
    sendCreated(res, result);
}));

router.put("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    // We need to fetch project to check permissions (creator check).
    // Since getProjectBySlug is in service and might not expose full members for this check easily,
    // we rely on the fact that the service uses prisma.
    // But `requireAdminOrModeratorOrCreator` expects to do the check.
    // It's simpler to keep the check logic that relies on DB here or in middleware,
    // but for now we'll use the existing middleware logic.
    // Ideally, we would move permission check to service, but we are constrained not to change authorization behaviour.
    // The middleware fetches the project and attaches it to req.project.
    const { prisma } = require("../db"); // Only needed for this middleware check if not refactored
    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: { members: true },
    });
    if (!project) return false;
    req.project = project;
    const user = req.user;

    if (user.member && user.member.id) {
        const mp = (project.members || []).find(m => m.memberId === user.member.id);
        return !!mp;
    }
    return false;
}), asyncHandler(async (req, res) => {
    const user = req.user;
    const parsed = createProjectSchema.safeParse({
        ...req.body,
        year: typeof req.body?.year === "string" ? Number(req.body.year) : req.body?.year,
    });
    if (!parsed.success) {
        throw new BadRequestError("Invalid input", parsed.error.flatten());
    }

    const result = await updateProject(req.params.slug, parsed.data, user, req.project);
    sendOk(res, result);
}));

router.delete("/:slug", requireAuth, requireAdminOrModeratorOrCreator(async (req) => {
    const { prisma } = require("../db");
    const project = await prisma.project.findUnique({
        where: { slug: req.params.slug },
        include: { members: true },
    });
    if (!project) return false;
    req.project = project;
    const user = req.user;

    if (user.member && user.member.id) {
        return (project.members || []).some(m => m.memberId === user.member.id && !!m.isCreator);
    }
    return false;
}), asyncHandler(async (req, res) => {
    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const result = await deleteProject(req.params.slug, parsed.data.confirmSlug, req.user);
    sendOk(res, result);
}));

module.exports = router;
