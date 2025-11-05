// web/app/api/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/config";

// Proxy GET /api/projects -> backend API /api/projects
export async function GET(req: NextRequest) {
    try {
        // Preserve query string (e.g. ?size=999&page=1)
        const search = req.nextUrl.search || "";
        const url = `${API_BASE}/api/projects${search}`;

        const res = await fetch(url, {
            // We don’t forward cookies/credentials here – projects are public
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        // Surface a 500 so the caller can show "Could not load projects."
        console.error("[api/projects] proxy error", err);
        return NextResponse.json(
            { error: "Failed to load projects" },
            { status: 500 },
        );
    }
}
