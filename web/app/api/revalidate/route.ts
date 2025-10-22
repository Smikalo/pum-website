import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const { secret, path } = await req.json();
  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok:false }, { status: 401 });
  }
  if (typeof path === "string") revalidatePath(path);
  return NextResponse.json({ ok:true, now: Date.now() });
}
