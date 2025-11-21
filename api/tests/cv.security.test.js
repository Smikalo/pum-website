// api/tests/cv.security.test.js
const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/db');

// Mock Auth middleware to simulate users without needing a DB
jest.mock('../src/middleware/auth', () => {
    const original = jest.requireActual('../src/middleware/auth');
    return {
        ...original,
        requireAuth: (req, res, next) => {
            const auth = req.headers['authorization'];
            if (!auth) return res.status(401).json({ error: 'Missing access token' });
            if (auth === 'Bearer member_token') {
                req.user = { id: 'u1', roles: [{role:'MEMBER'}], member: { id: 'm1' } };
                return next();
            }
            if (auth === 'Bearer admin_token') {
                req.user = { id: 'u2', roles: [{role:'ADMIN'}], member: { id: 'm2' } };
                return next();
            }
            return res.status(401).json({ error: 'Invalid' });
        }
    };
});

// Mock prisma
jest.mock('../src/db', () => ({
    prisma: {
        member: { findUnique: jest.fn(), update: jest.fn() },
        skill: { findMany: jest.fn().mockResolvedValue([]) },
        tech: { findMany: jest.fn().mockResolvedValue([]) }
    }
}));

describe('CV Security', () => {
    test('Anon upload to /api/account/cv rejected (401)', async () => {
        const res = await request(app).post('/api/account/cv').attach('cv', Buffer.from('%PDF-1.4'), 'test.pdf');
        expect(res.status).toBe(401);
    });

    test('Anon upload to admin route rejected (401)', async () => {
        const res = await request(app).post('/api/members/mem1/cv').attach('cv', Buffer.from('%PDF-1.4'), 'test.pdf');
        expect(res.status).toBe(401);
    });

    test('Member upload valid PDF to own account (201)', async () => {
        // Mock member check
        prisma.member.findUnique.mockResolvedValue({ id: 'm1' });

        const res = await request(app)
            .post('/api/account/cv')
            .set('Authorization', 'Bearer member_token')
            .attach('cv', Buffer.from('%PDF-1.4 fake content'), 'cv.pdf');

        expect(res.status).toBe(201);
        expect(res.body.ok).toBe(true);
    });

    test('Member upload invalid file type (400)', async () => {
        const res = await request(app)
            .post('/api/account/cv')
            .set('Authorization', 'Bearer member_token')
            .attach('cv', Buffer.from('text'), 'cv.txt');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid input/);
    });

    test('Member accessing admin upload route (403)', async () => {
        // Member trying to update another user
        const res = await request(app)
            .post('/api/members/other/cv')
            .set('Authorization', 'Bearer member_token')
            .attach('cv', Buffer.from('%PDF-1.4'), 'cv.pdf');

        // requireAdminOrModerator middleware stops this
        expect(res.status).toBe(403);
    });
});