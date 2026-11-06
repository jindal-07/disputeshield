import { NextResponse } from "next/server";
import { addTracking } from "@/lib/paypal";
import { read, update, now } from "@/lib/store";
import { fail } from "@/lib/http";

// Seller ships the order: tracking is pushed to PayPal (required for Seller Protection).
// For the demo, "delivered: true" marks the parcel as delivered.
export async function POST(req: Request) {
  try {
    const { orderId, delivered } = (await req.json()) as { orderId: string; delivered?: boolean };
    const order = read().orders[orderId];
    if (!order?.captureId) return NextResponse.json({ error: "Order is not paid yet" }, { status: 400 });

    if (delivered) {
      update((db) => {
        db.orders[orderId].status = "DELIVERED";
      });
      return NextResponse.json({ ok: true });
    }

    const trackingNumber = `9400${Math.floor(Math.random() * 1e16).toString().padStart(16, "0")}`;
    const carrier = "USPS";
    let pushed = true;
    try {
      await addTracking({ orderId, captureId: order.captureId, trackingNumber, carrier });
    } catch (e) {
      pushed = false;
      console.error("Tracking upload failed", e);
    }
    update((db) => {
      db.orders[orderId].status = "SHIPPED";
      db.orders[orderId].tracking = { number: trackingNumber, carrier, addedAt: now(), pushedToPayPal: pushed };
    });
    return NextResponse.json({ ok: true, trackingNumber, pushedToPayPal: pushed });
  } catch (e) {
    return fail(e);
  }
}
