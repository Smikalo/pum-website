// api/tests/events.service.test.js
const { NotFoundError, ForbiddenError } = require("../src/errors");

const mockLogger = { info: jest.fn() };
jest.doMock("../src/logger", () => mockLogger);

const mockPrisma = {
    event: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    memberEvent: { upsert: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), update: jest.fn() },
    eventProject: { createMany: jest.fn(), deleteMany: jest.fn() },
    eventBlog: { createMany: jest.fn(), deleteMany: jest.fn() },
    eventInvite: { create: jest.fn(), deleteMany: jest.fn() },
    project: { findMany: jest.fn() },
    blog: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(mockPrisma))
};

jest.doMock("../src/db", () => ({ prisma: mockPrisma }));

const { listEvents, getEventBySlug, createEvent, updateEvent } = require("../src/services/events.service");

describe("events.service", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("listEvents returns paged data", async () => {
        mockPrisma.event.count.mockResolvedValue(1);
        mockPrisma.event.findMany.mockResolvedValue([
            { id: "e1", slug: "e1", name: "Event 1", relatedProjects: [], attendees: [], invites: [], blogs: [] }
        ]);

        const res = await listEvents({}, "http://test.local");
        expect(res.total).toBe(1);
        expect(res.items[0].slug).toBe("e1");
    });

    test("getEventBySlug throws if missing", async () => {
        mockPrisma.event.findUnique.mockResolvedValue(null);
        await expect(getEventBySlug("missing", "http://test.local")).rejects.toThrow(NotFoundError);
    });

    test("createEvent throws Forbidden if no member role", async () => {
        await expect(createEvent({ name: "New Event" }, { roles: [] })).rejects.toThrow(ForbiddenError);
    });

    test("createEvent succeeds with role and logs", async () => {
        mockPrisma.event.findUnique.mockResolvedValue(null); // for slug check
        mockPrisma.event.create.mockResolvedValue({ id: "e1", slug: "new-event", name: "New Event" });

        const res = await createEvent(
            { name: "New Event" },
            { id: "u1", roles: [{ role: "MEMBER" }], member: { id: "m1" } }
        );
        expect(res.slug).toBe("new-event");
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith("Event created", expect.objectContaining({
            userId: "u1",
            eventSlug: "new-event"
        }));
    });

    test("updateEvent wraps updates in transaction", async () => {
        const existing = { id: "e1", slug: "ev-1", name: "Old", attendees: [], invites: [] };
        mockPrisma.event.update.mockResolvedValue({ id: "e1", slug: "ev-1" });

        await updateEvent("ev-1", { name: "New Name" }, { id: "u1", member: { id: "m1" } }, existing);

        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.memberEvent.deleteMany).toHaveBeenCalled(); // cleanup step
        expect(mockPrisma.event.update).toHaveBeenCalled();
    });
});