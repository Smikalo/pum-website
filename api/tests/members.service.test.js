// api/tests/members.service.test.js
const { NotFoundError } = require("../src/errors");

const mockLogger = { info: jest.fn() };
jest.doMock("../src/logger", () => mockLogger);

const mockPrisma = {
    member: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma))
};

jest.doMock("../src/db", () => ({ prisma: mockPrisma }));

const { listMembers, getMemberBySlug } = require("../src/services/members.service");

describe("members.service", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("listMembers returns paged data", async () => {
        mockPrisma.member.count.mockResolvedValue(1);
        mockPrisma.member.findMany.mockResolvedValue([
            { id: "m1", slug: "m1", name: "Member 1", skills: [], techs: [] }
        ]);

        const res = await listMembers({}, "http://test.local");
        expect(res.total).toBe(1);
        expect(res.items[0].slug).toBe("m1");
    });

    test("getMemberBySlug throws if missing", async () => {
        mockPrisma.member.findUnique.mockResolvedValue(null);
        await expect(getMemberBySlug("missing", "http://test.local")).rejects.toThrow(NotFoundError);
    });
});