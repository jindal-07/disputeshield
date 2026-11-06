"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import type { Dispute, Order } from "@/lib/store";
import type { sellerHealth } from "@/lib/health";
import { Badge, CountUp, Item, Reveal, Stagger, Typing, ease, spring } from "@/components/ui";
import { IconCheck, IconDoc, IconHandshake, IconRefresh, IconShield, IconTruck, IconX } from "@/components/icons";

ModuleRegistry.registerModules([AllCommunityModule]);

// Translucent grid that inherits the neu tokens (light + dark come from CSS variables).
const gridTheme = themeQuartz.withParams({
  backgroundColor: "transparent",
  foregroundColor: "var(--text)",
  headerBackgroundColor: "transparent",
  headerTextColor: "var(--text-3)",
  headerFontWeight: 600,
  headerFontSize: 12,
  borderColor: "var(--hairline)",
  rowHoverColor: "var(--neutral-soft)",
  selectedRowBackgroundColor: "var(--accent-soft)",
  accentColor: "var(--accent)",
  fontFamily: "var(--font)",
  fontSize: 14,
  rowHeight: 50,
  headerHeight: 44,
  wrapperBorder: false,
  columnBorder: false,
  oddRowBackgroundColor: "transparent",
  cellHorizontalPadding: 16,
  headerColumnResizeHandleColor: "transparent",
  pinnedColumnBorder: false,
});

type Row = Dispute & { working?: boolean };
type State = { orders: Order[]; disputes: Row[]; health: ReturnType<typeof sellerHealth> };

const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorised",
  CREDIT_NOT_PROCESSED: "Credit not processed",
  DUPLICATE_TRANSACTION: "Duplicate",
  INCORRECT_AMOUNT: "Incorrect amount",
  PAYMENT_BY_OTHER_MEANS: "Paid another way",
  CANCELED_RECURRING_BILLING: "Cancelled subscription",
  PROBLEM_WITH_REMITTANCE: "Remittance problem",
  OTHER: "Other",
};

const ACTION_TONE = { FIGHT: "info", SETTLE: "warn", ACCEPT: "bad" } as const;

// PayPal's dispute statuses, shortened for the table
const STATUS_LABEL: Record<string, string> = {
  WAITING_FOR_SELLER_RESPONSE: "Needs response",
  WAITING_FOR_BUYER_RESPONSE: "Waiting on buyer",
  UNDER_REVIEW: "PayPal reviewing",
  RESOLVED: "Resolved",
  OTHER: "Other",
  OPEN: "Open",
};
const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replaceAll("_", " ").toLowerCase();
const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtInt = (n: number) => Math.round(n).toString();

async function post(url: string, body?: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j;
}

export default function ConsolePage() {
  const [state, setState] = useState<State | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = (await fetch("/api/state").then((r) => r.json())) as State;
    setState(s);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await post("/api/disputes/sync");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const fast = setInterval(refresh, 3000); // local state (agents write here as they work)
    const slow = setInterval(() => post("/api/disputes/sync").catch(() => {}), 30000); // PayPal poll
    return () => { clearTimeout(first); clearInterval(fast); clearInterval(slow); };
  }, [refresh]);

  const selected = state?.disputes.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <Reveal>
        <div className="row between" style={{ alignItems: "flex-end", gap: 16 }}>
          <div className="stack" style={{ gap: 6 }}>
            <span className="tiny">Seller console · Loom &amp; Thread</span>
            <h1>Disputes</h1>
          </div>
          <div className="row">
            <span className="row small muted" style={{ gap: 8 }}><span className="pulse-dot" /> Live</span>
            <button className="btn btn-primary" onClick={sync} disabled={syncing}>
              <motion.span animate={syncing ? { rotate: 360 } : { rotate: 0 }} transition={syncing ? { repeat: Infinity, duration: 0.9, ease: "linear" } : { duration: 0 }} style={{ display: "inline-flex" }}>
                <IconRefresh size={16} />
              </motion.span>
              Sync with PayPal
            </button>
          </div>
        </div>
      </Reveal>

      <AnimatePresence>
        {error && (
          <motion.div className="neu pad row between" style={{ color: "var(--bad)" }} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="small">{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setError(null)} aria-label="Dismiss"><IconX size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {state ? <Health h={state.health} /> : <div className="stats">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="neu stat"><div className="shimmer" style={{ height: 70 }} /></div>)}</div>}

      <Reveal delay={0.1}>
        <div className="grid-panel">
          <DisputeGrid rows={state?.disputes ?? []} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </Reveal>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div key={selected.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.5, ease }}>
            <DisputeDetail d={selected} onChange={refresh} />
          </motion.div>
        ) : (
          <motion.div key="empty" className="neu pad row" style={{ gap: 14 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="icon-tile yellow"><IconShield size={20} /></span>
            <span className="muted">Select a dispute to see your agent&apos;s assessment, the negotiation and your options.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Reveal>
        <div className="row between" style={{ marginTop: 8 }}>
          <h2>Orders</h2>
          <span className="small faint">Tracking uploaded to PayPal keeps orders eligible for Seller Protection</span>
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <div className="grid-panel">
          <OrderGrid rows={state?.orders ?? []} onChange={refresh} />
        </div>
      </Reveal>
    </div>
  );
}

function Health({ h }: { h: State["health"] }) {
  const tone = h.riskLevel === "HIGH" ? "bad" : h.riskLevel === "ELEVATED" ? "warn" : "good";
  const label = h.riskLevel === "OK" ? "Healthy" : h.riskLevel === "ELEVATED" ? "Review risk" : "Hold risk";
  return (
    <Stagger className="stats" gap={0.06}>
      <Item className="neu stat">
        <span className="tiny">Dispute ratio</span>
        <span className="value"><CountUp value={h.disputeRatio * 100} format={fmtPct} /></span>
        <div className="sub"><Badge tone={tone} dot>{label}</Badge></div>
      </Item>
      <Item className="neu stat">
        <span className="tiny">Open disputes</span>
        <span className="value"><CountUp value={h.openDisputes} format={fmtInt} /></span>
        <span className="sub">{h.disputes} total · {h.orders} orders</span>
      </Item>
      <Item className="neu stat">
        <span className="tiny">Settled early</span>
        <span className="value"><CountUp value={h.settledBeforeEscalation} format={fmtInt} /></span>
        <span className="sub">≈ {fmtUsd(h.estimatedFeesAvoided)} fees avoided</span>
      </Item>
      <Item className="neu stat">
        <span className="tiny">Won with evidence</span>
        <span className="value"><CountUp value={h.wonCount} format={fmtInt} /></span>
        <span className="sub">${h.revenueProtected.toFixed(2)} protected</span>
      </Item>
      <Item className="neu stat">
        <span className="tiny">Next deadline</span>
        <span className="value" style={{ fontSize: 22 }}>{h.nextDeadline ? countdown(h.nextDeadline) : "—"}</span>
        <span className="sub">Seller response due</span>
      </Item>
    </Stagger>
  );
}

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

/** Vertically centres custom cell content inside AG Grid's row. */
function Cell({ children }: { children: React.ReactNode }) {
  return <div className="cell">{children}</div>;
}

function ActionCell(p: ICellRendererParams<Row>) {
  const d = p.data!;
  if (d.working) return <Cell><span className="row small muted" style={{ gap: 8, flexWrap: "nowrap" }}><span className="spinner" /> Working</span></Cell>;
  const a = d.assessment?.recommendedAction;
  if (!a) return <Cell><Badge>Pending</Badge></Cell>;
  return <Cell><Badge tone={ACTION_TONE[a]} dot>{a.toLowerCase()}</Badge></Cell>;
}

function WinCell(p: ICellRendererParams<Row>) {
  const w = p.data?.assessment?.winProbability;
  if (w === undefined) return <Cell><span className="faint">—</span></Cell>;
  return (
    <div className="cell" style={{ gap: 10 }}>
      <div className="meter" style={{ width: 64 }}><div style={{ width: `${w * 100}%` }} /></div>
      <span className="small mono">{Math.round(w * 100)}%</span>
    </div>
  );
}

function ProtectionCell(p: ICellRendererParams<Row>) {
  const a = p.data?.assessment;
  if (!a) return <Cell><span className="faint">—</span></Cell>;
  return <Cell>{a.sellerProtectionEligible ? <Badge tone="good">Eligible</Badge> : <Badge tone="bad">Not eligible</Badge>}</Cell>;
}

function AgentsCell(p: ICellRendererParams<Row>) {
  const s = p.data?.negotiation?.status;
  if (!s) return <Cell><span className="faint">—</span></Cell>;
  return <Cell><Badge tone={s === "AGREED" ? "good" : s === "FAILED" ? "bad" : "info"}>{s.toLowerCase()}</Badge></Cell>;
}

function DisputeGrid({ rows, selectedId, onSelect }: { rows: Row[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const cols = useMemo<ColDef<Row>[]>(() => [
    { headerName: "Dispute", field: "id", minWidth: 140, flex: 0.9, pinned: "left", cellClass: "mono" },
    { headerName: "Reason", tooltipValueGetter: (p) => p.data?.assessment?.summary ?? "", valueGetter: (p) => p.data?.assessment?.category ?? REASONS[p.data!.paypal.reason] ?? p.data!.paypal.reason, flex: 1.6, minWidth: 190 },
    { headerName: "Amount", valueGetter: (p) => Number(p.data!.paypal.dispute_amount.value), valueFormatter: (p) => `$${p.value.toFixed(2)}`, minWidth: 100, flex: 0.6, type: "rightAligned", cellClass: "mono" },
    { headerName: "PayPal status", valueGetter: (p) => statusLabel(p.data!.paypal.status), minWidth: 170, flex: 1 },
    { headerName: "AI action", cellRenderer: ActionCell, minWidth: 120, flex: 0.7, sortable: false },
    { headerName: "Win chance", cellRenderer: WinCell, valueGetter: (p) => p.data?.assessment?.winProbability ?? -1, minWidth: 140, flex: 0.8 },
    { headerName: "Protection", headerTooltip: "PayPal Seller Protection", cellRenderer: ProtectionCell, minWidth: 130, flex: 0.8, sortable: false },
    { headerName: "Agents", cellRenderer: AgentsCell, minWidth: 110, flex: 0.6, sortable: false },
    { headerName: "Respond in", valueGetter: (p) => p.data!.paypal.seller_response_due_date ?? "", valueFormatter: (p) => (p.value ? countdown(p.value) : "—"), minWidth: 110, flex: 0.6 },
  ], []);
  return (
    <AgGridReact<Row>
      theme={gridTheme}
      rowData={rows}
      columnDefs={cols}
      getRowId={(p) => p.data.id}
      defaultColDef={{ sortable: true, resizable: true }}
      rowSelection={{ mode: "singleRow", checkboxes: false, enableClickSelection: true }}
      onRowClicked={(e) => e.data && onSelect(e.data.id)}
      onFirstDataRendered={(e) => selectedId && e.api.getRowNode(selectedId)?.setSelected(true)}
      animateRows
      domLayout="autoHeight"
      tooltipShowDelay={400}
      overlayNoRowsTemplate='<span style="color:var(--text-3)">No disputes yet. Open one from the PayPal sandbox buyer account, then Sync.</span>'
    />
  );
}

function OrderGrid({ rows, onChange }: { rows: Order[]; onChange: () => void }) {
  const cols = useMemo<ColDef<Order>[]>(() => [
    { headerName: "Item", field: "itemName", flex: 2, minWidth: 240, tooltipField: "itemName" },
    { headerName: "Amount", valueGetter: (p) => `$${p.data!.amount.value}`, minWidth: 100, flex: 0.6, cellClass: "mono" },
    {
      headerName: "Status", minWidth: 130, flex: 0.7,
      cellRenderer: (p: ICellRendererParams<Order>) => {
        const s = p.data!.status;
        return <Cell><Badge tone={s === "DELIVERED" ? "good" : s === "SHIPPED" ? "warn" : "info"} dot>{s.toLowerCase()}</Badge></Cell>;
      },
    },
    { headerName: "Buyer", cellRenderer: (p: ICellRendererParams<Order>) => <Cell>{p.data!.intentId ? <Badge tone="info">Agent</Badge> : <span className="faint">Human</span>}</Cell>, minWidth: 120, flex: 0.6 },
    {
      headerName: "Tracking", minWidth: 230, flex: 1.3,
      cellRenderer: (p: ICellRendererParams<Order>) => {
        const t = p.data!.tracking;
        return <Cell>{t ? <span className="mono small truncate">{t.carrier} {t.number}</span> : <Badge tone="warn">Missing</Badge>}</Cell>;
      },
    },
    {
      headerName: "On PayPal", minWidth: 120, flex: 0.6,
      cellRenderer: (p: ICellRendererParams<Order>) => {
        const t = p.data!.tracking;
        if (!t) return <Cell><span className="faint">—</span></Cell>;
        return <Cell>{t.pushedToPayPal ? <Badge tone="good">Uploaded</Badge> : <Badge tone="bad">Failed</Badge>}</Cell>;
      },
    },
    {
      headerName: "", minWidth: 230, flex: 1, sortable: false, resizable: false,
      cellRenderer: (p: ICellRendererParams<Order>) => {
        const o = p.data!;
        const act = (delivered?: boolean) => post("/api/orders/ship", { orderId: o.id, delivered }).then(onChange).catch((e) => alert(e.message));
        if (o.status === "PAID") return <Cell><button className="btn btn-sm" onClick={() => act()}><IconTruck size={15} /> Ship + upload tracking</button></Cell>;
        if (o.status === "SHIPPED") return <Cell><button className="btn btn-sm" onClick={() => act(true)}><IconCheck size={15} /> Mark delivered</button></Cell>;
        return <Cell><span className="small faint">Done</span></Cell>;
      },
    },
  ], [onChange]);
  return (
    <AgGridReact<Order>
      theme={gridTheme}
      rowData={rows.filter((o) => o.status !== "CREATED")}
      columnDefs={cols}
      getRowId={(p) => p.data.id}
      defaultColDef={{ resizable: true }}
      animateRows
      domLayout="autoHeight"
      tooltipShowDelay={400}
      overlayNoRowsTemplate='<span style="color:var(--text-3)">No paid orders yet. Place one from the Buyer agent page.</span>'
    />
  );
}

function DisputeDetail({ d, onChange }: { d: Row; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const a = d.assessment;
  const n = d.negotiation;
  const closed = d.paypal.status === "RESOLVED" || d.paypal.status === "CLOSED";
  // What PayPal currently lets the seller do (from the dispute's HATEOAS links)
  const allowed = (d.paypal.links ?? []).filter((l) => l.method === "POST").map((l) => l.rel);

  async function run(label: string, url: string, body?: unknown) {
    setBusy(label);
    setErr(null);
    try {
      await post(url, body);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="split">
      <div className="neu pad-lg stack" style={{ gap: 18 }}>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="tiny mono">{d.id}</span>
            <span className="mono" style={{ fontWeight: 600 }}>${d.paypal.dispute_amount.value}</span>
          </div>
          <h2 style={{ fontSize: 22 }}>{a?.category ?? REASONS[d.paypal.reason] ?? d.paypal.reason}</h2>
        </div>

        {!a && (
          d.working ? (
            <div className="stack" style={{ gap: 10 }}>
              <span className="row small muted" style={{ gap: 10 }}><Typing /> Your agent is investigating the dispute, order, tracking and listing…</span>
              <div className="shimmer" style={{ height: 14, width: "90%" }} />
              <div className="shimmer" style={{ height: 14, width: "70%" }} />
            </div>
          ) : (
            <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => run("Starting agent", `/api/disputes/${d.id}/assess`)}>
              <IconShield size={16} /> Run seller agent
            </button>
          )
        )}

        {a && (
          <>
            <p style={{ fontSize: 16, lineHeight: 1.5 }}>{a.summary}</p>
            <div className="row" style={{ gap: 8 }}>
              <Badge tone={ACTION_TONE[a.recommendedAction]} dot>Recommends {a.recommendedAction.toLowerCase()}</Badge>
              <Badge tone={a.sellerProtectionEligible ? "good" : "bad"}>Seller Protection {a.sellerProtectionEligible ? "eligible" : "not eligible"}</Badge>
              {a.suggestedOffer && <Badge tone="warn">{a.suggestedOffer.type.replaceAll("_", " ").toLowerCase()} ${a.suggestedOffer.amount}</Badge>}
            </div>
            <div className="neu-inset" style={{ padding: 14 }}>
              <div className="row between small" style={{ marginBottom: 8 }}>
                <span className="muted">Chance of winning if fought</span>
                <span className="mono" style={{ fontWeight: 600 }}>{Math.round(a.winProbability * 100)}%</span>
              </div>
              <div className="meter"><motion.div initial={{ width: 0 }} animate={{ width: `${a.winProbability * 100}%` }} transition={{ duration: 1, ease }} /></div>
            </div>
            {a.riskFlags.length > 0 && (
              <div className="row" style={{ gap: 6 }}>{a.riskFlags.map((f) => <Badge key={f}>{f}</Badge>)}</div>
            )}
            <details>
              <summary className="disclosure">Agent reasoning</summary>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="stack" style={{ gap: 10, marginTop: 10 }}>
                <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{a.reasoning}</p>
                {a.evidenceNotes && (
                  <div className="neu-inset" style={{ padding: 12 }}>
                    <div className="row small" style={{ gap: 6, marginBottom: 6, fontWeight: 600 }}><IconDoc size={15} /> Evidence draft</div>
                    <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{a.evidenceNotes}</p>
                  </div>
                )}
              </motion.div>
            </details>

            {!closed && (
              <div className="stack" style={{ gap: 10, paddingTop: 4, borderTop: "1px solid var(--hairline)" }}>
                <span className="tiny" style={{ paddingTop: 12 }}>Your decision</span>
                {allowed.length === 0 && (
                  <span className="small muted">PayPal is reviewing this case. Actions open when PayPal asks for your response.</span>
                )}
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" disabled={!!busy || d.working} onClick={() => run("Starting negotiation", `/api/disputes/${d.id}/negotiate`)}>
                    <IconHandshake size={16} /> Negotiate with buyer&apos;s agent
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!!busy || (!n?.agreed && !a.suggestedOffer) || !allowed.includes("make_offer")}
                    title={allowed.includes("make_offer") ? undefined : "PayPal isn't accepting offers on this dispute right now"}
                    onClick={() => run("Sending offer to PayPal", `/api/disputes/${d.id}/approve`, { decision: "SETTLE" })}
                  >
                    <IconCheck size={16} /> Approve settlement{n?.agreed ? ` · $${n.agreed.amount}` : a.suggestedOffer ? ` · $${a.suggestedOffer.amount}` : ""}
                  </button>
                  <button
                    className="btn"
                    disabled={!!busy || !allowed.includes("provide_evidence")}
                    title={allowed.includes("provide_evidence") ? undefined : "PayPal accepts evidence once the case becomes a claim or PayPal requests it"}
                    onClick={() => run("Submitting evidence", `/api/disputes/${d.id}/approve`, { decision: "FIGHT" })}
                  >
                    <IconShield size={16} /> Submit evidence
                  </button>
                  <button
                    className="btn btn-ghost btn-danger"
                    disabled={!!busy || !allowed.includes("accept_claim")}
                    onClick={() => run("Accepting claim", `/api/disputes/${d.id}/approve`, { decision: "ACCEPT" })}
                  >
                    Accept claim
                  </button>
                </div>
                {!allowed.includes("provide_evidence") && allowed.length > 0 && (
                  <span className="small faint">Evidence opens if the buyer escalates this to a claim or PayPal requests it.</span>
                )}
                <AnimatePresence>
                  {busy && (
                    <motion.span className="row small muted" style={{ gap: 8 }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <span className="spinner" /> {busy}…
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        <AnimatePresence>
          {err && (
            <motion.div className="small" style={{ color: "var(--bad)", whiteSpace: "pre-wrap", background: "var(--bad-soft)", padding: 12, borderRadius: 12 }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {err}
            </motion.div>
          )}
        </AnimatePresence>

        <details>
          <summary className="disclosure faint">Sandbox controls</summary>
          <div className="row" style={{ marginTop: 10, gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => run("Simulating", `/api/disputes/${d.id}/sandbox`, { action: "SELLER_EVIDENCE" })}>Request seller evidence</button>
            <button className="btn btn-sm btn-ghost" onClick={() => run("Simulating", `/api/disputes/${d.id}/sandbox`, { action: "SELLER_FAVOR" })}>Decide for seller</button>
            <button className="btn btn-sm btn-ghost" onClick={() => run("Simulating", `/api/disputes/${d.id}/sandbox`, { action: "BUYER_FAVOR" })}>Decide for buyer</button>
          </div>
        </details>
      </div>

      <div className="stack" style={{ gap: 18 }}>
        <div className="neu pad-lg stack" style={{ gap: 14 }}>
          <div className="row between">
            <h2>Agent negotiation</h2>
            {n && <Badge tone={n.status === "AGREED" ? "good" : n.status === "FAILED" ? "bad" : "info"} dot>{n.status.toLowerCase()}</Badge>}
          </div>
          {!n && (
            <p className="small muted">
              Not started. Your agent and the buyer&apos;s shopping agent negotiate over the Agent Dispute Protocol. When you approve, the agreed offer and a summary of the negotiation go to PayPal.
            </p>
          )}
          <div className="stack" style={{ gap: 10 }}>
            <AnimatePresence initial={false}>
              {n?.turns.map((t, i) => (
                <motion.div
                  key={`${t.at}-${i}`}
                  className={`turn ${t.from === "SELLER_AGENT" ? "seller" : "buyer"}`}
                  initial={{ opacity: 0, x: t.from === "SELLER_AGENT" ? -14 : 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={spring}
                >
                  <div className="who">
                    <span>{t.from === "SELLER_AGENT" ? "Your agent" : "Buyer's agent"}</span>
                    <Badge tone={t.action === "ACCEPT" ? "good" : t.action === "REJECT" ? "bad" : "neutral"}>{t.action.toLowerCase()}</Badge>
                    {t.amount && t.action !== "REJECT" && <span className="mono">{t.offerType?.replaceAll("_", " ").toLowerCase()} ${t.amount}</span>}
                  </div>
                  <div style={{ fontSize: 14.5 }}>{t.message}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {n?.status === "RUNNING" && <span className="row small muted" style={{ gap: 10 }}><Typing /> Agents are negotiating…</span>}
          </div>
        </div>

        <div className="neu pad-lg stack" style={{ gap: 14 }}>
          <h2>Activity</h2>
          <div className="timeline">
            <AnimatePresence initial={false}>
              {[...d.log].reverse().map((l) => (
                <motion.div key={`${l.at}-${l.action}`} className="tl-item" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
                  <span className={`tl-dot${l.ok ? "" : " bad"}`} />
                  <div className="stack" style={{ gap: 2 }}>
                    <div className="row small" style={{ gap: 8 }}>
                      <b style={{ color: l.ok ? "inherit" : "var(--bad)" }}>{l.actor}</b>
                      <span className="faint mono">{new Date(l.at).toLocaleTimeString()}</span>
                    </div>
                    <span className="small">{l.action}</span>
                    {l.detail && <span className="small muted">{l.detail.slice(0, 240)}</span>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
