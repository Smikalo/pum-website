// web/lib/config.ts
/**
 * API_BASE for both browser and server.
 * - Browser: use NEXT_PUBLIC_API_BASE if provided, else same host on :3001
 * - Server (SSR): use API_BASE_INTERNAL (e.g. http://api:3001 in Docker) or API_BASE, else localhost:3001
 */
const isServer = typeof window === "undefined";

const PUBLIC = process.env.NEXT_PUBLIC_API_BASE;
const INTERNAL = process.env.API_BASE_INTERNAL || process.env.API_BASE;

export const API_BASE =
    isServer
        ? (INTERNAL || "http://localhost:3001")
        : (PUBLIC || `${window.location.protocol}//${window.location.hostname}:3001`);
export default API_BASE;
