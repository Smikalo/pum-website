const { run, get, post, assert } = require("./_lib");

async function login(email, password) {
    const { res: csrfRes } = await get("/api/auth/csrf");
    if (!csrfRes.ok) throw new Error("Failed to get CSRF token");

    const cookieHeader = csrfRes.headers.get("set-cookie");
    if (!cookieHeader) throw new Error("No cookies returned");

    const match = cookieHeader.match(/XSRF-TOKEN=([^;]+)/);
    const xsrfToken = match ? decodeURIComponent(match[1]) : null;
    if (!xsrfToken) throw new Error("XSRF-TOKEN not found");

    const { res, body } = await post("/api/auth/login", { email, password }, {
        headers: {
            "X-CSRF-Token": xsrfToken,
            "Cookie": cookieHeader
        }
    });

    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    return body.accessToken;
}

run("Project Auth Tests", async () => {
    const adminToken = await login("admin@pum.local", "ChangeMe!123");
    const memberToken = await login("mem1@pum.local", "ChangeMe!123");
    const slug = `proj-${Date.now()}`;

    {
        const { res } = await post("/api/projects", { title: "Anon Project" });
        assert(res.status === 401, `Anon create should fail 401, got ${res.status}`);
    }

    {
        const { res } = await post("/api/projects", { title: "Member Project " + slug }, {
            headers: { "Authorization": `Bearer ${memberToken}` }
        });
        assert(res.status === 201, `Member create should succeed, got ${res.status}`);
    }
});