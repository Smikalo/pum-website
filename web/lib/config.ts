// web/lib/config.ts
// Centralized configuration for how the frontend talks to the backend API.

export const isServer = typeof window === "undefined";

const PUBLIC = process.env.NEXT_PUBLIC_API_BASE;
const INTERNAL = process.env.API_BASE_INTERNAL ?? process.env.API_BASE;

/**
 * Base URL used by the web app to talk to the backend API.
 *
 * Resolution order:
 *   - Server (SSR / route handlers):
 *       API_BASE_INTERNAL -> API_BASE -> http://api:3001
 *   - Browser:
 *       NEXT_PUBLIC_API_BASE -> window.location.[protocol,hostname]:3001
 */
export const API_BASE: string = (() => {
    if (isServer) {
        // In Docker, API_BASE_INTERNAL should be http://api:3001
        const base = INTERNAL || "http://api:3001";
        return base.replace(/\/+$/, "");
    }

    if (PUBLIC) {
        return PUBLIC.replace(/\/+$/, "");
    }

    if (typeof window !== "undefined") {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:3001`;
    }

    return "http://localhost:3001";
})();

export default API_BASE;
