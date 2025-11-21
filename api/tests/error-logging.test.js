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

    test("logs unhandled errors (e.g. 400)", async () => {
        // Trigger a BadRequestError (400) which IS logged.
        // (404s are skipped in app.js logging logic)
        // Sending invalid JSON or bad input to a POST route is a reliable way.

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'not-an-email', password: 'short' }); // Invalid email format -> BadRequest

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);

        expect(loggerSpy).toHaveBeenCalled();
        const calls = loggerSpy.mock.calls;
        const errLog = calls.find(args => args[0] === 'Unhandled error');

        expect(errLog).toBeDefined();
        expect(errLog[1]).toMatchObject({
            statusCode: 400,
            path: '/api/auth/login',
            method: 'POST'
        });
    });
});