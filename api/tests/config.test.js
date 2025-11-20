const path = require("path");

// Helper to clear the config module from cache so it re-reads process.env
function resetConfig() {
    delete require.cache[require.resolve("../src/config")];
}

describe("Config module", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test("Reads PORT from env", () => {
        process.env.PORT = "4000";
        resetConfig();
        const config = require("../src/config");
        expect(config.PORT).toBe(4000);
    });

    test("Defaults PORT to 3001", () => {
        delete process.env.PORT;
        resetConfig();
        const config = require("../src/config");
        expect(config.PORT).toBe(3001);
    });

    test("Reads DATABASE_URL from env", () => {
        process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
        resetConfig();
        const config = require("../src/config");
        expect(config.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/db");
    });

    test("Defaults JWT_ACCESS_SECRET", () => {
        delete process.env.JWT_ACCESS_SECRET;
        resetConfig();
        const config = require("../src/config");
        expect(config.JWT_ACCESS_SECRET).toBe("dev-only-change-me");
    });

    test("Reads JWT_ACCESS_SECRET from env", () => {
        process.env.JWT_ACCESS_SECRET = "super-secret";
        resetConfig();
        const config = require("../src/config");
        expect(config.JWT_ACCESS_SECRET).toBe("super-secret");
    });

    test("Defaults NODE_ENV to development", () => {
        delete process.env.NODE_ENV;
        resetConfig();
        const config = require("../src/config");
        expect(config.NODE_ENV).toBe("development");
    });

    test("Reads SMTP config", () => {
        process.env.SMTP_HOST = "smtp.example.com";
        process.env.SMTP_PORT = "25";
        resetConfig();
        const config = require("../src/config");
        expect(config.SMTP_HOST).toBe("smtp.example.com");
        expect(config.SMTP_PORT).toBe(25);
    });
});