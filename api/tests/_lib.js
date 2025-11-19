// Lightweight assertions + HTTP client (no new deps)
const assert = (cond, msg = "Assertion failed") => {
    if (!cond) throw new Error(msg);
};

function fail(msg) {
    const err = new Error(msg);
    err.__isTestFail = true;
    throw err;
}

async function get(base, path, opts = {}) {
    const url = new URL(path, base).toString();
    const res = await fetch(url, { method: "GET", ...opts });
    let body = null;
    try { body = await res.json(); } catch { /* ignore non-JSON */ }
    return { res, body };
}

async function post(base, path, json) {
    const url = new URL(path, base).toString();
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(json || {}),
        credentials: "include",
    });
    let body = null;
    try { body = await res.json(); } catch { /* ignore */ }
    return { res, body };
}

// Tiny harness (run files directly with `node`)
async function run(name, fn) {
    const start = Date.now();
    try {
        await fn();
        console.log(`✅ ${name} (${Date.now() - start}ms)`);
    } catch (e) {
        if (e.__isTestFail) {
            console.error(`❌ ${name}: ${e.message}`);
        } else {
            console.error(`❌ ${name}:`, e);
        }
        process.exitCode = 1;
    }
}

function getApiBase() {
    // Default to typical dev port; override with API_BASE env
    return process.env.API_BASE || "http://localhost:3001";
}

module.exports = { assert, fail, get, post, run, getApiBase };
