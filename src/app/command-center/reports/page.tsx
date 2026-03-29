"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   REPORTS — Data Export & P&L Dashboard
   Export agents/crons/memory/revenue as CSV/JSON, weekly summaries, P&L
   ══════════════════════════════════════════════════════════════════════════════ */

interface ExportHistoryEntry {
  scope: string;
  type: string;
  timestamp: string;
}

interface MonthlyBreakdown {
  month: string;
  amount: number;
}

interface RevenueData {
  revenue: { last30Days: number; monthlyBreakdown: MonthlyBreakdown[]; totalCharges: number };
  balance: { available: number; pending: number; currency: string };
  subscriptions: { active: number; mrr: number; arr: number };
  source: string;
  fetchedAt: string;
}

interface SummaryResponse {
  markdown: string;
  generatedAt: string;
}

const MONTHLY_EXPENSES = 3200;

const EXPORT_BUTTONS: { label: string; scope: string; type: string; color: string }[] = [
  { label: "Export Agents (CSV)", scope: "agents", type: "csv", color: "#22c55e" },
  { label: "Export Crons (CSV)", scope: "crons", type: "csv", color: "#818cf8" },
  { label: "Export Memory (CSV)", scope: "memory", type: "csv", color: "#22d3ee" },
  { label: "Export Revenue (CSV)", scope: "revenue", type: "csv", color: "#f59e0b" },
  { label: "Full Export (JSON)", scope: "full", type: "json", color: "#C9A84C" },
];

function parseMarkdown(md: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = md.split("\n");
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} style={{ margin: "8px 0 16px 4px", padding: 0, listStyle: "none" }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ fontSize: 13, color: "#d4d4d4", lineHeight: 1.7, padding: "2px 0", display: "flex", gap: 8 }}>
            <span style={{ color: "#C9A84C", flexShrink: 0 }}>▸</span>
            <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*([^*]+)\*\*/g, "<strong style='color:#e5e5e5'>$1</strong>") }} />
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h2 key={`h1-${i}`} style={{ fontSize: 22, fontWeight: 900, color: "#C9A84C", margin: "24px 0 8px", textShadow: "0 0 30px rgba(201,168,76,0.3)" }}>
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h3 key={`h2-${i}`} style={{ fontSize: 14, fontWeight: 800, color: "#e5e5e5", letterSpacing: "0.1em", textTransform: "uppercase", margin: "20px 0 8px", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("---")) {
      flushList();
    } else if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
    } else if (line.startsWith("**") && line.includes(":**")) {
      flushList();
      nodes.push(
        <p key={`p-${i}`} style={{ fontSize: 12, color: "#a3a3a3", margin: "4px 0", fontFamily: "monospace" }}
           dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, "<strong style='color:#e5e5e5'>$1</strong>") }} />
      );
    } else if (line.trim()) {
      flushList();
      nodes.push(
        <p key={`p-${i}`} style={{ fontSize: 13, color: "#a3a3a3", margin: "4px 0" }}
           dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, "<strong style='color:#e5e5e5'>$1</strong>") }} />
      );
    }
  }
  flushList();
  return nodes;
}

export default function ReportsPage() {
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cc-export-history");
      if (stored) setExportHistory(JSON.parse(stored));
    } catch { /* localStorage unavailable */ }
  }, []);

  const saveHistory = useCallback((entry: ExportHistoryEntry) => {
    setExportHistory((prev) => {
      const next = [entry, ...prev].slice(0, 20);
      try { localStorage.setItem("cc-export-history", JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const handleExport = useCallback(async (type: string, scope: string) => {
    const key = `${type}-${scope}`;
    setExporting(key);
    try {
      const res = await fetch(`/api/command-center/export?type=${type}&scope=${scope}`);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);

      const ext = type === "json" ? "json" : "csv";
      const contentType = type === "json" ? "application/json" : "text/csv";

      let blob: Blob;
      if (type === "json") {
        const data = await res.json();
        blob = new Blob([JSON.stringify(data, null, 2)], { type: contentType });
      } else {
        const text = await res.text();
        blob = new Blob([text], { type: contentType });
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cc-export-${scope}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      saveHistory({ scope, type, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("[reports] Export error:", err);
    } finally {
      setExporting(null);
    }
  }, [saveHistory]);

  const handleGenerateSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch("/api/command-center/export?type=summary&scope=full");
      if (!res.ok) throw new Error(`Summary failed: ${res.status}`);
      const data: SummaryResponse = await res.json();
      setSummaryData(data);
      saveHistory({ scope: "summary", type: "summary", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("[reports] Summary error:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, [saveHistory]);

  useEffect(() => {
    let cancelled = false;
    async function fetchRevenue() {
      try {
        const res = await fetch("/api/command-center/stripe-revenue", { cache: "no-store" });
        if (!res.ok) throw new Error(`Revenue fetch failed: ${res.status}`);
        const data: RevenueData = await res.json();
        if (!cancelled) setRevenueData(data);
      } catch (err) {
        console.error("[reports] Revenue error:", err);
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    }
    fetchRevenue();
    return () => { cancelled = true; };
  }, []);

  const revenue30d = revenueData?.revenue?.last30Days ?? 0;
  const netPL = revenue30d - MONTHLY_EXPENSES;
  const breakdown = revenueData?.revenue?.monthlyBreakdown ?? [];
  const maxBreakdown = Math.max(...breakdown.map((b) => b.amount), 1);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 800px 600px at 25% 15%, rgba(201,168,76,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 85%, rgba(249,115,22,0.06) 0%, transparent 60%)"
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "32px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8, transition: "all 0.15s" }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(201,168,76,0.3)" }}>
            Reports & Exports
          </h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
            Data export, weekly summaries, and P&L dashboard
          </p>
        </div>

        {/* ── Section 1: Quick Export Buttons ──────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>
            Quick Export
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {EXPORT_BUTTONS.map((btn) => {
              const isActive = exporting === `${btn.type}-${btn.scope}`;
              return (
                <button
                  key={`${btn.type}-${btn.scope}`}
                  onClick={() => handleExport(btn.type, btn.scope)}
                  disabled={isActive}
                  style={{
                    padding: "16px 20px",
                    borderRadius: 12,
                    background: isActive ? `${btn.color}20` : "rgba(0,0,0,0.95)",
                    border: `2px solid ${btn.color}${isActive ? "60" : "30"}`,
                    boxShadow: `0 0 20px ${btn.color}10`,
                    color: btn.color,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    cursor: isActive ? "wait" : "pointer",
                    opacity: isActive ? 0.6 : 1,
                    transition: "all 0.25s",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 14, marginBottom: 4 }}>
                    {btn.type === "json" ? "{ }" : "▤"}
                  </div>
                  {isActive ? "EXPORTING..." : btn.label}
                  <div style={{ fontSize: 9, color: "#525252", marginTop: 4, fontWeight: 400 }}>
                    {btn.type.toUpperCase()} · {btn.scope.toUpperCase()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Weekly Summary Generator ─────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>
            Weekly Summary
          </h2>
          <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: summaryData ? 20 : 0 }}>
              <button
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  background: summaryLoading ? "rgba(201,168,76,0.08)" : "rgba(201,168,76,0.15)",
                  border: "2px solid rgba(201,168,76,0.3)",
                  color: "#C9A84C",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  cursor: summaryLoading ? "wait" : "pointer",
                  opacity: summaryLoading ? 0.5 : 1,
                  transition: "all 0.25s",
                }}
              >
                {summaryLoading ? "GENERATING..." : "GENERATE WEEKLY SUMMARY"}
              </button>
              {summaryData && (
                <span style={{ fontSize: 10, color: "#525252", fontFamily: "monospace" }}>
                  Generated: {new Date(summaryData.generatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {summaryData && (
              <div style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                maxHeight: 500,
                overflowY: "auto",
              }}>
                {parseMarkdown(summaryData.markdown)}
              </div>
            )}

            {!summaryData && !summaryLoading && (
              <p style={{ fontSize: 12, color: "#525252", margin: "12px 0 0" }}>
                Generates a report from git commits, memory entries, YOLO builds, agent activity, and cron health for the last 7 days.
              </p>
            )}
          </div>
        </div>

        {/* ── Section 3: P&L Dashboard ────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>
            P&L Dashboard
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {/* Revenue */}
            <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(34,197,94,0.15)", boxShadow: "0 0 24px rgba(34,197,94,0.05)" }}>
              <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>
                Revenue (Last 30d)
              </p>
              {revenueLoading ? (
                <div style={{ height: 32, width: "60%", borderRadius: 6, background: "rgba(255,255,255,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
              ) : (
                <p style={{ fontSize: 28, color: "#22c55e", fontFamily: "monospace", fontWeight: 900, margin: 0 }}>
                  ${revenue30d.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              )}
              <p style={{ fontSize: 11, color: "#525252", margin: "6px 0 0", fontFamily: "monospace" }}>
                {revenueData?.revenue?.totalCharges ?? 0} charges · {revenueData?.source ?? "—"}
              </p>
            </div>

            {/* Expenses */}
            <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(239,68,68,0.15)", boxShadow: "0 0 24px rgba(239,68,68,0.05)" }}>
              <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>
                Monthly Expenses
              </p>
              <p style={{ fontSize: 28, color: "#ef4444", fontFamily: "monospace", fontWeight: 900, margin: 0 }}>
                ${MONTHLY_EXPENSES.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p style={{ fontSize: 11, color: "#525252", margin: "6px 0 0", fontFamily: "monospace" }}>
                Infrastructure + API costs
              </p>
            </div>

            {/* Net P&L */}
            <div style={{
              padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)",
              border: `2px solid ${netPL >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              boxShadow: `0 0 24px ${netPL >= 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}`,
            }}>
              <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>
                Net P&L
              </p>
              {revenueLoading ? (
                <div style={{ height: 32, width: "60%", borderRadius: 6, background: "rgba(255,255,255,0.06)", animation: "pulse 1.5s ease-in-out infinite" }} />
              ) : (
                <p style={{ fontSize: 28, fontFamily: "monospace", fontWeight: 900, margin: 0, color: netPL >= 0 ? "#22c55e" : "#ef4444" }}>
                  {netPL >= 0 ? "+" : ""}${netPL.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
              )}
              <p style={{ fontSize: 11, color: "#525252", margin: "6px 0 0", fontFamily: "monospace" }}>
                Revenue − Expenses
              </p>
            </div>
          </div>

          {/* Monthly breakdown bar chart */}
          {breakdown.length > 0 && (
            <div style={{ marginTop: 20, padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.08)" }}>
              <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 16px", textTransform: "uppercase" }}>
                Monthly Breakdown
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {breakdown.map((b) => {
                  const pct = Math.max((b.amount / maxBreakdown) * 100, 2);
                  return (
                    <div key={b.month} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, color: "#737373", fontFamily: "monospace", width: 70, flexShrink: 0 }}>
                        {b.month}
                      </span>
                      <div style={{ flex: 1, height: 24, background: "rgba(255,255,255,0.03)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, rgba(201,168,76,0.5), rgba(201,168,76,0.25))",
                          borderRadius: 6,
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#C9A84C", fontFamily: "monospace", fontWeight: 700, width: 80, textAlign: "right", flexShrink: 0 }}>
                        ${b.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Subscription metrics */}
          {revenueData && revenueData.subscriptions.active > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
              {[
                { label: "ACTIVE SUBS", value: String(revenueData.subscriptions.active), color: "#22c55e" },
                { label: "MRR", value: `$${revenueData.subscriptions.mrr.toLocaleString()}`, color: "#C9A84C" },
                { label: "ARR", value: `$${revenueData.subscriptions.arr.toLocaleString()}`, color: "#818cf8" },
              ].map((m) => (
                <div key={m.label} style={{ padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize: 9, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 6px" }}>{m.label}</p>
                  <p style={{ fontSize: 18, color: m.color, fontFamily: "monospace", fontWeight: 700, margin: 0 }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 4: Export History ────────────────────────────────────── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>
            Export History
          </h2>
          <div style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
            {exportHistory.length === 0 ? (
              <p style={{ fontSize: 12, color: "#525252", margin: 0 }}>
                No exports yet. Use the buttons above to start exporting data.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {exportHistory.map((entry, i) => (
                  <div key={`${entry.timestamp}-${i}`} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 8,
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", padding: "3px 8px",
                        borderRadius: 4, textTransform: "uppercase",
                        background: entry.type === "json" ? "rgba(201,168,76,0.12)" : entry.type === "summary" ? "rgba(130,140,248,0.12)" : "rgba(34,197,94,0.12)",
                        color: entry.type === "json" ? "#C9A84C" : entry.type === "summary" ? "#818cf8" : "#22c55e",
                        border: `1px solid ${entry.type === "json" ? "rgba(201,168,76,0.25)" : entry.type === "summary" ? "rgba(130,140,248,0.25)" : "rgba(34,197,94,0.25)"}`,
                      }}>
                        {entry.type}
                      </span>
                      <span style={{ fontSize: 12, color: "#a3a3a3", fontWeight: 600 }}>
                        {entry.scope}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: "#525252", fontFamily: "monospace" }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {exportHistory.length > 0 && (
              <button
                onClick={() => {
                  setExportHistory([]);
                  try { localStorage.removeItem("cc-export-history"); } catch { /* noop */ }
                }}
                style={{
                  marginTop: 12, padding: "6px 14px", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.08em", borderRadius: 6, cursor: "pointer",
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  color: "#ef4444", transition: "all 0.2s",
                }}
              >
                CLEAR HISTORY
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
