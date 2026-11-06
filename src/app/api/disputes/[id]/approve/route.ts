import { NextResponse } from "next/server";
import { executeDecision, type Decision } from "@/lib/disputes";
import { fail } from "@/lib/http";

// The human-in-the-loop gate: nothing that moves money runs without this call.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { decision } = (await req.json()) as { decision: Decision };
    if (!["SETTLE", "FIGHT", "ACCEPT"].includes(decision)) {
      return NextResponse.json({ error: "decision must be SETTLE, FIGHT or ACCEPT" }, { status: 400 });
    }
    await executeDecision(id, decision);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
