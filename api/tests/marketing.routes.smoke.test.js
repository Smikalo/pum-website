const { run, post, assert } = require("./_lib");

run("POST /api/contact invalid returns 400", async () => {
    const { res, body } = await post("/api/contact", {});
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(body && body.ok === false, "Body should have ok:false");
});

run("POST /api/newsletter/subscribe invalid returns 400", async () => {
    const { res } = await post("/api/newsletter/subscribe", {});
    assert(res.status >= 400, `Expected error status, got ${res.status}`);
});