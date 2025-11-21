const request = require('supertest');
const app = require('../src/app');

describe('Uploads Routes Smoke', () => {
    test('POST /api/uploads/event-photo 401 without auth', async () => {
        const res = await request(app).post('/api/uploads/event-photo');
        expect(res.status).toBe(401);
    });
    test('POST /api/uploads/project-photo 401 without auth', async () => {
        const res = await request(app).post('/api/uploads/project-photo');
        expect(res.status).toBe(401);
    });
});