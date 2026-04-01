"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
  const colors = { active: "#22c55e", pending: "#f59e0b", opportunity: "#60a5fa" };
  const labels = { active: "LIVE", pending: "BUILDING", opportunity: "OPPORTUNITY" };
  return (
    <span style={{
      fontSize: "10px",
      fontWeight: 800,
      padding: "2px 8px",
      borderRadius: "4px",
      background: `${colors[status]}20`,
      color: colors[status],
      border: `1px solid ${colors[status]}40`,
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
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#0f172a", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "2px solid #e2e8f0", display: "flex", alignItems: "center", gap: "12px" }}>
        <Link href="/command-center" style={{ color: "#64748b", textDecoration: "none", fontSize: "14px", fontWeight: 600 }}>← BACK</Link>
        <span style={{ color: "#d97706", fontSize: "18px" }}>◉</span>
        <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.05em" }}>REVENUE</span>
      </div>

      {stripe && (
        <div style={{ margin: "0 20px 12px", padding: "14px 16px", background: "#0f172a", color: "#f8fafc", borderRadius: "10px", border: "2px solid #334155" }}>
          <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", color: "#94a3b8", marginBottom: "8px" }}>
            STRIPE (LIVE) · {stripe.source === "live" ? "CONNECTED" : "NO KEY / FALLBACK"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 24px", fontSize: "13px" }}>
            <span><strong style={{ color: "#22c55e" }}>MRR</strong> ${stripe.mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span><strong>ARR</strong> ${stripe.arr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span><strong>30d volume</strong> ${stripe.last30.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span><strong>Active subs</strong> {stripe.activeSubs}</span>
          </div>
          {stripe.fetchedAt && (
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "8px" }}>Updated {new Date(stripe.fetchedAt).toLocaleString()}</div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ padding: "12px 20px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {(["all", "active", "pending", "opportunity"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: filter === f ? "2px solid #0f172a" : "2px solid #e2e8f0",
              background: filter === f ? "#0f172a" : "white",
              color: filter === f ? "white" : "#475569",
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
      <div style={{ padding: "8px 20px 100px" }}>
        {filtered.map((stream, i) => (
          <div
            key={i}
            style={{
              background: "white",
              borderRadius: "10px",
              border: "2px solid #e2e8f0",
              padding: "16px 20px",
              marginBottom: "12px",
              borderLeft: `4px solid ${stream.color}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{stream.name}</span>
              {statusBadge(stream.status)}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: stream.color }}>{stream.amount}</span>
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {stream.type === "recurring" ? "RECURRING" : stream.type === "one-time" ? "ONE-TIME" : "PIPELINE"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
