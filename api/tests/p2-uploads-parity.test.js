// api/tests/p2-uploads-parity.test.js
const { spawnSync } = require('child_process');
const path = require('path');

const TEST_FILE = path.join(__dirname, 'uploads.service.test.js');

describe('Upload Security Parity', () => {
    test('Standalone upload security validation script passes', () => {
        // This runs the standalone "uploads.service.test.js" file in a separate node process.
        // That file sets up its own mocks and runs assertions imperatively.
        // We pipe stdio so we can see the logs in the CI output.
        const res = spawnSync('node', [TEST_FILE], {
            stdio: 'inherit',
            encoding: 'utf-8',
            shell: process.platform === 'win32'
        });

        if (res.error) {
            console.error("Failed to spawn standalone test process:", res.error);
            throw res.error;
        }

        if (res.status !== 0) {
            throw new Error(`Upload security script failed with exit code ${res.status}. Check logs above.`);
        }
    });
});