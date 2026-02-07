"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════
   COMMAND CENTER v3 — HOLOGRAPHIC MISSION CONTROL
   Living, breathing, futuristic — not a spreadsheet.
   ══════════════════════════════════════════════════════════════ */

/* ── agents ─────────────────────────────────────────────── */
const AGENTS = [
  { name: "Atlas", model: "Opus 4.6", role: "Lead · Strategy", status: "active" as const, color: "#00f0ff", icon: "🧭" },
  { name: "Builder", model: "Sonnet 4.5", role: "Code · Ship", status: "idle" as const, color: "#a855f7", icon: "⚡" },
  { name: "Scout", model: "Haiku 4.5", role: "Research · Scan", status: "idle" as const, color: "#f59e0b", icon: "🔍" },
  { name: "Voice", model: "ChatGPT 4o", role: "Audio · TTS", status: "idle" as const, color: "#e879f9", icon: "🎙" },
];

/* ── projects ────────────────────────────────────────────── */
const PROJECTS = [
  {
    name: "Galactik Antics", accent: "#00f0ff", status: "active" as const,
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
    name: "Apex Athlete", accent: "#f59e0b", status: "active" as const,
    desc: "Gamified swim training — live beta",
    tasks: [
      { t: "Game engine + check-ins", done: true },
      { t: "Coach dashboard + leaderboard", done: true },
      { t: "Advanced analytics", done: true },
      { t: "Multi-roster expansion (240+)", done: false },
      { t: "Firebase backend + deploy", done: false },
    ],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Ramiche Studio", accent: "#a855f7", status: "active" as const,
    desc: "$400 Creative Direction Sprint",
    tasks: [
      { t: "Landing page live", done: true },
      { t: "Portfolio + case studies", done: false },
      { t: "Social proof / testimonials", done: false },
      { t: "Stripe integration", done: false },
    ],
    link: { label: "Studio", href: "/studio" },
  },
  {
    name: "Music Pipeline", accent: "#e879f9", status: "paused" as const,
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
  { title: "AI Product Photos", rev: "$99-349", tag: "READY", accent: "#00f0ff", desc: "Weavy pipeline as a service" },
  { title: "Brand-in-a-Box", rev: "$300-500", tag: "READY", accent: "#a855f7", desc: "48h Creative Direction Sprint" },
  { title: "Shopify Setup", rev: "$500-1.5K", tag: "SOON", accent: "#f59e0b", desc: "Done-for-you store" },
  { title: "AI Agent Consulting", rev: "$1-3K", tag: "SOON", accent: "#e879f9", desc: "OpenClaw-style setup" },
  { title: "Content Repurposing", rev: "$200-500/mo", tag: "IDEA", accent: "#00f0ff", desc: "Multi-platform pipeline" },
];

/* ── timeline ────────────────────────────────────────────── */
const LOG = [
  { time: "Now", text: "Building multi-roster Apex Athlete expansion", color: "#f59e0b" },
  { time: "Today", text: "Apex Athlete v1 tested at practice — working", color: "#00f0ff" },
  { time: "Today", text: "Sci-fi game UI overhaul deployed", color: "#a855f7" },
  { time: "Today", text: "Coach analytics: attrition risk, culture score", color: "#f59e0b" },
  { time: "Yest.", text: "GA phone case art crops + source matching", color: "#00f0ff" },
  { time: "Yest.", text: "Studio landing page deployed", color: "#a855f7" },
];

/* ── types ────────────────────────────────────────────────── */
interface Weather { tempF: string; condition: string; humidity: string; wind: string; forecast: { day: string; high: string; low: string; cond: string }[]; }
interface Verse { text: string; ref: string; }

/* ── NAV ─────────────────────────────────────────────────── */
const NAV = [
  { label: "HQ", href: "/", icon: "◈" },
  { label: "COMMAND", href: "/command-center", icon: "◇", active: true },
  { label: "APEX", href: "/apex-athlete", icon: "✦" },
  { label: "STUDIO", href: "/studio", icon: "♢" },
];

/* ══════════════════════════════════════════════════════════════ */

export default function CommandCenter() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState(0);
  const [waterG, setWaterG] = useState(0);
  const [sleepH, setSleepH] = useState(7);
  const [workedOut, setWorkedOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── live clock ── */
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── holographic particle canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; color: string }[] = [];

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // seed particles
    for (let i = 0; i < 60; i++) {
      const colors = ["rgba(0,240,255,", "rgba(168,85,247,", "rgba(245,158,11,", "rgba(232,121,249,"];
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        a: Math.random() * 0.4 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.a})`;
        ctx.fill();

        // glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.a * 0.15})`;
        ctx.fill();
      });

      // draw connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,240,255,${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  /* ── fetchers ── */
  const fetchWeather = useCallback(async () => {
    try {
      const r = await fetch("https://wttr.in/BocaRaton?format=j1");
      const d = await r.json();
      const c = d.current_condition?.[0];
      setWeather({
        tempF: c?.temp_F ?? "--", condition: c?.weatherDesc?.[0]?.value ?? "",
        humidity: c?.humidity ?? "--", wind: `${c?.windspeedMiles ?? "--"} mph`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast: (d.weather?.slice(0, 3) ?? []).map((w: any) => ({
          day: new Date(w.date).toLocaleDateString("en", { weekday: "short" }),
          high: w.maxtempF ?? "--", low: w.mintempF ?? "--",
          cond: w.hourly?.[4]?.weatherDesc?.[0]?.value ?? "",
        })),
      });
    } catch { /* */ }
  }, []);

  const fetchVerse = useCallback(async () => {
    try {
      const r = await fetch("https://bible-api.com/?random=verse");
      const d = await r.json();
      setVerse({ text: d.text?.trim() ?? "", ref: d.reference ?? "" });
    } catch { /* */ }
  }, []);

  const copyVerse = () => {
    if (!verse) return;
    navigator.clipboard.writeText(`"${verse.text}" — ${verse.ref}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { setMounted(true); fetchWeather(); fetchVerse(); }, [fetchWeather, fetchVerse]);
  if (!mounted) return null;

  /* ── computed ── */
  const totalT = PROJECTS.reduce((s, p) => s + p.tasks.length, 0);
  const doneT = PROJECTS.reduce((s, p) => s + p.tasks.filter(t => t.done).length, 0);
  const pct = Math.round((doneT / totalT) * 100);
  const activeCount = AGENTS.filter(a => a.status === "active").length;

  return (
    <main className="min-h-screen w-full bg-[#030108] text-white relative overflow-hidden">

      {/* ═══════ HOLOGRAPHIC BACKGROUND ═══════ */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* ambient gradient layers */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full nebula-1"
          style={{ background: "radial-gradient(circle, rgba(0,240,255,0.08) 0%, transparent 60%)" }} />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] rounded-full nebula-2"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 60%)" }} />
        <div className="absolute bottom-[-10%] left-[40%] w-[500px] h-[500px] rounded-full nebula-3"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 60%)" }} />
        <div className="absolute top-[60%] left-[10%] w-[400px] h-[400px] rounded-full nebula-drift"
          style={{ background: "radial-gradient(circle, rgba(232,121,249,0.04) 0%, transparent 60%)" }} />
      </div>

      {/* scan line overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
        <div className="w-full h-[2px] scan-line"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,240,255,0.15), transparent)" }} />
      </div>

      {/* subtle grid overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none data-grid-bg opacity-30" />

      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-10 py-4">

        {/* ═══════ TOP HUD BAR ═══════ */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {/* logo mark */}
            <div className="relative w-10 h-10 game-panel flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.15) 0%, rgba(168,85,247,0.1) 100%)", border: "1px solid rgba(0,240,255,0.3)" }}>
              <span className="neon-text-cyan text-lg font-black">R</span>
              <div className="absolute inset-0 neon-pulse opacity-50" />
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[0.5em] text-[#00f0ff]/40 font-mono">RAMICHE OPS ·  SYSTEM ONLINE</div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#e879f9] bg-clip-text text-transparent bg-[length:200%_200%] animated-gradient-text">
                  COMMAND CENTER
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* live clock */}
            <div className="hidden sm:block text-right">
              <div className="font-mono text-lg text-[#00f0ff]/80 tabular-nums tracking-widest">{time}</div>
              <div className="text-[8px] font-mono text-white/20 uppercase tracking-wider">EASTERN · LIVE</div>
            </div>
            {/* nav */}
            <nav className="flex">
              {NAV.map(n => (
                <Link key={n.href} href={n.href}
                  className={`game-btn px-3 py-2 text-[9px] font-mono uppercase tracking-wider ${
                    n.active
                      ? "bg-[#00f0ff]/10 text-[#00f0ff] border-t-2 border-[#00f0ff]/60"
                      : "bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
                  }`} style={{ borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="mr-1 opacity-40">{n.icon}</span>{n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        {/* ═══════ SYSTEM STATUS STRIP ═══════ */}
        <div className="game-panel game-panel-scan relative mb-6 px-5 py-3 flex items-center justify-between gap-6 flex-wrap"
          style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.04) 0%, rgba(168,85,247,0.03) 50%, rgba(0,240,255,0.04) 100%)", border: "1px solid rgba(0,240,255,0.12)" }}>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse" style={{ boxShadow: "0 0 8px rgba(0,240,255,0.6)" }} />
              <span className="text-[10px] font-mono text-[#00f0ff]/70">SYSTEMS NOMINAL</span>
            </div>
            <div className="text-[10px] font-mono text-white/30">{activeCount}/{AGENTS.length} AGENTS ACTIVE</div>
            <div className="text-[10px] font-mono text-white/30">MISSIONS {doneT}/{totalT} · {pct}%</div>
          </div>
          {/* mission progress bar inline */}
          <div className="flex items-center gap-3 flex-1 max-w-xs">
            <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden xp-bar-segments">
              <div className="h-full rounded-full xp-shimmer transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-mono neon-text-cyan">{pct}%</span>
          </div>
        </div>

        {/* ═══════ VERSE + WEATHER + AGENTS — HOLOGRAPHIC PANELS ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* ── Scripture ── */}
          <div className="game-panel game-panel-border relative p-5 flex flex-col justify-between"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(6,2,15,0.95) 100%)" }}>
            <div className="absolute top-2 right-3 text-[8px] font-mono text-[#f59e0b]/30 tracking-widest">✦ VERSE</div>
            {verse ? (
              <div>
                <p className="text-white/80 text-sm leading-relaxed italic mb-3 pr-8">&ldquo;{verse.text}&rdquo;</p>
                <div className="neon-text-gold text-[11px] font-mono">— {verse.ref}</div>
              </div>
            ) : (
              <div className="text-white/20 text-sm animate-pulse">Connecting...</div>
            )}
            <div className="flex gap-3 mt-4 pt-3 border-t border-[#f59e0b]/10">
              <button onClick={fetchVerse} className="game-btn px-3 py-1.5 text-[9px] font-mono bg-[#f59e0b]/10 text-[#f59e0b]/70 hover:text-[#f59e0b]">↻ NEW</button>
              <button onClick={copyVerse} className="game-btn px-3 py-1.5 text-[9px] font-mono bg-white/[0.03] text-white/30 hover:text-white/60">{copied ? "✓ COPIED" : "⎘ COPY"}</button>
            </div>
          </div>

          {/* ── Weather ── */}
          <div className="game-panel game-panel-border relative p-5"
            style={{ background: "linear-gradient(135deg, rgba(0,240,255,0.05) 0%, rgba(6,2,15,0.95) 100%)" }}>
            <div className="absolute top-2 right-3 text-[8px] font-mono text-[#00f0ff]/30 tracking-widest">☀ WEATHER</div>
            {weather ? (
              <>
                <div className="flex items-start gap-4 mb-4">
                  <div>
                    <span className="text-5xl font-black neon-text-cyan">{weather.tempF}°</span>
                  </div>
                  <div className="pt-2">
                    <div className="text-white/70 text-sm font-medium">{weather.condition}</div>
                    <div className="text-[10px] font-mono text-white/30 mt-1">
                      {weather.humidity}% humidity · {weather.wind}
                    </div>
                    <div className="text-[8px] font-mono text-[#00f0ff]/30 mt-1 uppercase tracking-wider">Boca Raton, FL</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {weather.forecast.map(d => (
                    <div key={d.day} className="game-panel-sm text-center py-2 px-2"
                      style={{ background: "rgba(0,240,255,0.04)", border: "1px solid rgba(0,240,255,0.08)" }}>
                      <div className="text-[9px] font-mono text-[#00f0ff]/50">{d.day}</div>
                      <div className="text-xs text-white/70 font-bold mt-0.5">{d.high}°<span className="text-white/30">/{d.low}°</span></div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-white/20 text-sm animate-pulse">Scanning atmosphere...</div>
            )}
          </div>

          {/* ── Agent Network ── */}
          <div className="game-panel game-panel-border game-panel-scan relative p-5"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.04) 0%, rgba(6,2,15,0.95) 100%)" }}>
            <div className="absolute top-2 right-3 text-[8px] font-mono text-white/20 tracking-widest">◈ AGENTS</div>
            <div className="space-y-3">
              {AGENTS.map(a => (
                <div key={a.name} className="flex items-center gap-3 group">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: `linear-gradient(135deg, ${a.color}15 0%, ${a.color}05 100%)`,
                        border: `1px solid ${a.color}30`,
                        boxShadow: a.status === "active" ? `0 0 15px ${a.color}30, inset 0 0 10px ${a.color}10` : "none",
                      }}>
                      {a.icon}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#030108] ${
                      a.status === "active" ? "bg-[#00f0ff] animate-pulse" : "bg-white/15"
                    }`} style={a.status === "active" ? { boxShadow: `0 0 8px ${a.color}` } : {}} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white/90">{a.name}</span>
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                        color: a.color, background: `${a.color}12`, border: `1px solid ${a.color}20`
                      }}>{a.model}</span>
                    </div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: `${a.color}60` }}>
                      {a.role} · <span className={a.status === "active" ? "text-[#00f0ff]" : "text-white/20"}>{a.status.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════ HEALTH VITALS — HOLOGRAPHIC RING CARDS ═══════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "STEPS", val: steps.toLocaleString(), color: "#a855f7", unit: "", inc: () => setSteps(s => s + 500), dec: () => setSteps(s => Math.max(0, s - 500)) },
            { label: "WATER", val: String(waterG), color: "#00f0ff", unit: "glasses", inc: () => setWaterG(w => w + 1), dec: () => setWaterG(w => Math.max(0, w - 1)) },
            { label: "SLEEP", val: String(sleepH), color: "#f59e0b", unit: "hrs", inc: () => setSleepH(s => Math.min(12, s + 0.5)), dec: () => setSleepH(s => Math.max(0, s - 0.5)) },
          ].map(h => (
            <div key={h.label} className="game-panel relative p-4 group"
              style={{
                background: `linear-gradient(135deg, ${h.color}08 0%, rgba(3,1,8,0.95) 100%)`,
                border: `1px solid ${h.color}18`,
              }}>
              <div className="text-[8px] font-mono uppercase tracking-widest mb-2" style={{ color: `${h.color}50` }}>{h.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black" style={{ color: h.color, textShadow: `0 0 15px ${h.color}40` }}>{h.val}</span>
                {h.unit && <span className="text-[10px] font-mono text-white/20">{h.unit}</span>}
              </div>
              <div className="flex gap-1 mt-3">
                <button onClick={h.dec} className="game-btn w-8 h-7 text-xs font-mono flex items-center justify-center"
                  style={{ background: `${h.color}10`, color: `${h.color}70`, border: `1px solid ${h.color}15` }}>−</button>
                <button onClick={h.inc} className="game-btn w-8 h-7 text-xs font-mono flex items-center justify-center"
                  style={{ background: `${h.color}10`, color: `${h.color}70`, border: `1px solid ${h.color}15` }}>+</button>
              </div>
            </div>
          ))}
          {/* Workout */}
          <div className="game-panel relative p-4 cursor-pointer" onClick={() => setWorkedOut(w => !w)}
            style={{
              background: workedOut
                ? "linear-gradient(135deg, rgba(232,121,249,0.12) 0%, rgba(3,1,8,0.95) 100%)"
                : "linear-gradient(135deg, rgba(232,121,249,0.04) 0%, rgba(3,1,8,0.95) 100%)",
              border: workedOut ? "1px solid rgba(232,121,249,0.35)" : "1px solid rgba(232,121,249,0.12)",
              boxShadow: workedOut ? "0 0 20px rgba(232,121,249,0.15), inset 0 0 15px rgba(232,121,249,0.05)" : "none",
            }}>
            <div className="text-[8px] font-mono uppercase tracking-widest mb-2 text-[#e879f9]/50">WORKOUT</div>
            <div className="text-2xl font-black" style={{ color: workedOut ? "#e879f9" : "rgba(255,255,255,0.15)", textShadow: workedOut ? "0 0 15px rgba(232,121,249,0.4)" : "none" }}>
              {workedOut ? "DONE" : "—"}
            </div>
            <div className="mt-3 text-[9px] font-mono" style={{ color: workedOut ? "#e879f9" : "rgba(255,255,255,0.2)" }}>
              {workedOut ? "✓ Completed" : "Tap to mark"}
            </div>
          </div>
        </div>

        {/* ═══════ MISSIONS + ACTIVITY FEED ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

          {/* ── Projects (2 cols) ── */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-[#00f0ff]/30">◈ ACTIVE MISSIONS</div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.15), transparent)" }} />
            </div>
            {PROJECTS.map(p => {
              const done = p.tasks.filter(t => t.done).length;
              const total = p.tasks.length;
              const ppct = Math.round((done / total) * 100);
              const isExpanded = expandedProject === p.name;
              return (
                <div key={p.name} className="game-card game-panel relative overflow-hidden cursor-pointer"
                  onClick={() => setExpandedProject(isExpanded ? null : p.name)}
                  style={{
                    background: `linear-gradient(135deg, ${p.accent}06 0%, rgba(3,1,8,0.98) 100%)`,
                    border: `1px solid ${p.accent}18`,
                  }}>
                  {/* scan sweep on active projects */}
                  {p.status === "active" && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="absolute left-0 right-0 h-[1px] opacity-30"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`,
                          animation: "scanSweep 8s linear infinite",
                        }} />
                    </div>
                  )}
                  <div className="relative z-10 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{
                          background: p.accent,
                          boxShadow: `0 0 10px ${p.accent}60, 0 0 25px ${p.accent}20`,
                        }} />
                        <div>
                          <h3 className="text-sm font-bold text-white/90">{p.name}</h3>
                          <p className="text-[10px] text-white/35 font-mono">{p.desc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[8px] font-mono uppercase px-2 py-1 game-panel-sm"
                          style={{ color: p.accent, background: `${p.accent}12`, border: `1px solid ${p.accent}20` }}>
                          {p.status}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: `${p.accent}70` }}>{ppct}%</span>
                      </div>
                    </div>
                    {/* progress bar */}
                    <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden mb-2 xp-bar-segments">
                      <div className="h-full rounded-full transition-all duration-500" style={{
                        width: `${ppct}%`,
                        background: `linear-gradient(90deg, ${p.accent}80, ${p.accent})`,
                        boxShadow: `0 0 10px ${p.accent}40`,
                      }} />
                    </div>
                    {/* expanded task list */}
                    <div className="athlete-card-wrapper" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
                      <div>
                        <div className="pt-3 border-t border-white/[0.04] mt-2 space-y-2">
                          {p.tasks.map(t => (
                            <div key={t.t} className="flex items-center gap-2.5">
                              <div className={`w-4 h-4 rounded flex items-center justify-center text-[9px] flex-shrink-0 ${
                                t.done ? "" : "border border-white/10"
                              }`} style={t.done ? { background: `${p.accent}25`, color: p.accent } : {}}>
                                {t.done ? "✓" : ""}
                              </div>
                              <span className={`text-xs font-mono ${t.done ? "text-white/35 line-through" : "text-white/60"}`}>{t.t}</span>
                            </div>
                          ))}
                          {p.link && (
                            <div className="pt-2">
                              <Link href={p.link.href}
                                className="game-btn inline-block px-4 py-1.5 text-[9px] font-mono uppercase tracking-wider"
                                style={{ background: `${p.accent}12`, color: p.accent, border: `1px solid ${p.accent}25` }}
                                onClick={e => e.stopPropagation()}>
                                {p.link.label} →
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Activity Feed + Revenue ── */}
          <div className="space-y-4">
            {/* Activity */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-white/20">◈ ACTIVITY</div>
                <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
              </div>
              <div className="game-panel game-panel-scan relative p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {LOG.map((l, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <div className="mt-1.5 flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full transition-all group-hover:scale-150" style={{
                        background: l.color,
                        boxShadow: `0 0 8px ${l.color}50`,
                      }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white/55 leading-snug">{l.text}</div>
                      <div className="text-[8px] font-mono text-white/20 mt-0.5">{l.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue */}
            <div className="game-panel relative p-5"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(3,1,8,0.95) 100%)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-[#f59e0b]/40 mb-4">✦ REVENUE</div>
              <div className="space-y-3">
                {[
                  { label: "This Month", val: "$0", style: "text-white/40" },
                  { label: "Pipeline", val: "$2,400", style: "neon-text-gold" },
                  { label: "Monthly Target", val: "$5,000", style: "text-[#f59e0b]/50" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/25">{r.label}</span>
                    <span className={`text-sm font-bold ${r.style}`}>{r.val}</span>
                  </div>
                ))}
              </div>
              {/* progress to target */}
              <div className="mt-4 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: "0%", background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                  boxShadow: "0 0 8px rgba(245,158,11,0.3)",
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ OPPORTUNITY SCANNER ═══════ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-white/20">✦ OPPORTUNITY SCANNER</div>
            <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.06), transparent)" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {OPPS.map(o => (
              <div key={o.title} className="game-card game-panel-sm relative p-4 cursor-pointer"
                style={{
                  background: `linear-gradient(160deg, ${o.accent}06 0%, rgba(3,1,8,0.98) 100%)`,
                  border: `1px solid ${o.accent}15`,
                }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[7px] font-mono uppercase px-1.5 py-0.5 tracking-wider"
                    style={{ color: o.accent, background: `${o.accent}12`, border: `1px solid ${o.accent}20` }}>{o.tag}</span>
                  <span className="text-xs font-bold font-mono" style={{ color: o.accent, textShadow: `0 0 8px ${o.accent}30` }}>{o.rev}</span>
                </div>
                <div className="text-xs font-bold text-white/80 mb-1">{o.title}</div>
                <div className="text-[9px] text-white/30 font-mono leading-relaxed">{o.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ FOOTER ═══════ */}
        <footer className="text-center py-6 border-t border-white/[0.04]">
          <div className="text-[8px] font-mono text-white/10 tracking-widest uppercase">
            Command Center v3 · Ramiche Operations · Signal First
          </div>
        </footer>

      </div>
    </main>
  );
}
