const { run, get, post, assert } = require("./_lib");

async function login(email, password) {
    const { res: csrfRes } = await get("/api/auth/csrf");
    if (!csrfRes.ok) throw new Error("Failed to get CSRF token");
    const cookieHeader = csrfRes.headers.get("set-cookie");
    const match = cookieHeader ? cookieHeader.match(/XSRF-TOKEN=([^;]+)/) : null;
    const xsrfToken = match ? decodeURIComponent(match[1]) : null;
    if (!xsrfToken) throw new Error("XSRF-TOKEN not found");

    const { res, body } = await post("/api/auth/login", { email, password }, {
        headers: { "X-CSRF-Token": xsrfToken, "Cookie": cookieHeader }
    });

    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    return body.accessToken;
}

run("Blog Auth Tests", async () => {
    const memToken = await login("mem1@pum.local", "ChangeMe!123");

    const { res } = await post("/api/blogs", { title: "Test Blog " + Date.now() }, {
        headers: { "Authorization": `Bearer ${memToken}` }
    });
    assert(res.ok, "Create blog failed");
});