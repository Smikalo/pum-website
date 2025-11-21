const request = require('supertest');
const app = require('../src/app');

describe('Marketing Routes', () => {
    test('POST /api/contact 400 on empty', async () => {
        const res = await request(app).post('/api/contact').send({});
        expect(res.status).toBe(400);
    });
});