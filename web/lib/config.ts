// web/lib/config.ts
// Prefer runtime env, then fall back to the Compose service name used in dev.
export const API_BASE =
    (process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE) ?? "http://api-dev:3001";
