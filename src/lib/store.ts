// Tiny JSON-file store. Good enough for a single-seller demo; swap for Postgres later.
import fs from "fs";
import path from "path";
import type { PayPalDispute, Money } from "./paypal";

const FILE = process.env.DATA_FILE ?? path.join(process.cwd(), "data", "db.json");

export type PurchaseIntent = {
  id: string;
  userRequest: string; // exactly what the human asked the buyer agent for
  budget?: Money;
  constraints: string[]; // e.g. ["size M", "colour blue"]
  chosenSku: string;
  agentReasoning: string;
  approvedByHumanAt?: string;
  complaint?: string; // what the human told their agent went wrong (shared in negotiation)
  createdAt: string;
};

export type Order = {
  id: string; // PayPal order id
  captureId?: string;
  sku: string;
  itemName: string;
  amount: Money;
  buyerEmail?: string;
  status: "CREATED" | "PAID" | "SHIPPED" | "DELIVERED";
  intentId?: string;
  tracking?: { number: string; carrier: string; addedAt: string; pushedToPayPal: boolean };
  createdAt: string;
};

export type Assessment = {
  category: string;
  summary: string;
  winProbability: number; // 0..1
  sellerProtectionEligible: boolean;
  recommendedAction: "FIGHT" | "SETTLE" | "ACCEPT";
  suggestedOffer?: { type: string; amount: string };
  evidenceNotes?: string;
  reasoning: string;
  riskFlags: string[];
  createdAt: string;
};

export type NegotiationTurn = {
  from: "SELLER_AGENT" | "BUYER_AGENT";
  action: "OFFER" | "COUNTER" | "ACCEPT" | "REJECT";
  offerType?: string;
  amount?: string;
  message: string;
  at: string;
};

export type Negotiation = {
  status: "RUNNING" | "AGREED" | "FAILED";
  turns: NegotiationTurn[];
  agreed?: { offerType: string; amount: string; note: string };
};

export type ActionLog = { at: string; actor: string; action: string; detail?: string; ok: boolean };

export type Dispute = {
  id: string;
  orderId?: string;
  paypal: PayPalDispute;
  assessment?: Assessment;
  negotiation?: Negotiation;
  log: ActionLog[];
  resolvedAt?: string;
  updatedAt: string;
};

type DB = {
  orders: Record<string, Order>;
  intents: Record<string, PurchaseIntent>;
  disputes: Record<string, Dispute>;
};

function load(): DB {
  try {
    return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ FILE, "utf8")) as DB;
  } catch {
    return { orders: {}, intents: {}, disputes: {} };
  }
}

function save(db: DB) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function read(): DB {
  return load();
}

export function update<T>(fn: (db: DB) => T): T {
  const db = load();
  const out = fn(db);
  save(db);
  return out;
}

export function now() {
  return new Date().toISOString();
}

export function logAction(disputeId: string, entry: Omit<ActionLog, "at">) {
  update((db) => {
    const d = db.disputes[disputeId];
    if (d) {
      d.log.push({ at: now(), ...entry });
      d.updatedAt = now();
    }
  });
}

/** Find our order behind a PayPal dispute (custom_id carries our intent id, transaction id = capture id). */
export function findOrderForDispute(db: DB, d: PayPalDispute): Order | undefined {
  const txns = d.disputed_transactions ?? [];
  for (const t of txns) {
    const byCapture = Object.values(db.orders).find((o) => o.captureId && o.captureId === t.seller_transaction_id);
    if (byCapture) return byCapture;
    const byCustom = Object.values(db.orders).find((o) => o.intentId && o.intentId === t.custom);
    if (byCustom) return byCustom;
  }
  return undefined;
}
