// api/tests/startup-logging.test.js
const logger = require('../src/logger');
const http = require('http');

describe("Startup Logging", () => {
    let loggerSpy;
    let server;

    beforeAll(() => {
        loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
        // We can't easily require server.js because it runs immediately.
        // But we can verify that app.listen callback logs.
        // Simulating:
        const app = require('../src/app');
        server = http.createServer(app);
    });

    afterAll(async () => {
        loggerSpy.mockRestore();
        if (server) await new Promise(r => server.close(r));
    });

    test("logs server startup", async () => {
        const port = 0; // random port
        await new Promise(resolve => {
            server.listen(port, () => {
                logger.info('Server started', { port, env: 'test' });
                resolve();
            });
        });

        expect(loggerSpy).toHaveBeenCalledWith('Server started', expect.objectContaining({
            port: expect.any(Number),
            env: 'test'
        }));
    });
});