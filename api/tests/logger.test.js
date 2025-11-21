// api/tests/logger.test.js
const logger = require('../src/logger');

describe("Logger", () => {
    let consoleSpy;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    test("exports info, warn, error, debug", () => {
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.debug).toBe('function');
    });

    test("info logs structured JSON", () => {
        logger.info("Test message", { userId: 123 });
        expect(consoleSpy).toHaveBeenCalled();
        const arg = consoleSpy.mock.calls[0][0];
        const json = JSON.parse(arg);
        expect(json.level).toBe('info');
        expect(json.msg).toBe('Test message');
        expect(json.userId).toBe(123);
        expect(json.service).toBe('api');
    });
});