// api/tests/error-handler.test.js
const request = require('supertest');
const express = require('express');
const {
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
    AppError
} = require('../src/errors');

// Duplicate error handler logic for testing isolation
const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof AppError) {
        const status = err.statusCode || 500;
        const payload = { ok: false, error: err.message };
        if (err.details !== undefined) payload.details = err.details;
        return res.status(status).json(payload);
    }

    const status = 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Server error');
    return res.status(status).json({ ok: false, error: msg });
};

describe('Global Error Handler Middleware', () => {
    let app;
    let server;

    beforeEach(() => {
        app = express();
        app.get('/test/bad', (req, res, next) => next(new BadRequestError('Bad input')));
        app.get('/test/auth', (req, res, next) => next(new UnauthorizedError('No token')));
        app.get('/test/forbid', (req, res, next) => next(new ForbiddenError('No access')));
        app.get('/test/found', (req, res, next) => next(new NotFoundError('Missing')));
        app.get('/test/valid', (req, res, next) => next(new ValidationError('Invalid field', { field: 'email' })));
        app.get('/test/crash', (req, res, next) => next(new Error('Boom')));

        app.use(errorHandler);
    });

    test('BadRequestError -> 400', async () => {
        const res = await request(app).get('/test/bad');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ ok: false, error: 'Bad input' });
    });

    test('UnauthorizedError -> 401', async () => {
        const res = await request(app).get('/test/auth');
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ ok: false, error: 'No token' });
    });

    test('ForbiddenError -> 403', async () => {
        const res = await request(app).get('/test/forbid');
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ ok: false, error: 'No access' });
    });

    test('NotFoundError -> 404', async () => {
        const res = await request(app).get('/test/found');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ ok: false, error: 'Missing' });
    });

    test('ValidationError -> 400 with details', async () => {
        const res = await request(app).get('/test/valid');
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ ok: false, error: 'Invalid field', details: { field: 'email' } });
    });

    test('Generic Error -> 500 (development mode shows message)', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const res = await request(app).get('/test/crash');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Boom');
        process.env.NODE_ENV = oldEnv;
    });

    test('Generic Error -> 500 (production mode hides message)', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const res = await request(app).get('/test/crash');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Internal server error');
        process.env.NODE_ENV = oldEnv;
    });
});