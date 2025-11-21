const request = require('supertest');
const app = require('../src/app');

describe('HTTP Helpers Smoke', () => {
    test('GET /api/members structure', async () => {
        const res = await request(app).get('/api/members?size=1');
        expect(res.status).toBe(200);
        expect(res.body.items).toBeInstanceOf(Array);
    });
});