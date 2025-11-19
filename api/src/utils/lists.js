// api/src/utils/lists.js

/**
 * Safely parse an integer or return default
 */
const toInt = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Extract standard pagination params (page, size) from query string.
 * Applies defaults and capping.
 */
function getPaginationParams(query, defaultSize = 24, maxSize = 1000) {
    const page = toInt(query.page, 1);
    const size = Math.min(toInt(query.size, defaultSize), maxSize);
    return { page, size };
}

/**
 * Standard list response structure
 */
function toPagedResponse(items, total, page, size) {
    return {
        items,
        page,
        size,
        total,
    };
}

module.exports = {
    toInt,
    getPaginationParams,
    toPagedResponse,
};