#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const TEST_FILE = path.join(__dirname, 'uploads.service.test.js');

console.log("Running upload security parity tests...");
const res = spawnSync('node', [TEST_FILE], { stdio: 'inherit' });

if (res.status !== 0) {
    console.error("Tests failed!");
    process.exit(1);
}
console.log("Success.");