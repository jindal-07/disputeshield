// Thin, typed wrapper around the PayPal REST APIs DisputeShield uses.
// Everything runs against the PayPal sandbox unless PAYPAL_ENV=live.

const BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    public endpoint: string,
  ) {
    super(`PayPal ${status} on ${endpoint}: ${JSON.stringify(body)}`);
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set (see .env.example)");
  }
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await res.json();
  if (!res.ok) throw new PayPalError(res.status, body, "/v1/oauth2/token");
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

type Init = { method?: string; json?: unknown; form?: FormData; headers?: Record<string, string> };

export async function paypal<T = Record<string, unknown>>(path: string, init: Init = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, ...init.headers };
  let body: BodyInit | undefined;
  if (init.form) {
    body = init.form; // fetch sets the multipart boundary itself
  } else if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${BASE}${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
  const text = await res.text();
  const parsed = text ? safeJson(text) : {};
  if (!res.ok) throw new PayPalError(res.status, parsed, path);
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---------- Orders v2 ----------

export type Money = { currency_code: string; value: string };

export function createOrder(args: { amount: Money; description: string; sku: string; customId: string }) {
  return paypal<{ id: string; status: string }>("/v2/checkout/orders", {
    json: {
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: args.customId,
          description: args.description.slice(0, 127),
          amount: {
            ...args.amount,
            breakdown: { item_total: args.amount },
          },
          items: [
            {
              name: args.description.slice(0, 127),
              sku: args.sku,
              quantity: "1",
              unit_amount: args.amount,
              category: "PHYSICAL_GOODS",
            },
          ],
        },
      ],
    },
  });
}

export function captureOrder(orderId: string) {
  return paypal<CapturedOrder>(`/v2/checkout/orders/${orderId}/capture`, { json: {} });
}

export function getOrder(orderId: string) {
  return paypal<CapturedOrder>(`/v2/checkout/orders/${orderId}`);
}

export type CapturedOrder = {
  id: string;
  status: string;
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  purchase_units: {
    custom_id?: string;
    payments?: { captures?: { id: string; status: string; amount: Money }[] };
  }[];
};

// ---------- Tracking (Orders v2 track endpoint) ----------

export function addTracking(args: { orderId: string; captureId: string; trackingNumber: string; carrier: string }) {
  return paypal(`/v2/checkout/orders/${args.orderId}/track`, {
    json: {
      capture_id: args.captureId,
      tracking_number: args.trackingNumber,
      carrier: args.carrier,
      notify_payer: false,
    },
  });
}

// ---------- Disputes v1 ----------

export type PayPalDispute = {
  dispute_id: string;
  create_time: string;
  update_time: string;
  reason: string;
  status: string;
  dispute_state?: string;
  dispute_amount: Money;
  dispute_life_cycle_stage?: string;
  dispute_channel?: string;
  seller_response_due_date?: string;
  buyer_response_due_date?: string;
  disputed_transactions?: {
    seller_transaction_id?: string;
    buyer_transaction_id?: string;
    gross_amount?: Money;
    custom?: string;
    items?: { item_id?: string; item_name?: string; item_description?: string; item_quantity?: string; reason?: string; notes?: string }[];
    seller_protection_eligible?: boolean;
    seller_protection_type?: string;
  }[];
  evidences?: { evidence_type: string; notes?: string; source?: string; date?: string }[];
  messages?: { posted_by: string; time_posted: string; content: string }[];
  offer?: unknown;
  dispute_outcome?: { outcome_code: string; amount_refunded?: Money };
  links?: { href: string; rel: string; method: string }[];
};

/**
 * Lists disputes from the last 179 days (buyers can dispute up to 180 days after payment;
 * PayPal rejects a start_time of 180+ days with INVALID_START_TIME_RANGE).
 * PayPal's list endpoint omits some disputes (e.g. ones under PayPal review) unless
 * start_time is passed explicitly, so always send it.
 */
export async function listDisputes() {
  const since = new Date(Date.now() - 179 * 86400_000).toISOString();
  const items: PayPalDispute[] = [];
  let path: string | null = `/v1/customer/disputes?page_size=50&start_time=${encodeURIComponent(since)}`;
  for (let page = 0; path && page < 10; page++) {
    const res: { items?: PayPalDispute[]; links?: { rel: string; href: string }[] } = await paypal(path);
    items.push(...(res.items ?? []));
    const next = res.links?.find((l) => l.rel === "next")?.href;
    path = next ? next.replace(BASE, "") : null;
  }
  return { items };
}

/** The POST actions PayPal currently allows on a dispute (e.g. "make_offer", "provide_evidence"). */
export function allowedActions(d: PayPalDispute): string[] {
  return (d.links ?? []).filter((l) => l.method === "POST").map((l) => l.rel);
}

export function getDispute(id: string) {
  return paypal<PayPalDispute>(`/v1/customer/disputes/${id}`);
}

export function sendDisputeMessage(id: string, message: string) {
  // send-message expects multipart/form-data with a JSON "input" part
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify({ message: message.slice(0, 2000) })], { type: "application/json" }));
  return paypal(`/v1/customer/disputes/${id}/send-message`, { form });
}

export type OfferType = "REFUND" | "REFUND_WITH_RETURN" | "REFUND_WITH_REPLACEMENT" | "REPLACEMENT_WITHOUT_REFUND";

export function makeOffer(id: string, args: { note: string; amount: Money; offerType: OfferType }) {
  return paypal(`/v1/customer/disputes/${id}/make-offer`, {
    json: {
      note: args.note.slice(0, 2000),
      offer_amount: args.amount,
      offer_type: args.offerType,
    },
  });
}

export function acceptClaim(id: string, note: string) {
  return paypal(`/v1/customer/disputes/${id}/accept-claim`, { json: { note: note.slice(0, 2000) } });
}

export function provideEvidence(
  id: string,
  args: { notes: string; trackingNumber?: string; carrier?: string },
) {
  const evidence: Record<string, unknown> = {
    evidence_type: args.trackingNumber ? "PROOF_OF_FULFILLMENT" : "OTHER",
    notes: args.notes.slice(0, 2000),
  };
  if (args.trackingNumber) {
    evidence.evidence_info = {
      tracking_info: [{ carrier_name: args.carrier ?? "OTHER", tracking_number: args.trackingNumber }],
    };
  }
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify({ evidences: [evidence] })], { type: "application/json" }));
  return paypal(`/v1/customer/disputes/${id}/provide-evidence`, { form });
}

// Sandbox-only helpers to walk a dispute through its lifecycle for demos
export function sandboxRequireEvidence(id: string, action: "BUYER_EVIDENCE" | "SELLER_EVIDENCE") {
  return paypal(`/v1/customer/disputes/${id}/require-evidence`, { json: { action } });
}

export function sandboxAdjudicate(id: string, outcome: "BUYER_FAVOR" | "SELLER_FAVOR") {
  return paypal(`/v1/customer/disputes/${id}/adjudicate`, { json: { adjudication_outcome: outcome } });
}

// ---------- Webhooks ----------

export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const res = await paypal<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    json: {
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    },
  });
  return res.verification_status === "SUCCESS";
}

export const paypalBase = BASE;
