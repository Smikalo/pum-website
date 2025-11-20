const request = require('supertest');
const app = require('../src/app');

describe('API Smoke Tests', () => {
    test('GET /api/projects?size=10 returns expected shape', async () => {
        const res = await request(app).get('/api/projects?size=10');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('items');
        expect(Array.isArray(res.body.items)).toBe(true);
        if ('total' in res.body) {
            expect(typeof res.body.total).toBe('number');
        }
    });

    test('GET /api/events?size=10 returns expected shape', async () => {
        const res = await request(app).get('/api/events?size=10');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('items');
        expect(Array.isArray(res.body.items)).toBe(true);
    });

    test('GET /api/members?size=10 returns expected shape', async () => {
        const res = await request(app).get('/api/members?size=10');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('items');
        expect(Array.isArray(res.body.items)).toBe(true);
    });

    test('GET /api/blogs?size=10 returns expected shape', async () => {
        const res = await request(app).get('/api/blogs?size=10');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('items');
        expect(Array.isArray(res.body.items)).toBe(true);
    });

});