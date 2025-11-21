const request = require('supertest');
const app = require('../src/app');

describe('Blog Routes', () => {
    test('GET /api/blogs list', async () => {
        const res = await request(app).get('/api/blogs?size=1');
        expect(res.status).toBe(200);
        expect(res.body.items).toBeInstanceOf(Array);
    });
    test('GET /api/blogs/unknown 404', async () => {
        const res = await request(app).get('/api/blogs/__unknown__');
        expect(res.status).toBe(404);
    });
});