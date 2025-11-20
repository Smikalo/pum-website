module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/*',
        'uploads.service.unit.test.js',
        'cv.security.test.js',
        'p0-api-scripts.smoke.js',
        '_lib.js',
        '.\.smoke\.test\.js',
        '.\.auth\.test\.js',
        '.\.routes\.test\.js',
        'pagination.regression.test.js',
        'utils.static.test.js',
        'wiring.sanity.test.js',
        'final_audit.test.js',
        'app.import.test.js',
        'middleware.unit.test.js',
        'uploads.service.test.js',
        'uploads.routes.test.js'
    ],
    maxWorkers: 1,
    verbose: true,
    moduleNameMapper: {
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js'
    }
};