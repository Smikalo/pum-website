const { run, get, assert } = require("./_lib");

run("GET /api/members?size=1 returns list shape", async () => {
    const { res, body } = await get("/api/members?size=1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(body.items), "items must be an array");
});

run("GET /api/members/:slug 404 for unknown", async () => {
    const { res } = await get("/api/members/__non-existing-slug__");
    assert(res.status === 404, `Expected 404, got ${res.status}`);
});