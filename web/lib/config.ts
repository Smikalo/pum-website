// web/lib/config.ts
// Prefer NEXT_PUBLIC_API_BASE when provided; else assume API on port 3001 next to the web app.
export const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : "http://localhost:3001");
