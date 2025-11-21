// api/tests/p2-uploads-parity.test.js
const { spawnSync } = require('child_process');
const path = require('path');

const TEST_SCRIPT = path.join(__dirname, 'uploads.service.test.js');

describe('Upload Security Parity', () => {
    test('Standalone upload security validation script passes', () => {
        const res = spawnSync('node', [TEST_SCRIPT], {
            stdio: 'inherit',
            encoding: 'utf-8',
            shell: process.platform === 'win32'
        });

        if (res.error) {
            throw res.error;
        }

        if (res.status !== 0) {
            throw new Error(`Security verification script failed with exit code ${res.status}`);
        }
    });
});