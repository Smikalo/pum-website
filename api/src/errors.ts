// api/src/errors.ts

export class AppError extends Error {
    statusCode: number;
    details?: any;

    constructor(message: string, statusCode: number, details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        // Maintain prototype chain for instanceof checks in mixed envs if needed,
        // though class syntax usually handles this well in modern node.
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = 'Bad request', details?: any) {
        super(message, 400, details);
        this.name = 'BadRequestError';
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized', details?: any) {
        super(message, 401, details);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden', details?: any) {
        super(message, 403, details);
        this.name = 'ForbiddenError';
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Not found', details?: any) {
        super(message, 404, details);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string = 'Validation failed', details?: any) {
        super(message, 400, details);
        this.name = 'ValidationError';
    }
}