"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { APEX_PRICING, APEX_PROJECTIONS as SHARED_PROJECTIONS, NAV_LINKS, KEY_METRICS } from "@/lib/shared-config";

/* ══════════════════════════════════════════════════════════════════════════════
   FINANCIAL DASHBOARD — KIYOSAKI'S ORACLE
   Revenue projections, brand P&L, pricing tiers, and growth metrics.
   Full-width, immersive, game-UI design.
   ══════════════════════════════════════════════════════════════════════════════ */

const NAV = NAV_LINKS.map(n => ({
  ...n,
  active: n.label === "FINANCE",
}));

const APEX_TIERS = APEX_PRICING.tiers.map(t => ({
  name: t.name,
  price: t.priceLabel,
  teams: t.athletes,
  features: t.features,
  color: t.color,
}));

const APEX_PROJECTIONS = SHARED_PROJECTIONS.map(p => ({ ...p }));

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
    name: "Parallax Studio", accent: "#a855f7", icon: "\u2662",
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

const METRICS = [
  { label: "Active Agents", value: String(KEY_METRICS.activeAgents), sub: "Full squad operational", color: "#00f0ff" },
  { label: "Athletes (Beta)", value: KEY_METRICS.athletesBeta, sub: KEY_METRICS.betaPartner, color: "#f59e0b" },
  { label: "GA Products", value: String(KEY_METRICS.gaProducts), sub: KEY_METRICS.gaProductsBreakdown, color: "#00f0ff" },
  { label: "Apex ARR Target", value: "$3.72M", sub: "Y1 base \u00b7 blended $310 ARPU", color: "#a855f7" },
];

const READINESS = [
  { item: "Live beta with real users (240+ athletes)", done: true },
  { item: "Successful live test (Feb 7)", done: true },
  { item: "Financial model with 3 scenarios + unit economics", done: true },
  { item: "19-agent AI operations team (model tiers locked)", done: true },
  { item: "Multi-brand portfolio (4 active brands)", done: true },
  { item: "Shopify store created (GALAKTIK ANTICS)", done: true },
  { item: "Stripe checkout \u2014 3 tiers wired + tested", done: true },
  { item: "CI/CD pipeline (GitHub Actions + Husky + Vitest)", done: true },
  { item: "Copyright filed (Feb 17, 2026)", done: true },
  { item: "Firebase backend (v2) \u2014 deploy pending", done: false },
  { item: "App Store deployment (v3)", done: false },
  { item: "Revenue / paying customers", done: false },
];

export default function FinancialDashboard() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  const readinessScore = Math.round((READINESS.filter(r => r.done).length / READINESS.length) * 100);

  return (
    <main className="relative min-h-screen bg-[#06020f] text-white overflow-hidden">
      {/* Background nebulae */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="nebula-1 absolute rounded-full blur-3xl" style={{ width: "700px", height: "700px", top: "-10%", left: "-5%", background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)" }} />
        <div className="nebula-2 absolute rounded-full blur-3xl" style={{ width: "600px", height: "600px", top: "40%", right: "-10%", background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)" }} />
        <div className="nebula-3 absolute rounded-full blur-3xl" style={{ width: "500px", height: "500px", bottom: "5%", left: "30%", background: "radial-gradient(circle, rgba(0,240,255,0.05) 0%, transparent 70%)" }} />
        <div className="scan-line absolute left-0 w-full h-px" style={{ background: "rgba(245,158,11,0.08)" }} />
      </div>

      {/* Nav bar */}
      <nav className="relative z-10 border-b border-white/5 bg-[#06020f]/80 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              {NAV.map(n => (
                <Link key={n.label} href={n.href}
                  className={`game-btn px-3 py-1.5 text-xs font-medium tracking-wide uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                    n.active ? "bg-[#fcd34d]/10 text-[#fcd34d] border border-[#fcd34d]/30" : "text-white/40 hover:text-white/70 hover:bg-white/5 border border-transparent"
                  }`}>
                  <span className="mr-1.5 opacity-50">{n.icon}</span>{n.label}
                </Link>
              ))}
            </div>
            <div className="text-white/30 text-xs font-mono tabular-nums">{time}</div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mx-auto w-full max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 py-10 lg:py-14">

        {/* Header */}
        <div className="mb-12 lg:mb-14">
          <div className="flex items-center gap-5 mb-3">
            <div className="w-16 h-16 lg:w-20 lg:h-20 game-panel flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(252,211,77,0.12) 0%, rgba(245,158,11,0.06) 100%)", border: "1px solid rgba(252,211,77,0.25)" }}>
              <span className="text-3xl lg:text-4xl" role="img" aria-label="gem">💎</span>
            </div>
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none">
                <span className="bg-gradient-to-r from-[#fcd34d] via-[#f59e0b] to-[#e879f9] bg-clip-text text-transparent bg-[length:200%_200%] animated-gradient-text">
                  ORACLE Financial Dashboard
                </span>
              </h1>
              <p className="text-white/30 text-sm font-mono mt-2 tracking-wider">
                Powered by KIYOSAKI \u2014 8 financial minds integrated \u2014 Updated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics — full width, tall + prominent */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8 mb-12">
          {METRICS.map(m => (
            <div key={m.label} className="game-panel game-panel-border relative p-8 lg:p-10 xl:p-12 min-h-[180px] lg:min-h-[220px] flex flex-col justify-center"
              style={{ background: `linear-gradient(145deg, ${m.color}0a 0%, rgba(6,2,15,0.97) 100%)` }}>
              <div className="absolute top-4 right-4 w-3 h-3 rounded-full animate-pulse" style={{ background: m.color, boxShadow: `0 0 12px ${m.color}` }} />
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 rounded-tl" style={{ borderColor: `${m.color}30` }} />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 rounded-br" style={{ borderColor: `${m.color}30` }} />
              <div className="text-xs lg:text-sm tracking-[0.2em] uppercase text-white/30 font-mono mb-4">
                {m.label}
              </div>
              <div className="text-5xl lg:text-6xl xl:text-7xl font-black tabular-nums leading-none mb-3" style={{ color: m.color,
                textShadow: `0 0 30px ${m.color}40, 0 0 60px ${m.color}15` }}>
                {m.value}
              </div>
              <div className="text-sm lg:text-base text-white/40">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Apex Pricing Tiers */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[#f59e0b]/20 to-transparent" />
            <h2 className="text-sm tracking-[0.25em] uppercase text-[#f59e0b]/60 font-mono font-bold">
              Apex Athlete &#x2014; Pricing Tiers
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#f59e0b]/20 to-transparent" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
            {APEX_TIERS.map(t => (
              <div key={t.name} className="game-panel relative p-6 lg:p-10 xl:p-12 transition-all duration-300 hover:-translate-y-1 min-h-[200px] lg:min-h-[240px] flex flex-col justify-center"
                style={{
                  background: `linear-gradient(145deg, ${t.color}0a 0%, rgba(6,2,15,0.97) 100%)`,
                  border: `1px solid ${t.color}30`,
                }}>
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2" style={{ borderColor: `${t.color}40` }} />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2" style={{ borderColor: `${t.color}40` }} />
                <div className="text-base lg:text-lg font-bold mb-3" style={{ color: t.color }}>{t.name}</div>
                <div className="text-4xl lg:text-5xl xl:text-6xl font-black text-white mb-4">{t.price}</div>
                <div className="text-sm text-white/40 mb-2">{t.teams}</div>
                <div className="text-xs text-white/25 leading-relaxed">{t.features}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ARR Projections */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[#fcd34d]/20 to-transparent" />
            <h2 className="text-sm tracking-[0.25em] uppercase text-[#fcd34d]/60 font-mono font-bold">
              <span role="img" aria-label="chart">📈</span> ARR Projections
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#fcd34d]/20 to-transparent" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
            {APEX_PROJECTIONS.map(p => (
              <div key={p.year} className="game-panel game-panel-border relative p-6 lg:p-10 xl:p-12 min-h-[240px] lg:min-h-[280px] flex flex-col"
                style={{ background: `linear-gradient(145deg, ${p.color}0c 0%, rgba(6,2,15,0.97) 100%)` }}>
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2" style={{ borderColor: `${p.color}30` }} />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2" style={{ borderColor: `${p.color}30` }} />
                <div className="text-sm font-mono font-bold mb-5" style={{ color: p.color }}>{p.year}</div>
                <div className="text-4xl lg:text-5xl xl:text-6xl font-black text-white mb-6 leading-none" style={{ textShadow: `0 0 30px ${p.color}30` }}>{p.arr}</div>
                <div className="grid grid-cols-3 gap-4 mb-6 flex-1">
                  <div>
                    <div className="text-[10px] lg:text-xs text-white/25 tracking-widest uppercase font-mono mb-1">Teams</div>
                    <div className="text-lg lg:text-xl font-bold text-white/60">{p.teams}</div>
                  </div>
                  <div>
                    <div className="text-[10px] lg:text-xs text-white/25 tracking-widest uppercase font-mono mb-1">ARPU</div>
                    <div className="text-lg lg:text-xl font-bold text-white/60">{p.arpu}</div>
                  </div>
                  <div>
                    <div className="text-[10px] lg:text-xs text-white/25 tracking-widest uppercase font-mono mb-1">Churn</div>
                    <div className="text-lg lg:text-xl font-bold text-white/60">{p.churn}</div>
                  </div>
                </div>
                <div className="h-3 lg:h-4 bg-white/5 rounded-full overflow-hidden xp-bar-segments">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{
                      background: `linear-gradient(90deg, ${p.color}, ${p.color}cc)`,
                      width: `${Math.min(100, (parseFloat(p.arr.replace(/[$M]/g, "")) / 14.9) * 100)}%`,
                      boxShadow: `0 0 12px ${p.color}60, 0 0 24px ${p.color}20`,
                    }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Revenue Streams — 2x2 grid, fills ultrawide */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[#00f0ff]/20 to-transparent" />
            <h2 className="text-sm tracking-[0.25em] uppercase text-[#00f0ff]/60 font-mono font-bold">
              Revenue Streams by Brand
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#00f0ff]/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
            {BRANDS.map(b => (
              <div key={b.name} className="game-panel relative p-6 lg:p-8 xl:p-10"
                style={{
                  background: `linear-gradient(145deg, ${b.accent}08 0%, rgba(6,2,15,0.97) 100%)`,
                  border: `1px solid ${b.accent}20`,
                }}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 game-panel-sm flex items-center justify-center text-xl lg:text-2xl"
                    style={{ background: `${b.accent}12`, border: `1px solid ${b.accent}25`, color: b.accent }}>
                    {b.icon}
                  </div>
                  <div>
                    <span className="text-lg lg:text-xl font-bold" style={{ color: b.accent }}>{b.name}</span>
                    <span className="text-xs text-white/25 ml-3">({b.streams.length} streams)</span>
                  </div>
                </div>
                <div className="space-y-0">
                  {b.streams.map(s => (
                    <div key={s.name} className="flex items-center justify-between py-4 border-t border-white/[0.04]">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm lg:text-base font-medium text-white/70">{s.name}</div>
                        <div className="text-xs text-white/25 mt-0.5">Current: {s.monthly}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-6">
                        <span className={`text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-sm uppercase ${
                          s.status === "active" ? "bg-[#34d399]/10 text-[#34d399]" :
                          s.status === "ready" ? "bg-[#60a5fa]/10 text-[#60a5fa]" :
                          s.status === "blocked" ? "bg-[#ef4444]/10 text-[#ef4444]" :
                          s.status === "soon" ? "bg-[#fbbf24]/10 text-[#fbbf24]" :
                          "bg-white/5 text-white/30"
                        }`}>{s.status}</span>
                        <div className="text-xs text-white/40 mt-1.5">{s.potential}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investment Readiness — Achievement Tracker */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-gradient-to-r from-[#a855f7]/20 to-transparent" />
            <h2 className="text-sm tracking-[0.25em] uppercase text-[#a855f7]/60 font-mono font-bold">
              &#x1F3AF; Investment Readiness &#x2014; Achievement Tracker
            </h2>
            <div className="h-px flex-1 bg-gradient-to-l from-[#a855f7]/20 to-transparent" />
          </div>
          <div className="game-panel game-panel-border relative p-8 lg:p-10 xl:p-12"
            style={{ background: "linear-gradient(145deg, rgba(168,85,247,0.06) 0%, rgba(6,2,15,0.97) 100%)" }}>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl" style={{ borderColor: "rgba(168,85,247,0.3)" }} />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 rounded-tr" style={{ borderColor: "rgba(168,85,247,0.3)" }} />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 rounded-bl" style={{ borderColor: "rgba(168,85,247,0.3)" }} />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br" style={{ borderColor: "rgba(168,85,247,0.3)" }} />
            {/* XP Progress bar */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <span className="text-xs text-white/30 font-mono tracking-widest uppercase block mb-1">Mission Progress</span>
                  <span className="text-base lg:text-lg text-white/50 font-mono">Readiness Score</span>
                </div>
                <div className="text-right">
                  <span className="text-4xl lg:text-5xl font-black neon-text-purple" style={{ textShadow: "0 0 20px rgba(168,85,247,0.4)" }}>{readinessScore}%</span>
                  <span className="block text-xs text-white/30 font-mono mt-1">{READINESS.filter(r => r.done).length}/{READINESS.length} UNLOCKED</span>
                </div>
              </div>
              <div className="h-4 lg:h-5 bg-white/5 rounded-full overflow-hidden xp-bar-segments relative">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{
                    background: "linear-gradient(90deg, #a855f7, #c084fc, #e879f9)",
                    width: `${readinessScore}%`,
                    boxShadow: "0 0 16px rgba(168,85,247,0.5), 0 0 32px rgba(168,85,247,0.2)",
                  }} />
              </div>
            </div>
            {/* Achievement grid in 2 columns on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-1">
              {READINESS.map(r => (
                <div key={r.item} className={`flex items-center gap-4 py-3 border-t border-white/[0.04] transition-all duration-200 ${r.done ? "hover:bg-white/[0.02]" : "opacity-60"}`}>
                  <div className={`w-8 h-8 lg:w-9 lg:h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0 transition-all ${
                    r.done ? "bg-[#34d399]/15 text-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.2)]" : "bg-white/5 text-white/20 border border-white/10"
                  }`}>
                    {r.done ? "\u2713" : "\u25CB"}
                  </div>
                  <span className={`text-sm lg:text-base ${r.done ? "text-white/70" : "text-white/30"}`}>{r.item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 pt-6 pb-4 text-center">
          <p className="text-[10px] text-white/15 tracking-widest uppercase">
            ORACLE Financial Dashboard \u2014 KIYOSAKI Agent \u2014 PARALLAX HQ \u2014 {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}
