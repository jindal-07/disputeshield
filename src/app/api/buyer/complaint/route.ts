import { NextResponse } from "next/server";
import { update } from "@/lib/store";

// The human tells their shopping agent what went wrong; the agent carries this into negotiation.
export async function POST(req: Request) {
  const { intentId, complaint } = (await req.json()) as { intentId: string; complaint: string };
  const ok = update((db) => {
    const intent = db.intents[intentId];
    if (!intent) return false;
    intent.complaint = complaint.slice(0, 1000);
    return true;
  });
  return ok ? NextResponse.json({ ok }) : NextResponse.json({ error: "Unknown intent" }, { status: 404 });
}
