#!/usr/bin/env node
/* eslint-disable */
const { run, get, assert, getApiBase } = require("./_lib");
const BASE = getApiBase();

// Derived from current code:
// - members: default size 24, max 1000  :contentReference[oaicite:5]{index=5}
// - projects: returns page/size/total (cap inferred 1000 like others) :contentReference[oaicite:6]{index=6}
// - blogs: default size 24, max 1000    :contentReference[oaicite:7]{index=7}
/* - events: default size 200, max 1000 */  // explicit in handler  :contentReference[oaicite:8]{index=8}

async function expectPaging(path, expectedMax) {
    // defaults
    {
        const { res, body } = await get(BASE, path);
        assert(res.status === 200, `defaults: ${path} -> ${res.status}`);
        assert(typeof body.page === "number" && body.page >= 1, "default page missing/invalid");
        assert(typeof body.size === "number" && body.size >= 1, "default size missing/invalid");
        assert(typeof body.total === "number", "default total missing/invalid");
    }

    // huge size is capped
    {
        const { res, body } = await get(BASE, `${path}${path.includes("?") ? "&" : "?"}size=999999`);
        assert(res.status === 200, `cap: ${path} -> ${res.status}`);
        assert(body.size <= expectedMax, `expected size<=${expectedMax}, got ${body.size}`);
    }
}

run("Members pagination defaults and caps", async () => {
    await expectPaging("/api/members", 1000);
});

run("Projects pagination defaults and caps", async () => {
    await expectPaging("/api/projects", 1000);
});

run("Blogs pagination defaults and caps", async () => {
    await expectPaging("/api/blogs", 1000);
});

run("Events pagination defaults and caps", async () => {
    // default size is 200; we only assert the cap to avoid binding to exact default
    await expectPaging("/api/events", 1000);
});
