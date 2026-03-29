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
    position_count: number;
    long_count: number;
    short_count: number;
    equity_history: Array<{ date: string; equity: number }>;
    trade_count: number;
    win_count: number;
    loss_count: number;
    win_rate: number;
    total_realized_pnl: number;
  };
  signals?: Array<{
    ticker: string;
    composite_score: number;
    momentum_score: number;
    value_score: number;
    volatility_score: number;
    action: string;
    confidence?: number;
    price?: number;
    change_1d?: number;
    change_5d?: number;
    change_20d?: number;
  }>;
  risk?: {
    overall_status: string;
    alerts: string[];
    correlation: {
      status: string;
      avg_abs: number;
      max_abs: number;
      clusters: string[][];
      matrix: Record<string, Record<string, number>>;
    };
    drawdown: {
      status: string;
      current_pct: number;
      peak_equity: number;
      size_multiplier: number;
      new_trades_allowed: boolean;
      flatten_triggered: boolean;
    };
    signal_health: {
      healthy: Array<{ component: string; health_score: number; hit_rate: number; ic: number | null; observations: number }>;
      weak: Array<{ component: string; health_score: number; hit_rate: number; ic: number | null; observations: number }>;
      dead: Array<{ component: string; health_score: number; hit_rate: number; ic: number | null; observations: number }>;
      insufficient_data: Array<{ component: string; health_score: number; hit_rate: number; ic: number | null; observations: number }>;
      healthy_count: number;
      total_components: number;
    };
    portfolio_var: number;
    max_drawdown: number;
    sharpe_ratio: number;
    correlation_risk: string;
  };
  ab_test?: {
    days: number;
    a_control: { label: string; return_pct: number; sharpe: number; max_drawdown: number; volatility: number };
    b_treatment: { label: string; return_pct: number; sharpe: number; max_drawdown: number; volatility: number };
    alpha: number;
    leader: string;
    equity_curve: Array<{ date: string; a_equity: number; b_equity: number; alpha: number }>;
  };
  sector_rotation?: {
    sectors: Array<{ etf: string; name: string; quadrant: string; return_5d: number; return_20d: number; return_60d: number; excess_20d: number; momentum: number }>;
    quadrants: Record<string, string[]>;
  };
  optimizer?: {
    weights: Array<{ ticker: string; weight: number; direction: string }>;
    metrics: { expected_return: number; volatility: number; sharpe_ratio: number; max_weight: number; min_weight: number; net_exposure: number };
  };
  attribution?: {
    total_pnl: number;
    total_trades: number;
    win_rate: number;
    components: Array<{ component: string; net_pnl: number; agreement_rate: number; avg_decision_share: number }>;
  };
  earnings?: Array<{ ticker: string; date: string; days_until: number }>;
  volatility?: {
    vix: { vix: number; vix_percentile_1y: number };
    tickers: Record<string, {
      ticker: string;
      realized_vol_20d: number;
      realized_vol_5d: number;
      parkinson_vol: number;
      vol_of_vol: number;
      vol_percentile_60d: number;
      vol_ratio_5d_20d: number;
      vol_regime: string;
      vol_expanding: boolean;
      size_multiplier: number;
    }>;
  };
  stress_test?: {
    current_equity: number;
    scenarios: Record<string, {
      name: string;
      stressed_equity: number;
      drawdown_from_current: number;
      margin_call_risk: boolean;
      worst_position: string;
      best_position: string;
    }>;
    summary: { worst_case_equity: number; worst_case_drawdown: number; worst_scenario: string; best_case_equity: number; best_scenario: string; any_margin_call: boolean };
  };
  monte_carlo?: {
    equity: number;
    n_simulations: number;
    horizons: Record<string, {
      horizon_days: number;
      horizon_label: string;
      percentiles: { p5: number; p10: number; p25: number; median: number; p75: number; p90: number; p95: number };
      return_stats: { mean: number; std: number; min: number; max: number; skew: number };
      risk: { prob_loss_pct: number; var_95_pct: number; cvar_95_pct: number };
    }>;
  };
  walk_forward?: {
    results: {
      total_observations: number;
      information_coefficient: { ic_5d: number; ic_10d: number; ic_20d: number; interpretation: string };
      long_short: { long_count: number; short_count: number; hold_count: number; long_avg_return_20d: number; short_avg_return_20d: number; long_short_spread_20d: number; interpretation: string };
      by_action: Record<string, { count: number; avg_fwd_5d: number; avg_fwd_10d: number; avg_fwd_20d: number; hit_rate: number; avg_score: number }>;
    };
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

// ── SIGNALS — Live from Meridian pipeline when available ──────────────────────

const DEMO_SIGNALS: Signal[] = [];

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
  const [stripeData, setStripeData] = useState<{
    balance: { available: number; pending: number; currency: string };
    revenue: { last30Days: number; monthlyBreakdown: { month: string; amount: number }[]; totalCharges: number };
    subscriptions: { active: number; mrr: number; arr: number };
    recentTransactions: { id: string; amount: number; description: string; created: string; status: string }[];
    source: "live" | "unavailable";
  } | null>(null);

  useEffect(() => {
    fetch("/api/command-center/stripe-revenue")
      .then(r => r.json())
      .then(d => setStripeData(d))
      .catch(() => {});
  }, []);

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
              {DEMO_SIGNALS.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#3a4250", fontStyle: "italic" }}>Awaiting first signal data from Meridian pipeline</div>
                  <div style={{ fontSize: "9px", color: "#2a3240", marginTop: "4px" }}>Signals populate when yfinance MCP is connected</div>
                </div>
              ) : DEMO_SIGNALS.map((s, i) => (
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

              {DEMO_SIGNALS.length === 0 ? (
                <div style={{ padding: "30px 0", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "#3a4250" }}>Awaiting signal data from Meridian pipeline</div>
                  <div style={{ fontSize: "9px", color: "#2a3240", marginTop: "4px" }}>Connect yfinance MCP to populate live signals</div>
                </div>
              ) : DEMO_SIGNALS.map((s, i) => (
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

              {/* Income from real REVENUE_STREAMS */}
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#22c55e", letterSpacing: "1px", marginBottom: "8px" }}>INCOME STREAMS</div>
              {REVENUE_STREAMS.map((item, i) => {
                const isPassive = item.quadrant === "I" || item.quadrant === "B";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: i < REVENUE_STREAMS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#e2e8f0" }}>{item.name}</span>
                      <span style={{
                        fontSize: "8px", fontWeight: 800, padding: "1px 5px", borderRadius: "3px",
                        background: isPassive ? "rgba(34,197,94,0.1)" : "rgba(96,165,250,0.1)",
                        color: isPassive ? "#22c55e" : "#60a5fa",
                        border: `1px solid ${isPassive ? "rgba(34,197,94,0.2)" : "rgba(96,165,250,0.2)"}`,
                      }}>{item.quadrant}</span>
                      <span style={{
                        fontSize: "7px", fontWeight: 700, padding: "1px 4px", borderRadius: "2px",
                        background: item.status === "active" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
                        color: item.status === "active" ? "#22c55e" : "#f59e0b",
                      }}>{item.status.toUpperCase()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: item.monthly > 0 ? "#22c55e" : "#3a4250", fontFamily: "'JetBrains Mono', monospace" }}>
                        ${item.monthly.toFixed(0)}/mo
                      </span>
                      {item.potential > item.monthly && (
                        <span style={{ fontSize: "9px", color: "#5a6270" }}>→ ${item.potential}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Expenses */}
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#ef4444", letterSpacing: "1px", marginTop: "16px", marginBottom: "8px" }}>MONTHLY EXPENSES</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                <span style={{ fontSize: "12px", color: "#e2e8f0" }}>Total Monthly Expenses</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>-${MONTHLY_EXPENSES.toFixed(0)}/mo</span>
              </div>

              {/* Net */}
              {(() => {
                const totalIncome = REVENUE_STREAMS.reduce((s, r) => s + r.monthly, 0);
                const net = totalIncome - MONTHLY_EXPENSES;
                return (
                  <div style={{ marginTop: "16px", padding: "12px", background: net >= 0 ? "rgba(0,255,136,0.03)" : "rgba(239,68,68,0.03)", borderRadius: "8px", border: `1px solid ${net >= 0 ? "rgba(0,255,136,0.1)" : "rgba(239,68,68,0.1)"}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#5a6270" }}>MONTHLY NET CASHFLOW</span>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: net >= 0 ? "#22c55e" : "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>
                      {net >= 0 ? "+" : ""}${net.toFixed(0)}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Stripe Live Revenue */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#7c3aed", letterSpacing: "1px" }}>STRIPE REVENUE — LIVE</div>
                <span style={{
                  fontSize: "8px", fontWeight: 800, padding: "2px 6px", borderRadius: "3px",
                  background: stripeData?.source === "live" ? "rgba(34,197,94,0.1)" : "rgba(113,113,122,0.1)",
                  color: stripeData?.source === "live" ? "#22c55e" : "#71717a",
                  border: `1px solid ${stripeData?.source === "live" ? "rgba(34,197,94,0.2)" : "rgba(113,113,122,0.2)"}`,
                }}>{stripeData?.source === "live" ? "CONNECTED" : "NOT CONFIGURED"}</span>
              </div>
              {stripeData && stripeData.source === "live" ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "14px" }}>
                    {[
                      { label: "Last 30 Days", value: `$${stripeData.revenue.last30Days.toFixed(0)}`, color: "#22c55e" },
                      { label: "Available Balance", value: `$${stripeData.balance.available.toFixed(2)}`, color: "#22d3ee" },
                      { label: "Pending", value: `$${stripeData.balance.pending.toFixed(2)}`, color: "#f59e0b" },
                      { label: "Active Subscriptions", value: `${stripeData.subscriptions.active}`, color: "#7c3aed" },
                      { label: "MRR", value: `$${stripeData.subscriptions.mrr.toFixed(0)}`, color: "#00ff88" },
                      { label: "ARR", value: `$${stripeData.subscriptions.arr.toFixed(0)}`, color: "#22d3ee" },
                    ].map((kpi, i) => (
                      <div key={i} style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ fontSize: "9px", color: "#5a6270", letterSpacing: "0.5px", fontWeight: 600 }}>{kpi.label}</div>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>
                  {stripeData.revenue.monthlyBreakdown.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: "#5a6270", letterSpacing: "0.5px", marginBottom: "8px" }}>MONTHLY BREAKDOWN</div>
                      {stripeData.revenue.monthlyBreakdown.map((m, i) => {
                        const maxAmount = Math.max(...stripeData.revenue.monthlyBreakdown.map(x => x.amount), 1);
                        const pct = (m.amount / maxAmount) * 100;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "10px", color: "#5a6270", width: "60px", fontFamily: "'JetBrains Mono', monospace" }}>{m.month}</span>
                            <div style={{ flex: 1, height: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "5px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #7c3aed, #22d3ee)", borderRadius: "5px" }} />
                            </div>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", width: "60px", textAlign: "right" }}>${m.amount.toFixed(0)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {stripeData.recentTransactions.length > 0 && (
                    <div>
                      <div style={{ fontSize: "9px", fontWeight: 700, color: "#5a6270", letterSpacing: "0.5px", marginBottom: "8px" }}>RECENT TRANSACTIONS</div>
                      {stripeData.recentTransactions.slice(0, 5).map((tx, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                          <span style={{ fontSize: "11px", color: "#e2e8f0" }}>{tx.description || "Payment"}</span>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#22c55e", fontFamily: "'JetBrains Mono', monospace" }}>+${tx.amount.toFixed(2)}</span>
                            <span style={{ fontSize: "9px", color: "#5a6270" }}>{new Date(tx.created).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>💳</div>
                  <div style={{ fontSize: "12px", color: "#5a6270", lineHeight: 1.6 }}>
                    Set <code style={{ color: "#7c3aed", background: "rgba(124,58,237,0.1)", padding: "1px 4px", borderRadius: "3px" }}>STRIPE_SECRET_KEY</code> in env to see live revenue data
                  </div>
                </div>
              )}
            </div>

            {/* Entity Structure */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#22d3ee", letterSpacing: "1px", marginBottom: "12px" }}>ENTITY STRUCTURE</div>
              {ENTITY_STRUCTURE.map((entity, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < ENTITY_STRUCTURE.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2e8f0" }}>{entity.name}</div>
                    <div style={{ fontSize: "10px", color: "#5a6270", marginTop: "2px" }}>{entity.purpose}</div>
                  </div>
                  <span style={{ fontSize: "8px", fontWeight: 800, padding: "2px 8px", borderRadius: "3px", background: entity.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", color: entity.status === "active" ? "#22c55e" : "#f59e0b", border: `1px solid ${entity.status === "active" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}` }}>
                    {entity.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {/* Wealth Actions */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1px", marginBottom: "12px" }}>WEALTH ACTION ITEMS</div>
              {WEALTH_ACTIONS.map((action, i) => {
                const priorityColor = action.priority === "high" ? "#ef4444" : action.priority === "medium" ? "#f59e0b" : "#525252";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: i < WEALTH_ACTIONS.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityColor, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "11px", color: "#e2e8f0" }}>{action.task}</div>
                      <div style={{ fontSize: "9px", color: "#5a6270" }}>{action.deadline}</div>
                    </div>
                    <span style={{ fontSize: "8px", fontWeight: 700, padding: "2px 6px", borderRadius: "3px", background: `${priorityColor}15`, color: priorityColor, border: `1px solid ${priorityColor}30` }}>
                      {action.status.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rich Dad Quote */}
            <div style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "13px", color: "#f59e0b", fontStyle: "italic", lineHeight: 1.6 }}>
                &ldquo;{RICH_DAD_QUOTES[0]}&rdquo;
              </div>
              <div style={{ fontSize: "10px", color: "#5a6270", marginTop: "6px" }}>&mdash; Rich Dad Philosophy</div>
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                  {[
                    { label: "Equity", value: `$${meridianData.portfolio.equity.toFixed(0)}`, color: "#00ff88" },
                    { label: "Return", value: `${meridianData.portfolio.total_return_pct > 0 ? "+" : ""}${meridianData.portfolio.total_return_pct}%`, color: meridianData.portfolio.total_return_pct >= 0 ? "#00ff88" : "#ef4444" },
                    { label: "Cash", value: `$${meridianData.portfolio.cash.toFixed(0)}`, color: "#22d3ee" },
                    { label: "Positions", value: `${meridianData.portfolio.positions.length}`, color: "#a855f7" },
                    { label: "Win Rate", value: `${(meridianData.portfolio.win_rate ?? 0).toFixed(1)}%`, color: "#f59e0b" },
                    { label: "Alpha", value: meridianData.ab_test ? `+${meridianData.ab_test.alpha.toFixed(1)}%` : "—", color: "#00ff88" },
                    { label: "Pipeline", value: `v${meridianData.pipeline_version}`, color: "#f59e0b" },
                  ].map((kpi, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px" }}>
                      <div style={{ fontSize: "10px", color: "#5a6270", letterSpacing: "1px", fontWeight: 700 }}>{kpi.label}</div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: kpi.color, fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>

                {/* ── A/B TEST COMPARISON ── */}
                {meridianData.ab_test && (() => {
                  const ab = meridianData.ab_test!;
                  const metrics = [
                    { label: "Return", a: ab.a_control.return_pct, b: ab.b_treatment.return_pct, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%` },
                    { label: "Sharpe", a: ab.a_control.sharpe, b: ab.b_treatment.sharpe, fmt: (v: number) => v.toFixed(2) },
                    { label: "Max DD", a: ab.a_control.max_drawdown, b: ab.b_treatment.max_drawdown, fmt: (v: number) => `${v.toFixed(2)}%`, invertColor: true },
                    { label: "Volatility", a: ab.a_control.volatility, b: ab.b_treatment.volatility, fmt: (v: number) => `${v.toFixed(1)}%`, invertColor: true },
                  ];
                  return (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#00ff88", letterSpacing: "1.5px" }}>A/B TEST — DAY {ab.days}</div>
                        <div style={{ fontSize: "11px", fontWeight: 800, color: "#00ff88", fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,255,136,0.08)", padding: "3px 10px", borderRadius: "6px", border: "1px solid rgba(0,255,136,0.15)" }}>
                          ALPHA +{ab.alpha.toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#5a6270", textAlign: "center", letterSpacing: "0.5px" }}>A: {ab.a_control.label}</div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#5a6270", textAlign: "center", letterSpacing: "0.5px" }}>B: {ab.b_treatment.label}</div>
                      </div>
                      {metrics.map((m, i) => {
                        const maxVal = Math.max(Math.abs(m.a), Math.abs(m.b), 0.01);
                        const aPct = Math.min(Math.abs(m.a) / maxVal * 100, 100);
                        const bPct = Math.min(Math.abs(m.b) / maxVal * 100, 100);
                        const aWins = m.invertColor ? m.a < m.b : m.a > m.b;
                        return (
                          <div key={i} style={{ marginBottom: "10px" }}>
                            <div style={{ fontSize: "10px", color: "#5a6270", marginBottom: "4px", letterSpacing: "0.5px" }}>{m.label}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                              <div style={{ position: "relative", height: "22px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", overflow: "hidden" }}>
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${aPct}%`, background: aWins ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.15)", borderRadius: "4px", transition: "width 0.5s" }} />
                                <span style={{ position: "relative", fontSize: "11px", fontWeight: 700, color: aWins ? "#00ff88" : "#ef4444", fontFamily: "'JetBrains Mono', monospace", lineHeight: "22px", paddingLeft: "6px" }}>{m.fmt(m.a)}</span>
                              </div>
                              <div style={{ position: "relative", height: "22px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", overflow: "hidden" }}>
                                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${bPct}%`, background: !aWins ? "rgba(0,255,136,0.2)" : "rgba(239,68,68,0.15)", borderRadius: "4px", transition: "width 0.5s" }} />
                                <span style={{ position: "relative", fontSize: "11px", fontWeight: 700, color: !aWins ? "#00ff88" : "#ef4444", fontFamily: "'JetBrains Mono', monospace", lineHeight: "22px", paddingLeft: "6px" }}>{m.fmt(m.b)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

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

                {/* ── ENHANCED RISK DASHBOARD ── */}
                {meridianData.risk && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "1.5px" }}>RISK DASHBOARD</div>
                      <div style={{
                        fontSize: "10px", fontWeight: 800, letterSpacing: "1px", padding: "3px 10px", borderRadius: "6px",
                        background: meridianData.risk.overall_status === "GREEN" ? "rgba(0,255,136,0.1)" : meridianData.risk.overall_status === "YELLOW" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                        color: meridianData.risk.overall_status === "GREEN" ? "#00ff88" : meridianData.risk.overall_status === "YELLOW" ? "#f59e0b" : "#ef4444",
                        border: `1px solid ${meridianData.risk.overall_status === "GREEN" ? "rgba(0,255,136,0.2)" : meridianData.risk.overall_status === "YELLOW" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
                      }}>{meridianData.risk.overall_status}</div>
                    </div>
                    {meridianData.risk.alerts && meridianData.risk.alerts.length > 0 && (
                      <div style={{ marginBottom: "12px" }}>
                        {meridianData.risk.alerts.map((alert, i) => (
                          <div key={i} style={{ fontSize: "11px", color: "#f59e0b", padding: "6px 10px", background: "rgba(245,158,11,0.06)", borderRadius: "6px", marginBottom: "4px", border: "1px solid rgba(245,158,11,0.12)" }}>{alert}</div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "14px" }}>
                      {[
                        { label: "VaR (1d)", value: `${(meridianData.risk.portfolio_var * 100).toFixed(2)}%`, color: "#ef4444" },
                        { label: "Max Drawdown", value: `${(meridianData.risk.max_drawdown * 100).toFixed(2)}%`, color: "#f59e0b" },
                        { label: "Sharpe", value: meridianData.risk.sharpe_ratio.toFixed(2), color: "#22d3ee" },
                        { label: "Correlation", value: meridianData.risk.correlation_risk, color: "#a855f7" },
                        { label: "DD Status", value: meridianData.risk.drawdown?.status ?? "—", color: meridianData.risk.drawdown?.status === "GREEN" ? "#00ff88" : "#f59e0b" },
                        { label: "Corr Avg", value: meridianData.risk.correlation?.avg_abs?.toFixed(3) ?? "—", color: "#22d3ee" },
                      ].map((m, i) => (
                        <div key={i} style={{ padding: "10px" }}>
                          <div style={{ fontSize: "10px", color: "#5a6270", letterSpacing: "0.5px" }}>{m.label}</div>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {meridianData.risk.signal_health && (
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#5a6270", letterSpacing: "1px", marginBottom: "8px" }}>SIGNAL HEALTH</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {[
                            ...(meridianData.risk.signal_health.healthy || []).map(c => ({ ...c, status: "healthy" as const })),
                            ...(meridianData.risk.signal_health.weak || []).map(c => ({ ...c, status: "weak" as const })),
                            ...(meridianData.risk.signal_health.dead || []).map(c => ({ ...c, status: "dead" as const })),
                            ...(meridianData.risk.signal_health.insufficient_data || []).map(c => ({ ...c, status: "nodata" as const })),
                          ].map((c, i) => {
                            const statusColor = c.status === "healthy" ? "#00ff88" : c.status === "weak" ? "#f59e0b" : c.status === "dead" ? "#ef4444" : "#5a6270";
                            return (
                              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: `1px solid ${statusColor}33`, minWidth: "80px" }}>
                                <div style={{ fontSize: "9px", fontWeight: 700, color: statusColor, letterSpacing: "0.5px", marginBottom: "4px" }}>{c.component.toUpperCase()}</div>
                                <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                                  <div style={{ width: `${c.health_score}%`, height: "100%", background: statusColor, borderRadius: "2px" }} />
                                </div>
                                <div style={{ fontSize: "9px", color: "#5a6270", marginTop: "3px", fontFamily: "'JetBrains Mono', monospace" }}>{c.health_score.toFixed(0)}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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

                {/* ── ROW: SECTOR ROTATION + OPTIMIZER WEIGHTS ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* Sector Rotation 2x2 Grid */}
                  {meridianData.sector_rotation && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#a855f7", letterSpacing: "1.5px", marginBottom: "12px" }}>SECTOR ROTATION</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: "6px" }}>
                        {(["LEADING", "IMPROVING", "WEAKENING", "LAGGING"] as const).map((q) => {
                          const qColor = q === "LEADING" ? "#00ff88" : q === "IMPROVING" ? "#22d3ee" : q === "WEAKENING" ? "#f59e0b" : "#ef4444";
                          const sectors = meridianData.sector_rotation!.sectors.filter(s => s.quadrant === q);
                          return (
                            <div key={q} style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: `1px solid ${qColor}22` }}>
                              <div style={{ fontSize: "9px", fontWeight: 700, color: qColor, letterSpacing: "1px", marginBottom: "6px" }}>{q}</div>
                              {sectors.length === 0 ? (
                                <div style={{ fontSize: "10px", color: "#3a4250" }}>—</div>
                              ) : sectors.map((s, si) => (
                                <div key={si} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{s.etf}</span>
                                  <span style={{ fontSize: "9px", color: "#5a6270" }}>{s.name}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Optimizer Weights Horizontal Bars */}
                  {meridianData.optimizer && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#22d3ee", letterSpacing: "1.5px" }}>OPTIMIZER WEIGHTS</div>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#22d3ee", fontFamily: "'JetBrains Mono', monospace" }}>Sharpe {meridianData.optimizer.metrics.sharpe_ratio.toFixed(2)}</div>
                      </div>
                      {meridianData.optimizer.weights.sort((a, b) => b.weight - a.weight).map((w, i) => {
                        const maxW = Math.max(...meridianData.optimizer!.weights.map(x => Math.abs(x.weight)), 1);
                        const pct = Math.abs(w.weight) / maxW * 100;
                        const barColor = w.direction === "long" ? "#00ff88" : "#ef4444";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace", width: "60px" }}>{w.ticker}</span>
                            <div style={{ flex: 1, height: "14px", background: "rgba(255,255,255,0.03)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: `${barColor}33`, borderRadius: "3px" }} />
                            </div>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: barColor, fontFamily: "'JetBrains Mono', monospace", width: "50px", textAlign: "right" }}>{w.weight > 0 ? "+" : ""}{w.weight.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                      <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "10px", color: "#5a6270" }}>
                        <span>Net Exp: <span style={{ color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{meridianData.optimizer.metrics.net_exposure.toFixed(1)}%</span></span>
                        <span>E[R]: <span style={{ color: "#00ff88", fontFamily: "'JetBrains Mono', monospace" }}>{meridianData.optimizer.metrics.expected_return.toFixed(1)}%</span></span>
                        <span>Vol: <span style={{ color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{meridianData.optimizer.metrics.volatility.toFixed(1)}%</span></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── VOLATILITY BADGES ── */}
                {meridianData.volatility && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1.5px" }}>VOLATILITY REGIME</div>
                      <div style={{ display: "flex", gap: "12px", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ color: "#5a6270" }}>VIX: <span style={{ color: meridianData.volatility.vix.vix > 25 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>{meridianData.volatility.vix.vix.toFixed(1)}</span></span>
                        <span style={{ color: "#5a6270" }}>Pctl: <span style={{ color: meridianData.volatility.vix.vix_percentile_1y > 80 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>{meridianData.volatility.vix.vix_percentile_1y.toFixed(0)}%</span></span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {Object.values(meridianData.volatility.tickers).map((tv, i) => {
                        const regimeColor = tv.vol_regime === "LOW" ? "#00ff88" : tv.vol_regime === "NORMAL" ? "#22d3ee" : tv.vol_regime === "HIGH" ? "#f59e0b" : "#ef4444";
                        return (
                          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: `1px solid ${regimeColor}22`, minWidth: "90px" }}>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{tv.ticker}</div>
                            <div style={{ fontSize: "9px", fontWeight: 800, color: regimeColor, letterSpacing: "0.5px", marginTop: "3px", padding: "1px 6px", borderRadius: "3px", background: `${regimeColor}15` }}>{tv.vol_regime}{tv.vol_expanding ? " ↑" : ""}</div>
                            <div style={{ fontSize: "9px", color: "#5a6270", marginTop: "4px", fontFamily: "'JetBrains Mono', monospace" }}>20d: {(tv.realized_vol_20d * 100).toFixed(0)}% · sz: {tv.size_multiplier.toFixed(2)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── STRESS TEST SCENARIO TABLE ── */}
                {meridianData.stress_test && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#ef4444", letterSpacing: "1.5px", marginBottom: "12px" }}>STRESS TEST SCENARIOS</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 70px 70px", gap: "8px", fontSize: "10px", fontWeight: 700, color: "#5a6270", letterSpacing: "0.5px", marginBottom: "6px", padding: "0 4px" }}>
                      <span>SCENARIO</span><span>EQUITY</span><span>DRAWDOWN</span><span>WORST</span><span>BEST</span>
                    </div>
                    {Object.values(meridianData.stress_test.scenarios).map((sc, i) => {
                      const ddColor = sc.drawdown_from_current < -5 ? "#ef4444" : sc.drawdown_from_current < 0 ? "#f59e0b" : "#00ff88";
                      const ddAbsPct = Math.min(Math.abs(sc.drawdown_from_current) * 5, 100);
                      return (
                        <div key={i} style={{
                          display: "grid", gridTemplateColumns: "1fr 100px 80px 70px 70px", gap: "8px",
                          padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.04)",
                          fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", alignItems: "center",
                        }}>
                          <div>
                            <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "11px" }}>{sc.name}</div>
                            {sc.margin_call_risk && <span style={{ fontSize: "8px", color: "#ef4444", fontWeight: 800, letterSpacing: "0.5px" }}>MARGIN RISK</span>}
                          </div>
                          <span style={{ color: "#c8ccd4" }}>${sc.stressed_equity.toFixed(0)}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <div style={{ width: "30px", height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${ddAbsPct}%`, height: "100%", background: ddColor, borderRadius: "3px" }} />
                            </div>
                            <span style={{ color: ddColor, fontWeight: 700 }}>{sc.drawdown_from_current > 0 ? "+" : ""}{sc.drawdown_from_current.toFixed(2)}%</span>
                          </div>
                          <span style={{ color: "#ef4444", fontSize: "10px" }}>{sc.worst_position}</span>
                          <span style={{ color: "#00ff88", fontSize: "10px" }}>{sc.best_position}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── EARNINGS CALENDAR ── */}
                {meridianData.earnings && meridianData.earnings.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1.5px", marginBottom: "12px" }}>EARNINGS CALENDAR</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {meridianData.earnings.map((e, i) => {
                        const urgent = e.days_until <= 3;
                        const hasPosition = meridianData.portfolio.positions.some(p => p.ticker === e.ticker);
                        return (
                          <div key={i} style={{
                            padding: "8px 12px", borderRadius: "8px",
                            background: urgent ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${urgent ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                            display: "flex", alignItems: "center", gap: "8px",
                          }}>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{e.ticker}</span>
                            <span style={{ fontSize: "10px", color: urgent ? "#ef4444" : "#5a6270" }}>{e.days_until}d</span>
                            {hasPosition && <span style={{ fontSize: "8px", fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "1px 5px", borderRadius: "3px" }}>OPEN</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {meridianData.earnings && meridianData.earnings.length === 0 && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "1.5px" }}>EARNINGS CALENDAR</div>
                    <div style={{ fontSize: "11px", color: "#3a4250" }}>No upcoming earnings in 14d window</div>
                  </div>
                )}

                {/* ── MONTE CARLO CONFIDENCE INTERVALS ── */}
                {meridianData.monte_carlo && (
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#a855f7", letterSpacing: "1.5px" }}>MONTE CARLO — {meridianData.monte_carlo.n_simulations.toLocaleString()} SIMS</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                      {Object.entries(meridianData.monte_carlo.horizons).map(([key, h]) => {
                        const range = h.percentiles.p95 - h.percentiles.p5;
                        const eq = meridianData.monte_carlo!.equity;
                        const minP = h.percentiles.p5;
                        const pctOfRange = (v: number) => range > 0 ? ((v - minP) / range) * 100 : 50;
                        return (
                          <div key={key} style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#a855f7", marginBottom: "8px" }}>{h.horizon_label.toUpperCase()}</div>
                            <div style={{ position: "relative", height: "28px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", marginBottom: "8px", overflow: "hidden" }}>
                              <div style={{ position: "absolute", left: `${pctOfRange(h.percentiles.p25)}%`, top: 0, height: "100%", width: `${pctOfRange(h.percentiles.p75) - pctOfRange(h.percentiles.p25)}%`, background: "rgba(168,85,247,0.2)", borderRadius: "4px" }} />
                              <div style={{ position: "absolute", left: `${pctOfRange(h.percentiles.median)}%`, top: "2px", width: "2px", height: "24px", background: "#a855f7", borderRadius: "1px" }} />
                              <div style={{ position: "absolute", left: `${pctOfRange(eq)}%`, top: "4px", width: "6px", height: "6px", borderRadius: "50%", background: "#22d3ee", transform: "translateX(-3px)", marginTop: "7px" }} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", fontSize: "9px", fontFamily: "'JetBrains Mono', monospace" }}>
                              <div><span style={{ color: "#5a6270" }}>P5</span> <span style={{ color: "#ef4444" }}>${(h.percentiles.p5 / 1000).toFixed(1)}k</span></div>
                              <div style={{ textAlign: "center" }}><span style={{ color: "#5a6270" }}>MED</span> <span style={{ color: "#a855f7" }}>${(h.percentiles.median / 1000).toFixed(1)}k</span></div>
                              <div style={{ textAlign: "right" }}><span style={{ color: "#5a6270" }}>P95</span> <span style={{ color: "#00ff88" }}>${(h.percentiles.p95 / 1000).toFixed(1)}k</span></div>
                            </div>
                            <div style={{ display: "flex", gap: "10px", marginTop: "6px", fontSize: "9px", color: "#5a6270" }}>
                              <span>P(loss): <span style={{ color: h.risk.prob_loss_pct > 30 ? "#ef4444" : "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{h.risk.prob_loss_pct}%</span></span>
                              <span>VaR95: <span style={{ color: "#ef4444", fontFamily: "'JetBrains Mono', monospace" }}>{h.risk.var_95_pct.toFixed(2)}%</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── ROW: WALK-FORWARD + ATTRIBUTION ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* Walk-Forward IC and Spread */}
                  {meridianData.walk_forward && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: "#22d3ee", letterSpacing: "1.5px", marginBottom: "12px" }}>WALK-FORWARD VALIDATION</div>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        {[
                          { label: "IC 5d", value: meridianData.walk_forward.results.information_coefficient.ic_5d, },
                          { label: "IC 10d", value: meridianData.walk_forward.results.information_coefficient.ic_10d, },
                          { label: "IC 20d", value: meridianData.walk_forward.results.information_coefficient.ic_20d, },
                        ].map((ic, i) => {
                          const icColor = ic.value > 0.05 ? "#00ff88" : ic.value > 0 ? "#f59e0b" : "#ef4444";
                          return (
                            <div key={i} style={{ flex: 1, padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
                              <div style={{ fontSize: "9px", color: "#5a6270", letterSpacing: "0.5px" }}>{ic.label}</div>
                              <div style={{ fontSize: "16px", fontWeight: 800, color: icColor, fontFamily: "'JetBrains Mono', monospace", marginTop: "2px" }}>{ic.value.toFixed(3)}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ padding: "8px", borderRadius: "6px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)", marginBottom: "10px" }}>
                        <div style={{ fontSize: "9px", color: "#5a6270", letterSpacing: "0.5px", marginBottom: "2px" }}>LONG/SHORT SPREAD (20d)</div>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#00ff88", fontFamily: "'JetBrains Mono', monospace" }}>{meridianData.walk_forward.results.long_short.long_short_spread_20d.toFixed(2)}%</div>
                      </div>
                      <div style={{ fontSize: "10px", color: "#5a6270", lineHeight: 1.5 }}>{meridianData.walk_forward.results.information_coefficient.interpretation}</div>
                    </div>
                  )}

                  {/* Attribution Component Bars */}
                  {meridianData.attribution && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#00ff88", letterSpacing: "1.5px" }}>ATTRIBUTION</div>
                        <div style={{ fontSize: "10px", color: "#5a6270", fontFamily: "'JetBrains Mono', monospace" }}>
                          {meridianData.attribution.total_trades} trades · {meridianData.attribution.win_rate.toFixed(1)}% WR
                        </div>
                      </div>
                      {meridianData.attribution.components.sort((a, b) => b.net_pnl - a.net_pnl).map((c, i) => {
                        const maxPnl = Math.max(...meridianData.attribution!.components.map(x => Math.abs(x.net_pnl)), 1);
                        const pct = Math.abs(c.net_pnl) / maxPnl * 100;
                        const barColor = c.net_pnl >= 0 ? "#00ff88" : "#ef4444";
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                            <span style={{ fontSize: "9px", fontWeight: 700, color: "#5a6270", width: "75px", letterSpacing: "0.3px", textTransform: "uppercase" }}>{c.component}</span>
                            <div style={{ flex: 1, height: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
                              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: `${barColor}33`, borderRadius: "3px" }} />
                            </div>
                            <span style={{ fontSize: "10px", fontWeight: 700, color: barColor, fontFamily: "'JetBrains Mono', monospace", width: "55px", textAlign: "right" }}>{c.net_pnl >= 0 ? "+" : ""}{c.net_pnl.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

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
