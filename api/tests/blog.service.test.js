// api/tests/blog.service.test.js
const { NotFoundError } = require("../src/errors");

const mockPrisma = {
    blog: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    // Added mocks for related models accessed during create/update
    member: {
        findMany: jest.fn()
    },
    blogAuthor: {
        upsert: jest.fn(),
        deleteMany: jest.fn()
    },
    project: {
        findMany: jest.fn()
    },
    projectBlog: {
        createMany: jest.fn(),
        deleteMany: jest.fn()
    },
    event: {
        findMany: jest.fn()
    },
    eventBlog: {
        createMany: jest.fn(),
        deleteMany: jest.fn()
    },
    blogTech: {
        createMany: jest.fn(),
        deleteMany: jest.fn()
    },
    blogTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn()
    },
    newsletterSubscriber: {
        findMany: jest.fn()
    },
    $transaction: jest.fn(async (cb) => cb(mockPrisma))
};

// Use doMock to ensure mockPrisma is defined before this runs
jest.doMock("../src/db", () => ({ prisma: mockPrisma }));

const { listBlogs, getBlogBySlug, createBlog } = require("../src/services/blog.service");

describe("blog.service", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("listBlogs returns paged data", async () => {
        mockPrisma.blog.count.mockResolvedValue(1);
        mockPrisma.blog.findMany.mockResolvedValue([
            { id: "b1", slug: "b1", title: "Blog 1", techs: [], tags: [], authors: [], projects: [], events: [] }
        ]);

        const res = await listBlogs({}, "http://test.local");
        expect(res.total).toBe(1);
        expect(res.items[0].slug).toBe("b1");
    });

    test("getBlogBySlug throws if missing", async () => {
        mockPrisma.blog.findUnique.mockResolvedValue(null);
        await expect(getBlogBySlug("missing", "http://test.local")).rejects.toThrow(NotFoundError);
    });

    test("createBlog creates blog", async () => {
        mockPrisma.blog.findUnique.mockResolvedValue(null); // uniqueBlogSlug check
        mockPrisma.blog.create.mockResolvedValue({ id: "b1", slug: "new-blog", title: "New Blog" });

        // Mock finding members for authors logic (triggered by user.member.slug)
        mockPrisma.member.findMany.mockResolvedValue([{ id: "m1", slug: "m1" }]);
        mockPrisma.blogAuthor.upsert.mockResolvedValue({});

        const res = await createBlog({ title: "New Blog" }, { id: "u1", member: { id: "m1", slug: "m1" } });
        expect(res.slug).toBe("new-blog");
        expect(mockPrisma.blog.create).toHaveBeenCalled();
        // Expect member.findMany to be called because an author slug was added from the user context
        expect(mockPrisma.member.findMany).toHaveBeenCalled();
    });
});