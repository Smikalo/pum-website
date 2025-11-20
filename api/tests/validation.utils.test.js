const val = require('../src/utils/validation');

describe('utils/validation', () => {
    describe('sanitizePlainText', () => {
        test('removes html tags', () => {
            expect(val.sanitizePlainText('<script>alert(1)</script>hello')).toBe('hello');
        });
        test('trims whitespace', () => {
            expect(val.sanitizePlainText(' abc ')).toBe('abc');
        });
        test('respects max length', () => {
// sanitizePlainText signature: input, { maxLen }
            expect(val.sanitizePlainText('12345', {maxLen: 3})).toBe('123');
        });
    });
    describe('sanitizeEmailInput', () => {
        test('validates and normalizes email', () => {
            expect(val.sanitizeEmailInput('  TEST@Example.com  ')).toBe('test@example.com');
        });
        test('returns empty string for invalid email', () => {
            expect(val.sanitizeEmailInput('not-an-email')).toBe('');
        });
    });

    describe('sanitizeHeaderValue', () => {
        test('removes newlines', () => {
            expect(val.sanitizeHeaderValue('foo\nbar')).toBe('foo bar');
        });
    });

    describe('requireFields', () => {
        test('returns null if all fields present', () => {
            expect(val.requireFields({a: 1, b: 2}, ['a', 'b'])).toBeNull();
        });
        test('returns missing field name', () => {
            expect(val.requireFields({a: 1}, ['a', 'b'])).toBe('b');
        });
        test('considers empty string as missing', () => {
            expect(val.requireFields({a: ''}, ['a'])).toBe('a');
        });
    });
});