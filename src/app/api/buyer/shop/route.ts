import { NextResponse } from "next/server";
import { shop } from "@/lib/agents/buyer";
import { fail } from "@/lib/http";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { request } = (await req.json()) as { request: string };
    if (!request?.trim()) return NextResponse.json({ error: "Tell the agent what to buy" }, { status: 400 });
    return NextResponse.json(await shop(request.trim().slice(0, 500)));
  } catch (e) {
    return fail(e);
  }
}
