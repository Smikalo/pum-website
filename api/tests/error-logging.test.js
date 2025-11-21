// api/tests/error-logging.test.js
const request = require('supertest');
const logger = require('../src/logger');
const app = require('../src/app');

describe("Error Logging", () => {
    let loggerSpy;

    beforeAll(() => {
        // Spy on logger.error
        loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        loggerSpy.mockRestore();
    });

    test("logs unhandled errors (e.g. 400 on contact route)", async () => {
        // POST /api/contact is public and validates input.
        // Sending empty body triggers Zod validation error -> BadRequestError (400).
        // This avoids Auth/CSRF hurdles.

        const res = await request(app)
            .post('/api/contact')
            .send({}); // Empty body -> validation fail

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Invalid input/);

        expect(loggerSpy).toHaveBeenCalled();
        const calls = loggerSpy.mock.calls;
        const errLog = calls.find(args => args[0] === 'Unhandled error');

        expect(errLog).toBeDefined();
        expect(errLog[1]).toMatchObject({
            statusCode: 400,
            path: '/api/contact',
            method: 'POST'
        });
    });
});