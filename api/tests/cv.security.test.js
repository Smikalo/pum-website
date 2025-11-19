// api/tests/cv.security.test.js
const assert = require("assert");
const http = require("http");
const app = require("../src/app"); // relative to tests dir

async function getAuthToken(baseUrl, email, password) {
    // 1. Get CSRF token
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    if (!csrfRes.ok) throw new Error("Failed to get CSRF");

    const cookie = csrfRes.headers.get("set-cookie");
    const match = cookie && cookie.match(/XSRF-TOKEN=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : "";

    // 2. Login
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-csrf-token": token,
            "cookie": cookie
        },
        body: JSON.stringify({ email, password })
    });

    if (!res.ok) return null;
    const body = await res.json();
    return body.accessToken;
}

async function uploadCv(baseUrl, authToken, endpoint, fileContent, filename = "test.pdf", mimeType = "application/pdf") {
    const fd = new FormData();
    const blob = new Blob([fileContent], { type: mimeType });
    fd.append("cv", blob, filename);

    const headers = {};
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: headers,
        body: fd
    });
    return res;
}

async function runSecurityTests() {
    console.log("Running cv.security.test.js");
    const PORT = 3999;
    const BASE = `http://localhost:${PORT}`;

    const server = http.createServer(app);

    await new Promise(resolve => server.listen(PORT, resolve));

    try {
        // 1. Anon Access (Account route)
        {
            const res = await uploadCv(BASE, null, "/api/account/cv", "%PDF-1.4...", "test.pdf");
            assert.strictEqual(res.status, 401, `Anon account CV upload: Expected 401, got ${res.status}`);
            console.log("✅ Anon upload to /api/account/cv rejected (401)");
        }

        // 2. Anon Access (Member Admin route)
        {
            const res = await uploadCv(BASE, null, "/api/members/mem1/cv", "%PDF-1.4...", "test.pdf");
            assert.strictEqual(res.status, 401, `Anon admin CV upload: Expected 401, got ${res.status}`);
            console.log("✅ Anon upload to /api/members/:slug/cv rejected (401)");
        }

        // 3. Login as Member
        // Note: Assuming seed data exists. If it doesn't, this will skip gracefully.
        const memToken = await getAuthToken(BASE, "mem1@pum.local", "ChangeMe!123");

        if (memToken) {
            // 4. Member upload to own account (valid PDF)
            {
                const res = await uploadCv(BASE, memToken, "/api/account/cv", "%PDF-1.4 valid pdf content", "mycv.pdf");
                assert.strictEqual(res.status, 201, `Member valid CV upload: Expected 201, got ${res.status}`);
                console.log("✅ Member upload to own account succeeded (201)");
            }

            // 5. Member upload invalid type
            {
                const res = await uploadCv(BASE, memToken, "/api/account/cv", "not a pdf", "bad.txt", "text/plain");
                // Middleware rejects it with 400 (Invalid input: Only PDF allowed)
                assert.strictEqual(res.status, 400, `Member invalid file type: Expected 400, got ${res.status}`);
                console.log("✅ Member invalid file type rejected (400)");
            }

            // 6. Member accessing Admin route (mem2)
            {
                const res = await uploadCv(BASE, memToken, "/api/members/mem2/cv", "%PDF-1.4...", "hack.pdf");
                // Should be 403 Forbidden
                assert.strictEqual(res.status, 403, `Member accessing admin route: Expected 403, got ${res.status}`);
                console.log("✅ Member accessing other member's CV route rejected (403)");
            }
        } else {
            console.warn("⚠️ Skipping authenticated member tests (login failed or seed data missing)");
        }

        // 7. Login as Admin
        const adminToken = await getAuthToken(BASE, "admin@pum.local", "ChangeMe!123");

        if (adminToken) {
            // 8. Admin upload to Member profile (mem1)
            {
                const res = await uploadCv(BASE, adminToken, "/api/members/mem1/cv", "%PDF-1.4 admin override", "admin.pdf");
                assert.strictEqual(res.status, 201, `Admin override upload: Expected 201, got ${res.status}`);
                console.log("✅ Admin upload to member profile succeeded (201)");
            }
        } else {
            console.warn("⚠️ Skipping authenticated admin tests (login failed or seed data missing)");
        }

    } finally {
        server.close();
    }
}

runSecurityTests().catch(e => {
    console.error("❌ Security Test failed:", e);
    process.exit(1);
});