// api/tests/projects.service.test.js
const { NotFoundError } = require("../src/errors");

const mockPrisma = {
    project: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma))
};

// Use doMock to avoid hoisting issues with the mockPrisma variable
jest.doMock("../src/db", () => ({ prisma: mockPrisma }));

// Import service AFTER mocking
const { listProjects, getProjectBySlug, createProject } = require("../src/services/projects.service");

describe("projects.service", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("listProjects returns paged data", async () => {
        mockPrisma.project.count.mockResolvedValue(1);
        mockPrisma.project.findMany.mockResolvedValue([
            { id: "p1", slug: "p1", title: "Project 1", techs: [], tags: [], members: [] }
        ]);

        const res = await listProjects({}, "http://test.local");
        expect(res.total).toBe(1);
        expect(res.items).toHaveLength(1);
        expect(res.items[0].slug).toBe("p1");
    });

    test("getProjectBySlug throws NotFoundError if missing", async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null);
        await expect(getProjectBySlug("missing", "http://test.local")).rejects.toThrow(NotFoundError);
    });

    test("createProject creates project", async () => {
        mockPrisma.project.findUnique.mockResolvedValue(null); // for uniqueProjectSlug check
        mockPrisma.project.create.mockResolvedValue({ id: "p1", slug: "new-project", title: "New Project" });

        const res = await createProject({ title: "New Project" }, { id: "u1", member: { id: "m1" } });
        expect(res.slug).toBe("new-project");
        expect(mockPrisma.project.create).toHaveBeenCalled();
    });
});