const express = require("express");
const z = require("zod");
const {
    sendOk,
    sendCreated,
    asyncHandler
} = require("../utils/http");
const {
    requireAuth,
    requireAdminOrModeratorOrCreator,
} = require("../middleware/auth");
const {
    NotFoundError,
    BadRequestError
} = require("../errors");
const {
    listEvents,
    getEventBySlug,
    createEvent,
    updateEvent,
    deleteEvent
} = require("../services/events.service");
const { MAIL_FROM } = require("../utils/shared");
const { prisma } = require("../db");

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

router.get("/", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await listEvents(req.query, baseUrl);
    sendOk(res, result);
}));

router.get("/:slug", asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const result = await getEventBySlug(req.params.slug, baseUrl);
    sendOk(res, result);
}));

router.post("/", requireAuth, asyncHandler(async (req, res) => {
    const user = req.user;
    const parsed = eventCreateSchema.safeParse({
        ...req.body,
        lat: typeof req.body?.lat === "string" ? Number(req.body.lat) : req.body?.lat,
        lng: typeof req.body?.lng === "string" ? Number(req.body.lng) : req.body?.lng,
    });
    if (!parsed.success) {
        throw new BadRequestError("Invalid input", parsed.error.flatten());
    }

    const result = await createEvent(parsed.data, user);
    sendCreated(res, result);
}));

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
}), asyncHandler(async (req, res) => {
    const user = req.user;
    const parsed = eventCreateSchema.safeParse({
        ...req.body,
        lat: typeof req.body?.lat === "string" ? Number(req.body.lat) : req.body?.lat,
        lng: typeof req.body?.lng === "string" ? Number(req.body.lng) : req.body?.lng,
    });
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const result = await updateEvent(req.params.slug, parsed.data, user, req.event);
    sendOk(res, result);
}));

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
}), asyncHandler(async (req, res) => {
    const parsed = deleteBySlugSchema.safeParse(req.body || {});
    if (!parsed.success) throw new BadRequestError("Invalid input", parsed.error.flatten());

    const result = await deleteEvent(req.params.slug, parsed.data.confirmSlug, req.user);
    sendOk(res, result);
}));

module.exports = router;
