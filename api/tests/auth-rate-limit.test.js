// api/tests/auth-rate-limit.test.js
// Tests for rate limiting on public auth endpoints (login).
// Uses configured thresholds from config.js and ensures that
// normal usage is unaffected while abusive patterns are blocked.

// Ensure cookies aren't secure so supertest sends them over http
process.env.COOKIE_SECURE = "false";

const request = require("supertest");
const app = require("../src/app");
const config = require("../src/config");

const LOGIN_LIMIT = config.LOGIN_RATE_MAX || 10;

// Helper to extract CSRF token from /api/auth/csrf response
async function getCsrfToken(agent) {
    const csrfRes = await agent.get("/api/auth/csrf");
    const cookies = csrfRes.headers["set-cookie"];

    let token = "dummy";
    if (cookies && Array.isArray(cookies)) {
        const xsrfCookie = cookies.find((c) => c.startsWith("XSRF-TOKEN="));
        if (xsrfCookie) {
            token = xsrfCookie.split(";")[0].split("=")[1];
        }
    }
    return token;
}

describe("Auth rate limiting", () => {
    test("allows typical failed login attempts but rate-limits abusive patterns", async () => {
        // Sanity: LOGIN_LIMIT should be a reasonable positive number
        const limit = LOGIN_LIMIT > 0 ? LOGIN_LIMIT : 10;
        const typicalAttempts = Math.min(limit, 3); // simulate normal user behaviour
        const totalAttempts = limit + 2; // go beyond the configured max to trigger limiter

        const agent = request.agent(app);
        const csrfToken = await getCsrfToken(agent);

        let saw429 = false;

        for (let i = 0; i < totalAttempts; i++) {
            const res = await agent
                .post("/api/auth/login")
                .set("X-CSRF-Token", csrfToken)
                // Password must be >= 8 chars to pass validation schema, then fail auth
                .send({ email: "admin@pum.local", password: "wrongpassword" });

            if (i < typicalAttempts) {
                // For the first few attempts, behaviour should be the same as normal invalid login:
                // 401 Invalid email or password, not 429 rate limit.
                expect(res.status).toBe(401);
                expect(res.body).toHaveProperty("error", "Invalid email or password");
            }

            if (!saw429 && res.status === 429) {
                saw429 = true;
                expect(res.body).toEqual({
                    ok: false,
                    error: "Too many attempts, please try again later.",
                });
            }
        }

        // After enough attempts in a short window, rate limiting must kick in.
        expect(saw429).toBe(true);
    });
});
