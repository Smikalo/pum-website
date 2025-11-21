// api/tests/utils.static.test.js
const http = require('../src/utils/http');
const lists = require('../src/utils/lists');
const val = require('../src/utils/validation');

describe('Utils Static Checks', () => {
    test('utils/http exports functions', () => {
        expect(typeof http.sendOk).toBe('function');
        expect(typeof http.sendCreated).toBe('function');
        expect(typeof http.sendNoContent).toBe('function');
        expect(typeof http.sendError).toBe('function');
    });

    test('utils/lists exports helpers', () => {
        expect(typeof lists.getPaginationParams).toBe('function');
        expect(typeof lists.toPagedResponse).toBe('function');
    });

    test('utils/validation exports validators', () => {
        expect(typeof val.requireFields).toBe('function');
        expect(typeof val.sanitizeEmailInput).toBe('function');
        expect(typeof val.sanitizePlainText).toBe('function');
    });
});