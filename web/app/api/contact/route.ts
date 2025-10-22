import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const api = process.env.API_BASE || "http://api:3001";
  const res = await fetch(`${api}/api/contact`, { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
