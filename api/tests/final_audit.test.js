const request = require('supertest');
const app = require('../src/app');
describe('Final Audit', () => {
    test('Healthz', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
    });
});