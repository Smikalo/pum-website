const lists = require('../src/utils/lists');

describe('utils/lists', () => {
    describe('toInt', () => {
        test('parses valid integer string', () => {
            expect(lists.toInt('123', 1)).toBe(123);
        });
        test('returns default for invalid input', () => {
            expect(lists.toInt('abc', 10)).toBe(10);
        });
        test('handles numbers correctly', () => {
            expect(lists.toInt(5, 0)).toBe(5);
        });
    });

    describe('getPaginationParams', () => {
        test('uses defaults when empty', () => {
            const { page, size } = lists.getPaginationParams({});
            expect(page).toBe(1);
            expect(size).toBe(24); // default in implementation
        });

        test('parses provided values', () => {
            const { page, size } = lists.getPaginationParams({ page: '2', size: '50' });
            expect(page).toBe(2);
            expect(size).toBe(50);
        });

        test('clamps size if too large', () => {
            const { size } = lists.getPaginationParams({ size: '99999' });
            expect(size).toBeLessThanOrEqual(1000); // implementation caps at 1000
        });
    });

    describe('toPagedResponse', () => {
        test('formats response correctly', () => {
            const items = [1, 2, 3];
            const res = lists.toPagedResponse(items, 100, 2, 3);
            expect(res).toEqual({
                items,
                total: 100,
                page: 2,
                size: 3
            });
        });
    });

});