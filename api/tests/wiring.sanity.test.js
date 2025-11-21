// api/tests/wiring.sanity.test.js
const request = require('supertest');
const app = require('../src/app');

describe('App Wiring', () => {
    test('GET /healthz returns 200', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('404 handler works', async () => {
        const res = await request(app).get('/api/not-a-real-route-123');
        expect(res.status).toBe(404);
        // Ensure error property exists before matching
        if (res.body && res.body.error) {
            expect(res.body.error).toMatch(/Not found/i);
        } else {
            // Fallback: check structure
            expect(res.body).toEqual(expect.objectContaining({ ok: false }));
        }
    });
});