// api/tests/p2-uploads-parity.test.js
const { spawnSync } = require('child_process');
const path = require('path');

const TEST_SCRIPT = path.join(__dirname, 'uploads.service.test.js');

describe('Upload Security Parity', () => {
    test('Standalone upload security validation script passes', () => {
        // We run the standalone verification script as a child process.
        // This script (uploads.service.test.js) performs imperative checks
        // and mocks that conflict with the main Jest environment if run directly.

        const res = spawnSync('node', [TEST_SCRIPT], {
            stdio: 'inherit', // Pipe output so we can see it in CI logs
            encoding: 'utf-8',
            shell: process.platform === 'win32'
        });

        if (res.error) {
            console.error("Failed to spawn process:", res.error);
            throw res.error;
        }

        if (res.status !== 0) {
            throw new Error(`Security verification script failed with exit code ${res.status}`);
        }
    });
});