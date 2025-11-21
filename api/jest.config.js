module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        'uploads.service.unit.test.js', // Legacy/unit specific
        'uploads.service.test.js',      // Standalone script run by p2-uploads-parity.test.js
        'cv.security.test.js',          // Standalone integration script
        'p0-api-scripts.smoke.js',      // Smoke script (ends in .js anyway)
        '_lib.js',
        // Ignore older smoke/sanity tests if they overlap or are deprecated
        'wiring.sanity.test.js',
        'final_audit.test.js',
        'app.import.test.js',
        'middleware.unit.test.js',
        'uploads.routes.test.js'
    ],
    maxWorkers: 1,
    verbose: true,
    moduleNameMapper: {
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js'
    }
};