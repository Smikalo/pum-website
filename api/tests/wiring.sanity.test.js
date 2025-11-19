#!/usr/bin/env node
/* eslint-disable */
const { run, get, assert, getApiBase } = require("./_lib");
const BASE = getApiBase();

// Current behaviour:
// - GET /healthz returns { ok: true, service: "api", db: boolean } or
//   500 with { ok: false, service: "api", db: false, error }  :contentReference[oaicite:9]{index=9}

run("GET /healthz returns expected JSON keys (success path)", async () => {
    const { res, body } = await get(BASE, "/healthz");
    if (res.status === 200) {
        assert(body && body.ok === true, "ok must be true on success");
        assert(body.service === "api", "service must be 'api'");
        assert(typeof body.db === "boolean", "db must be boolean");
    } else if (res.status === 500) {
        assert(body && body.ok === false, "ok must be false on 500");
        assert(body.service === "api", "service must be 'api'");
        assert(body.db === false, "db must be false on 500");
        assert(typeof body.error === "string", "error string required on 500");
    } else {
        throw new Error(`unexpected status ${res.status}`);
    }
});
