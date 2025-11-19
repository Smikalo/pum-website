#!/usr/bin/env node
/**
 * Stage 0 — P0-02-api-scripts
 * Smoke-test api/package.json for lint/test scripts and that they run.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const API_DIR = fs.existsSync(path.join(ROOT, 'api')) ? path.join(ROOT, 'api') : ROOT; // allow running from /api
const PKG = path.join(API_DIR, 'package.json');

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
    // also look one level up (monorepo root locks)
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
if (!fs.existsSync(PKG)) fail('api/package.json not found. Are you in the right repo?');
const pkg = readJson(PKG);
if (typeof pkg.scripts !== 'object' || pkg.scripts === null) fail('api/package.json has no "scripts" object');

// 2) presence checks
if (!('lint' in pkg.scripts)) fail('api/package.json missing "scripts.lint"');
if (!('test' in pkg.scripts)) fail('api/package.json missing "scripts.test"');
ok('api/package.json has "scripts.lint" and "scripts.test".');

// 3) run lint & test (accept failures, forbid "missing script")
const pm = detectPm(API_DIR);
console.log(`\nℹ️  Detected package manager for API: ${pm}`);

let res = runScript(pm, 'lint', API_DIR);
if (res.missing) { console.error(res.out); fail('API "lint" appears missing.'); }
ok('API "lint" script is wired.');

res = runScript(pm, 'test', API_DIR);
if (res.missing) { console.error(res.out); fail('API "test" appears missing.'); }
ok('API "test" script is wired.');

console.log('\n🎉 Stage 0 API scripts smoke test passed.\n');
