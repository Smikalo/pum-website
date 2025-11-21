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

    test("logs unhandled errors (e.g. 400)", async () => {
        const agent = request.agent(app);

        // 1. Get CSRF token
        const csrfRes = await agent.get('/api/auth/csrf');
        const cookies = csrfRes.headers['set-cookie'];
        let csrfToken = '';

        if (cookies) {
            const match = cookies.find(c => c.includes('XSRF-TOKEN'));
            if (match) {
                csrfToken = match.split(';')[0].split('=')[1];
            }
        }

        // 2. Send invalid data to trigger 400
        const res = await agent
            .post('/api/auth/login')
            .set('X-CSRF-Token', csrfToken)
            .send({ email: 'not-an-email', password: 'short' });

        // If CSRF passes, Zod validation should fail -> 400
        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Invalid input/);

        // 3. Verify log
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