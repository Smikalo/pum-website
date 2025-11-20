// api/src/routes/members.js
const express = require("express");
const z = require("zod");
const fs = require("fs");
const { prisma } = require("../db");
const {
    sendOk,
    sendCreated,
    asyncHandler
} = require("../utils/http");
const {
    requireAuth,
    requireAdminOrModerator,
} = require("../middleware/auth");
const {
    abs
} = require("../utils/shared");
const {
    cvUploadMiddleware,
    avatarUploadMiddleware,
    processCvUpload,
    processAvatarUpload
} = require("../services/uploads.service");
const {
    NotFoundError,
    BadRequestError,
    ForbiddenError
} = require("../errors");
const {
    listMembers,
    getMemberBySlug,
    updateMember,
    deleteMember
} = require("../services/members.service");

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

router.get("/", asyncHandler(async (req, res) => {
    const qp = qpSchema.parse(req.query);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await listMembers(qp, baseUrl);
    sendOk(res, result);
}));

router.get("/:slug", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await getMemberBySlug(req.params.slug, baseUrl);
    sendOk(res, result);
}));

router.put("/:slug", requireAuth, requireAdminOrModerator, asyncHandler(async (req, res) => {
    const roles = (req.user.roles || []).map((r) => r.role);
    const isAdmin = roles.includes("ADMIN");

    const member = await prisma.member.findUnique({
        where: { slug: req.params.slug },
    });

    if (!member) {
        throw new NotFoundError("Not found");
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const isAdminMember = usersForMember.some((u) =>
        (u.roles || []).some((r) => r.role === "ADMIN"),
    );

    if (isAdminMember) {
        throw new ForbiddenError("Cannot edit admin member from this page");
    }

    const parsed = memberProfileUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) {
        throw new BadRequestError("Invalid input", parsed.error.flatten());
    }

    const bodyHasAccessRole = Object.prototype.hasOwnProperty.call(req.body || {}, "accessRole");

    if (bodyHasAccessRole && !isAdmin) {
        throw new ForbiddenError("Only admins can change member access role");
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await updateMember(req.params.slug, parsed.data, req.user, baseUrl);
    sendOk(res, { ok: true, ...result });
}));

router.delete("/:slug", requireAuth, requireAdminOrModerator, asyncHandler(async (req, res) => {
    const member = await prisma.member.findUnique({
        where: { slug: req.params.slug },
    });

    if (!member) {
        throw new NotFoundError("Not found");
    }

    const usersForMember = await prisma.user.findMany({
        where: { memberId: member.id },
        include: { roles: true },
    });

    const isAdminMemberDelete = usersForMember.some((u) =>
        (u.roles || []).some((r) => r.role === "ADMIN"),
    );

    if (isAdminMemberDelete) {
        throw new ForbiddenError("Cannot delete admin member");
    }

    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) {
        throw new BadRequestError("Invalid input", parsed.error.flatten());
    }

    const result = await deleteMember(req.params.slug, parsed.data.confirmSlug, req.user);
    sendOk(res, result);
}));

// --- CV Upload (Service-backed) ---

router.post(
    "/:slug/cv",
    requireAuth,
    requireAdminOrModerator,
    asyncHandler(async (req, res, next) => {
        const member = await prisma.member.findUnique({
            where: { slug: req.params.slug },
        });
        if (!member) {
            throw new NotFoundError("Member not found");
        }
        req._member = member;
        next();
    }),
    cvUploadMiddleware.single("cv"),
    asyncHandler(async (req, res) => {
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
            throw new ForbiddenError("Cannot modify admin member from this page");
        }

        if (!usersForMember.length) {
            try { if(req.file?.path) fs.unlinkSync(req.file.path); } catch {}
            throw new BadRequestError("No user account linked to this member");
        }

        try {
            // Use first user ID for the CV naming if multiple exist
            const userId = usersForMember[0].id;
            const result = await processCvUpload({ userId, memberId: member.id, file: req.file });
            sendCreated(res, { ok: true, url: abs(result.url, req) });
        } catch (e) {
            throw new BadRequestError(e.message || "CV upload failed");
        }
    }),
);

// --- Avatar Upload (Service-backed) ---

router.post(
    "/:slug/avatar",
    requireAuth,
    requireAdminOrModerator,
    asyncHandler(async (req, res, next) => {
        const member = await prisma.member.findUnique({
            where: { slug: req.params.slug },
        });
        if (!member) throw new NotFoundError("Member not found");
        req._member = member;
        next();
    }),
    avatarUploadMiddleware.single("avatar"),
    asyncHandler(async (req, res) => {
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
            throw new ForbiddenError("Cannot modify admin member from this page");
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
            throw new BadRequestError(e.message || "Avatar upload failed");
        }
    }),
);

module.exports = router;