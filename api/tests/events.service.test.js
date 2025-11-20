// api/tests/events.service.test.js
const { NotFoundError, ForbiddenError } = require("../src/errors");

const mockPrisma = {
    event: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    memberEvent: { upsert: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(mockPrisma))
};

jest.doMock("../src/db", () => ({ prisma: mockPrisma }));

const { listEvents, getEventBySlug, createEvent } = require("../src/services/events.service");

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

    test("createEvent succeeds with role", async () => {
        mockPrisma.event.findUnique.mockResolvedValue(null); // for slug check
        mockPrisma.event.create.mockResolvedValue({ id: "e1", slug: "new-event", name: "New Event" });

        const res = await createEvent(
            { name: "New Event" },
            { roles: [{ role: "MEMBER" }], member: { id: "m1" } }
        );
        expect(res.slug).toBe("new-event");
    });
});