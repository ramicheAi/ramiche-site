"use client";

import { useState, useEffect } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   REVENUE — Pipeline & Opportunities
   Track sales, pricing, deals, and revenue streams
   ══════════════════════════════════════════════════════════════════════════════ */

interface RevenueStream {
  name: string;
  type: "recurring" | "one-time" | "pipeline";
  amount: string;
  status: "active" | "pending" | "opportunity";
  color: string;
}

const STREAMS: RevenueStream[] = [
  { name: "METTLE SaaS", type: "recurring", amount: "$149-549/mo", status: "pending", color: "#7c3aed" },
  { name: "Ramiche Studio", type: "one-time", amount: "$400/sprint", status: "active", color: "#2563eb" },
  { name: "ClawGuard Pro", type: "one-time", amount: "$299-1,499", status: "active", color: "#059669" },
  { name: "Claude Skills (Parallax)", type: "one-time", amount: "$149-499", status: "active", color: "#d97706" },
  { name: "Setup Service", type: "one-time", amount: "$99-249", status: "active", color: "#0891b2" },
  { name: "Galactik Antics (Merch)", type: "one-time", amount: "Variable", status: "pending", color: "#ec4899" },
  { name: "Upwork Freelance", type: "one-time", amount: "$150/hr", status: "active", color: "#22c55e" },
  { name: "White-Label Agents", type: "one-time", amount: "Enterprise", status: "opportunity", color: "#8b5cf6" },
];

const statusBadge = (status: RevenueStream["status"]) => {
  const colors = { active: "var(--c-green)", pending: "var(--c-amber)", opportunity: "var(--c-sky)" };
  const labels = { active: "LIVE", pending: "BUILDING", opportunity: "OPPORTUNITY" };
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 800,
      padding: "2px 8px",
      borderRadius: "4px",
      background: `color-mix(in srgb, ${colors[status]} 18%, transparent)`,
      color: colors[status],
      border: `1px solid color-mix(in srgb, ${colors[status]} 40%, transparent)`,
      letterSpacing: "0.05em",
    }}>
      {labels[status]}
    </span>
  );
};

export default function RevenuePage() {
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "opportunity">("all");
  const [stripe, setStripe] = useState<{
    mrr: number;
    arr: number;
    last30: number;
    activeSubs: number;
    source: string;
    fetchedAt: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/command-center/revenue", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data) return;
        setStripe({
          mrr: data.subscriptions?.mrr ?? 0,
          arr: data.subscriptions?.arr ?? 0,
          last30: data.revenue?.last30Days ?? 0,
          activeSubs: data.subscriptions?.active ?? 0,
          source: data.source ?? "unknown",
          fetchedAt: data.fetchedAt ?? "",
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = filter === "all" ? STREAMS : STREAMS.filter(s => s.status === filter);

  return (
    <InstrumentPage id="finance" title="Revenue" section="Business" icon="finance" accent="var(--c-gold)">
      {stripe && (
        <Panel title="Stripe (Live)" icon="finance" badge={<span className="mono" style={{ color: stripe.source === "live" ? "var(--c-green)" : "var(--t-mid)" }}>{stripe.source === "live" ? "CONNECTED" : "NO KEY / FALLBACK"}</span>}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 24px", fontSize: "13px", color: "var(--t-hi)" }}>
            <span><strong style={{ color: "var(--c-green)" }}>MRR</strong> ${stripe.mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span><strong>ARR</strong> ${stripe.arr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span><strong>30d volume</strong> ${stripe.last30.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span><strong>Active subs</strong> {stripe.activeSubs}</span>
          </div>
          {stripe.fetchedAt && (
            <div className="mono" style={{ fontSize: "10px", color: "var(--t-lo)", marginTop: "8px" }}>Updated {new Date(stripe.fetchedAt).toLocaleString()}</div>
          )}
        </Panel>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: 4 }}>
        {(["all", "active", "pending", "opportunity"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: filter === f ? "2px solid var(--accent)" : "2px solid var(--line-2)",
              background: filter === f ? "var(--accent)" : "var(--ink-2)",
              color: filter === f ? "#fff" : "var(--t-mid)",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {f === "all" ? `ALL (${STREAMS.length})` : `${f.toUpperCase()} (${STREAMS.filter(s => s.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Revenue Cards */}
      <Panel title="Revenue Streams" icon="dashboard">
        {filtered.map((stream, i) => (
          <div
            key={i}
            style={{
              background: "var(--ink-2)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line)",
              padding: "16px 20px",
              marginBottom: "12px",
              borderLeft: `4px solid ${stream.color}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--t-hi)" }}>{stream.name}</span>
              {statusBadge(stream.status)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: stream.color }}>{stream.amount}</span>
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--t-mid)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {stream.type === "recurring" ? "RECURRING" : stream.type === "one-time" ? "ONE-TIME" : "PIPELINE"}
              </span>
            </div>
          </div>
        ))}
      </Panel>
    </InstrumentPage>
  );
}
