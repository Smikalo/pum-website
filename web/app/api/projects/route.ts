// web/app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/config";

// Proxy GET /api/projects -> backend API /api/projects
export async function GET(req: NextRequest) {
    const search = req.nextUrl.search || "";
    const url = `${API_BASE}/api/projects${search}`;

    try {
        const res = await fetch(url, {
            // Projects are public; we don't forward auth cookies here
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log("[api/projects] proxied request", {
                url,
                status: res.status,
            });
        }

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[api/projects] proxy error", {
            url,
            apiBase: API_BASE,
            error: err,
        });

        return NextResponse.json(
            { error: "Failed to load projects" },
            { status: 500 },
        );
    }
}
