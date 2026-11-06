import { NextResponse, after } from "next/server";
import { verifyWebhook, getDispute } from "@/lib/paypal";
import { upsertDispute, runAssessment } from "@/lib/disputes";

// PayPal webhook receiver: CUSTOMER.DISPUTE.CREATED / UPDATED / RESOLVED
export async function POST(req: Request) {
  const raw = await req.text();
  const verified = await verifyWebhook(req.headers, raw).catch(() => false);
  if (!verified && process.env.PAYPAL_WEBHOOK_SKIP_VERIFY !== "true") {
    return NextResponse.json({ error: "signature verification failed" }, { status: 401 });
  }
  const event = JSON.parse(raw) as { event_type: string; resource: { dispute_id?: string } };
  const id = event.resource?.dispute_id;
  if (event.event_type.startsWith("CUSTOMER.DISPUTE.") && id) {
    after(async () => {
      const dispute = await getDispute(id).catch(() => undefined);
      if (!dispute) return;
      const isNew = upsertDispute(dispute);
      if (isNew) await runAssessment(id);
    });
  }
  return NextResponse.json({ received: true });
}
