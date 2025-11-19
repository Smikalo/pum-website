import React from "react";

/**
 * Returns a unique array of items.
 */
export function uniq<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

/**
 * Parses a comma-separated string parameter into an array of trimmed strings.
 */
export function parseMulti(param?: string): string[] {
    if (!param) return [];
    return param.split(",").map((x) => x.trim()).filter(Boolean);
}

/**
 * Checks if all `needles` are present in `haystack` (case-insensitive).
 * If needles is empty, returns true.
 */
export function includesAll(haystack: string[] | undefined, needles: string[]): boolean {
    if (!needles.length) return true;
    const h = new Set((haystack || []).map((s) => s.toLowerCase()));
    return needles.every((n) => h.has(n.toLowerCase()));
}

/**
 * Generic search matcher. Checks if any of the provided field values contains the query string.
 * Case-insensitive.
 */
export function checkMatches(q: string, fields: string[]): boolean {
    if (!q) return true;
    const needle = q.toLowerCase();
    return fields.some((f) => f.toLowerCase().includes(needle));
}

/**
 * Highlights occurrences of `q` in `text` with a <mark> tag.
 * Returns a React fragment.
 */
export function highlight(text: string | undefined | null, q: string): React.ReactNode {
    if (!text) return null;
    if (!q) return text;
    // Escape regex special characters
    const esc = q.replace(/[.*+?^${}()|[\]\\/+^]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const parts = text.split(re);
    return (
        <>
            {parts.map((p, i) =>
                re.test(p) ? (
                    <mark
                        key={i}
                        className="px-0.5 rounded bg-yellow-300/30 text-yellow-200"
                    >
                        {p}
                    </mark>
                ) : (
                    <span key={i}>{p}</span>
                )
            )}
        </>
    );
}