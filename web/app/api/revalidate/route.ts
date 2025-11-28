// web/app/api/revalidate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// This route is server-only. `REVALIDATE_SECRET` must NOT be prefixed with
// NEXT_PUBLIC_ so it never ends up in the client bundle.
export async function POST(req: NextRequest) {
  const { secret, path } = await req.json();

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (typeof path === "string") {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, now: Date.now() });
}
