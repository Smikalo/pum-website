const { run, get, assert } = require("./_lib");

run("GET /healthz returns expected JSON keys", async () => {
    const { res, body } = await get("/healthz");
    assert(res.status === 200, `Status ${res.status}`);
    assert(body.ok === true, "ok true");
});