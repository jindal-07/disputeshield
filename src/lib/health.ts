import { read } from "./store";

// Illustrative figures for the dashboard. PayPal's actual dispute fees vary by country and account;
// set DISPUTE_FEE_USD to match the seller's fee schedule.
const DISPUTE_FEE = Number(process.env.DISPUTE_FEE_USD ?? "15");
const REVIEW_THRESHOLD = 0.01; // ~1% dispute ratio is where processors start paying attention

export function sellerHealth() {
  const db = read();
  const orders = Object.values(db.orders).filter((o) => o.status !== "CREATED");
  const disputes = Object.values(db.disputes);
  const open = disputes.filter((d) => !isClosed(d.paypal.status));
  const settledEarly = disputes.filter(
    (d) => d.negotiation?.status === "AGREED" && d.paypal.dispute_life_cycle_stage !== "CHARGEBACK",
  );
  const won = disputes.filter((d) => d.paypal.dispute_outcome?.outcome_code === "RESOLVED_SELLER_FAVOUR");
  const ratio = orders.length ? disputes.length / orders.length : 0;

  return {
    orders: orders.length,
    disputes: disputes.length,
    openDisputes: open.length,
    disputeRatio: ratio,
    reviewThreshold: REVIEW_THRESHOLD,
    riskLevel: ratio >= REVIEW_THRESHOLD * 1.5 ? "HIGH" : ratio >= REVIEW_THRESHOLD ? "ELEVATED" : "OK",
    settledBeforeEscalation: settledEarly.length,
    estimatedFeesAvoided: settledEarly.length * DISPUTE_FEE,
    wonCount: won.length,
    revenueProtected: won.reduce((s, d) => s + Number(d.paypal.dispute_amount.value), 0),
    nextDeadline: open
      .map((d) => d.paypal.seller_response_due_date)
      .filter(Boolean)
      .sort()[0],
  };
}

export function isClosed(status: string) {
  return status === "RESOLVED" || status === "CLOSED";
}
