// web/app/api/blogs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/config";

// Proxy GET /api/blogs -> backend API /api/blogs
export async function GET(req: NextRequest) {
    try {
        // Keep query string (?size=999&q=foo&tag=bar)
        const search = req.nextUrl.search || "";
        const url = `${API_BASE}/api/blogs${search}`;

        const res = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error("[api/blogs] proxy error", err);
        return NextResponse.json(
            { error: "Failed to load blogs" },
            { status: 500 },
        );
    }
}
