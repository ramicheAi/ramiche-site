"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   COMMAND CENTER — MISSION CONTROL
   Clean, professional, operationally focused
   ══════════════════════════════════════════════════════════════ */

/* ── agents ─────────────────────────────────────────────── */
const AGENTS = [
  { name: "Atlas", model: "Opus 4.6", role: "Lead", status: "active" as const, color: "#00f0ff" },
  { name: "Builder", model: "Sonnet 4.5", role: "Code", status: "idle" as const, color: "#a855f7" },
  { name: "Scout", model: "Haiku 4.5", role: "Research", status: "idle" as const, color: "#f59e0b" },
];

/* ── projects ────────────────────────────────────────────── */
const PROJECTS = [
  {
    name: "Galactik Antics", emoji: "🌌", accent: "#00f0ff", status: "active" as const,
    desc: "AI art merch → Shopify store",
    tasks: [
      { t: "Art crops finalized", done: true },
      { t: "Weavy production renders", done: true },
      { t: "Save outputs to finals folder", done: false },
      { t: "Upload to Printful + variants", done: false },
      { t: "Product copy + pricing", done: false },
    ],
    link: { label: "Printful", href: "https://www.printful.com/dashboard" },
  },
  {
    name: "Apex Athlete", emoji: "🏊", accent: "#f59e0b", status: "active" as const,
    desc: "Gamified swim training — live beta",
    tasks: [
      { t: "Game engine + check-ins", done: true },
      { t: "Coach dashboard + leaderboard", done: true },
      { t: "Advanced analytics", done: true },
      { t: "Multi-roster expansion (240+ athletes)", done: false },
      { t: "Firebase backend + deploy", done: false },
    ],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Ramiche Studio", emoji: "🎨", accent: "#a855f7", status: "active" as const,
    desc: "$400 Creative Direction Sprint",
    tasks: [
      { t: "Landing page live", done: true },
      { t: "Portfolio + case studies", done: false },
      { t: "Social proof / testimonials", done: false },
      { t: "Stripe integration", done: false },
    ],
    link: { label: "Studio Page", href: "/studio" },
  },
  {
    name: "Music Pipeline", emoji: "🎵", accent: "#e879f9", status: "paused" as const,
    desc: "Track production & release automation",
    tasks: [
      { t: "music.json system of record", done: true },
      { t: "Status dashboard", done: true },
      { t: "Stalled-track detection", done: false },
      { t: "Momentum reports", done: false },
    ],
    link: null,
  },
];

/* ── opportunities ───────────────────────────────────────── */
const OPPS = [
  { title: "AI Product Photos", rev: "$99-349/batch", tag: "READY", accent: "#00f0ff", desc: "Weavy pipeline as a service for small e-commerce" },
  { title: "Brand-in-a-Box", rev: "$300-500", tag: "READY", accent: "#a855f7", desc: "48h Creative Direction Sprint — kit already built" },
  { title: "Shopify Store Setup", rev: "$500-1.5K", tag: "SOON", accent: "#f59e0b", desc: "Done-for-you store from GA playbook" },
  { title: "AI Agent Consulting", rev: "$1-3K", tag: "SOON", accent: "#e879f9", desc: "OpenClaw-style setup + training for businesses" },
  { title: "Content Repurposing", rev: "$200-500/mo", tag: "IDEA", accent: "#00f0ff", desc: "Whisper → AI → multi-platform formatting pipeline" },
];

/* ── timeline ────────────────────────────────────────────── */
const LOG = [
  { time: "Now", text: "Building multi-roster Apex Athlete expansion", color: "#f59e0b" },
  { time: "Today", text: "Apex Athlete v1 tested at practice — working", color: "#00f0ff" },
  { time: "Today", text: "Sci-fi game UI overhaul deployed", color: "#a855f7" },
  { time: "Today", text: "Coach analytics: attrition risk, culture score", color: "#f59e0b" },
  { time: "Yest.", text: "GA phone case art crops + source matching", color: "#00f0ff" },
  { time: "Yest.", text: "Studio landing page deployed", color: "#a855f7" },
  { time: "3d ago", text: "Music pipeline paused → focus shift to GA", color: "#e879f9" },
];

/* ── NAV ─────────────────────────────────────────────────── */
const NAV = [
  { label: "HQ", href: "/", icon: "◈" },
  { label: "Command", href: "/command-center", icon: "◇", active: true },
  { label: "Apex", href: "/apex-athlete", icon: "✦" },
  { label: "Studio", href: "/studio", icon: "♢" },
];

/* ── types ────────────────────────────────────────────────── */
interface Weather { tempF: string; condition: string; humidity: string; forecast: { day: string; high: string; low: string; cond: string }[]; }
interface Verse { text: string; ref: string; }

/* ══════════════════════════════════════════════════════════════ */

export default function CommandCenter() {
  /* ── state ── */
  const [weather, setWeather] = useState<Weather | null>(null);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState(0);
  const [waterG, setWaterG] = useState(0);
  const [sleepH, setSleepH] = useState(7);
  const [workedOut, setWorkedOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* ── fetchers ── */
  const fetchWeather = useCallback(async () => {
    try {
      const r = await fetch("https://wttr.in/BocaRaton?format=j1");
      const d = await r.json();
      const c = d.current_condition?.[0];
      setWeather({
        tempF: c?.temp_F ?? "--", condition: c?.weatherDesc?.[0]?.value ?? "", humidity: c?.humidity ?? "--",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast: (d.weather?.slice(0, 3) ?? []).map((w: any) => ({
          day: new Date(w.date).toLocaleDateString("en", { weekday: "short" }),
          high: w.maxtempF ?? "--", low: w.mintempF ?? "--",
          cond: w.hourly?.[4]?.weatherDesc?.[0]?.value ?? "",
        })),
      });
    } catch { /* fail silently */ }
  }, []);

  const fetchVerse = useCallback(async () => {
    try {
      const r = await fetch("https://bible-api.com/?random=verse");
      const d = await r.json();
      setVerse({ text: d.text?.trim() ?? "", ref: d.reference ?? "" });
    } catch { /* fail silently */ }
  }, []);

  const copyVerse = () => {
    if (!verse) return;
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.ref}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  /* ── mount ── */
  useEffect(() => { setMounted(true); fetchWeather(); fetchVerse(); }, [fetchWeather, fetchVerse]);
  if (!mounted) return null;

  /* ── computed ── */
  const totalT = PROJECTS.reduce((s, p) => s + p.tasks.length, 0);
  const doneT = PROJECTS.reduce((s, p) => s + p.tasks.filter(t => t.done).length, 0);
  const pct = Math.round((doneT / totalT) * 100);

  return (
    <main className="min-h-screen w-full bg-[#06020f] text-white relative overflow-hidden">
      {/* ── BG ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-60" style={{ background: "radial-gradient(circle, rgba(0,240,255,0.06) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] right-[-5%] w-[600px] h-[400px] rounded-full opacity-60" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-5%] left-[30%] w-[400px] h-[400px] rounded-full opacity-60" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)" }} />
      </div>

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-10 py-6 max-w-[1800px] mx-auto">

        {/* ═══════════════ HEADER + NAV ═══════════════ */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[9px] uppercase tracking-[0.35em] text-[#00f0ff]/30 font-mono mb-0.5">◈ RAMICHE OPS</div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#e879f9] bg-clip-text text-transparent">
              COMMAND CENTER
            </h1>
          </div>
          <nav className="flex gap-1">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${
                  n.active ? "bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30" : "text-white/30 hover:text-white/60"
                }`}>
                <span className="mr-1 opacity-50">{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* ═══════════════ TOP ROW: VERSE + WEATHER + AGENTS ═══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* ── Scripture ── */}
          <div className="rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/[0.03] p-5 flex flex-col justify-between">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#f59e0b]/40 mb-3">✦ DAILY VERSE</div>
              {verse ? (
                <>
                  <p className="text-white/80 text-sm leading-relaxed italic mb-2">&ldquo;{verse.text}&rdquo;</p>
                  <div className="text-[#f59e0b]/50 text-xs font-mono">— {verse.ref}</div>
                </>
              ) : (
                <div className="text-white/20 text-sm animate-pulse">Loading...</div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={fetchVerse} className="text-[10px] font-mono text-[#f59e0b]/60 hover:text-[#f59e0b] transition-colors">↻ New</button>
              <button onClick={copyVerse} className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors">{copied ? "✓ Copied" : "Copy"}</button>
            </div>
          </div>

          {/* ── Weather ── */}
          <div className="rounded-xl border border-[#00f0ff]/15 bg-[#00f0ff]/[0.03] p-5">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#00f0ff]/40 mb-3">☀ BOCA RATON</div>
            {weather ? (
              <>
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="text-4xl font-black text-[#00f0ff]">{weather.tempF}°</span>
                  <div>
                    <div className="text-white/70 text-sm">{weather.condition}</div>
                    <div className="text-white/30 text-[10px] font-mono">{weather.humidity}% humidity</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {weather.forecast.map(d => (
                    <div key={d.day} className="text-center bg-white/[0.03] rounded-lg py-2 px-1">
                      <div className="text-[10px] font-mono text-white/40">{d.day}</div>
                      <div className="text-xs text-white/70 font-medium">{d.high}° / {d.low}°</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-white/20 text-sm animate-pulse">Loading weather...</div>
            )}
          </div>

          {/* ── Agent Status ── */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30 mb-3">◈ AGENTS</div>
            <div className="space-y-3">
              {AGENTS.map(a => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}30` }}>
                      {a.name[0]}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#06020f] ${
                      a.status === "active" ? "bg-[#00f0ff]" : "bg-white/20"
                    }`} style={a.status === "active" ? { boxShadow: `0 0 6px ${a.color}` } : {}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/90">{a.name}</span>
                      <span className="text-[9px] font-mono text-white/30">{a.model}</span>
                    </div>
                    <div className="text-[10px] font-mono" style={{ color: `${a.color}80` }}>{a.role} · {a.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════════ MISSION PROGRESS BAR ═══════════════ */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">Overall Mission Progress</span>
            <span className="text-[10px] font-mono text-white/50">{doneT}/{totalT} tasks · {pct}%</span>
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* ═══════════════ HEALTH + QUICK STATS ═══════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Steps */}
          <div className="rounded-xl border border-[#a855f7]/15 bg-[#a855f7]/[0.03] p-4">
            <div className="text-[9px] font-mono uppercase text-white/30 mb-1">Steps</div>
            <div className="text-xl font-black text-[#a855f7]">{steps.toLocaleString()}</div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => setSteps(s => Math.max(0, s - 500))} className="w-7 h-6 rounded text-xs font-mono bg-[#a855f7]/10 text-[#a855f7]/70 hover:text-[#a855f7] transition-colors">−</button>
              <button onClick={() => setSteps(s => s + 500)} className="w-7 h-6 rounded text-xs font-mono bg-[#a855f7]/10 text-[#a855f7]/70 hover:text-[#a855f7] transition-colors">+</button>
            </div>
          </div>
          {/* Water */}
          <div className="rounded-xl border border-[#00f0ff]/15 bg-[#00f0ff]/[0.03] p-4">
            <div className="text-[9px] font-mono uppercase text-white/30 mb-1">Water</div>
            <div className="text-xl font-black text-[#00f0ff]">{waterG}<span className="text-xs font-normal text-white/30 ml-1">glasses</span></div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => setWaterG(w => Math.max(0, w - 1))} className="w-7 h-6 rounded text-xs font-mono bg-[#00f0ff]/10 text-[#00f0ff]/70 hover:text-[#00f0ff] transition-colors">−</button>
              <button onClick={() => setWaterG(w => w + 1)} className="w-7 h-6 rounded text-xs font-mono bg-[#00f0ff]/10 text-[#00f0ff]/70 hover:text-[#00f0ff] transition-colors">+</button>
            </div>
          </div>
          {/* Sleep */}
          <div className="rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/[0.03] p-4">
            <div className="text-[9px] font-mono uppercase text-white/30 mb-1">Sleep</div>
            <div className="text-xl font-black text-[#f59e0b]">{sleepH}<span className="text-xs font-normal text-white/30 ml-1">hrs</span></div>
            <div className="flex gap-1 mt-2">
              <button onClick={() => setSleepH(s => Math.max(0, s - 0.5))} className="w-7 h-6 rounded text-xs font-mono bg-[#f59e0b]/10 text-[#f59e0b]/70 hover:text-[#f59e0b] transition-colors">−</button>
              <button onClick={() => setSleepH(s => Math.min(12, s + 0.5))} className="w-7 h-6 rounded text-xs font-mono bg-[#f59e0b]/10 text-[#f59e0b]/70 hover:text-[#f59e0b] transition-colors">+</button>
            </div>
          </div>
          {/* Workout */}
          <div className="rounded-xl border border-[#e879f9]/15 bg-[#e879f9]/[0.03] p-4">
            <div className="text-[9px] font-mono uppercase text-white/30 mb-1">Workout</div>
            <div className="text-xl font-black" style={{ color: workedOut ? "#e879f9" : "rgba(255,255,255,0.2)" }}>{workedOut ? "Done ✓" : "—"}</div>
            <button onClick={() => setWorkedOut(w => !w)}
              className={`mt-2 px-3 py-1 rounded text-[10px] font-mono transition-colors ${
                workedOut ? "bg-[#e879f9]/20 text-[#e879f9]" : "bg-white/[0.04] text-white/30 hover:text-white/60"
              }`}>{workedOut ? "Completed" : "Mark Done"}</button>
          </div>
        </div>

        {/* ═══════════════ PROJECTS + ACTIVITY ═══════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* ── Projects (2 cols) ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 mb-1">◈ ACTIVE MISSIONS</div>
            {PROJECTS.map(p => {
              const done = p.tasks.filter(t => t.done).length;
              const total = p.tasks.length;
              const ppct = Math.round((done / total) * 100);
              return (
                <div key={p.name} className="rounded-xl border bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.03]"
                  style={{ borderColor: `${p.accent}20` }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{p.emoji}</span>
                      <div>
                        <h3 className="text-sm font-bold text-white/90">{p.name}</h3>
                        <p className="text-[10px] text-white/40">{p.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full`}
                        style={{ color: p.accent, background: `${p.accent}15`, border: `1px solid ${p.accent}25` }}>
                        {p.status}
                      </span>
                      {p.link && (
                        <Link href={p.link.href} className="text-[10px] font-mono hover:underline" style={{ color: `${p.accent}90` }}>
                          {p.link.label} →
                        </Link>
                      )}
                    </div>
                  </div>
                  {/* progress */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ppct}%`, background: p.accent }} />
                    </div>
                    <span className="text-[10px] font-mono text-white/30">{done}/{total}</span>
                  </div>
                  {/* tasks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {p.tasks.map(t => (
                      <div key={t.t} className="flex items-center gap-2 py-0.5">
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[8px] flex-shrink-0 ${
                          t.done ? "border-transparent" : "border-white/10"
                        }`} style={t.done ? { background: `${p.accent}30`, color: p.accent } : {}}>
                          {t.done ? "✓" : ""}
                        </div>
                        <span className={`text-xs ${t.done ? "text-white/40 line-through" : "text-white/65"}`}>{t.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Activity Feed ── */}
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 mb-1">◈ ACTIVITY LOG</div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
              {LOG.map((l, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}50` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/60 leading-snug">{l.text}</div>
                    <div className="text-[9px] font-mono text-white/25 mt-0.5">{l.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Revenue ── */}
            <div className="mt-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/[0.03] p-5">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#f59e0b]/40 mb-3">✦ REVENUE</div>
              <div className="space-y-2">
                {[
                  { label: "This Month", val: "$0", color: "text-white/50" },
                  { label: "Pipeline", val: "$2,400", color: "text-[#f59e0b]" },
                  { label: "Monthly Target", val: "$5,000", color: "text-[#f59e0b]/60" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/30">{r.label}</span>
                    <span className={`text-sm font-bold ${r.color}`}>{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════ OPPORTUNITY SCANNER ═══════════════ */}
        <div className="mb-6">
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">✦ OPPORTUNITY SCANNER</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {OPPS.map(o => (
              <div key={o.title} className="rounded-xl border bg-white/[0.02] p-4 hover:bg-white/[0.03] transition-colors"
                style={{ borderColor: `${o.accent}20` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded"
                    style={{ color: o.accent, background: `${o.accent}15` }}>{o.tag}</span>
                  <span className="text-xs font-bold" style={{ color: o.accent }}>{o.rev}</span>
                </div>
                <div className="text-sm font-semibold text-white/85 mb-1">{o.title}</div>
                <div className="text-[10px] text-white/35 leading-relaxed">{o.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <footer className="text-center text-[9px] font-mono text-white/15 py-6 space-y-0.5">
          <div>Command Center v2 — Ramiche Operations</div>
          <div>No auto-publish · PRs only · Signal-first</div>
        </footer>

      </div>
    </main>
  );
}
