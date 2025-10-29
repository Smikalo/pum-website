// web/app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "@/lib/config";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(new URL("/api/contact", API_BASE).toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
