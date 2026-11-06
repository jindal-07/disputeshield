import { NextResponse } from "next/server";
import { sandboxAdjudicate, sandboxRequireEvidence, getDispute } from "@/lib/paypal";
import { upsertDispute } from "@/lib/disputes";
import { logAction } from "@/lib/store";
import { fail } from "@/lib/http";

// Sandbox-only controls that play PayPal's role so a demo can show the full dispute lifecycle.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.PAYPAL_ENV === "live") return NextResponse.json({ error: "sandbox only" }, { status: 403 });
  try {
    const { id } = await params;
    const { action } = (await req.json()) as { action: "SELLER_FAVOR" | "BUYER_FAVOR" | "SELLER_EVIDENCE" | "BUYER_EVIDENCE" };
    if (action === "SELLER_FAVOR" || action === "BUYER_FAVOR") await sandboxAdjudicate(id, action);
    else await sandboxRequireEvidence(id, action);
    logAction(id, { actor: "PayPal (sandbox)", action: `Simulated: ${action}`, ok: true });
    upsertDispute(await getDispute(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
