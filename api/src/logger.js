// api/src/logger.js
// Simple JSON logger for the backend API.
//
// NOTE: Never pass secrets (JWTs, passwords, DB URLs, API keys, etc.) in the
// `meta` object here. This logger intentionally only pulls `NODE_ENV` from
// config and does not read or log any secret values itself.

const config = require("./config");

const base = { service: "api", env: config.NODE_ENV };

function log(level, message, meta) {
    const payload = {
        level,
        msg: message,
        ...base,
        ...(meta || {}),
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(payload));
}

module.exports = {
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
    debug: (message, meta) => log("debug", message, meta),
};
