// api/tests/error-logging.test.js
const request = require('supertest');
const logger = require('../src/logger');
const app = require('../src/app');

describe("Error Logging", () => {
    let loggerSpy;

    beforeAll(() => {
        loggerSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        loggerSpy.mockRestore();
    });

    test("logs unhandled errors", async () => {
        // Use a known 404 route which throws NotFoundError (an AppError)
        // This avoids complexity with middleware stack ordering when trying to inject a new route
        const res = await request(app).get('/api/members/non-existent-member-for-logging-test');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'Not found' });

        expect(loggerSpy).toHaveBeenCalled();
        const calls = loggerSpy.mock.calls;
        const errLog = calls.find(args => args[0] === 'Unhandled error');
        expect(errLog).toBeDefined();
        expect(errLog[1]).toMatchObject({
            message: 'Not found',
            statusCode: 404,
            path: '/api/members/non-existent-member-for-logging-test',
            method: 'GET'
        });
    });
});