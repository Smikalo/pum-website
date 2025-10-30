// web/lib/config.ts
export const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ||
    (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : "http://localhost:3001");
