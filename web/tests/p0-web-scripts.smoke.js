#!/usr/bin/env node
/**
 * Stage 0 — P0-03-web-scripts
 * Smoke-test web/package.json (Next.js) for lint/test scripts and that they run.
 */


const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const WEB_DIR = fs.existsSync(path.join(ROOT, 'web')) ? path.join(ROOT, 'web') : ROOT; // allow running from /web
const PKG = path.join(WEB_DIR, 'package.json');

function fail(msg, details) {
    console.error(`\n❌ ${msg}`);
    if (details) console.error(details);
    process.exit(1);
}
function ok(msg) { console.log(`✅ ${msg}`); }

function readJson(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { fail(`Cannot read/parse JSON: ${file}`, e.message); }
}

function detectPm(cwd) {
    if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
    const up = path.dirname(cwd);
    if (fs.existsSync(path.join(up, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(up, 'yarn.lock'))) return 'yarn';
    return 'npm';
}

function runScript(pm, script, cwd) {
    const cmd = pm === 'yarn' ? 'yarn' : pm;
    const args = pm === 'yarn' ? ['run', script, '--silent'] : ['run', script, '--silent'];
    const res = spawnSync(cmd, args, {
        cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8',
        shell: process.platform === 'win32',
    });
    const out = (res.stdout || '') + (res.stderr || '');
    const missing =
        /Missing script:\s*"?\b${script}\b"?/i.test(out) ||
        new RegExp(`error\\s+Command\\s+"${script}"\\s+not\\s+found`, 'i').test(out);
    return { code: res.status, out, missing };
}

// 1) existence & JSON
if (!fs.existsSync(PKG)) fail('web/package.json not found. Are you in the right repo?');
const pkg = readJson(PKG);
if (typeof pkg.scripts !== 'object' || pkg.scripts === null) fail('web/package.json has no "scripts" object');

// 2) presence checks (Next.js often uses "next lint")
if (!('lint' in pkg.scripts)) fail('web/package.json missing "scripts.lint" (e.g., "next lint")');
if (!('test' in pkg.scripts)) fail('web/package.json missing "scripts.test"');
ok('web/package.json has "scripts.lint" and "scripts.test".');

// 3) run lint & test (accept failures, forbid "missing script")
const pm = detectPm(WEB_DIR);
console.log(`\nℹ️  Detected package manager for Web: ${pm}`);

let res = runScript(pm, 'lint', WEB_DIR);
if (res.missing) { console.error(res.out); fail('Web "lint" appears missing.'); }
ok('Web "lint" script is wired.');

res = runScript(pm, 'test', WEB_DIR);
if (res.missing) { console.error(res.out); fail('Web "test" appears missing.'); }
ok('Web "test" script is wired.');

console.log('\n🎉 Stage 0 Web scripts smoke test passed.\n');
