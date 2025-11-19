#!/usr/bin/env node
/* eslint-disable */
const { run, get, assert, fail, getApiBase } = require("./_lib");

const BASE = getApiBase();

// NOTE: These expectations are derived from current handlers.
// - Members list returns { items, page, size, total }  :contentReference[oaicite:0]{index=0}
// - Projects list returns { items, page, size, total } :contentReference[oaicite:1]{index=1}
// - Blogs list returns { items, page, size, total }    :contentReference[oaicite:2]{index=2}
// - Events list returns { items, page, size, total }   :contentReference[oaicite:3]{index=3}
// - Project detail 404 returns { error: "Not found" }  :contentReference[oaicite:4]{index=4}

run("GET /api/members?size=1 returns list shape", async () => {
    const { res, body } = await get(BASE, "/api/members?size=1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const k of ["items", "page", "size", "total"]) {
        assert(Object.prototype.hasOwnProperty.call(body, k), `Missing key ${k}`);
    }
    assert(Array.isArray(body.items), "items must be an array");
});

run("GET /api/projects?size=1 returns list shape", async () => {
    const { res, body } = await get(BASE, "/api/projects?size=1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const k of ["items", "page", "size", "total"]) {
        assert(Object.prototype.hasOwnProperty.call(body, k), `Missing key ${k}`);
    }
    assert(Array.isArray(body.items), "items must be an array");
});

run("GET /api/blogs?size=1 returns list shape", async () => {
    const { res, body } = await get(BASE, "/api/blogs?size=1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const k of ["items", "page", "size", "total"]) {
        assert(Object.prototype.hasOwnProperty.call(body, k), `Missing key ${k}`);
    }
    assert(Array.isArray(body.items), "items must be an array");
});

run("GET /api/events?size=1 returns list shape", async () => {
    const { res, body } = await get(BASE, "/api/events?size=1");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    for (const k of ["items", "page", "size", "total"]) {
        assert(Object.prototype.hasOwnProperty.call(body, k), `Missing key ${k}`);
    }
    assert(Array.isArray(body.items), "items must be an array");
});

run("GET /api/projects/:slug 404 shape is stable", async () => {
    const { res, body } = await get(BASE, "/api/projects/__non-existing-slug__");
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    assert(body && typeof body.error === "string", "Missing string 'error'");
    assert(body.error === "Not found", `Expected error='Not found', got ${body.error}`);
});
