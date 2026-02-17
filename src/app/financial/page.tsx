"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { APEX_PRICING, APEX_PROJECTIONS as SHARED_PROJECTIONS, NAV_LINKS, KEY_METRICS } from "@/lib/shared-config";

/* ══════════════════════════════════════════════════════════════════════════════
   FINANCIAL DASHBOARD — KIYOSAKI'S ORACLE
   Revenue projections, brand P&L, pricing tiers, and growth metrics.
   Powered by KIYOSAKI (8 financial minds integrated).
   Imports from shared-config.ts — single source of truth.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── NAV ───────────────────────────────────────────────────────────────────── */
const NAV = NAV_LINKS.map(n => ({
  ...n,
  active: n.label === "FINANCE",
}));

/* ── APEX ATHLETE FINANCIALS (from shared config) ──────────────────────────── */
const APEX_TIERS = APEX_PRICING.tiers.map(t => ({
  name: t.name,
  price: t.priceLabel,
  teams: t.athletes,
  features: t.features,
  color: t.color,
}));

const APEX_PROJECTIONS = SHARED_PROJECTIONS.map(p => ({ ...p }));

/* ── BRAND REVENUE STREAMS ─────────────────────────────────────────────────── */
const BRANDS = [
  {
    name: "Apex Athlete", accent: "#f59e0b", icon: "\u2726",
    streams: [
      { name: "SaaS Subscriptions ($149-$549/mo)", status: "active", monthly: "Beta (Stripe live)", potential: "$310K/mo @ 1K teams" },
      { name: "App Store (v3)", status: "planned", monthly: "\u2014", potential: "$50K+/mo (30% premium)" },
    ],
  },
  {
    name: "Galactik Antics", accent: "#00f0ff", icon: "\u2606",
    streams: [
      { name: "Phone Cases", status: "ready", monthly: "\u2014", potential: "$5K\u2013$15K/mo" },
      { name: "Framed Posters", status: "ready", monthly: "\u2014", potential: "$3K\u2013$8K/mo" },
      { name: "T-Shirts", status: "planned", monthly: "\u2014", potential: "$2K\u2013$6K/mo" },
      { name: "Collector Tiers", status: "planned", monthly: "\u2014", potential: "$1K\u2013$5K/mo (recurring)" },
    ],
  },
  {
    name: "Ramiche Studio", accent: "#a855f7", icon: "\u2662",
    streams: [
      { name: "48h Sprint ($300\u2013$500)", status: "active", monthly: "\u2014", potential: "$3K\u2013$10K/mo" },
      { name: "AI Agent Setup ($1K\u2013$3K)", status: "soon", monthly: "\u2014", potential: "$5K\u2013$15K/mo" },
      { name: "Shopify Setup ($500\u20131.5K)", status: "soon", monthly: "\u2014", potential: "$2K\u2013$6K/mo" },
    ],
  },
  {
    name: "The Baba Studio", accent: "#e879f9", icon: "\u266B",
    streams: [
      { name: "Music Releases", status: "blocked", monthly: "\u2014", potential: "TBD (needs timeline)" },
      { name: "Artist Management", status: "planned", monthly: "\u2014", potential: "Revenue splits TBD" },
    ],
  },
];

/* ── KEY METRICS (from shared config) ──────────────────────────────────────── */
const METRICS = [
  { label: "Active Agents", value: String(KEY_METRICS.activeAgents), sub: "Full squad operational", color: "#00f0ff" },
  { label: "Athletes (Beta)", value: KEY_METRICS.athletesBeta, sub: KEY_METRICS.betaPartner, color: "#f59e0b" },
  { label: "GA Products", value: String(KEY_METRICS.gaProducts), sub: KEY_METRICS.gaProductsBreakdown, color: "#00f0ff" },
  { label: "Apex ARR Target", value: "$3.72M", sub: "Y1 base · blended $310 ARPU", color: "#a855f7" },
];

/* ── INVESTMENT READINESS ──────────────────────────────────────────────────── */
const READINESS = [
  { item: "Live beta with real users (240+ athletes)", done: true },
  { item: "Successful live test (Feb 7)", done: true },
  { item: "Financial model with 3 scenarios + unit economics", done: true },
  { item: "19-agent AI operations team (model tiers locked)", done: true },
  { item: "Multi-brand portfolio (4 active brands)", done: true },
  { item: "Shopify store created (GALAKTIK ANTICS)", done: true },
  { item: "Stripe checkout — 3 tiers wired + tested", done: true },
  { item: "CI/CD pipeline (GitHub Actions + Husky + Vitest)", done: true },
  { item: "Copyright filed (Feb 17, 2026)", done: true },
  { item: "Firebase backend (v2) — deploy pending", done: false },
  { item: "App Store deployment (v3)", done: false },
  { item: "Revenue / paying customers", done: false },
];

export default function FinancialDashboard() {
  const [time, setTime] = useState<string | null>(null);
  // Brand revenue streams are always expanded on desktop

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "#000", color: "#e2e8f0",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      {/* ── NAV BAR ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 56,
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {NAV.map(n => (
            <Link key={n.label} href={n.href} style={{
              color: n.active ? "#fcd34d" : "#94a3b8", textDecoration: "none",
              fontSize: 12, fontWeight: 600, letterSpacing: 1.5,
              padding: "6px 14px", borderRadius: 8,
              background: n.active ? "rgba(252,211,77,0.1)" : "transparent",
              border: n.active ? "1px solid rgba(252,211,77,0.2)" : "1px solid transparent",
              transition: "all 0.2s",
            }}>
              <span style={{ marginRight: 6 }}>{n.icon}</span>{n.label}
            </Link>
          ))}
        </div>
        <div style={{ color: "#64748b", fontSize: 13, fontFamily: "monospace" }}>{time}</div>
      </nav>

      <div style={{ padding: "80px 32px 40px", maxWidth: 1800, margin: "0 auto" }}>
        {/* ── HEADER ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 28 }}>{"💎"}</span>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: "#fcd34d", margin: 0 }}>
              ORACLE Financial Dashboard
            </h1>
          </div>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Powered by KIYOSAKI \u2014 8 financial minds integrated \u2014 Updated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* ── KEY METRICS ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20, marginBottom: 48,
        }}>
          {METRICS.map(m => (
            <div key={m.label} style={{
              background: "rgba(255,255,255,0.03)", border: `1px solid ${m.color}22`,
              borderRadius: 16, padding: "28px 24px",
            }}>
              <div style={{ fontSize: 12, color: "#64748b", letterSpacing: 1.2, fontWeight: 600, marginBottom: 8 }}>
                {m.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* ── APEX ATHLETE PRICING TIERS ── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#f59e0b", marginBottom: 16, letterSpacing: 1 }}>
            \u2726 APEX ATHLETE \u2014 PRICING TIERS
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
          }}>
            {APEX_TIERS.map(t => (
              <div key={t.name} style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${t.color}33`,
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{t.price}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>{t.teams}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{t.features}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ARR PROJECTIONS ── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fcd34d", marginBottom: 16, letterSpacing: 1 }}>
            {"📈"} ARR PROJECTIONS
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {APEX_PROJECTIONS.map(p => (
              <div key={p.year} style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${p.color}22`,
                borderRadius: 16, padding: 24,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.color, marginBottom: 4 }}>{p.year}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>{p.arr}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1 }}>TEAMS</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>{p.teams}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1 }}>ARPU</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>{p.arpu}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 1 }}>CHURN</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#94a3b8" }}>{p.churn}</div>
                  </div>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
                  <div style={{
                    height: "100%", borderRadius: 4, background: p.color,
                    width: `${Math.min(100, (parseFloat(p.arr.replace(/[$M]/g, "")) / 14.9) * 100)}%`,
                    transition: "width 1s ease",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BRAND REVENUE STREAMS ── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#00f0ff", marginBottom: 16, letterSpacing: 1 }}>
            {"🏢"} REVENUE STREAMS BY BRAND
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
            {BRANDS.map(b => (
              <div key={b.name} style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${b.accent}22`,
                borderRadius: 16, padding: 24,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 20 }}>{b.icon}</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: b.accent }}>{b.name}</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>({b.streams.length} streams)</span>
                </div>
                <div>
                  {b.streams.map(s => (
                    <div key={s.name} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.04)",
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>Current: {s.monthly}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 1,
                          padding: "3px 8px", borderRadius: 6,
                          color: s.status === "active" ? "#34d399" : s.status === "ready" ? "#60a5fa" : s.status === "blocked" ? "#ef4444" : "#94a3b8",
                          background: s.status === "active" ? "rgba(52,211,153,0.1)" : s.status === "ready" ? "rgba(96,165,250,0.1)" : s.status === "blocked" ? "rgba(239,68,68,0.1)" : "rgba(148,163,184,0.1)",
                        }}>
                          {s.status.toUpperCase()}
                        </span>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.potential}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── INVESTMENT READINESS ── */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#a855f7", marginBottom: 16, letterSpacing: 1 }}>
            {"🎯"} INVESTMENT READINESS
          </h2>
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 24,
            border: "1px solid rgba(168,85,247,0.15)",
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>Readiness Score</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#a855f7" }}>
                  {Math.round((READINESS.filter(r => r.done).length / READINESS.length) * 100)}%
                </span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  background: "linear-gradient(90deg, #a855f7, #e879f9)",
                  width: `${(READINESS.filter(r => r.done).length / READINESS.length) * 100}%`,
                  transition: "width 1s ease",
                }} />
              </div>
            </div>
            {READINESS.map(r => (
              <div key={r.item} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "8px 0",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{
                  fontSize: 14, width: 22, height: 22, borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: r.done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
                  color: r.done ? "#34d399" : "#64748b",
                }}>
                  {r.done ? "\u2713" : "\u2022"}
                </span>
                <span style={{ fontSize: 13, color: r.done ? "#e2e8f0" : "#64748b" }}>{r.item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          textAlign: "center", padding: "24px 0",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          color: "#475569", fontSize: 11,
        }}>
          ORACLE Financial Dashboard \u2014 KIYOSAKI Agent \u2014 RAMICHE HQ \u2014 {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
