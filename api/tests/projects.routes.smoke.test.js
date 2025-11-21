const request = require('supertest');
const app = require('../src/app');

describe('Projects Routes', () => {
    test('GET /api/projects list', async () => {
        const res = await request(app).get('/api/projects?size=1');
        expect(res.status).toBe(200);
        expect(res.body.items).toBeInstanceOf(Array);
    });
    test('GET /api/projects/unknown 404', async () => {
        const res = await request(app).get('/api/projects/__unknown__');
        expect(res.status).toBe(404);
    });
});