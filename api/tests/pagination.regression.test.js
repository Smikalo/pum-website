// api/tests/pagination.regression.test.js
const request = require('supertest');
const app = require('../src/app');

describe('Pagination Regression', () => {
    const endpoints = [
        '/api/members',
        '/api/projects',
        '/api/events',
        '/api/blogs'
    ];

    test.each(endpoints)('GET %s returns default pagination', async (path) => {
        const res = await request(app).get(path);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('page');
        expect(res.body).toHaveProperty('size');
        expect(res.body).toHaveProperty('total');
        expect(res.body.page).toBeGreaterThanOrEqual(1);
    });

    test.each(endpoints)('GET %s?size=1 caps size correctly', async (path) => {
        const res = await request(app).get(`${path}?size=1`);
        expect(res.status).toBe(200);
        expect(res.body.items.length).toBeLessThanOrEqual(1);
    });
});