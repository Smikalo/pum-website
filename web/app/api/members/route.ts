import { NextResponse } from "next/server";
import { getAllMembersMerged } from "@/lib/members-merge";

/** GET /api/members — returns { items: MemberLite[] } for BC with existing callers. */
export async function GET() {
    const items = await getAllMembersMerged();
    return NextResponse.json({ items });
}
