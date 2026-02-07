"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ── agent network ────────────────────────────────────────── */
const agents = [
  { name: "Atlas", model: "Opus 4.6", status: "active" as const, task: "Running GA PRODUCTS render pipeline via Weavy" },
  { name: "Builder", model: "Sonnet 4.5", status: "idle" as const, task: "Last: scaffolded Apex Athlete MVP" },
  { name: "Scout", model: "Haiku 4.5", status: "idle" as const, task: "Last: scanned Printful catalog for margin data" },
];

/* ── XP data ──────────────────────────────────────────────── */
const xp = { current: 1420, nextLevel: 2000, level: "Operator", nextTitle: "Commander" };

/* ── stats ────────────────────────────────────────────────── */
const stats = [
  { label: "Active Missions", value: "3", accent: "cyan", delta: null },
  { label: "Tasks Shipped", value: "12", accent: "purple", delta: "+3 this week" },
  { label: "Blockers", value: "2", accent: "gold", delta: "down from 4" },
  { label: "Agent Uptime", value: "98%", accent: "cyan", delta: null },
];

/* ── revenue ──────────────────────────────────────────────── */
const revenue = [
  { label: "This Month", amount: "$0" },
  { label: "Pipeline", amount: "$2,400" },
  { label: "Target", amount: "$5,000" },
];

/* ── projects ─────────────────────────────────────────────── */
const projects = [
  {
    name: "Galactik Antics", status: "active" as const, accent: "cyan",
    focus: "Phone cases → Framed posters → T-shirts",
    tasks: [
      { text: "Pick case-safe art crops", done: true },
      { text: "Generate production renders via Weavy GA PRODUCTS", done: true },
      { text: "Save outputs into finals folder", done: false },
      { text: "Upload to Printful + configure variants", done: false },
      { text: "PDP copy + pricing", done: false },
    ],
    links: [
      { label: "Weavy GA flow", href: "https://app.weavy.ai/flow/c6YNwJ4aj9z2iXcK1pRSeU" },
      { label: "Printful dashboard", href: "https://www.printful.com/dashboard" },
    ],
  },
  {
    name: "Ramiche Studio", status: "active" as const, accent: "purple",
    focus: "$400 Creative Direction Sprint — brand identity in 48h",
    tasks: [
      { text: "Landing page live", done: true },
      { text: "Portfolio section with case studies", done: false },
      { text: "Testimonials / social proof", done: false },
      { text: "Stripe payment integration", done: false },
    ],
    links: [{ label: "Studio page", href: "/studio" }],
  },
  {
    name: "Apex Athlete", status: "active" as const, accent: "gold",
    focus: "Gamified swim training system — MVP build",
    tasks: [
      { text: "Game engine (XP, levels, streaks, quests)", done: true },
      { text: "Dashboard UI + coach tools", done: true },
      { text: "Daily check-in flow", done: true },
      { text: "Leaderboard + quest tracker", done: true },
      { text: "Coach analytics panel", done: true },
    ],
    links: [{ label: "Apex Athlete app", href: "/apex-athlete" }],
  },
  {
    name: "Music Pipeline", status: "paused" as const, accent: "purple",
    focus: "Track production & release pipeline automation",
    tasks: [
      { text: "music.json system of record", done: true },
      { text: "Status dashboard", done: true },
      { text: "Stalled-track detection", done: false },
      { text: "Momentum reports", done: false },
    ],
    links: [],
  },
];

/* ── timeline ─────────────────────────────────────────────── */
const timeline = [
  { accent: "cyan", time: "Now", text: "Atlas running GA render pipeline" },
  { accent: "gold", time: "Today", text: "Apex Athlete swim system shipped" },
  { accent: "cyan", time: "Today", text: "Command Center v2 deployed" },
  { accent: "purple", time: "Yest.", text: "GA phone case art crops finalized" },
  { accent: "cyan", time: "2d", text: "Studio landing page deployed" },
  { accent: "gold", time: "3d", text: "Music pipeline paused — focus shift to GA" },
];

/* ── opportunities ────────────────────────────────────────── */
const opportunities = [
  { title: "AI Product Photo Service", source: "Reddit/X", pain: "Small e-commerce sellers can't afford photographers", solution: "Weavy pipeline as a service — batch renders from source art", revenue: "$99-349/batch", accent: "cyan" },
  { title: "Brand-in-a-Box for Creators", source: "Reddit", pain: "Creators need brand identity but can't afford agencies", solution: "48h Creative Direction Sprint — already built", revenue: "$300-500/project", accent: "purple" },
  { title: "Content Repurposing Pipeline", source: "X/Web", pain: "Creators make one video, need it everywhere", solution: "Whisper → AI summarize → multi-platform formatting", revenue: "$200-500/mo", accent: "gold" },
  { title: "Shopify Store Setup", source: "Reddit", pain: "Small brands overwhelmed by Shopify", solution: "Done-for-you store from GA playbook", revenue: "$500-1,500/store", accent: "cyan" },
  { title: "AI Agent Setup Consulting", source: "X/Reddit", pain: "Businesses want AI assistants but can't configure them", solution: "OpenClaw-style setup + training", revenue: "$1,000-3,000", accent: "purple" },
];

/* ── accent helpers ───────────────────────────────────────── */
const accentMap: Record<string, { border: string; bg: string; text: string; neon: string; glow: string }> = {
  cyan: { border: "border-[#00f0ff]/30", bg: "bg-[#00f0ff]/5", text: "text-[#00f0ff]", neon: "neon-text-cyan", glow: "rgba(0,240,255,0.3)" },
  purple: { border: "border-[#a855f7]/30", bg: "bg-[#a855f7]/5", text: "text-[#a855f7]", neon: "neon-text-purple", glow: "rgba(168,85,247,0.3)" },
  gold: { border: "border-[#f59e0b]/30", bg: "bg-[#f59e0b]/5", text: "text-[#f59e0b]", neon: "neon-text-gold", glow: "rgba(245,158,11,0.3)" },
};

/* ── types ────────────────────────────────────────────────── */
interface WeatherData {
  tempF: string; condition: string; humidity: string;
  forecast: { day: string; high: string; low: string; condition: string }[];
}
interface VerseData { text: string; reference: string; }

/* ══════════════════════════════════════════════════════════════ */

export default function CommandCenter() {
  const totalTasks = projects.reduce((s, p) => s + p.tasks.length, 0);
  const doneTasks = projects.reduce((s, p) => s + p.tasks.filter((t) => t.done).length, 0);
  const pct = Math.round((doneTasks / totalTasks) * 100);
  const xpPct = Math.round((xp.current / xp.nextLevel) * 100);

  /* ── weather ── */
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      const res = await fetch("https://wttr.in/Miami?format=j1");
      const data = await res.json();
      const current = data.current_condition?.[0];
      const days = data.weather?.slice(0, 3) ?? [];
      setWeather({
        tempF: current?.temp_F ?? "--", condition: current?.weatherDesc?.[0]?.value ?? "Unknown", humidity: current?.humidity ?? "--",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast: days.map((d: any) => ({ day: d.date?.slice(5) ?? "", high: d.maxtempF ?? "--", low: d.mintempF ?? "--", condition: d.hourly?.[4]?.weatherDesc?.[0]?.value ?? "" })),
      });
    } catch { setWeather(null); }
    setWeatherLoading(false);
  }, []);

  /* ── verse ── */
  const [verse, setVerse] = useState<VerseData | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const fetchVerse = useCallback(async () => {
    setVerseLoading(true);
    try {
      const res = await fetch("https://bible-api.com/?random=verse");
      const data = await res.json();
      setVerse({ text: data.text?.trim() ?? "", reference: data.reference ?? "" });
    } catch { setVerse(null); }
    setVerseLoading(false);
  }, []);
  const copyVerse = () => { if (!verse) return; navigator.clipboard.writeText(`${verse.text} — ${verse.reference}`); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  /* ── health ── */
  const [steps, setSteps] = useState(0);
  const [water, setWater] = useState(0);
  const [sleep, setSleep] = useState(7);
  const [workout, setWorkout] = useState(false);

  /* ── opportunity expand ── */
  const [expandedOpp, setExpandedOpp] = useState<number | null>(null);

  /* ── mount ── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); fetchWeather(); fetchVerse(); }, [fetchWeather, fetchVerse]);
  if (!mounted) return null;

  const NAV = [
    { label: "HQ", href: "/", icon: "◈" },
    { label: "Command Center", href: "/command-center", icon: "◇", active: true },
    { label: "Apex Athlete", href: "/apex-athlete", icon: "✦" },
    { label: "Studio", href: "/studio", icon: "♢" },
  ];

  return (
    <main className="min-h-screen w-full bg-[#06020f] text-white relative overflow-hidden">
      {/* ── Nebula BG ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="nebula-1 absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 70%)" }} />
        <div className="nebula-2 absolute top-[30%] right-[-10%] w-[700px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)" }} />
        <div className="nebula-3 absolute bottom-[-10%] left-[20%] w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)" }} />
        <div className="nebula-drift absolute top-[60%] left-[60%] w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(0,240,255,0.04) 0%, transparent 70%)" }} />
      </div>

      {/* ── Scan line ── */}
      <div className="scan-line fixed inset-0 pointer-events-none z-0">
        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff]/20 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 py-8 md:px-12">

        {/* ═══ HEADER ═══ */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#00f0ff]/40 font-mono mb-1">◈ MISSION CONTROL</div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight animated-gradient-text bg-clip-text text-transparent bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#e879f9]" style={{ filter: "drop-shadow(0 0 30px rgba(0,240,255,0.3))" }}>
              COMMAND CENTER
            </h1>
            <p className="text-white/30 text-sm mt-1 font-mono">All agents · All missions · One view</p>
          </div>
          <nav className="flex gap-1">
            {NAV.map(n => (
              <Link key={n.href} href={n.href}
                className={`game-btn px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all ${n.active ? "bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40" : "bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/70 hover:border-white/20"}`}>
                <span className="mr-1.5 opacity-60">{n.icon}</span>{n.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* ═══ TOP WIDGETS: Weather + Health + Bible ═══ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

          {/* Weather */}
          <div className="game-panel game-panel-border bg-[#00f0ff]/[0.03] p-5 relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="neon-text-cyan text-lg">☀</span>
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#00f0ff]/80">Weather — Miami</h2>
            </div>
            {weatherLoading ? (
              <div className="text-white/30 text-sm animate-pulse py-4">Loading...</div>
            ) : weather ? (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className="text-3xl font-black neon-text-cyan">{weather.tempF}°F</div>
                  <div>
                    <div className="text-white/80 text-sm">{weather.condition}</div>
                    <div className="text-white/30 text-xs font-mono">Humidity: {weather.humidity}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {weather.forecast.map(d => (
                    <div key={d.day} className="bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1.5 text-center">
                      <div className="text-[10px] text-white/40 font-mono">{d.day}</div>
                      <div className="text-xs text-white/70">{d.high}° / {d.low}°</div>
                      <div className="text-[10px] text-white/30">{d.condition}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={fetchWeather} className="game-btn bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] px-3 py-1.5 text-xs font-mono">↻ Refresh</button>
                  <button onClick={() => window.open("https://wttr.in/Miami", "_blank")} className="game-btn bg-white/[0.03] border border-white/[0.06] text-white/50 px-3 py-1.5 text-xs font-mono hover:text-white/80">Full Forecast →</button>
                </div>
              </>
            ) : <div className="text-white/30 text-sm py-4">Failed to load weather</div>}
          </div>

          {/* Health Stats */}
          <div className="game-panel game-panel-border bg-[#a855f7]/[0.03] p-5 relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="neon-text-purple text-lg">♥</span>
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#a855f7]/80">Health Stats</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Steps", value: steps.toLocaleString(), dec: () => setSteps(s => Math.max(0, s - 500)), inc: () => setSteps(s => s + 500) },
                { label: "Water", value: `${water} glasses`, dec: () => setWater(w => Math.max(0, w - 1)), inc: () => setWater(w => w + 1) },
                { label: "Sleep", value: `${sleep}h`, dec: () => setSleep(s => Math.max(0, s - 0.5)), inc: () => setSleep(s => Math.min(12, s + 0.5)) },
              ].map(h => (
                <div key={h.label} className="bg-white/[0.03] border border-white/[0.06] rounded p-2.5">
                  <div className="text-[10px] text-white/40 font-mono uppercase">{h.label}</div>
                  <div className="text-lg font-bold text-white/90 mb-1">{h.value}</div>
                  <div className="flex gap-1">
                    <button onClick={h.dec} className="game-btn bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] w-8 h-7 text-sm font-mono">−</button>
                    <button onClick={h.inc} className="game-btn bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] w-8 h-7 text-sm font-mono">+</button>
                  </div>
                </div>
              ))}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded p-2.5">
                <div className="text-[10px] text-white/40 font-mono uppercase">Workout</div>
                <div className="text-lg font-bold text-white/90 mb-1">{workout ? "Done ✓" : "—"}</div>
                <button onClick={() => setWorkout(w => !w)}
                  className={`game-btn px-3 py-1 text-xs font-mono ${workout ? "bg-[#a855f7]/20 border border-[#a855f7]/40 text-[#a855f7]" : "bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/70"}`}>
                  {workout ? "✓ Completed" : "Mark Done"}
                </button>
              </div>
            </div>
          </div>

          {/* Bible Verse */}
          <div className="game-panel game-panel-border bg-[#f59e0b]/[0.03] p-5 relative">
            <div className="flex items-center gap-2 mb-3">
              <span className="neon-text-gold text-lg">✦</span>
              <h2 className="text-sm font-mono uppercase tracking-wider text-[#f59e0b]/80">Daily Verse</h2>
            </div>
            {verseLoading ? (
              <div className="text-white/30 text-sm animate-pulse py-4">Loading...</div>
            ) : verse ? (
              <>
                <p className="text-white/80 text-sm leading-relaxed italic mb-2">&ldquo;{verse.text}&rdquo;</p>
                <div className="text-[#f59e0b]/60 text-xs font-mono mb-3">— {verse.reference}</div>
              </>
            ) : <div className="text-white/30 text-sm py-4">Failed to load verse</div>}
            <div className="flex gap-2">
              <button onClick={fetchVerse} className="game-btn bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] px-3 py-1.5 text-xs font-mono">↻ New Verse</button>
              <button onClick={copyVerse} className="game-btn bg-white/[0.03] border border-white/[0.06] text-white/50 px-3 py-1.5 text-xs font-mono hover:text-white/80 relative">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </section>

        {/* ═══ XP BAR ═══ */}
        <div className="game-panel game-panel-border bg-white/[0.02] p-4 mb-8 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#00f0ff]/60">Mission XP</span>
            <span className="text-xs font-mono text-white/40">{xp.level} → {xp.nextTitle}</span>
          </div>
          <div className="w-full h-3 bg-white/[0.06] rounded-full overflow-hidden xp-bar-segments">
            <div className="h-full xp-shimmer rounded-full transition-all duration-500" style={{ width: `${xpPct}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-mono text-white/30">
            <span>{xp.current.toLocaleString()} XP</span>
            <span>{xp.nextLevel.toLocaleString()} XP</span>
          </div>
        </div>

        {/* ═══ STATS ROW ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map(s => {
            const a = accentMap[s.accent] || accentMap.cyan;
            return (
              <div key={s.label} className={`game-panel-sm ${a.bg} ${a.border} border p-4 relative`}>
                <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">{s.label}</div>
                <div className={`text-2xl font-black ${a.text}`}>{s.value}</div>
                {s.delta && <div className="text-[10px] font-mono text-[#00f0ff]/50 mt-1">{s.delta}</div>}
              </div>
            );
          })}
        </div>

        {/* ═══ AGENT NETWORK ═══ */}
        <section className="mb-8">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[#00f0ff]/40 mb-3">◈ Agent Network</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {agents.map(a => (
              <div key={a.name} className={`game-panel game-panel-border p-4 relative ${a.status === "active" ? "bg-[#00f0ff]/[0.04] neon-pulse" : "bg-white/[0.02]"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${a.status === "active" ? "bg-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.5)]" : "bg-white/20"}`} />
                  <span className={`text-sm font-bold ${a.status === "active" ? "neon-text-cyan" : "text-white/60"}`}>{a.name}</span>
                </div>
                <div className="text-[10px] font-mono text-white/30 mb-1">{a.model}</div>
                <div className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${a.status === "active" ? "text-[#00f0ff]/80" : "text-white/30"}`}>● {a.status}</div>
                <div className="text-xs text-white/50">{a.task}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ REVENUE TRACKER ═══ */}
        <div className="game-panel game-panel-border bg-white/[0.02] p-5 mb-8 relative">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[#f59e0b]/40 mb-3">✦ Revenue Tracker</h2>
          <div className="grid grid-cols-3 gap-4">
            {revenue.map(r => (
              <div key={r.label} className="text-center">
                <div className="text-2xl font-black neon-text-gold">{r.amount}</div>
                <div className="text-[10px] font-mono text-white/30 uppercase mt-1">{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ OPPORTUNITY SCANNER ═══ */}
        <section className="mb-8">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[#f59e0b]/40 mb-3">✦ Opportunity Scanner</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunities.map((o, i) => {
              const a = accentMap[o.accent] || accentMap.cyan;
              const isOpen = expandedOpp === i;
              return (
                <div key={i} className={`game-panel-sm ${a.bg} ${a.border} border p-4 cursor-pointer transition-all hover:scale-[1.01]`} onClick={() => setExpandedOpp(isOpen ? null : i)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`text-xs font-mono uppercase ${a.text}`}>{o.source}</div>
                    <div className={`text-xs font-mono font-bold ${a.text}`}>{o.revenue}</div>
                  </div>
                  <div className="text-sm font-bold text-white/90 mb-1">{o.title}</div>
                  {isOpen && (
                    <div className="expand-in mt-2 space-y-2">
                      <div className="text-xs text-white/50"><span className="text-white/30 font-mono">PAIN: </span>{o.pain}</div>
                      <div className="text-xs text-white/50"><span className="text-white/30 font-mono">FIX: </span>{o.solution}</div>
                      <button className={`game-btn ${a.bg} ${a.border} border ${a.text} px-3 py-1.5 text-xs font-mono mt-2`}>Explore →</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ PROJECT CARDS ═══ */}
        <section className="mb-8">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-white/30 mb-3">◈ Active Missions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map(p => {
              const a = accentMap[p.accent] || accentMap.cyan;
              const done = p.tasks.filter(t => t.done).length;
              const total = p.tasks.length;
              const ppct = Math.round((done / total) * 100);
              return (
                <div key={p.name} className={`game-panel game-panel-border ${a.bg} p-5 relative`}>
                  <div className="scan-sweep" />
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-base font-bold ${a.text}`}>{p.name}</h3>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      p.status === "active" ? "bg-[#00f0ff]/10 text-[#00f0ff]" : p.status === "paused" ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "bg-[#a855f7]/10 text-[#a855f7]"
                    }`}>● {p.status}</span>
                  </div>
                  <p className="text-xs text-white/40 mb-3">{p.focus}</p>
                  {/* Progress */}
                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-500`} style={{ width: `${ppct}%`, background: a.glow.replace("0.3", "0.8") }} />
                  </div>
                  <div className="text-[10px] font-mono text-white/30 mb-3">{done}/{total} tasks · {ppct}%</div>
                  <div className="space-y-1.5">
                    {p.tasks.map(t => (
                      <div key={t.text} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-sm border flex items-center justify-center text-[10px] ${t.done ? `${a.border} ${a.text}` : "border-white/10 text-transparent"}`}>{t.done ? "✓" : ""}</div>
                        <span className={`text-xs ${t.done ? "text-white/50 line-through" : "text-white/70"}`}>{t.text}</span>
                      </div>
                    ))}
                  </div>
                  {p.links.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {p.links.map(l => (
                        <a key={l.href} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel={l.href.startsWith("http") ? "noreferrer" : undefined}
                          className={`game-btn ${a.bg} ${a.border} border ${a.text} px-3 py-1 text-[10px] font-mono`}>
                          {l.label} →
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ ACTIVITY FEED + QUICK ACCESS ═══ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Mission Log */}
          <div className="game-panel game-panel-border bg-white/[0.02] p-5 relative">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[#00f0ff]/40 mb-3">◈ Mission Log</h2>
            <div className="space-y-2">
              {timeline.map((t, i) => {
                const a = accentMap[t.accent] || accentMap.cyan;
                return (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0`} style={{ background: a.glow.replace("0.3", "0.8"), boxShadow: `0 0 8px ${a.glow}` }} />
                    <span className="text-[10px] font-mono text-white/30 w-10 flex-shrink-0">{t.time}</span>
                    <span className="text-xs text-white/60">{t.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Access */}
          <div className="game-panel game-panel-border bg-white/[0.02] p-5 relative">
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-white/30 mb-3">◈ Quick Access</h2>
            <div className="text-[10px] font-mono text-[#00f0ff]/40 uppercase tracking-wider mb-2">Mission Progress</div>
            <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-2 xp-bar-segments">
              <div className="h-full xp-shimmer rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] font-mono text-white/30 mb-4">{doneTasks} of {totalTasks} tasks · {pct}%</div>
            <div className="text-[10px] font-mono text-white/30 mb-3">Priority: GA products → Studio portfolio → Apex Athlete → Music</div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="text-center text-[10px] font-mono text-white/20 py-4 space-y-0.5">
          <div>Command Center v2 — mission control for Ramiche Operations</div>
          <div>No auto-publish · PRs only · Signal-first</div>
        </footer>
      </div>
    </main>
  );
}
