"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ==============================================================================
   FINANCE HQ — SIMONS x KIYOSAKI COMMAND CENTER
   Portfolio tracking, signal screening, risk monitoring, and Oracle chat.
   Part of the Command Center ecosystem.
   ============================================================================== */

// ── TYPES ────────────────────────────────────────────────────────────────────

interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  dayChange: number;
  sector: string;
  color: string;
}

interface Signal {
  ticker: string;
  type: "momentum" | "mean-reversion" | "breakout" | "warning";
  strength: number; // 0-100
  message: string;
  timestamp: string;
}

interface RiskMetric {
  label: string;
  value: string;
  status: "healthy" | "caution" | "danger";
  detail: string;
}

type Tab = "overview" | "portfolio" | "signals" | "risk" | "oracle" | "cashflow" | "meridian";

interface MeridianData {
  generated_at: string;
  pipeline_version: string;
  portfolio: {
    equity: number;
    capital: number;
    cash: number;
    total_return_pct: number;
    positions: Array<{
      ticker: string;
      shares: number;
      direction: string;
      entry_price: number;
      entry_date: string;
      last_score: number;
    }>;
  };
  signals?: Array<{
    ticker: string;
    composite_score: number;
    momentum_score: number;
    value_score: number;
    volatility_score: number;
    action: string;
  }>;
  risk?: {
    portfolio_var: number;
    max_drawdown: number;
    sharpe_ratio: number;
    correlation_risk: string;
  };
}

// ── PORTFOLIO DATA (from Phase 1+2 margin cleanup) ──────────────────────────

const POSITIONS: Position[] = [
  { ticker: "TSLA", shares: 4.83, avgCost: 230.00, currentPrice: 0, dayChange: 0, sector: "Tech/Auto", color: "#ef4444" },
  { ticker: "AAPL", shares: 5.54, avgCost: 175.00, currentPrice: 0, dayChange: 0, sector: "Tech", color: "#22d3ee" },
  { ticker: "SPG", shares: 3.64, avgCost: 148.00, currentPrice: 0, dayChange: 0, sector: "REIT", color: "#a855f7" },
  { ticker: "CVX", shares: 0.42, avgCost: 155.00, currentPrice: 0, dayChange: 0, sector: "Energy", color: "#f59e0b" },
  { ticker: "PPTA", shares: 5.00, avgCost: 7.50, currentPrice: 0, dayChange: 0, sector: "Biotech", color: "#10b981" },
  { ticker: "SOL", shares: 0.15, avgCost: 140.00, currentPrice: 0, dayChange: 0, sector: "Crypto", color: "#818cf8" },
];

const MARGIN_DATA = {
  used: 2333.12,
  originalDebt: 2737.75,
  cashBuffer: 666.88,
  effectiveDebt: 1666.24,
  interestRate: 0.08,
  maintenanceReq: 4480.37,
  borrowingLimit: 3000,
};

// ── SIGNALS (demo — will be live from yfinance MCP) ──────────────────────────

const DEMO_SIGNALS: Signal[] = [
  { ticker: "TSLA", type: "momentum", strength: 72, message: "RSI 62 — uptrend intact, approaching overbought. Watch 380 resistance.", timestamp: "09:45" },
  { ticker: "AAPL", type: "mean-reversion", strength: 58, message: "Trading 1.2 std below 20-day MA. Mean reversion probability: 65%.", timestamp: "09:30" },
  { ticker: "SPG", type: "breakout", strength: 45, message: "Consolidating near 52-wk high. Volume declining — breakout or breakdown within 5 sessions.", timestamp: "09:15" },
  { ticker: "CVX", type: "warning", strength: 30, message: "Dividend yield compressing. Oil volatility elevated. Small position — hold for income.", timestamp: "08:45" },
];

// ── RISK METRICS ─────────────────────────────────────────────────────────────

const getRiskMetrics = (): RiskMetric[] => {
  const leverageRatio = MARGIN_DATA.used / (MARGIN_DATA.used + MARGIN_DATA.cashBuffer + 4010); // rough equity est
  const marginUtilization = MARGIN_DATA.used / MARGIN_DATA.borrowingLimit;

  return [
    {
      label: "Leverage Ratio",
      value: `${(leverageRatio * 100).toFixed(1)}%`,
      status: leverageRatio < 0.35 ? "healthy" : leverageRatio < 0.5 ? "caution" : "danger",
      detail: `Margin $${MARGIN_DATA.used.toFixed(0)} / Equity ~$4,010`,
    },
    {
      label: "Margin Utilization",
      value: `${(marginUtilization * 100).toFixed(1)}%`,
      status: marginUtilization < 0.6 ? "healthy" : marginUtilization < 0.8 ? "caution" : "danger",
      detail: `$${MARGIN_DATA.used.toFixed(0)} / $${MARGIN_DATA.borrowingLimit} limit`,
    },
    {
      label: "Daily Interest Burn",
      value: `$${(MARGIN_DATA.effectiveDebt * MARGIN_DATA.interestRate / 365).toFixed(2)}`,
      status: "caution",
      detail: `$${(MARGIN_DATA.effectiveDebt * MARGIN_DATA.interestRate).toFixed(0)}/year at ${(MARGIN_DATA.interestRate * 100)}%`,
    },
    {
      label: "Concentration Risk",
      value: "HIGH",
      status: "caution",
      detail: "TSLA + AAPL = ~65% of portfolio. Consider trimming >25% single-name.",
    },
    {
      label: "20% Drawdown Equity",
      value: "$2,866",
      status: "healthy",
      detail: "Up from $1,703 pre-cleanup. 68% risk reduction achieved.",
    },
    {
      label: "Margin Call Distance",
      value: "38%",
      status: "healthy",
      detail: "Market needs to drop ~38% before maintenance requirement hit.",
    },
  ];
};

// ── CASH FLOW (Kiyosaki Rich Dad Framework) ────────────────────────────────

const REVENUE_STREAMS = [
  { name: "Apex Athlete SaaS", monthly: 0, quadrant: "B" as const, type: "asset" as const, status: "building" as const, potential: 1200 },
  { name: "Galaktik Antics Merch", monthly: 0, quadrant: "B" as const, type: "asset" as const, status: "building" as const, potential: 800 },
  { name: "SCOWW Events", monthly: 0, quadrant: "B" as const, type: "asset" as const, status: "building" as const, potential: 600 },
  { name: "Parallax Studio (Upwork)", monthly: 2400, quadrant: "S" as const, type: "earned" as const, status: "active" as const, potential: 2400 },
  { name: "Ramiche Studio Services", monthly: 800, quadrant: "S" as const, type: "earned" as const, status: "active" as const, potential: 800 },
  { name: "The Baba Studio (Royalties)", monthly: 0, quadrant: "I" as const, type: "asset" as const, status: "building" as const, potential: 150 },
];

const MONTHLY_EXPENSES = 3200;

const ENTITY_STRUCTURE = [
  { name: "Parallax LLC → S-Corp", status: "active" as const, type: "operating" as const, purpose: "Primary operating entity. All Upwork revenue flows through here." },
  { name: "Revocable Living Trust", status: "planned" as const, type: "protection" as const, purpose: "Estate planning, probate avoidance, smooth wealth transfer." },
  { name: "IP Holding LLC", status: "planned" as const, type: "protection" as const, purpose: "Royalty income, licensing, intellectual property segregation." },
];

const WEALTH_ACTIONS = [
  { task: "File Parallax S-Corp 2025 return", status: "upcoming" as const, deadline: "Apr 15, 2026", priority: "high" as const },
  { task: "Q1 2026 estimated tax payment", status: "upcoming" as const, deadline: "Apr 15, 2026", priority: "high" as const },
  { task: "Launch Apex Athlete Pro tier", status: "current" as const, deadline: "Mar 2026", priority: "medium" as const },
  { task: "SBIR Grant application", status: "upcoming" as const, deadline: "Jun 2026", priority: "medium" as const },
  { task: "Set up Revocable Living Trust", status: "planned" as const, deadline: "Q2 2026", priority: "low" as const },
  { task: "Open IP Holding LLC", status: "planned" as const, deadline: "Q3 2026", priority: "low" as const },
  { task: "Quarterly net worth review", status: "upcoming" as const, deadline: "Mar 31, 2026", priority: "low" as const },
  { task: "Max SEP-IRA contribution", status: "planned" as const, deadline: "Oct 2026", priority: "low" as const },
];

const RICH_DAD_QUOTES = [
  "An asset puts money in your pocket. A liability takes money out.",
  "The poor and middle class work for money. The rich have money work for them.",
  "Financial freedom is when your passive income exceeds your monthly expenses.",
  "Your house is not an asset. It costs you every month.",
  "The rich don't work for money. They work to build systems that generate money.",
  "It's not how much you make. It's how much you keep.",
  "The bank's money can make you rich — if you know the rules.",
  "Which side of the quadrant are you on?",
];

// ── STYLE CONSTANTS ──────────────────────────────────────────────────────────

const STATUS_COLORS = {
  healthy: "#22c55e",
  caution: "#f59e0b",
  danger: "#ef4444",
};

const SIGNAL_COLORS = {
  momentum: "#22d3ee",
  "mean-reversion": "#a855f7",
  breakout: "#22c55e",
  warning: "#ef4444",
};

const SIGNAL_LABELS = {
  momentum: "MOMENTUM",
  "mean-reversion": "MEAN REV",
  breakout: "BREAKOUT",
  warning: "WARNING",
};

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function FinanceHQ() {
  const [time, setTime] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [oracleMessages, setOracleMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [oracleInput, setOracleInput] = useState("");
  const [oracleLoading, setOracleLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [meridianData, setMeridianData] = useState<MeridianData | null>(null);
  const [meridianError, setMeridianError] = useState(false);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [oracleMessages]);

  useEffect(() => {
    if (tab !== "meridian" || meridianData || meridianError) return;
    let cancelled = false;
    fetch("/api/command-center/meridian")
      .then(r => r.json())
      .then(d => { if (!cancelled) setMeridianData(d); })
      .catch(() => { if (!cancelled) setMeridianError(true); });
    return () => { cancelled = true; };
  }, [tab, meridianData, meridianError]);

  if (!time) return null;

  const riskMetrics = getRiskMetrics();
  const totalEquity = POSITIONS.reduce((sum, p) => sum + p.shares * (p.currentPrice || p.avgCost), 0);
  const debtReduction = ((1 - MARGIN_DATA.effectiveDebt / MARGIN_DATA.originalDebt) * 100).toFixed(1);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "OVERVIEW", icon: "\u25C8" },
    { id: "portfolio", label: "PORTFOLIO", icon: "\u25A3" },
    { id: "signals", label: "SIGNALS", icon: "\u25B2" },
    { id: "risk", label: "RISK", icon: "\u2665" },
    { id: "oracle", label: "ORACLE", icon: "\u03A3" },
    { id: "cashflow", label: "CASHFLOW", icon: "\u25C9" },
    { id: "meridian", label: "MERIDIAN", icon: "\u2604" },
  ];

  // ── Oracle Chat Handler ──────────────────────────────────────────────────

  const sendOracleMessage = async (text: string) => {
    if (!text.trim() || oracleLoading) return;
    const userMsg = { role: "user" as const, content: text.trim() };
    const newMessages = [...oracleMessages, userMsg];
    setOracleMessages(newMessages);
    setOracleInput("");
    setOracleLoading(true);

    try {
      const response = await fetch("/api/command-center/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await response.json();
      const assistantText = data.content || "Signal lost. Retry.";
      setOracleMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
    } catch {
      setOracleMessages(prev => [...prev, { role: "assistant", content: "Connection error. The model is offline." }]);
    }
    setOracleLoading(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#c8ccd4", fontFamily: "'Inter', -apple-system, sans-serif", position: "relative" }}>
      <ParticleField />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 10, padding: "16px 20px", borderBottom: "1px solid rgba(0,255,136,0.12)", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Link href="/command-center" style={{ color: "#5a6270", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>&larr; CMD</Link>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg, #00ff88, #00aa55)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 700, color: "#0a0a0f", boxShadow: "0 0 16px rgba(0,255,136,0.3)" }}>&Sigma;</div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#00ff88", letterSpacing: "2px" }}>FINANCE HQ</div>
              <div style={{ fontSize: "10px", color: "#5a6270", letterSpacing: "1px" }}>SIMONS x KIYOSAKI &middot; QUANTITATIVE COMMAND</div>
            </div>
          </div>
          <div style={{ fontSize: "12px", color: "#5a6270", fontFamily: "'JetBrains Mono', monospace" }}>{time}</div>
        </div>

        {/* Tab Nav */}
        <div style={{ display: "flex", gap: "4px", marginTop: "12px", overflowX: "auto" }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: tab === t.id ? "1px solid rgba(0,255,136,0.4)" : "1px solid rgba(255,255,255,0.06)",
                background: tab === t.id ? "rgba(0,255,136,0.1)" : "transparent",
                color: tab === t.id ? "#00ff88" : "#5a6270",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
                letterSpacing: "0.05em",
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ position: "relative", zIndex: 10, padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>

        {/* ═══ OVERVIEW TAB ═══ */}
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {[
                { label: "Portfolio Value", value: `$${totalEquity.toFixed(0)}`, sub: `${POSITIONS.length} positions`, color: "#00ff88" },
                { label: "Margin Debt", value: `$${MARGIN_DATA.effectiveDebt.toFixed(0)}`, sub: `${debtReduction}% reduced`, color: "#f59e0b" },
                { label: "Daily Interest", value: `$${(MARGIN_DATA.effectiveDebt * MARGIN_DATA.interestRate / 365).toFixed(2)}`, sub: `${(MARGIN_DATA.interestRate * 100)}% annual`, color: "#ef4444" },
                { label: "Cash Buffer", value: `$${MARGIN_DATA.cashBuffer.toFixed(0)}`, sub: "Buying power", color: "#22d3ee" },
              ].map((kpi, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  padding: "16px",
                  borderTop: `2px solid ${kpi.color}`,
                }}>
                  <div style={{ fontSize: "10px", color: "#5a6270", letterSpacing: "1px", fontWeight: 600, marginBottom: "6px" }}>{kpi.label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: kpi.color, fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</div>
                  <div style={{ fontSize: "11px", color: "#5a6270", marginTop: "4px" }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Debt Obliteration Progress */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#00ff88", letterSpacing: "1px", marginBottom: "12px" }}>DEBT OBLITERATION PROGRESS</div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ flex: 1, height: "8px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${debtReduction}%`,
                    background: "linear-gradient(90deg, #00ff88, #00aa55)",
                    borderRadius: "4px",
                    transition: "width 0.5s ease",
                  }} />
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#00ff88", fontFamily: "'JetBrains Mono', monospace" }}>{debtReduction}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "10px", color: "#5a6270" }}>
                <span>Phase 0: $2,738</span>
                <span>Current: ${MARGIN_DATA.effectiveDebt.toFixed(0)}</span>
                <span>Target: $0</span>
              </div>
            </div>

            {/* Quick Positions */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#22d3ee", letterSpacing: "1px", marginBottom: "12px" }}>POSITIONS</div>
              {POSITIONS.map((p, i) => {
                const value = p.shares * (p.currentPrice || p.avgCost);
                const weight = (value / totalEquity * 100).toFixed(1);
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: i < POSITIONS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{p.ticker}</span>
                      <span style={{ fontSize: "10px", color: "#5a6270" }}>{p.shares} shares</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "12px", color: "#8a91a5", fontFamily: "'JetBrains Mono', monospace" }}>${value.toFixed(0)}</span>
                      <span style={{ fontSize: "10px", color: "#5a6270", width: "40px", textAlign: "right" }}>{weight}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Signals */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#a855f7", letterSpacing: "1px", marginBottom: "12px" }}>ACTIVE SIGNALS</div>
              {DEMO_SIGNALS.map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "10px 0",
                  borderBottom: i < DEMO_SIGNALS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{
                    fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "3px",
                    background: `${SIGNAL_COLORS[s.type]}15`,
                    color: SIGNAL_COLORS[s.type],
                    border: `1px solid ${SIGNAL_COLORS[s.type]}30`,
                    whiteSpace: "nowrap",
                  }}>{SIGNAL_LABELS[s.type]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{s.ticker}</span>
                      <span style={{ color: "#5a6270", fontSize: "10px", marginLeft: "8px" }}>Strength: {s.strength}%</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "#8a91a5", marginTop: "2px", lineHeight: 1.5 }}>{s.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ PORTFOLIO TAB ═══ */}
        {tab === "portfolio" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#00ff88", letterSpacing: "1px", marginBottom: "16px" }}>POSITION DETAIL</div>

              {/* Table Header */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 60px 80px 80px 80px 1fr", gap: "8px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: "9px", fontWeight: 700, color: "#5a6270", letterSpacing: "1px" }}>
                <span>TICKER</span><span>SHARES</span><span>AVG COST</span><span>VALUE</span><span>WEIGHT</span><span>SECTOR</span>
              </div>

              {POSITIONS.map((p, i) => {
                const value = p.shares * (p.currentPrice || p.avgCost);
                const weight = (value / totalEquity * 100).toFixed(1);
                return (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "80px 60px 80px 80px 80px 1fr", gap: "8px",
                    padding: "10px 0",
                    borderBottom: i < POSITIONS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    fontSize: "12px", fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    <span style={{ fontWeight: 700, color: p.color }}>{p.ticker}</span>
                    <span style={{ color: "#8a91a5" }}>{p.shares}</span>
                    <span style={{ color: "#5a6270" }}>${p.avgCost}</span>
                    <span style={{ color: "#e2e8f0" }}>${value.toFixed(0)}</span>
                    <span style={{ color: Number(weight) > 25 ? "#f59e0b" : "#5a6270" }}>{weight}%</span>
                    <span style={{ color: "#5a6270", fontSize: "10px", fontFamily: "'Inter', sans-serif" }}>{p.sector}</span>
                  </div>
                );
              })}

              {/* Margin Summary */}
              <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,255,136,0.03)", borderRadius: "8px", border: "1px solid rgba(0,255,136,0.1)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#00ff88", letterSpacing: "1px", marginBottom: "8px" }}>MARGIN ACCOUNT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", fontSize: "11px" }}>
                  <div>
                    <div style={{ color: "#5a6270", fontSize: "9px", letterSpacing: "0.5px" }}>MARGIN USED</div>
                    <div style={{ color: "#f59e0b", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>${MARGIN_DATA.used.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#5a6270", fontSize: "9px", letterSpacing: "0.5px" }}>CASH BUFFER</div>
                    <div style={{ color: "#22d3ee", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>${MARGIN_DATA.cashBuffer.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#5a6270", fontSize: "9px", letterSpacing: "0.5px" }}>EFFECTIVE DEBT</div>
                    <div style={{ color: "#00ff88", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>${MARGIN_DATA.effectiveDebt.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation Visual */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#22d3ee", letterSpacing: "1px", marginBottom: "12px" }}>ALLOCATION</div>
              <div style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", gap: "2px" }}>
                {POSITIONS.map((p, i) => {
                  const value = p.shares * (p.currentPrice || p.avgCost);
                  const weight = value / totalEquity * 100;
                  return <div key={i} style={{ width: `${weight}%`, background: p.color, minWidth: "4px" }} />;
                })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "10px" }}>
                {POSITIONS.map((p, i) => {
                  const value = p.shares * (p.currentPrice || p.avgCost);
                  const weight = (value / totalEquity * 100).toFixed(1);
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "2px", background: p.color }} />
                      <span style={{ color: "#8a91a5" }}>{p.ticker} {weight}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ SIGNALS TAB ═══ */}
        {tab === "signals" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#a855f7", letterSpacing: "1px", marginBottom: "4px" }}>SIGNAL SCREENER</div>
              <div style={{ fontSize: "10px", color: "#5a6270", marginBottom: "16px" }}>Regime detection &middot; Momentum &middot; Mean Reversion &middot; Breakout</div>

              {DEMO_SIGNALS.map((s, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${SIGNAL_COLORS[s.type]}20`,
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "10px",
                  borderLeft: `3px solid ${SIGNAL_COLORS[s.type]}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 800, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{s.ticker}</span>
                      <span style={{
                        fontSize: "9px", fontWeight: 800, padding: "2px 8px", borderRadius: "4px",
                        background: `${SIGNAL_COLORS[s.type]}15`,
                        color: SIGNAL_COLORS[s.type],
                        border: `1px solid ${SIGNAL_COLORS[s.type]}30`,
                      }}>{SIGNAL_LABELS[s.type]}</span>
                    </div>
                    <span style={{ fontSize: "10px", color: "#5a6270" }}>{s.timestamp}</span>
                  </div>

                  {/* Strength Bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${s.strength}%`, background: SIGNAL_COLORS[s.type], borderRadius: "2px" }} />
                    </div>
                    <span style={{ fontSize: "10px", color: SIGNAL_COLORS[s.type], fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{s.strength}%</span>
                  </div>

                  <div style={{ fontSize: "12px", color: "#8a91a5", lineHeight: 1.6 }}>{s.message}</div>
                </div>
              ))}

              <div style={{ fontSize: "10px", color: "#3a4250", textAlign: "center", marginTop: "8px", fontStyle: "italic" }}>
                Live signals via yfinance MCP &middot; Updated pre-market
              </div>
            </div>
          </div>
        )}

        {/* ═══ RISK TAB ═══ */}
        {tab === "risk" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", letterSpacing: "1px", marginBottom: "4px" }}>RISK MONITOR</div>
              <div style={{ fontSize: "10px", color: "#5a6270", marginBottom: "16px" }}>Kelly criterion &middot; Drawdown scenarios &middot; Tail risk</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                {riskMetrics.map((m, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1px solid ${STATUS_COLORS[m.status]}20`,
                    borderRadius: "10px",
                    padding: "14px",
                    borderTop: `2px solid ${STATUS_COLORS[m.status]}`,
                  }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#5a6270", letterSpacing: "1px", marginBottom: "6px" }}>{m.label}</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: STATUS_COLORS[m.status], fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                    <div style={{ fontSize: "10px", color: "#5a6270", marginTop: "6px", lineHeight: 1.5 }}>{m.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stress Test */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1px", marginBottom: "12px" }}>STRESS TEST SCENARIOS</div>
              {[
                { scenario: "10% Market Drop", equity: "$3,438", marginCall: "No", color: "#22c55e" },
                { scenario: "20% Market Drop", equity: "$2,866", marginCall: "No", color: "#22c55e" },
                { scenario: "30% Market Drop", equity: "$2,294", marginCall: "No", color: "#f59e0b" },
                { scenario: "40% Market Drop", equity: "$1,722", marginCall: "Warning", color: "#ef4444" },
                { scenario: "50% Market Drop", equity: "$1,150", marginCall: "YES", color: "#ef4444" },
              ].map((s, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  fontSize: "12px",
                }}>
                  <span style={{ color: "#8a91a5" }}>{s.scenario}</span>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <span style={{ color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{s.equity}</span>
                    <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 8px", borderRadius: "3px", background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30` }}>
                      {s.marginCall}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ORACLE TAB ═══ */}
        {tab === "oracle" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)" }}>
            {/* Oracle Messages */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "12px 0",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              {oracleMessages.length === 0 && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "24px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px", background: "linear-gradient(135deg, #00ff88, #00aa55)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>&int;&part;&Sigma;</div>
                    <div style={{ fontSize: "13px", color: "#5a6270", maxWidth: "340px", lineHeight: 1.7 }}>
                      Markets aren&apos;t random. They&apos;re just very, very noisy.<br />
                      <span style={{ color: "#00ff88", fontSize: "11px" }}>&mdash; The Simons Philosophy</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", maxWidth: "460px", width: "100%" }}>
                    {[
                      "Analyze my portfolio risk",
                      "What regime is the market in?",
                      "Position sizing for a new trade",
                      "Should I trim TSLA?",
                      "Kelly criterion for my portfolio",
                      "Backtest a pairs trade idea",
                    ].map((p, i) => (
                      <button key={i} onClick={() => sendOracleMessage(p)} style={{
                        background: "rgba(0,255,136,0.05)",
                        border: "1px solid rgba(0,255,136,0.15)",
                        borderRadius: "8px", padding: "10px 12px",
                        color: "#8a91a5", fontSize: "11px", cursor: "pointer",
                        textAlign: "left", lineHeight: 1.5,
                        transition: "all 0.2s",
                        fontFamily: "inherit",
                      }}>{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {oracleMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: "8px" }}>
                  {m.role === "assistant" && (
                    <div style={{ width: 24, height: 24, borderRadius: "6px", flexShrink: 0, background: "linear-gradient(135deg, #00ff88, #00aa55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#0a0a0f", marginTop: 2 }}>&Sigma;</div>
                  )}
                  <div style={{
                    maxWidth: "80%", padding: "12px 16px",
                    borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: m.role === "user" ? "linear-gradient(135deg, #00aa55, #008844)" : "rgba(255,255,255,0.04)",
                    color: m.role === "user" ? "#ffffff" : "#c8ccd4",
                    fontSize: "12px", lineHeight: 1.7,
                    border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.06)",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>{m.content}</div>
                </div>
              ))}

              {oracleLoading && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "6px", background: "linear-gradient(135deg, #00ff88, #00aa55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#0a0a0f" }}>&Sigma;</div>
                  <div style={{ display: "flex", gap: "4px", padding: "12px" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", opacity: 0.4, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Oracle Input */}
            <div style={{ padding: "12px 0" }}>
              <div style={{
                display: "flex", gap: "8px", alignItems: "flex-end",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(0,255,136,0.15)",
                borderRadius: "12px", padding: "4px 4px 4px 14px",
              }}>
                <textarea
                  value={oracleInput}
                  onChange={e => setOracleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendOracleMessage(oracleInput); } }}
                  placeholder="Query the Oracle..."
                  rows={1}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "#c8ccd4", fontSize: "12px", fontFamily: "inherit",
                    resize: "none", padding: "8px 0", lineHeight: 1.5, maxHeight: "100px",
                  }}
                />
                <button onClick={() => sendOracleMessage(oracleInput)} disabled={oracleLoading || !oracleInput.trim()} style={{
                  width: 36, height: 36, borderRadius: "8px",
                  background: oracleInput.trim() ? "linear-gradient(135deg, #00ff88, #00aa55)" : "rgba(255,255,255,0.05)",
                  border: "none", cursor: oracleInput.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s", flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={oracleInput.trim() ? "#0a0a0f" : "#5a6270"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ CASHFLOW TAB (Kiyosaki Module) ═══ */}
        {tab === "cashflow" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "12px",
              padding: "16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1px" }}>KIYOSAKI CASHFLOW</div>
                <span style={{ fontSize: "9px", fontWeight: 800, padding: "2px 6px", borderRadius: "3px", background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>BUILDING</span>
              </div>
              <div style={{ fontSize: "10px", color: "#5a6270", marginBottom: "16px" }}>Asset / Liability classification &middot; Cash flow quadrant &middot; Passive income tracking</div>

              {/* Income */}
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#22c55e", letterSpacing: "1px", marginBottom: "8px" }}>INCOME STREAMS</div>
              {[{name:"Revenue",amount:12500,passive:false},{name:"Services",amount:8500,passive:false},{name:"Subscriptions",amount:4200,passive:true}].map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < 3 - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{item.name}</span>
                    <span style={{
                      fontSize: "8px", fontWeight: 800, padding: "1px 5px", borderRadius: "3px",
                      background: item.passive ? "rgba(34,197,94,0.1)" : "rgba(96,165,250,0.1)",
                      color: item.passive ? "#22c55e" : "#60a5fa",
                      border: `1px solid ${item.passive ? "rgba(34,197,94,0.2)" : "rgba(96,165,250,0.2)"}`,
                    }}>{item.passive ? "PASSIVE" : "EARNED"}</span>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>${item.amount.toFixed(2)}/mo</span>
                </div>
              ))}

              {/* Expenses */}
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#ef4444", letterSpacing: "1px", marginTop: "16px", marginBottom: "8px" }}>LIABILITIES</div>
              {[{name:"Salaries",amount:7500},{name:"Marketing",amount:3200},{name:"Infrastructure",amount:1800},{name:"Software",amount:950}].map((item, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: i < 4 - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{item.name}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>-${item.amount.toFixed(2)}/mo</span>
                </div>
              ))}

              {/* Net */}
              <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,255,136,0.03)", borderRadius: "8px", border: "1px solid rgba(0,255,136,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#5a6270" }}>MONTHLY NET CASHFLOW</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>
                  ${([{name:"Revenue",amount:12500},{name:"Services",amount:8500},{name:"Subscriptions",amount:4200}].reduce((s, i) => s + i.amount, 0) - [{name:"Salaries",amount:7500},{name:"Marketing",amount:3200},{name:"Infrastructure",amount:1800},{name:"Software",amount:950}].reduce((s, e) => s + e.amount, 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{
              background: "rgba(245,158,11,0.03)",
              border: "1px solid rgba(245,158,11,0.12)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>&#x1F3D7;</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b", marginBottom: "4px" }}>Kiyosaki Module — Under Construction</div>
              <div style={{ fontSize: "11px", color: "#5a6270", lineHeight: 1.6 }}>
                Full cash flow quadrant &middot; Asset/liability classification &middot; Passive income tracker<br />
                Coordinating with Kiyosaki agent via relay.
              </div>
            </div>
          </div>
        )}

        {/* ═══ MERIDIAN TAB ═══ */}
        {tab === "meridian" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {meridianError ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>Failed to load MERIDIAN data. Check API route.</div>
            ) : !meridianData ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#5a6270" }}>Loading MERIDIAN data...</div>
            ) : (
              <>
                {/* KPI Row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                  {[
                    { label: "Equity", value: `$${meridianData.portfolio.equity.toFixed(0)}`, color: "#00ff88" },
                    { label: "Return", value: `${meridianData.portfolio.total_return_pct > 0 ? "+" : ""}${meridianData.portfolio.total_return_pct}%`, color: meridianData.portfolio.total_return_pct >= 0 ? "#00ff88" : "#ef4444" },
                    { label: "Cash", value: `$${meridianData.portfolio.cash.toFixed(0)}`, color: "#22d3ee" },
                    { label: "Positions", value: `${meridianData.portfolio.positions.length}`, color: "#a855f7" },
                    { label: "Pipeline", value: `v${meridianData.pipeline_version}`, color: "#f59e0b" },
                  ].map((kpi, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px" }}>
                      <div style={{ fontSize: "10px", color: "#5a6270", letterSpacing: "1px", fontWeight: 700 }}>{kpi.label}</div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* Positions Table */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#00ff88", letterSpacing: "1.5px", marginBottom: "12px" }}>LIVE POSITIONS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 60px 80px 80px 80px 1fr", gap: "8px", fontSize: "10px", fontWeight: 700, color: "#5a6270", letterSpacing: "0.5px", marginBottom: "8px", padding: "0 4px" }}>
                    <span>TICKER</span><span>DIR</span><span>SHARES</span><span>ENTRY</span><span>SCORE</span><span>DATE</span>
                  </div>
                  {meridianData.portfolio.positions.map((pos, i) => {
                    const isLong = pos.direction === "long";
                    const scoreColor = pos.last_score > 20 ? "#00ff88" : pos.last_score > 0 ? "#f59e0b" : "#ef4444";
                    return (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "80px 60px 80px 80px 80px 1fr", gap: "8px",
                        padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                        fontSize: "12px", fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{pos.ticker}</span>
                        <span style={{ color: isLong ? "#00ff88" : "#ef4444", fontWeight: 700, fontSize: "10px" }}>{pos.direction.toUpperCase()}</span>
                        <span style={{ color: "#c8ccd4" }}>{Math.abs(pos.shares).toFixed(2)}</span>
                        <span style={{ color: "#c8ccd4" }}>${pos.entry_price.toFixed(2)}</span>
                        <span style={{ color: scoreColor, fontWeight: 700 }}>{pos.last_score.toFixed(1)}</span>
                        <span style={{ color: "#5a6270", fontSize: "10px" }}>{new Date(pos.entry_date).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Risk + Signals if available */}
                {meridianData.risk && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "1.5px", marginBottom: "12px" }}>RISK MONITOR</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                      {[
                        { label: "VaR (1d)", value: `${(meridianData.risk.portfolio_var * 100).toFixed(2)}%`, color: "#ef4444" },
                        { label: "Max Drawdown", value: `${(meridianData.risk.max_drawdown * 100).toFixed(2)}%`, color: "#f59e0b" },
                        { label: "Sharpe", value: meridianData.risk.sharpe_ratio.toFixed(2), color: "#22d3ee" },
                        { label: "Correlation", value: meridianData.risk.correlation_risk, color: "#a855f7" },
                      ].map((m, i) => (
                        <div key={i} style={{ padding: "10px" }}>
                          <div style={{ fontSize: "10px", color: "#5a6270", letterSpacing: "0.5px" }}>{m.label}</div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signals if available */}
                {meridianData.signals && meridianData.signals.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#22d3ee", letterSpacing: "1.5px", marginBottom: "12px" }}>SIGNAL SCREENER</div>
                    {meridianData.signals.map((sig, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{sig.ticker}</span>
                          <span style={{
                            fontSize: "9px", fontWeight: 700, letterSpacing: "1px",
                            padding: "2px 8px", borderRadius: "4px",
                            background: sig.action === "BUY" ? "rgba(0,255,136,0.1)" : sig.action === "SELL" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                            color: sig.action === "BUY" ? "#00ff88" : sig.action === "SELL" ? "#ef4444" : "#f59e0b",
                          }}>{sig.action}</span>
                        </div>
                        <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
                          <span style={{ color: "#5a6270" }}>CS: <span style={{ color: "#e2e8f0" }}>{sig.composite_score.toFixed(1)}</span></span>
                          <span style={{ color: "#5a6270" }}>M: <span style={{ color: "#22d3ee" }}>{sig.momentum_score.toFixed(1)}</span></span>
                          <span style={{ color: "#5a6270" }}>V: <span style={{ color: "#a855f7" }}>{sig.value_score.toFixed(1)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: "10px", color: "#3a4250", textAlign: "center", marginTop: "8px" }}>
                  Last updated: {new Date(meridianData.generated_at).toLocaleString()} · MERIDIAN Pipeline v{meridianData.pipeline_version}
                </div>
              </>
            )}
          </div>
        )}

        {/* Financial Analysis Tools */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#C9A84C", letterSpacing: "1.5px", marginBottom: "16px", textTransform: "uppercase" }}>Financial Analysis Tools</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            <div className="rounded-xl border-2 p-5 transition-all hover:scale-[1.02]" style={{ borderColor: 'rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.03)' }}>
              <h4 className="text-sm font-bold text-white/90 mb-1">Margin Simulator</h4>
              <p className="text-xs text-white/50 mb-3">Agent fleet margin simulator — MRR projections, token cost modeling, gross margins</p>
              <a href="/yolo-builds/2026-03-14-agent-margin-simulator/index.html" target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded border-2 font-semibold tracking-wider transition-all"
                style={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C' }}>
                Launch Tool →
              </a>
            </div>
            <div className="rounded-xl border-2 p-5 transition-all hover:scale-[1.02]" style={{ borderColor: 'rgba(34,211,238,0.2)', background: 'rgba(34,211,238,0.03)' }}>
              <h4 className="text-sm font-bold text-white/90 mb-1">APEX Sales Dashboard (Revenue View)</h4>
              <p className="text-xs text-white/50 mb-3">Revenue pipeline and conversion forecasting</p>
              <a href="/yolo-builds/2026-03-14-apex-sales-dashboard/index.html" target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded border-2 font-semibold tracking-wider transition-all"
                style={{ borderColor: 'rgba(34,211,238,0.4)', color: '#22d3ee' }}>
                Launch Tool →
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        textarea::placeholder { color: #3a4250; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}
