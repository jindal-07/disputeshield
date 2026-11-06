// Agent Dispute Protocol (ADP) v0: the seller's agent and the buyer's shopping agent negotiate
// a settlement in a few structured turns. When the seller approves, one PayPal make-offer call sends
// the agreed terms with a summary of the negotiation, so PayPal holds the record. Nothing runs before approval.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claude, baseParams } from "../ai";
import * as pp from "../paypal";
import { read, update, now, findOrderForDispute, logAction, type NegotiationTurn, type Negotiation } from "../store";
import { getProduct, SHOP_NAME } from "../catalog";
import { trimDispute } from "./seller";
import { offerText } from "../format";

const MAX_TURNS = 6;
const SELLER_MAX_REFUND_PCT = Number(process.env.SELLER_MAX_REFUND_PCT ?? "60");

const turnSchema = z.object({
  action: z.enum(["OFFER", "COUNTER", "ACCEPT", "REJECT"]),
  offerType: z
    .enum(["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"])
    .optional(),
  amount: z.string().optional().describe("USD amount as a string, e.g. '11.40'"),
  message: z.string().describe("Short, polite message to the other party (max 3 sentences)"),
});
type Turn = z.infer<typeof turnSchema>;

const SELLER_SYSTEM = `You are the seller-side agent for "${SHOP_NAME}", negotiating a PayPal dispute settlement with the buyer's AI shopping agent over the Agent Dispute Protocol.
Goal: resolve the dispute now, before it escalates to a PayPal claim, at a fair cost to the seller. Keep the customer happy where the seller shares fault.
Hard limit: never offer a refund above ${SELLER_MAX_REFUND_PCT}% of the order value without a return (REFUND_WITH_RETURN or REFUND_WITH_REPLACEMENT can go up to 100%).
Use the evidence: the listing text, the tracking, and the buyer agent's purchase-intent record. If the buyer's agent ignored something clearly stated in the listing, say so politely.
Reply by calling the respond tool exactly once.`;

const BUYER_SYSTEM = `You are a buyer's AI shopping agent. Earlier you bought an item for your human through PayPal; now there is a dispute and you are negotiating with the seller's agent over the Agent Dispute Protocol.
Represent your human honestly: use your own purchase-intent record and their complaint. Admit your own mistakes (e.g. if you missed a sizing note in the listing).
A fair, quick resolution is better for your human than a long PayPal claim. Accept reasonable offers; counter once or twice if an offer is clearly low.
Reply by calling the respond tool exactly once.`;

async function agentTurn(system: string, context: string): Promise<Turn> {
  let out: Turn | null = null;
  const respond = betaZodTool({
    name: "respond",
    description: "Send your negotiation move to the other agent.",
    inputSchema: turnSchema,
    run: async (input) => {
      out = input;
      return "Sent.";
    },
  });
  await claude().beta.messages.toolRunner({
    ...baseParams(),
    system,
    tools: [respond],
    messages: [{ role: "user", content: context }],
    max_iterations: 3,
  });
  if (!out) throw new Error("Agent did not respond");
  return out;
}

export async function negotiate(disputeId: string): Promise<Negotiation> {
  const db = read();
  const dispute = db.disputes[disputeId];
  if (!dispute) throw new Error("Unknown dispute");
  const order = findOrderForDispute(db, dispute.paypal);
  const intent = order?.intentId ? db.intents[order.intentId] : undefined;
  const listing = order ? getProduct(order.sku) : undefined;

  const negotiation: Negotiation = { status: "RUNNING", turns: [] };
  const save = () =>
    update((d) => {
      d.disputes[disputeId].negotiation = structuredClone(negotiation);
      d.disputes[disputeId].updatedAt = now();
    });
  save();

  const shared = JSON.stringify(
    {
      dispute: trimDispute(dispute.paypal),
      order,
      listing,
    },
    null,
    1,
  );
  const sellerPrivate = JSON.stringify({ sellerAssessment: dispute.assessment, purchaseIntent: intent }, null, 1);
  const buyerPrivate = JSON.stringify(
    { myPurchaseIntentRecord: intent, myHumansComplaint: intent?.complaint ?? latestBuyerMessage(dispute.paypal) },
    null,
    1,
  );

  const transcript = () =>
    negotiation.turns.length
      ? negotiation.turns
          .map((t) => `${t.from}: ${t.action}${t.amount ? ` ${t.offerType} $${t.amount}` : ""} — ${t.message}`)
          .join("\n")
      : "(no turns yet — you open)";

  let side: "SELLER_AGENT" | "BUYER_AGENT" = "SELLER_AGENT";
  for (let i = 0; i < MAX_TURNS; i++) {
    const turn =
      side === "SELLER_AGENT"
        ? await agentTurn(SELLER_SYSTEM, `Shared facts:\n${shared}\n\nYour private notes:\n${sellerPrivate}\n\nTranscript so far:\n${transcript()}\n\nYour move.`)
        : await agentTurn(BUYER_SYSTEM, `Shared facts:\n${shared}\n\nYour private notes:\n${buyerPrivate}\n\nTranscript so far:\n${transcript()}\n\nYour move.`);

    const last = negotiation.turns.at(-1);
    const entry: NegotiationTurn = {
      from: side,
      action: turn.action,
      // An ACCEPT locks in the other side's last offer
      offerType: turn.action === "ACCEPT" ? last?.offerType : turn.offerType,
      amount: turn.action === "ACCEPT" ? last?.amount : turn.amount,
      message: turn.message,
      at: now(),
    };
    negotiation.turns.push(entry);
    save();

    // Turns are NOT posted to PayPal one by one: a seller send-message flips the dispute to
    // "waiting for buyer", which blocks make-offer, and PayPal would attribute buyer-agent turns
    // to the seller. The agreed offer carries a summary of the negotiation instead (see note below).

    if (turn.action === "ACCEPT" && entry.amount && entry.offerType) {
      negotiation.status = "AGREED";
      negotiation.agreed = {
        offerType: entry.offerType,
        amount: entry.amount,
        note: settlementNote(negotiation.turns, entry.offerType, entry.amount),
      };
      break;
    }
    if (turn.action === "REJECT") {
      negotiation.status = "FAILED";
      break;
    }
    side = side === "SELLER_AGENT" ? "BUYER_AGENT" : "SELLER_AGENT";
  }
  if (negotiation.status === "RUNNING") negotiation.status = "FAILED";
  save();
  logAction(disputeId, {
    actor: "Agents",
    action: negotiation.status === "AGREED" ? "Settlement agreed, waiting for your approval" : "Negotiation ended without agreement",
    detail: negotiation.agreed ? offerText(negotiation.agreed.offerType, negotiation.agreed.amount) : undefined,
    ok: negotiation.status === "AGREED",
  });
  return negotiation;
}

/** The note sent with PayPal's make-offer: the agreed terms plus a compact record of how the agents got there. */
function settlementNote(turns: NegotiationTurn[], offerType: string, amount: string) {
  const who = (t: NegotiationTurn) => (t.from === "SELLER_AGENT" ? "Seller's agent" : "Buyer's agent");
  const steps = turns
    .map((t) => `${who(t)} ${t.action.toLowerCase()}${t.amount && t.action !== "REJECT" ? ` ${offerText(t.offerType ?? "", t.amount)}` : ""}`)
    .join("; ");
  const head = `As agreed with your shopping agent via DisputeShield: ${offerText(offerType, amount)}.`;
  const record = ` Negotiation record (${turns.length} turns): ${steps}.`;
  const closing = turns.at(-1)?.message ? ` Final message from ${who(turns.at(-1)!)}: "${turns.at(-1)!.message}"` : "";
  return (head + record + closing).slice(0, 2000);
}

function latestBuyerMessage(d: pp.PayPalDispute) {
  return d.messages?.filter((m) => m.posted_by === "BUYER").at(-1)?.content ?? d.reason;
}
