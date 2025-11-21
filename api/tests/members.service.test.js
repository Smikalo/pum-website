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
    memberSkill: { deleteMany: jest.fn(), upsert: jest.fn() },
    memberTech: { deleteMany: jest.fn(), upsert: jest.fn() },
    memberProject: { deleteMany: jest.fn() },
    memberEvent: { deleteMany: jest.fn() },
    skill: { upsert: jest.fn() },
    tech: { upsert: jest.fn() },
    user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn()
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma))
};

jest.doMock("../src/db", () => ({ prisma: mockPrisma }));

const { listMembers, getMemberBySlug, updateMember } = require("../src/services/members.service");

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

    test("updateMember uses transaction for skills/techs", async () => {
        // Mock initial find
        mockPrisma.member.findUnique
            .mockResolvedValueOnce({ id: "m1", slug: "mem-1" }) // first call (validation)
            .mockResolvedValueOnce({ // second call (re-fetch after update)
                id: "m1",
                slug: "mem-1",
                name: "New Name",
                skills: [],
                techs: [],
                projects: [],
                events: []
            });

        mockPrisma.skill.upsert.mockResolvedValue({ id: "s1" });
        mockPrisma.tech.upsert.mockResolvedValue({ id: "t1" });

        await updateMember("mem-1", { name: "New Name", skills: ["Js"], techStack: ["React"] }, { id: "u1" }, "http://test.local");

        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.memberSkill.deleteMany).toHaveBeenCalled();
        expect(mockPrisma.memberTech.deleteMany).toHaveBeenCalled();
        expect(mockPrisma.memberSkill.upsert).toHaveBeenCalled();
        expect(mockPrisma.memberTech.upsert).toHaveBeenCalled();
    });
});