// api/jest.config.js
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',

        // Helper library for legacy tests
        '_lib.js',

        // Legacy "smoke" tests that use a custom runner (not Jest-compatible)
        '.*\\.smoke\\.test\\.js$',
        'utils.static.test.js',
        'wiring.sanity.test.js',
        'final_audit.test.js',
        'app.import.test.js',
        'middleware.unit.test.js',

        // Legacy integration tests using custom runner
        'uploads.routes.test.js',
        'blog.auth.test.js',
        'events.auth.test.js',
        'projects.auth.test.js',

        // Standalone scripts (ran via node, not jest)
        'uploads.service.test.js',
        'cv.security.test.js',
        'p0-.*\\.js'
    ],
    maxWorkers: 1,
    verbose: true,
    moduleNameMapper: {
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js'
    }
};