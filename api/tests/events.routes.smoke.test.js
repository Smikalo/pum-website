const request = require('supertest');
const app = require('../src/app');

describe('Events Routes', () => {
    test('GET /api/events list', async () => {
        const res = await request(app).get('/api/events?size=1');
        expect(res.status).toBe(200);
        expect(res.body.items).toBeInstanceOf(Array);
    });
    test('GET /api/events/unknown 404', async () => {
        const res = await request(app).get('/api/events/__unknown__');
        expect(res.status).toBe(404);
    });
});