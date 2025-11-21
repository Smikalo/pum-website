// api/tests/app.import.test.js
const app = require('../src/app');

describe('App Entrypoint', () => {
    test('Exports an Express app function', () => {
        expect(typeof app).toBe('function');
        expect(typeof app.use).toBe('function');
    });
});