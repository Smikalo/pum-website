#!/usr/bin/env node
/**
 * Stage 0 — P0-01-root-scripts
 * Smoke-test the ROOT package.json for lint/test scripts and that they run.
 * No dependencies, no side effects: only checks that scripts exist and can be invoked.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const PKG = path.join(ROOT, 'package.json');

function fail(msg, details) {
    console.error(`\n❌ ${msg}`);
    if (details) console.error(details);
    process.exit(1);
}

function ok(msg) {
    console.log(`✅ ${msg}`);
}

function readJson(file) {
    try {
        const raw = fs.readFileSync(file, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        fail(`Cannot read/parse JSON file: ${file}`, e.message);
    }
}

function detectPm(cwd) {
    if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
    return 'npm';
}

function runScript(pm, script, cwd) {
    const cmd = pm === 'yarn' ? 'yarn' : pm;
    const args =
        pm === 'yarn'
            ? ['run', script, '--silent']
            : ['run', script, '--silent'];

    const res = spawnSync(cmd, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        shell: process.platform === 'win32', // make Windows happy
    });

    const out = (res.stdout || '') + (res.stderr || '');
    const missing =
        /Missing script:\s*"?\b${script}\b"?/i.test(out) ||                // npm/pnpm
        new RegExp(`error\\s+Command\\s+"${script}"\\s+not\\s+found`, 'i').test(out); // yarn

    return { code: res.status, out, missing };
}

// 1) package.json validity + scripts presence
if (!fs.existsSync(PKG)) fail('package.json not found at repo root');

const pkg = readJson(PKG);
if (typeof pkg.scripts !== 'object' || pkg.scripts === null) {
    fail('Root package.json has no "scripts" object');
}

if (!Object.prototype.hasOwnProperty.call(pkg.scripts, 'lint')) {
    fail('Root package.json is missing "scripts.lint"');
}
if (!Object.prototype.hasOwnProperty.call(pkg.scripts, 'test')) {
    fail('Root package.json is missing "scripts.test"');
}

ok('Root package.json parses and has "scripts.lint" and "scripts.test".');

// 2) run lint
const pm = detectPm(ROOT);
console.log(`\nℹ️  Detected package manager: ${pm}`);
let res = runScript(pm, 'lint', ROOT);

if (res.missing) {
    console.error(res.out);
    fail('Running "lint" indicates a missing script.');
}
ok('Root "lint" script is wired (it ran or at least started).');

// 3) run test
res = runScript(pm, 'test', ROOT);
if (res.missing) {
    console.error(res.out);
    fail('Running "test" indicates a missing script.');
}
ok('Root "test" script is wired (runner started or placeholder executed).');

console.log('\n🎉 Stage 0 root scripts smoke test passed.\n');
