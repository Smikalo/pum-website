#!/usr/bin/env node
/**

 Stage 2 — P2S13-01-create-ci-workflow

 Smoke-test the CI workflow configuration and local script readiness.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const CI_FILE = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const API_DIR = path.join(ROOT, 'api');
const WEB_DIR = path.join(ROOT, 'web');

function fail(msg, details) {
    console.error(`❌ ${msg}`);
    if (details) console.error(details);
    process.exit(1);
}

function ok(msg) {
    console.log(`✅ ${msg}`);
}

// 1. Check for CI file existence
if (!fs.existsSync(CI_FILE)) {
    fail('.github/workflows/ci.yml not found.');
}
ok('CI workflow file exists.');

// Simple check for content
const ciContent = fs.readFileSync(CI_FILE, 'utf8');
if (!ciContent.includes('runs-on: ubuntu-latest') || !ciContent.includes('npm test')) {
    fail('CI workflow file missing expected keywords (ubuntu-latest, npm test).');
}
ok('CI workflow file content looks plausible.');

// 2. Local sanity check for API scripts
console.log('\nRunning local sanity check for API scripts (lint & test)...');
const apiLint = spawnSync('npm', ['run', 'lint'], { cwd: API_DIR, stdio: 'inherit', shell: true });
if (apiLint.status !== 0) {
    fail('API lint failed locally. CI will likely fail.');
}
const apiTest = spawnSync('npm', ['test'], { cwd: API_DIR, stdio: 'inherit', shell: true });
if (apiTest.status !== 0) {
    fail('API test failed locally. CI will likely fail.');
}
ok('API scripts pass locally.');

// 3. Local sanity check for Web scripts
console.log('\nRunning local sanity check for Web scripts (lint & test)...');
// Note: web lint might warn but exit 0.
const webLint = spawnSync('npm', ['run', 'lint'], { cwd: WEB_DIR, stdio: 'inherit', shell: true });
if (webLint.status !== 0) {
// Next.js lint might fail if eslint config is strict, but we accept warnings.
// If it fails with error, CI fails.
    fail('Web lint failed locally. CI will likely fail.');
}

const webTest = spawnSync('npm', ['test'], { cwd: WEB_DIR, stdio: 'inherit', shell: true });
if (webTest.status !== 0) {
    fail('Web test failed locally. CI will likely fail.');
}
ok('Web scripts pass locally.');

console.log('\n🎉 Stage 2 CI workflow setup verification passed.\n');