"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import type { Order, PurchaseIntent } from "@/lib/store";
import { Badge, Reveal, Typing, ease, spring } from "@/components/ui";
import { IconBag, IconSend, IconCheck } from "@/components/icons";

type Msg = { id: number; from: "me" | "agent"; text: string };
type Pending = { orderId: string; intent: PurchaseIntent };

const SUGGESTIONS = [
  "Buy me a blue hoodie in size M, under $40",
  "A plain white tee, medium",
  "Denim jacket in M, budget $70",
];

export default function ShopPage() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [intents, setIntents] = useState<Record<string, PurchaseIntent>>({});
  const nextId = useRef(0);

  const push = (from: Msg["from"], text: string) => setMsgs((m) => [...m, { id: nextId.current++, from, text }]);

  async function refresh() {
    const s = await fetch("/api/state").then((r) => r.json());
    setOrders((s.orders as Order[]).filter((o) => o.intentId && o.status !== "CREATED"));
    setIntents(s.intents);
  }

  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((c) => setClientId(c.paypalClientId));
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, []);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    push("me", text);
    setInput("");
    setBusy(true);
    setPending(null);
    try {
      const res = await fetch("/api/buyer/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      push("agent", res.reply);
      if (res.paypalOrderId && res.intent) setPending({ orderId: res.paypalOrderId, intent: res.intent });
    } catch (e) {
      push("agent", `Something went wrong: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 28 }}>
      <Reveal>
        <div className="stack" style={{ gap: 8 }}>
          <span className="tiny">Buyer agent</span>
          <h1>Your shopping agent</h1>
          <p className="muted" style={{ maxWidth: 640 }}>
            Say what you want. It finds the item, prepares a PayPal checkout and records exactly what you asked for.
            You approve the payment in PayPal; the agent never sees your credentials.
          </p>
        </div>
      </Reveal>

      <div className="split-wide">
        <Reveal delay={0.05}>
          <div className="neu pad-lg stack" style={{ gap: 18 }}>
            <div className="chat">
              {msgs.length === 0 && !busy && (
                <div className="stack" style={{ alignItems: "center", textAlign: "center", padding: "28px 8px", gap: 14 }}>
                  <span className="icon-tile yellow"><IconBag size={22} /></span>
                  <p className="muted">What can I buy for you today?</p>
                  <div className="row" style={{ justifyContent: "center" }}>
                    {SUGGESTIONS.map((s) => (
                      <button key={s} className="btn btn-sm" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {msgs.map((m) => (
                  <motion.div
                    key={m.id}
                    className={`bubble ${m.from}`}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={spring}
                    style={{ transformOrigin: m.from === "me" ? "bottom right" : "bottom left" }}
                  >
                    {m.text}
                  </motion.div>
                ))}
                {busy && (
                  <motion.div key="typing" className="bubble agent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Typing />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {pending && (
                <motion.div
                  key={pending.orderId}
                  className="neu pad stack"
                  style={{ gap: 14, borderRadius: 20 }}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.6, ease }}
                >
                  <IntentView intent={pending.intent} />
                  {clientId ? (
                    <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "capture" }}>
                      <PayPalButtons
                        style={{ layout: "horizontal", tagline: false, height: 44, shape: "pill" }}
                        createOrder={async () => pending.orderId}
                        onApprove={async (data) => {
                          const r = await fetch("/api/orders/capture", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orderId: data.orderID }),
                          }).then((x) => x.json());
                          push("agent", r.error ? `Payment failed: ${r.error}` : "Paid with PayPal. I've saved the purchase-intent record with this order.");
                          setPending(null);
                          refresh();
                        }}
                      />
                    </PayPalScriptProvider>
                  ) : (
                    <span className="muted small">Set PAYPAL_CLIENT_ID to show the PayPal button.</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="composer">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask your agent to buy something…"
                aria-label="Message your shopping agent"
              />
              <button className="btn btn-primary btn-icon" onClick={() => send()} disabled={busy || !input.trim()} aria-label="Send">
                <IconSend />
              </button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="stack" style={{ gap: 14 }}>
            <div className="row between">
              <h2>Orders your agent made</h2>
              <Badge>{orders.length}</Badge>
            </div>
            {orders.length === 0 && (
              <div className="neu pad muted small">No orders yet. Paid orders show up here with their purchase-intent record.</div>
            )}
            <AnimatePresence>
              {orders.map((o) => (
                <motion.div key={o.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
                  <OrderCard order={o} intent={o.intentId ? intents[o.intentId] : undefined} onSaved={refresh} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function IntentView({ intent }: { intent: PurchaseIntent }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row between">
        <Badge tone="info" dot>Purchase intent</Badge>
        <span className="faint small mono">{intent.id}</span>
      </div>
      <p style={{ fontSize: 15 }}>“{intent.userRequest}”</p>
      <div className="row" style={{ gap: 6 }}>
        {intent.constraints.map((c) => <Badge key={c}>{c}</Badge>)}
      </div>
      <p className="small muted">{intent.agentReasoning}</p>
    </div>
  );
}

const STATUS_TONE: Record<Order["status"], "neutral" | "info" | "good" | "warn"> = {
  CREATED: "neutral",
  PAID: "info",
  SHIPPED: "warn",
  DELIVERED: "good",
};

function OrderCard({ order, intent, onSaved }: { order: Order; intent?: PurchaseIntent; onSaved: () => void }) {
  const [complaint, setComplaint] = useState(intent?.complaint ?? "");
  const [saved, setSaved] = useState(Boolean(intent?.complaint));

  async function save() {
    await fetch("/api/buyer/complaint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intentId: intent?.id, complaint }),
    });
    setSaved(true);
    onSaved();
  }

  return (
    <div className="neu pad stack" style={{ gap: 14 }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 15.5 }}>{order.itemName}</h3>
          <span className="small faint mono">${order.amount.value} · {order.id}</span>
        </div>
        <Badge tone={STATUS_TONE[order.status]} dot>{order.status.toLowerCase()}</Badge>
      </div>
      {order.tracking && <span className="small muted mono">{order.tracking.carrier} {order.tracking.number}</span>}
      {intent && (
        <details>
          <summary className="disclosure">Purchase intent</summary>
          <div style={{ marginTop: 10 }}><IntentView intent={intent} /></div>
        </details>
      )}
      <div className="stack" style={{ gap: 8 }}>
        <span className="small"><b>Something wrong?</b> <span className="muted">Your agent uses this when it negotiates with the seller.</span></span>
        <textarea
          className="field"
          rows={2}
          value={complaint}
          onChange={(e) => { setComplaint(e.target.value); setSaved(false); }}
          placeholder="e.g. It's too small. I usually wear M but this fits like an S."
        />
        <div className="row">
          <button className="btn btn-sm" onClick={save} disabled={!complaint.trim() || saved}>
            {saved ? <><IconCheck size={15} /> Saved</> : "Tell my agent"}
          </button>
        </div>
        <AnimatePresence>
          {saved && (
            <motion.p className="small muted" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease }}>
              Next, open a dispute for transaction <span className="mono">{order.captureId}</span> in the{" "}
              <a href="https://www.sandbox.paypal.com/resolutioncenter" target="_blank" rel="noreferrer">PayPal sandbox Resolution Center</a>.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
