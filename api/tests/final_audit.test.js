const { run, get, assert } = require("./_lib");

run("Check base paths work", async () => {
    await get("/api/members");
    await get("/api/projects");
    await get("/api/events");
    await get("/api/blogs");
});

run("Check healthz", async () => {
    const { res } = await get("/healthz");
    assert(res.status === 200, "Healthz should be 200");
});