import * as pp from "./paypal";
import { read, update, now, logAction, findOrderForDispute } from "./store";
import { assessDispute } from "./agents/seller";
import { negotiate } from "./agents/negotiation";
import { humanize, offerText } from "./format";

// Prevents the webhook and the poller from running the same agent twice at once.
const running = new Set<string>();

export function busy(id: string) {
  return running.has(id);
}

async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (running.has(key)) return undefined;
  running.add(key);
  try {
    return await fn();
  } finally {
    running.delete(key);
  }
}

/** Insert or refresh a dispute from PayPal. Returns true if it is new to us. */
export function upsertDispute(d: pp.PayPalDispute): boolean {
  return update((db) => {
    const existing = db.disputes[d.dispute_id];
    if (existing) {
      existing.paypal = { ...existing.paypal, ...d };
      existing.updatedAt = now();
      return false;
    }
    const order = findOrderForDispute(db, d);
    db.disputes[d.dispute_id] = {
      id: d.dispute_id,
      orderId: order?.id,
      paypal: d,
      log: [{ at: now(), actor: "PayPal", action: `Dispute opened: ${humanize(d.reason)}`, ok: true }],
      updatedAt: now(),
    };
    return true;
  });
}

/** Pull every dispute from PayPal; new ones get full details and an AI assessment. */
export async function syncFromPayPal(): Promise<string[]> {
  const list = await pp.listDisputes();
  const fresh: string[] = [];
  for (const summary of list.items ?? []) {
    const full = await pp.getDispute(summary.dispute_id).catch(() => summary);
    if (upsertDispute(full)) fresh.push(full.dispute_id);
  }
  return fresh;
}

export async function runAssessment(id: string) {
  return exclusive(`assess:${id}`, async () => {
    try {
      return await assessDispute(id);
    } catch (e) {
      logAction(id, { actor: "Seller agent", action: "Assessment failed", detail: String(e), ok: false });
    }
  });
}

export async function runNegotiation(id: string) {
  return exclusive(`negotiate:${id}`, async () => {
    try {
      return await negotiate(id);
    } catch (e) {
      logAction(id, { actor: "Agents", action: "Negotiation failed", detail: String(e), ok: false });
    }
  });
}

export type Decision = "SETTLE" | "FIGHT" | "ACCEPT";

/** Executes the seller-approved action against PayPal. The only place money-moving calls happen. */
export async function executeDecision(id: string, decision: Decision) {
  const db = read();
  const d = db.disputes[id];
  if (!d) throw new Error("Unknown dispute");
  const order = d.orderId ? db.orders[d.orderId] : undefined;
  const a = d.assessment;

  try {
    if (decision === "SETTLE") {
      const agreed = d.negotiation?.agreed;
      const offerType = (agreed?.offerType ?? a?.suggestedOffer?.type ?? "REFUND") as pp.OfferType;
      const amount = agreed?.amount ?? a?.suggestedOffer?.amount;
      if (!amount) throw new Error("No settlement amount — run the assessment or negotiation first");
      await pp.makeOffer(id, {
        note: agreed?.note ?? `We'd like to resolve this quickly: ${offerType} of $${amount}.`,
        amount: { currency_code: d.paypal.dispute_amount.currency_code, value: amount },
        offerType,
      });
      logAction(id, { actor: "Seller", action: "Approved, offer sent to PayPal", detail: offerText(offerType, amount), ok: true });
    } else if (decision === "FIGHT") {
      const notes = a?.evidenceNotes ?? a?.reasoning ?? "Seller disputes this claim.";
      await pp.provideEvidence(id, { notes, trackingNumber: order?.tracking?.number, carrier: order?.tracking?.carrier });
      logAction(id, { actor: "Seller", action: "Approved, evidence submitted to PayPal", detail: notes.slice(0, 200), ok: true });
    } else {
      await pp.acceptClaim(id, "Seller accepts the claim. Sorry for the trouble.");
      logAction(id, { actor: "Seller", action: "Approved, claim accepted and buyer refunded", ok: true });
    }
  } catch (e) {
    logAction(id, { actor: "PayPal", action: `PayPal rejected the ${humanize(decision)} action`, detail: String(e), ok: false });
    throw e;
  }
  // Refresh state from PayPal
  const fresh = await pp.getDispute(id).catch(() => undefined);
  if (fresh) upsertDispute(fresh);
}
