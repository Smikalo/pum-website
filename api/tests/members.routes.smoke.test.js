const request = require('supertest');
const app = require('../src/app');

describe('Members Routes', () => {
    test('GET /api/members list', async () => {
        const res = await request(app).get('/api/members?size=1');
        expect(res.status).toBe(200);
        expect(res.body.items).toBeInstanceOf(Array);
    });
    test('GET /api/members/unknown 404', async () => {
        const res = await request(app).get('/api/members/__unknown__');
        expect(res.status).toBe(404);
    });
});