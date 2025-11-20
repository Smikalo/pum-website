// api/tests/errors.test.js
const {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ValidationError
} = require('../src/errors');

describe('Typed Error Classes', () => {
    test('AppError behaves as base error', () => {
        const err = new AppError('base message', 503, { foo: 'bar' });
        expect(err instanceof Error).toBe(true);
        expect(err.message).toBe('base message');
        expect(err.statusCode).toBe(503);
        expect(err.details).toEqual({ foo: 'bar' });
    });

    test('BadRequestError defaults', () => {
        const err = new BadRequestError();
        expect(err instanceof AppError).toBe(true);
        expect(err.statusCode).toBe(400);
        expect(err.name).toBe('BadRequestError');
        expect(err.message).toBe('Bad request');
    });

    test('UnauthorizedError defaults', () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
        expect(err.name).toBe('UnauthorizedError');
        expect(err.message).toBe('Unauthorized');
    });

    test('ForbiddenError defaults', () => {
        const err = new ForbiddenError();
        expect(err.statusCode).toBe(403);
        expect(err.name).toBe('ForbiddenError');
        expect(err.message).toBe('Forbidden');
    });

    test('NotFoundError defaults', () => {
        const err = new NotFoundError();
        expect(err.statusCode).toBe(404);
        expect(err.name).toBe('NotFoundError');
        expect(err.message).toBe('Not found');
    });

    test('ValidationError defaults', () => {
        const err = new ValidationError();
        expect(err.statusCode).toBe(400);
        expect(err.name).toBe('ValidationError');
        expect(err.message).toBe('Validation failed');
    });

    test('Custom messages and details passed correctly', () => {
        const err = new NotFoundError('Custom 404', { id: 123 });
        expect(err.message).toBe('Custom 404');
        expect(err.statusCode).toBe(404);
        expect(err.details).toEqual({ id: 123 });
    });
});