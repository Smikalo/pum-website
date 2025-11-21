// api/src/utils/lists.ts

/**
 * Safely parse an integer or return default
 */
export const toInt = (v: any, d: number): number => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Extract standard pagination params (page, size) from query string.
 * Applies defaults and capping.
 */
export function getPaginationParams(query: any, defaultSize = 24, maxSize = 1000): { page: number; size: number } {
    const page = toInt(query?.page, 1);
    const size = Math.min(toInt(query?.size, defaultSize), maxSize);
    return { page, size };
}

/**
 * Standard list response structure
 */
export function toPagedResponse<T>(items: T[], total: number, page: number, size: number) {
    return {
        items,
        page,
        size,
        total,
    };
}