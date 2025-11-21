// api/jest.config.js
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    testPathIgnorePatterns: [
        '/node_modules/',
        // Ignore the helper library from test execution
        '_lib.js',
        // Ignore the deprecated smoke scripts that aren't tests
        'p0-.*\\.js'
    ],
    maxWorkers: 1,
    verbose: true,
    moduleNameMapper: {
        '^nanoid$': '<rootDir>/tests/mocks/nanoid.js'
    }
};