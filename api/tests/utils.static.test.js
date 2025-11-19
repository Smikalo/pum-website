#!/usr/bin/env node
/* eslint-disable */
const { run, assert } = require("./_lib");

function tryRequire(p) {
    try { return { mod: require(p), ok: true }; }
    catch { return { ok: false }; }
}

run("utils/http.js exists and exports functions", async () => {
    const r = tryRequire("../src/utils/http");
    if (!r.ok) { console.warn("SKIP: utils/http.js not found (create in P1S1-01)"); return; }
    const { sendOk, sendCreated, sendNoContent, sendError } = r.mod || {};
    assert(typeof sendOk === "function", "sendOk must be a function");
    assert(typeof sendCreated === "function", "sendCreated must be a function");
    assert(typeof sendNoContent === "function", "sendNoContent must be a function");
    assert(typeof sendError === "function", "sendError must be a function");
});

run("utils/lists.js exists and exports pagination helpers", async () => {
    const r = tryRequire("../src/utils/lists");
    if (!r.ok) { console.warn("SKIP: utils/lists.js not found (create in P1S1-02)"); return; }
    const { getPaginationParams, toPagedResponse } = r.mod || {};
    assert(typeof getPaginationParams === "function", "getPaginationParams must be a function");
    assert(typeof toPagedResponse === "function", "toPagedResponse must be a function");
});

run("utils/validation.js exists and exports validators", async () => {
    const r = tryRequire("../src/utils/validation");
    if (!r.ok) { console.warn("SKIP: utils/validation.js not found (create in P1S1-03)"); return; }
    const { requireFields, isValidEmail, isValidSlug } = r.mod || {};
    assert(typeof requireFields === "function", "requireFields must be a function");
    assert(typeof isValidEmail === "function", "isValidEmail must be a function");
    assert(typeof isValidSlug === "function", "isValidSlug must be a function");
});
