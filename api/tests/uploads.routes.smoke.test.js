const { run, post, assert } = require("./_lib");

run("POST /api/uploads/event-photo without auth returns 401", async () => {
    const { res } = await post("/api/uploads/event-photo", {});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
});

run("POST /api/uploads/project-photo without auth returns 401", async () => {
    const { res } = await post("/api/uploads/project-photo", {});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
});

run("POST /api/uploads/blog-photo without auth returns 401", async () => {
    const { res } = await post("/api/uploads/blog-photo", {});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
});