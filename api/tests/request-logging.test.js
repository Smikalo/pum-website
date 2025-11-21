// api/tests/request-logging.test.js
const request = require('supertest');
const logger = require('../src/logger');
const app = require('../src/app');

describe("Request Logging", () => {
    let loggerSpy;

    beforeAll(() => {
        loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    });

    afterAll(() => {
        loggerSpy.mockRestore();
    });

    test("logs HTTP requests", async () => {
        const res = await request(app).get('/api/projects?size=1');
        expect(res.status).toBe(200);

        // Wait for finish event to fire
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(loggerSpy).toHaveBeenCalled();
        const calls = loggerSpy.mock.calls;
        const reqLog = calls.find(args => args[0] === 'HTTP request');
        expect(reqLog).toBeDefined();
        expect(reqLog[1]).toMatchObject({
            method: 'GET',
            url: '/api/projects?size=1',
            statusCode: 200
        });
    });
});