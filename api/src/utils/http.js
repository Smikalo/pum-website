// api/src/utils/http.js

/**
 * Standard 200 OK response
 */
function sendOk(res, data) {
    return res.status(200).json(data);
}

/**
 * Standard 201 Created response
 */
function sendCreated(res, data) {
    return res.status(201).json(data);
}

/**
 * Standard 204 No Content response
 */
function sendNoContent(res) {
    return res.sendStatus(204);
}

/**
 * Flexible helper for specific status codes + payloads
 * Useful for legacy endpoints that don't follow the { ok: false } pattern
 */
function sendJson(res, status, data) {
    return res.status(status).json(data);
}

/**
 * Standard error response { ok: false, error: "..." }
 */
function sendError(res, status, error, extras = {}) {
    return res.status(status).json({ ok: false, error, ...extras });
}

/**
 * 400 Bad Request with optional details
 */
function sendBadRequest(res, error, details = undefined) {
    const body = { ok: false, error };
    if (details) body.details = details;
    return res.status(400).json(body);
}

/**
 * 401 Unauthorized
 */
function sendUnauthorized(res, error = "Unauthorized") {
    return res.status(401).json({ ok: false, error });
}

/**
 * 403 Forbidden
 */
function sendForbidden(res, error = "Insufficient permissions") {
    return res.status(403).json({ ok: false, error });
}

/**
 * 404 Not Found (Standard { ok: false } shape)
 */
function sendNotFound(res, error = "Not found") {
    return res.status(404).json({ ok: false, error });
}

/**
 * 500 Server Error
 */
function sendServerError(res, error = "Server error") {
    return res.status(500).json({ ok: false, error });
}

/**
 * Wraps async route handlers to catch errors and pass them to Express error middleware.
 */
const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    sendOk,
    sendCreated,
    sendNoContent,
    sendJson,
    sendError,
    sendBadRequest,
    sendUnauthorized,
    sendForbidden,
    sendNotFound,
    sendServerError,
    asyncHandler,
};