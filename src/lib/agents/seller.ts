// Seller agent: investigates a PayPal dispute with read-only tools, then files a structured assessment.
// It never moves money on its own — actions run only after the seller clicks Approve.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claude, baseParams } from "../ai";
import * as pp from "../paypal";
import { read, update, now, findOrderForDispute, logAction, type Assessment } from "../store";
import { getProduct, SHOP_NAME } from "../catalog";
import { sellerHealth } from "../health";

const SYSTEM = `You are DisputeShield, the dispute-defence agent for "${SHOP_NAME}", a small online apparel shop that takes payments through PayPal.

When a dispute arrives, investigate it with your tools before deciding anything:
1. Read the PayPal dispute (reason, amount, buyer messages, deadlines).
2. Read the order, its tracking, and the product listing the buyer saw.
3. If the purchase was made by a buyer's AI shopping agent, read its purchase-intent record: it says what the human actually asked for.
4. Check the shop's dispute health.

Then call submit_assessment exactly once. Decide between:
- FIGHT: the seller has strong evidence (e.g. "item not received" but tracking shows delivery; item matches the listing exactly). Write the evidence notes PayPal will read: factual, specific, under 1500 characters.
- SETTLE: the buyer has a partly fair point (e.g. listing said "runs small" but the agent bought the usual size). Propose a PayPal offer type and amount that keeps the customer and avoids escalation to a claim.
- ACCEPT: fighting costs more than the order is worth, or the seller is clearly at fault.

Rules: Seller Protection for "item not received" needs tracking showing delivery to the buyer's address. Every escalated dispute raises the shop's dispute ratio; above roughly 1% PayPal may review the account and hold funds. Be honest about weak cases — a wrong FIGHT costs the seller more than a fair settlement. Amounts are USD strings like "12.00".`;

export async function assessDispute(disputeId: string): Promise<Assessment> {
  let result: Assessment | null = null;

  const getDispute = betaZodTool({
    name: "get_dispute",
    description: "Fetch the live PayPal dispute: reason, status, amount, buyer messages, response deadline.",
    inputSchema: z.object({}),
    run: async () => {
      const d = await pp.getDispute(disputeId);
      update((db) => {
        if (db.disputes[disputeId]) db.disputes[disputeId].paypal = d;
      });
      return JSON.stringify(trimDispute(d));
    },
  });

  const getOrder = betaZodTool({
    name: "get_order_and_tracking",
    description: "Look up the shop's order behind this dispute, including PayPal capture status and shipment tracking.",
    inputSchema: z.object({}),
    run: async () => {
      const db = read();
      const order = findOrderForDispute(db, db.disputes[disputeId].paypal);
      if (!order) return "No matching order found in the shop's records (the sale may predate DisputeShield).";
      let paypalStatus: string | undefined;
      try {
        paypalStatus = (await pp.getOrder(order.id)).status;
      } catch {
        paypalStatus = "unavailable";
      }
      return JSON.stringify({ ...order, paypalOrderStatus: paypalStatus });
    },
  });

  const getListing = betaZodTool({
    name: "get_listing",
    description: "Return the product listing exactly as the buyer saw it.",
    inputSchema: z.object({ sku: z.string() }),
    run: async ({ sku }) => JSON.stringify(getProduct(sku) ?? { error: "unknown sku" }),
  });

  const getIntent = betaZodTool({
    name: "get_purchase_intent",
    description:
      "If a buyer's AI shopping agent made this purchase, return its signed purchase-intent record (what the human asked for, budget, constraints, the agent's reasoning). Shared over the Agent Dispute Protocol.",
    inputSchema: z.object({}),
    run: async () => {
      const db = read();
      const order = findOrderForDispute(db, db.disputes[disputeId].paypal);
      const intent = order?.intentId ? db.intents[order.intentId] : undefined;
      return intent ? JSON.stringify(intent) : "No purchase-intent record: this was a regular human checkout.";
    },
  });

  const getHealth = betaZodTool({
    name: "get_shop_health",
    description: "The shop's dispute ratio, open disputes and how close it is to PayPal's risk-review thresholds.",
    inputSchema: z.object({}),
    run: async () => JSON.stringify(sellerHealth()),
  });

  const submit = betaZodTool({
    name: "submit_assessment",
    description: "File the final assessment. Call exactly once, after investigating.",
    inputSchema: z.object({
      category: z.string().describe("Plain-language dispute type, e.g. 'Wrong size (agent purchase)'"),
      summary: z.string().describe("One or two sentences a busy seller can read in five seconds"),
      winProbability: z.number().min(0).max(1).describe("Chance the seller wins if the dispute is fought"),
      sellerProtectionEligible: z.boolean(),
      recommendedAction: z.enum(["FIGHT", "SETTLE", "ACCEPT"]),
      suggestedOffer: z
        .object({
          type: z.enum(["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"]),
          amount: z.string(),
        })
        .optional()
        .describe("Required when recommendedAction is SETTLE"),
      evidenceNotes: z.string().optional().describe("Required when recommendedAction is FIGHT"),
      reasoning: z.string().describe("Why this action, citing the evidence you found"),
      riskFlags: z.array(z.string()).describe("Short flags, e.g. 'No tracking uploaded', 'Agent ignored size note'"),
    }),
    run: async (input) => {
      result = { ...input, createdAt: now() };
      return "Assessment recorded.";
    },
  });

  const d = read().disputes[disputeId];
  await claude().beta.messages.toolRunner({
    ...baseParams(),
    system: SYSTEM,
    tools: [getDispute, getOrder, getListing, getIntent, getHealth, submit],
    messages: [
      {
        role: "user",
        content: `New PayPal dispute ${disputeId} (${d.paypal.reason}, ${d.paypal.dispute_amount.value} ${d.paypal.dispute_amount.currency_code}). Investigate and submit your assessment.`,
      },
    ],
    max_iterations: 12,
  } as Parameters<ReturnType<typeof claude>["beta"]["messages"]["toolRunner"]>[0]);

  if (!result) throw new Error("Seller agent finished without submitting an assessment");
  const assessment: Assessment = result;
  update((db) => {
    db.disputes[disputeId].assessment = assessment;
    db.disputes[disputeId].updatedAt = now();
  });
  logAction(disputeId, {
    actor: "Seller agent",
    action: `Assessed: ${assessment.recommendedAction}`,
    detail: assessment.summary,
    ok: true,
  });
  return assessment;
}

/** Keep the model's context small: drop HATEOAS links and other noise. */
export function trimDispute(d: pp.PayPalDispute) {
  return {
    dispute_id: d.dispute_id,
    reason: d.reason,
    status: d.status,
    stage: d.dispute_life_cycle_stage,
    channel: d.dispute_channel,
    amount: d.dispute_amount,
    created: d.create_time,
    seller_response_due_date: d.seller_response_due_date,
    transactions: d.disputed_transactions?.map((t) => ({
      seller_transaction_id: t.seller_transaction_id,
      gross_amount: t.gross_amount,
      items: t.items,
    })),
    messages: d.messages,
    outcome: d.dispute_outcome,
  };
}
