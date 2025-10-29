// web/app/api/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/config";

/** GET /api/members — simply proxy the backend. */
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const qs = url.search ? url.search : "";
    const res = await fetch(new URL(`/api/members${qs}`, API_BASE).toString(), {
        cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
}
