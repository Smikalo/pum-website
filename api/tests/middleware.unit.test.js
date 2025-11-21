// api/tests/middleware.unit.test.js
const { requireAuth, requireAdminOrModerator, requireAdminOrModeratorOrCreator } = require("../src/middleware/auth");

// Mock request/response
const mockReq = (overrides = {}) => ({
    get: jest.fn(),
    ...overrides
});
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};
const mockNext = jest.fn();

// Mock JWT config and verify
jest.mock("jsonwebtoken", () => ({
    verify: jest.fn()
}));
const jwt = require("jsonwebtoken");

// Mock Prisma for user lookup
jest.mock("../src/db", () => ({
    prisma: {
        user: { findUnique: jest.fn() }
    }
}));
const { prisma } = require("../src/db");

describe('Auth Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('requireAuth: 401 if no header', async () => {
        const req = mockReq({ get: () => null });
        const res = mockRes();
        await requireAuth(req, res, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    test('requireAuth: calls next if valid', async () => {
        jwt.verify.mockReturnValue({ sub: 'u1' });
        prisma.user.findUnique.mockResolvedValue({ id: 'u1', roles: [] });

        const req = mockReq({ get: () => 'Bearer valid' });
        const res = mockRes();
        await requireAuth(req, res, mockNext);

        expect(req.user).toBeDefined();
        expect(mockNext).toHaveBeenCalledWith();
    });

    test('requireAdminOrModerator: calls next if admin', () => {
        const req = { user: { roles: [{ role: 'ADMIN' }] } };
        requireAdminOrModerator(req, {}, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    test('requireAdminOrModerator: 403 if member', () => {
        const req = { user: { roles: [{ role: 'MEMBER' }] } };
        requireAdminOrModerator(req, {}, mockNext);
        expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
});