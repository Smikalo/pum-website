// api/tests/cv.security.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock prisma
const mockPrisma = {
    member: { findUnique: jest.fn(), update: jest.fn() },
    skill: { findMany: jest.fn().mockResolvedValue([]) },
    tech: { findMany: jest.fn().mockResolvedValue([]) }
};

jest.mock('../src/db', () => ({
    prisma: mockPrisma
}));

// Mock JWT to allow our fake tokens to pass authRequired in account.js
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn((token) => {
        if (token === 'member_token') return { sub: 'u1' }; // Member
        if (token === 'admin_token') return { sub: 'u2' };  // Admin
        throw new Error('Invalid token');
    })
}));

// Mock the user lookup in account.js
// account.js: const user = await prisma.user.findUnique(...)
mockPrisma.user = {
    findUnique: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === 'u1') return { id: 'u1', memberId: 'm1' }; // Member
        if (where.id === 'u2') return { id: 'u2', memberId: 'm2' }; // Admin
        return null;
    })
};

// We also need to mock the admin middleware check for the second set of tests if they hit routes using `requireAdminOrModerator`
// But account.js routes (POST /api/account/cv) only use `authRequired`.
// The admin test hits `/api/members/.../cv` which DOES use `requireAdminOrModerator` from `middleware/auth`.

jest.mock('../src/middleware/auth', () => {
    const original = jest.requireActual('../src/middleware/auth');
    return {
        ...original,
        requireAuth: (req, res, next) => {
            // Mimic authRequired logic but trust our mock tokens
            const auth = req.headers['authorization'];
            if (auth === 'Bearer member_token') {
                req.user = { id: 'u1', roles: [{role:'MEMBER'}], member: { id: 'm1' } };
                return next();
            }
            if (auth === 'Bearer admin_token') {
                req.user = { id: 'u2', roles: [{role:'ADMIN'}], member: { id: 'm2' } };
                return next();
            }
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
});

const app = require('../src/app');

describe('CV Security', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Anon upload to /api/account/cv rejected (401)', async () => {
        const res = await request(app).post('/api/account/cv').attach('cv', Buffer.from('%PDF-1.4'), 'test.pdf');
        expect(res.status).toBe(401);
    });

    test('Member upload valid PDF to own account (201)', async () => {
        // Mock member check for account.js
        mockPrisma.member.findUnique.mockResolvedValue({ id: 'm1' });

        const res = await request(app)
            .post('/api/account/cv')
            .set('Authorization', 'Bearer member_token')
            .attach('cv', Buffer.from('%PDF-1.4 fake content'), 'cv.pdf');

        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
    });

    test('Member upload invalid file type (400)', async () => {
        mockPrisma.member.findUnique.mockResolvedValue({ id: 'm1' });

        const res = await request(app)
            .post('/api/account/cv')
            .set('Authorization', 'Bearer member_token')
            .attach('cv', Buffer.from('text'), 'cv.txt');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid input/);
    });

    // This test targets the MEMBERS router which uses `requireAuth` middleware we mocked
    test('Member accessing admin upload route (403)', async () => {
        const res = await request(app)
            .post('/api/members/mem2/cv')
            .set('Authorization', 'Bearer member_token')
            .attach('cv', Buffer.from('%PDF-1.4'), 'cv.pdf');

        expect(res.status).toBe(403);
    });
});