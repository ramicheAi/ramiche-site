"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { APEX_PRICING, APEX_PROJECTIONS as SHARED_PROJECTIONS, NAV_LINKS, KEY_METRICS } from "@/lib/shared-config";

/* ══════════════════════════════════════════════════════════════════════════════
   FINANCIAL DASHBOARD — KIYOSAKI'S ORACLE (PARALLAX REDESIGN)
   Parallax scrolling, smart metrics, interactive charts, premium aesthetic.
   Light theme with navy, cyan, purple, and orange accents.
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
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!time) return null;

  const readinessScore = Math.round((READINESS.filter(r => r.done).length / READINESS.length) * 100);

  return (
    <main className="relative min-h-screen bg-white text-[#0f172a] overflow-hidden" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Parallax background layers */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Layer 1 — Slow navy gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f8f9fc 50%, #eef2ff 100%)",
            transform: `translateY(${scrollY * 0.5}px)`,
          }}
        />
        {/* Layer 2 — Navy accent (parallax) */}
        <div
          className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-3xl opacity-10"
          style={{
            background: "radial-gradient(circle, #1a1a5e 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.3}px)`,
          }}
        />
        {/* Layer 3 — Purple accent (parallax) */}
        <div
          className="absolute top-[30%] left-[-8%] w-[500px] h-[500px] rounded-full blur-3xl opacity-10"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.4}px)`,
          }}
        />
        {/* Layer 4 — Orange accent (parallax) */}
        <div
          className="absolute bottom-[5%] right-[-5%] w-[400px] h-[400px] rounded-full blur-3xl opacity-5"
          style={{
            background: "radial-gradient(circle, #f97316 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.2}px)`,
          }}
        />
      </div>

      {/* Nav bar — Parallax style */}
      <nav className="relative z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0">
        <div className="mx-auto w-full max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">
              {NAV.map(n => (
                <Link key={n.label} href={n.href}
                  className={`px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-all whitespace-nowrap flex-shrink-0 border ${
                    n.active
                      ? "bg-[#1a1a5e]/10 text-[#1a1a5e] border-[#1a1a5e]/30"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50 border-transparent"
                  }`}>
                  <span className="mr-1.5 opacity-70">{n.icon}</span>{n.label}
                </Link>
              ))}
            </div>
            <div className="text-slate-400 text-xs font-mono tabular-nums">{time}</div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 mx-auto w-full max-w-[2000px] px-4 sm:px-6 lg:px-10 xl:px-16 py-10 lg:py-14">

        {/* Hero Section — Parallax */}
        <div
          className="mb-12 lg:mb-16 pt-8 lg:pt-16 -mx-4 sm:-mx-6 lg:-mx-10 xl:-mx-16 px-4 sm:px-6 lg:px-10 xl:px-16"
          style={{ transform: `translateY(${scrollY * -0.2}px)` }}
        >
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="w-20 h-20 lg:w-32 lg:h-32 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(26,26,94,0.1) 0%, rgba(124,58,237,0.1) 100%)",
                border: "2px solid rgba(26,26,94,0.2)",
              }}>
              <span className="text-4xl lg:text-6xl" role="img" aria-label="gem">💎</span>
            </div>
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-tight">
                <span style={{ background: "linear-gradient(135deg, #1a1a5e 0%, #7c3aed 50%, #0ea5e9 100%)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Financial Oracle
                </span>
              </h1>
              <p className="text-slate-600 text-sm lg:text-base font-semibold mt-3 tracking-wide uppercase">
                Powered by KIYOSAKI — Multi-Agent Financial Intelligence
              </p>
              <p className="text-slate-400 text-xs lg:text-sm mt-2">
                Last updated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics — Smart dashboard cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {METRICS.map((m, idx) => (
            <div
              key={m.label}
              className="relative p-6 lg:p-8 rounded-lg transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border"
              style={{
                background: `linear-gradient(135deg, ${m.color}08 0%, transparent 100%)`,
                borderColor: `${m.color}20`,
              }}
            >
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full animate-pulse" style={{ background: m.color }} />
              <div className="text-xs tracking-[0.15em] uppercase text-slate-500 font-semibold mb-3">
                {m.label}
              </div>
              <div className="text-4xl lg:text-5xl font-black tabular-nums leading-none mb-2" style={{ color: m.color }}>
                {m.value}
              </div>
              <div className="text-xs lg:text-sm text-slate-500">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Apex Pricing Tiers — Interactive cards */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#f97316" }}>
              ⚡ Apex Athlete — Pricing Tiers
            </h2>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #f97316 20%, transparent 80%)" }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {APEX_TIERS.map((t, idx) => (
              <div
                key={t.name}
                className="relative p-6 lg:p-8 rounded-lg border transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
                style={{
                  background: `linear-gradient(135deg, ${t.color}10 0%, transparent 100%)`,
                  borderColor: `${t.color}30`,
                }}
              >
                <div className="text-base lg:text-lg font-bold mb-4" style={{ color: t.color }}>
                  {t.name}
                </div>
                <div className="text-3xl lg:text-4xl font-black text-slate-900 mb-4">
                  {t.price}
                </div>
                <div className="text-sm text-slate-600 mb-3 font-semibold">{t.teams}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{t.features}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ARR Projections — Growth trajectory */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#7c3aed" }}>
              📈 ARR Projections & Growth
            </h2>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #7c3aed 20%, transparent 80%)" }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {APEX_PROJECTIONS.map((p, idx) => (
              <div
                key={p.year}
                className="relative p-6 lg:p-8 rounded-lg border transition-all duration-300 hover:shadow-xl"
                style={{
                  background: `linear-gradient(135deg, ${p.color}10 0%, transparent 100%)`,
                  borderColor: `${p.color}30`,
                }}
              >
                <div className="text-sm font-bold tracking-wide uppercase" style={{ color: p.color }}>
                  {p.year}
                </div>
                <div className="text-3xl lg:text-4xl font-black text-slate-900 mt-3 mb-4">
                  {p.arr}
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6 py-4 border-y border-slate-200">
                  <div>
                    <div className="text-xs text-slate-500 tracking-wider uppercase font-semibold mb-1">Teams</div>
                    <div className="text-lg font-bold text-slate-700">{p.teams}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 tracking-wider uppercase font-semibold mb-1">ARPU</div>
                    <div className="text-lg font-bold text-slate-700">{p.arpu}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 tracking-wider uppercase font-semibold mb-1">Churn</div>
                    <div className="text-lg font-bold text-slate-700">{p.churn}</div>
                  </div>
                </div>
                <div className="h-2 lg:h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      background: `linear-gradient(90deg, ${p.color}, ${p.color}dd)`,
                      width: `${Math.min(100, (parseFloat(p.arr.replace(/[$M]/g, "")) / 14.9) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Brand Revenue Streams — Multi-brand breakdown */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#0ea5e9" }}>
              💰 Revenue Streams by Brand
            </h2>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #0ea5e9 20%, transparent 80%)" }} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {BRANDS.map((b, idx) => (
              <div
                key={b.name}
                className="relative p-6 lg:p-8 rounded-lg border transition-all duration-300 hover:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${b.accent}10 0%, transparent 100%)`,
                  borderColor: `${b.accent}30`,
                }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center text-lg lg:text-xl flex-shrink-0"
                    style={{
                      background: `${b.accent}15`,
                      borderColor: `${b.accent}40`,
                      border: "1px solid",
                      color: b.accent,
                    }}
                  >
                    {b.icon}
                  </div>
                  <div>
                    <div className="text-lg lg:text-xl font-bold" style={{ color: b.accent }}>
                      {b.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {b.streams.length} revenue stream{b.streams.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <div className="space-y-0">
                  {b.streams.map((s, sidx) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between py-4 border-t border-slate-200"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="text-sm lg:text-base font-medium text-slate-700">
                          {s.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Current: <span className="font-semibold">{s.monthly}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded-full uppercase ${
                            s.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : s.status === "ready"
                              ? "bg-blue-100 text-blue-700"
                              : s.status === "blocked"
                              ? "bg-red-100 text-red-700"
                              : s.status === "soon"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {s.status}
                        </span>
                        <div className="text-xs text-slate-600 font-semibold mt-2">
                          {s.potential}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Investment Readiness — Progress tracker */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight" style={{ color: "#1a1a5e" }}>
              🎯 Investment Readiness Tracker
            </h2>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #1a1a5e 20%, transparent 80%)" }} />
          </div>

          <div
            className="relative p-8 lg:p-12 rounded-lg border"
            style={{
              background: "linear-gradient(135deg, rgba(26,26,94,0.1) 0%, transparent 100%)",
              borderColor: "rgba(26,26,94,0.3)",
            }}
          >
            {/* Progress section */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs tracking-[0.15em] uppercase text-slate-500 font-semibold block mb-1">
                    Mission Progress
                  </div>
                  <div className="text-lg lg:text-xl text-slate-700 font-semibold">
                    Readiness Score
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl lg:text-6xl font-black" style={{ color: "#1a1a5e" }}>
                    {readinessScore}%
                  </div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">
                    {READINESS.filter((r) => r.done).length}/{READINESS.length} Unlocked
                  </div>
                </div>
              </div>
              <div className="h-3 lg:h-4 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    background: "linear-gradient(90deg, #1a1a5e, #7c3aed, #0ea5e9)",
                    width: `${readinessScore}%`,
                  }}
                />
              </div>
            </div>

            {/* Achievement grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-0">
              {READINESS.map((r, idx) => (
                <div
                  key={r.item}
                  className={`flex items-start gap-4 py-4 border-t border-slate-200 transition-all duration-200 ${
                    r.done ? "" : "opacity-60"
                  }`}
                >
                  <div
                    className={`w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 font-bold transition-all mt-0.5 ${
                      r.done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-400 border border-slate-300"
                    }`}
                  >
                    {r.done ? "✓" : "○"}
                  </div>
                  <span className={`text-sm lg:text-base leading-snug mt-0.5 ${r.done ? "text-slate-700" : "text-slate-500"}`}>
                    {r.item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-8 pb-6 text-center">
          <p className="text-xs text-slate-400 tracking-widest uppercase font-semibold">
            Financial Oracle — KIYOSAKI Agent — Powered by Parallax © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </main>
  );
}
