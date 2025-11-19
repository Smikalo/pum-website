// api/tests/_lib.js
const http = require("http");
const app = require("../src/app");

// Lightweight assertions
const assert = (cond, msg = "Assertion failed") => {
    if (!cond) throw new Error(msg);
};

function fail(msg) {
    const err = new Error(msg);
    err.__isTestFail = true;
    throw err;
}

let testServer;
let testBaseUrl;
let isExternalServer = false;

async function startTestServer() {
    if (testServer) return testBaseUrl;

    // If API_BASE is explicitly set, assume external server and don't manage it
    if (process.env.API_BASE) {
        testBaseUrl = process.env.API_BASE;
        isExternalServer = true;
        return testBaseUrl;
    }

    return new Promise((resolve) => {
        testServer = http.createServer(app);
        testServer.listen(0, () => {
            const port = testServer.address().port;
            testBaseUrl = `http://localhost:${port}`;
            resolve(testBaseUrl);
        });
    });
}

async function stopTestServer() {
    if (isExternalServer) return;
    if (testServer) {
        await new Promise(resolve => testServer.close(resolve));
        testServer = null;
        testBaseUrl = null;
    }
}

async function get(path, opts = {}) {
    const base = await startTestServer();
    const url = new URL(path, base).toString();

    const headers = { ...(opts.headers || {}) };

    const res = await fetch(url, {
        method: "GET",
        headers,
        ...opts
    });

    let body = null;
    try { body = await res.json(); } catch { /* ignore non-JSON */ }
    return { res, body };
}

async function post(path, json, opts = {}) {
    const base = await startTestServer();
    const url = new URL(path, base).toString();

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(opts.headers || {})
    };

    const { headers: _, ...restOpts } = opts;

    const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(json || {}),
        credentials: "include",
        ...restOpts
    });

    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    return { res, body };
}

async function run(name, fn) {
    const start = Date.now();
    try {
        await startTestServer();
        await fn();
        console.log(`✅ ${name} (${Date.now() - start}ms)`);
    } catch (e) {
        if (e.__isTestFail) {
            console.error(`❌ ${name}: ${e.message}`);
        } else {
            console.error(`❌ ${name}:`, e);
        }
        process.exitCode = 1;
    } finally {
        // Ensure server closes so the process can exit
        await stopTestServer();
    }
}

// Cleanup fallback if something else keeps it alive
process.on("exit", () => {
    if (testServer && !isExternalServer) testServer.close();
});

module.exports = { assert, fail, get, post, run };