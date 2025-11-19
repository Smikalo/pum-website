// api/src/utils/validation.js
const xss = require("xss");
const validator = require("validator");

/**
 * Sanitize plain text input: strip HTML, trim, limit length.
 */
function sanitizePlainText(input, { maxLen = 1000 } = {}) {
    const str = (input ?? "").toString();
    // Strip HTML tags & scripts
    const noHtml = xss(str, {
        whiteList: {}, // no tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script", "style", "iframe", "object"],
    });
    // Trim and clamp length
    return noHtml.trim().slice(0, maxLen);
}

/**
 * Normalize and validate email input. Returns empty string if invalid.
 */
function sanitizeEmailInput(input) {
    const str = (input ?? "").toString().trim();
    if (!validator.isEmail(str)) return "";
    // Ensure canonical, lower-cased email
    return (
        validator.normalizeEmail(str, { gmail_remove_dots: false }) ||
        str.toLowerCase()
    );
}

/**
 * Sanitize HTTP header values to prevent injection.
 */
function sanitizeHeaderValue(input) {
    return (input ?? "")
        .toString()
        .replace(/(\r|\n)/g, " ")
        .slice(0, 255)
        .trim();
}

/**
 * Return email if valid for Reply-To, else undefined.
 */
function safeReplyTo(email) {
    const trimmed = (email || "").trim();
    const valid = validator.isEmail(trimmed);
    return valid ? trimmed : undefined;
}

/**
 * Basic required fields check. Returns the name of the first missing field or null.
 */
function requireFields(body, fields) {
    for (const f of fields) {
        if (body[f] === undefined || body[f] === null || body[f] === "") {
            return f;
        }
    }
    return null;
}

module.exports = {
    sanitizePlainText,
    sanitizeEmailInput,
    sanitizeHeaderValue,
    safeReplyTo,
    requireFields,
};