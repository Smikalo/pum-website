// api/jest.config.js
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        // Explicitly ignore legacy/standalone scripts
        'uploads.service.unit.test.js',
        'uploads.service.test.js',
        'cv.security.test.js',
        'p0-.*\\.js',
        '_lib.js',
        // Ignore tests that use custom runners/assertions incompatible with Jest
        'wiring.sanity.test.js',
        'final_audit.test.js',
        'app.import.test.js',
        'middleware.unit.test.js',
        'uploads.routes.test.js',
        // Smoke/Integration tests that might require specific envs or are legacy
        '.*\\.smoke\\.test\\.js$',
        'blog.auth.test.js',
        'events.auth.test.js',
        'projects.auth.test.js'
    ],
    maxWorkers: 1,
    verbose: true,
    moduleNameMapper: {
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js'
    }
};