class AppError extends Error {
    constructor(message, statusCode, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace?.(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad request', details) {
        super(message, 400, details);
        this.name = 'BadRequestError';
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', details) {
        super(message, 401, details);
        this.name = 'UnauthorizedError';
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', details) {
        super(message, 403, details);
        this.name = 'ForbiddenError';
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Not found', details) {
        super(message, 404, details);
        this.name = 'NotFoundError';
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', details) {
        super(message, 400, details);
        this.name = 'ValidationError';
    }
}

module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
};