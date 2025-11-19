const { run, get, assert } = require("./_lib");

run("GET /api/events?size=1 returns list shape", async () => {
    const { res, body } = await get("/api/events?size=1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(body.items), "items must be an array");
});

run("GET /api/events/:slug 404 for unknown", async () => {
    const { res } = await get("/api/events/__non-existing-slug__");
    assert(res.status === 404, `Expected 404, got ${res.status}`);
});