import { NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";
import { update, now } from "@/lib/store";
import { fail } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const { orderId } = (await req.json()) as { orderId: string };
    const captured = await captureOrder(orderId);
    const capture = captured.purchase_units[0]?.payments?.captures?.[0];
    update((db) => {
      const o = db.orders[orderId];
      if (!o) return;
      o.status = "PAID";
      o.captureId = capture?.id;
      o.buyerEmail = captured.payer?.email_address;
      if (o.intentId && db.intents[o.intentId]) db.intents[o.intentId].approvedByHumanAt = now();
    });
    return NextResponse.json({ status: captured.status, captureId: capture?.id });
  } catch (e) {
    return fail(e);
  }
}
