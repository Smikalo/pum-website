// api/tests/config-security.test.js
// Tests for config.js around secret validation and production safety.

describe("Config security & secret validation", () => {
    const ORIGINAL_ENV = { ...process.env };

    const restoreEnv = () => {
        ["NODE_ENV", "JWT_ACCESS_SECRET", "DATABASE_URL"].forEach((key) => {
            if (ORIGINAL_ENV[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = ORIGINAL_ENV[key];
            }
        });
    };

    beforeEach(() => {
        restoreEnv();
        jest.resetModules(); // clear require cache
    });

    afterEach(() => {
        restoreEnv();
        jest.resetModules();
    });

    test("throws if JWT_ACCESS_SECRET is missing in production", () => {
        process.env.NODE_ENV = "production";
        process.env.DATABASE_URL =
            process.env.DATABASE_URL ||
            "postgres://user:pass@localhost:5432/db";
        delete process.env.JWT_ACCESS_SECRET;

        expect(() => {
            require("../src/config");
        }).toThrow(/Missing JWT_ACCESS_SECRET/i);
    });

    test("throws if DATABASE_URL is missing in production", () => {
        process.env.NODE_ENV = "production";
        process.env.JWT_ACCESS_SECRET = "test-secret";
        delete process.env.DATABASE_URL;

        expect(() => {
            require("../src/config");
        }).toThrow(/Missing DATABASE_URL/i);
    });

    test("loads successfully in production when required secrets are present", () => {
        process.env.NODE_ENV = "production";
        process.env.JWT_ACCESS_SECRET = "test-secret";
        process.env.DATABASE_URL =
            process.env.DATABASE_URL ||
            "postgres://user:pass@localhost:5432/db";

        let config;
        expect(() => {
            config = require("../src/config");
        }).not.toThrow();

        expect(config).toBeDefined();
        expect(config.JWT_ACCESS_SECRET).toBe("test-secret");
        expect(config.DATABASE_URL).toBe(process.env.DATABASE_URL);
        expect(config.NODE_ENV).toBe("production");
    });
});
