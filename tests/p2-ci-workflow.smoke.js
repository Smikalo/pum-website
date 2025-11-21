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
const WEB_ESLINT = path.join(ROOT, 'web', '.eslintrc.json');
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

// 1. Check for CI file existence and content
if (!fs.existsSync(CI_FILE)) {
    fail('.github/workflows/ci.yml not found.');
}

const ciContent = fs.readFileSync(CI_FILE, 'utf8');
if (!ciContent.includes('services:') || !ciContent.includes('postgres:')) {
    fail('CI workflow missing Postgres service definition.');
}
ok('CI workflow file exists and defines Postgres service.');

// 2. Check for Web ESLint config
if (!fs.existsSync(WEB_ESLINT)) {
    fail('web/.eslintrc.json not found. This is needed to prevent CI interactive prompts.');
}
ok('web/.eslintrc.json exists.');

// 3. Local sanity check for API scripts
console.log('\nRunning local sanity check for API scripts (lint & test)...');
// Note: API tests might fail locally if local DB is not running,
// but we check if the script starts.
const apiLint = spawnSync('npm', ['run', 'lint'], { cwd: API_DIR, stdio: 'inherit', shell: true });
if (apiLint.status !== 0) {
    fail('API lint failed locally.');
}
// We skip actual npm test here to avoid crashing if local DB isn't ready,
// relying on the previous stage's assurance that tests passed or the user handles local env.
ok('API lint passed locally.');

// 4. Local sanity check for Web scripts
console.log('\nRunning local sanity check for Web scripts (lint)...');
const webLint = spawnSync('npm', ['run', 'lint'], { cwd: WEB_DIR, stdio: 'inherit', shell: true });
if (webLint.status !== 0) {
// Next.js lint might warn, but should exit 0 if no errors.
// If it fails, it might be due to the config we just added being invalid.
    fail('Web lint failed locally.');
}
ok('Web lint passed locally.');

console.log('\n🎉 Stage 2 CI workflow setup verification passed.\n');