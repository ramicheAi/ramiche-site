"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER v4 — HOLOGRAPHIC MISSION CONTROL
   Apple x Rockstar Games, 50 years in the future.
   A living, breathing cockpit for Ramon's entire operation.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── AGENTS ─────────────────────────────────────────────────────────────────── */
const AGENTS = [
  {
    name: "Atlas", model: "Opus 4.6", role: "Lead Strategist",
    status: "active" as const, color: "#00f0ff", icon: "A",
    desc: "Orchestrates all agent actions, system-wide reasoning, mission planning",
    connections: [1, 2, 3],
  },
  {
    name: "Builder", model: "Sonnet 4.5", role: "Code & Ship",
    status: "active" as const, color: "#a855f7", icon: "B",
    desc: "Full-stack engineering, rapid prototyping, deployment pipelines",
    connections: [0, 2],
  },
  {
    name: "Scout", model: "Haiku 4.5", role: "Research & Scan",
    status: "idle" as const, color: "#f59e0b", icon: "S",
    desc: "Real-time intelligence gathering, data synthesis, trend detection",
    connections: [0, 3],
  },
  {
    name: "Voice", model: "ChatGPT 4o", role: "Audio & TTS",
    status: "idle" as const, color: "#e879f9", icon: "V",
    desc: "Voice synthesis, audio content generation, natural language interface",
    connections: [0],
  },
];

/* ── PROJECTS / MISSIONS ───────────────────────────────────────────────────── */
const MISSIONS = [
  {
    name: "Galactik Antics", accent: "#00f0ff", status: "active" as const,
    desc: "AI art merch \u2192 Shopify store", priority: "HIGH",
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
    desc: "Gamified swim training \u2014 LIVE BETA", priority: "CRITICAL",
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
    desc: "Creative Direction Sprint $400", priority: "HIGH",
    tasks: [
      { t: "Landing page live", done: true },
      { t: "Portfolio + case studies", done: false },
      { t: "Social proof / testimonials", done: false },
      { t: "Stripe integration", done: false },
    ],
    link: { label: "Studio", href: "/studio" },
  },
  {
    name: "Parallax", accent: "#e879f9", status: "active" as const,
    desc: "Music label \u2014 Yauggy, Niko Biswas, Gabe Greyson", priority: "MED",
    tasks: [
      { t: "Artist roster page", done: false },
      { t: "Distribution pipeline", done: false },
      { t: "Label branding + identity", done: false },
      { t: "Revenue split structure", done: false },
    ],
    link: null,
  },
  {
    name: "SCOWW", accent: "#22d3ee", status: "active" as const,
    desc: "Swim meet \u2014 sponsors locked, Meta ad live", priority: "HIGH",
    tasks: [
      { t: "Sponsor packages locked", done: true },
      { t: "Meta ad campaign live", done: true },
      { t: "Event logistics finalized", done: false },
      { t: "Registration page", done: false },
    ],
    link: null,
  },
  {
    name: "Music Pipeline", accent: "#e879f9", status: "paused" as const,
    desc: "Track production & release automation", priority: "LOW",
    tasks: [
      { t: "music.json system of record", done: true },
      { t: "Status dashboard", done: true },
      { t: "Stalled-track detection", done: false },
      { t: "Momentum reports", done: false },
    ],
    link: null,
  },
  {
    name: "Replit Projects", accent: "#22d3ee", status: "active" as const,
    desc: "Social Cross-Poster, Sports Betting Engine, TBD", priority: "MED",
    tasks: [
      { t: "Social Cross-Poster MVP", done: false },
      { t: "Sports Betting Engine prototype", done: false },
      { t: "Additional project scoping", done: false },
    ],
    link: null,
  },
];

/* ── OPPORTUNITIES ─────────────────────────────────────────────────────────── */
const OPPS = [
  { title: "AI Product Photos", rev: "$99-349", tag: "READY", accent: "#00f0ff", desc: "Weavy pipeline as a service" },
  { title: "Brand-in-a-Box", rev: "$300-500", tag: "READY", accent: "#a855f7", desc: "48h Creative Direction Sprint" },
  { title: "Shopify Setup", rev: "$500-1.5K", tag: "SOON", accent: "#f59e0b", desc: "Done-for-you store" },
  { title: "AI Agent Consulting", rev: "$1-3K", tag: "SOON", accent: "#e879f9", desc: "OpenClaw-style setup" },
  { title: "Content Repurposing", rev: "$200-500/mo", tag: "IDEA", accent: "#22d3ee", desc: "Multi-platform pipeline" },
];

/* ── QUICK LINKS ───────────────────────────────────────────────────────────── */
const LINKS = [
  { label: "Printful", href: "https://www.printful.com/dashboard", icon: "P", accent: "#00f0ff" },
  { label: "Shopify Admin", href: "https://admin.shopify.com", icon: "S", accent: "#96bf48" },
  { label: "Vercel", href: "https://vercel.com/dashboard", icon: "V", accent: "#ffffff" },
  { label: "GoMotion", href: "https://www.gomotionapp.com", icon: "G", accent: "#f59e0b" },
  { label: "GitHub", href: "https://github.com", icon: "H", accent: "#a855f7" },
  { label: "Replit", href: "https://replit.com", icon: "R", accent: "#e879f9" },
];

/* ── ACTIVITY LOG ──────────────────────────────────────────────────────────── */
const LOG = [
  { time: "Now", text: "Building multi-roster Apex Athlete expansion", color: "#f59e0b" },
  { time: "Today", text: "Apex Athlete v1 tested at practice \u2014 working", color: "#00f0ff" },
  { time: "Today", text: "Sci-fi game UI overhaul deployed", color: "#a855f7" },
  { time: "Today", text: "Coach analytics: attrition risk, culture score", color: "#f59e0b" },
  { time: "Yest.", text: "GA phone case art crops + source matching", color: "#00f0ff" },
  { time: "Yest.", text: "Studio landing page deployed", color: "#a855f7" },
  { time: "Yest.", text: "SCOWW sponsor packages finalized", color: "#22d3ee" },
  { time: "2d ago", text: "Parallax label identity started", color: "#e879f9" },
];

/* ── SCHEDULE ──────────────────────────────────────────────────────────────── */
const SCHEDULE = [
  { time: "06:00", event: "Morning swim practice", accent: "#00f0ff" },
  { time: "08:30", event: "School drop-off", accent: "#f59e0b" },
  { time: "15:30", event: "Afternoon swim practice", accent: "#00f0ff" },
  { time: "17:00", event: "Team meeting / review", accent: "#a855f7" },
  { time: "19:00", event: "Family dinner", accent: "#e879f9" },
  { time: "21:00", event: "Deep work session", accent: "#22d3ee" },
];

/* ── NAV ───────────────────────────────────────────────────────────────────── */
const NAV = [
  { label: "HQ", href: "/", icon: "\u25C8" },
  { label: "COMMAND", href: "/command-center", icon: "\u25C7", active: true },
  { label: "APEX", href: "/apex-athlete", icon: "\u2726" },
  { label: "STUDIO", href: "/studio", icon: "\u2662" },
];

/* ── TYPES ─────────────────────────────────────────────────────────────────── */
interface Weather {
  tempF: string;
  condition: string;
  humidity: string;
  wind: string;
  feelsLike: string;
  forecast: { day: string; high: string; low: string; cond: string }[];
}
interface Verse { text: string; ref: string; }

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */

export default function CommandCenter() {
  /* ── state ─── */
  const [weather, setWeather] = useState<Weather | null>(null);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState(0);
  const [waterG, setWaterG] = useState(0);
  const [sleepH, setSleepH] = useState(7);
  const [workedOut, setWorkedOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentNetRef = useRef<HTMLCanvasElement>(null);

  /* ── live clock ── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      }));
      setDateStr(now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      }));
    };
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
    const particles: {
      x: number; y: number; vx: number; vy: number;
      r: number; a: number; color: string; pulseOffset: number;
    }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = document.documentElement.scrollHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = [
      "rgba(0,240,255,",
      "rgba(168,85,247,",
      "rgba(245,158,11,",
      "rgba(232,121,249,",
      "rgba(34,211,238,",
    ];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 2 + 0.3,
        a: Math.random() * 0.35 + 0.08,
        color: colors[Math.floor(Math.random() * colors.length)],
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    let frameCount = 0;
    const draw = () => {
      frameCount++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const time = frameCount * 0.02;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
        if (p.y < -20) p.y = canvas.height + 20;
        if (p.y > canvas.height + 20) p.y = -20;

        const pulse = Math.sin(time + p.pulseOffset) * 0.3 + 0.7;
        const currentAlpha = p.a * pulse;

        // Glow trail
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 8);
        gradient.addColorStop(0, `${p.color}${currentAlpha * 0.4})`);
        gradient.addColorStop(0.4, `${p.color}${currentAlpha * 0.1})`);
        gradient.addColorStop(1, `${p.color}0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 8, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${currentAlpha})`;
        ctx.fill();
      });

      // Connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = 0.04 * (1 - dist / 150);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,240,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ── agent network SVG lines canvas ── */
  useEffect(() => {
    const canvas = agentNetRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    let frameCount = 0;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();

    const agentPositions = [
      { x: 0.5, y: 0.18 },   // Atlas top center
      { x: 0.17, y: 0.72 },  // Builder bottom left
      { x: 0.83, y: 0.72 },  // Scout bottom right
      { x: 0.5, y: 0.85 },   // Voice bottom center
    ];

    const draw = () => {
      frameCount++;
      const t = frameCount * 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const positions = agentPositions.map((p) => ({
        x: p.x * canvas.width,
        y: p.y * canvas.height,
      }));

      // Draw connection lines
      const connections: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2]];
      connections.forEach(([a, b]) => {
        const pa = positions[a];
        const pb = positions[b];
        const pulse = Math.sin(t + a + b) * 0.3 + 0.5;

        // Line
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        const lineGrad = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        lineGrad.addColorStop(0, `rgba(0,240,255,${0.12 * pulse})`);
        lineGrad.addColorStop(0.5, `rgba(168,85,247,${0.08 * pulse})`);
        lineGrad.addColorStop(1, `rgba(0,240,255,${0.12 * pulse})`);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Data packet traveling along line
        const packetPos = ((t * 0.5 + a * 0.7) % 1);
        const px = pa.x + (pb.x - pa.x) * packetPos;
        const py = pa.y + (pb.y - pa.y) * packetPos;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,240,255,${0.6 * pulse})`;
        ctx.fill();
        // Packet glow
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,240,255,${0.15 * pulse})`;
        ctx.fill();
      });

      // Draw node halos
      positions.forEach((p, i) => {
        const agentColor = AGENTS[i].color;
        const isActive = AGENTS[i].status === "active";
        const pulse = Math.sin(t * 1.5 + i) * 0.3 + 0.7;
        const r = isActive ? 20 : 14;

        ctx.beginPath();
        ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
        const haloGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * pulse);
        haloGrad.addColorStop(0, `${agentColor}${isActive ? "30" : "10"}`);
        haloGrad.addColorStop(1, `${agentColor}00`);
        ctx.fillStyle = haloGrad;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ── fetchers ── */
  const fetchWeather = useCallback(async () => {
    try {
      const r = await fetch("https://wttr.in/BocaRaton?format=j1");
      const d = await r.json();
      const c = d.current_condition?.[0];
      setWeather({
        tempF: c?.temp_F ?? "--",
        condition: c?.weatherDesc?.[0]?.value ?? "",
        humidity: c?.humidity ?? "--",
        wind: `${c?.windspeedMiles ?? "--"} mph`,
        feelsLike: c?.FeelsLikeF ?? "--",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forecast: (d.weather?.slice(0, 3) ?? []).map((w: any) => ({
          day: new Date(w.date).toLocaleDateString("en", { weekday: "short" }),
          high: w.maxtempF ?? "--",
          low: w.mintempF ?? "--",
          cond: w.hourly?.[4]?.weatherDesc?.[0]?.value ?? "",
        })),
      });
    } catch { /* silent */ }
  }, []);

  const fetchVerse = useCallback(async () => {
    try {
      const r = await fetch("https://bible-api.com/?random=verse");
      const d = await r.json();
      setVerse({ text: d.text?.trim() ?? "", ref: d.reference ?? "" });
    } catch { /* silent */ }
  }, []);

  const copyVerse = () => {
    if (!verse) return;
    navigator.clipboard.writeText(`"${verse.text}" \u2014 ${verse.ref}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    setMounted(true);
    fetchWeather();
    fetchVerse();
  }, [fetchWeather, fetchVerse]);

  if (!mounted) return null;

  /* ── computed ── */
  const totalT = MISSIONS.reduce((s, p) => s + p.tasks.length, 0);
  const doneT = MISSIONS.reduce((s, p) => s + p.tasks.filter((t) => t.done).length, 0);
  const pct = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
  const activeAgents = AGENTS.filter((a) => a.status === "active").length;
  const activeMissions = MISSIONS.filter((m) => m.status === "active").length;

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <main className="min-h-screen w-full bg-[#030108] text-white relative overflow-x-hidden">

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 0: HOLOGRAPHIC BACKGROUND SYSTEM
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Particle canvas — full page height */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ width: "100vw", height: "100vh" }}
      />

      {/* Nebula gradient layers — breathing, drifting */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[900px] h-[900px] rounded-full nebula-1"
          style={{
            top: "-15%", left: "-10%",
            background: "radial-gradient(circle, rgba(0,240,255,0.07) 0%, rgba(0,240,255,0.02) 30%, transparent 60%)",
          }}
        />
        <div
          className="absolute w-[700px] h-[700px] rounded-full nebula-2"
          style={{
            top: "25%", right: "-15%",
            background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, rgba(168,85,247,0.015) 35%, transparent 60%)",
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full nebula-3"
          style={{
            bottom: "-10%", left: "35%",
            background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full nebula-drift"
          style={{
            top: "55%", left: "5%",
            background: "radial-gradient(circle, rgba(232,121,249,0.04) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute w-[800px] h-[800px] rounded-full nebula-2"
          style={{
            top: "70%", right: "10%",
            background: "radial-gradient(circle, rgba(34,211,238,0.03) 0%, transparent 50%)",
            animationDelay: "-5s",
          }}
        />
      </div>

      {/* Data grid overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none data-grid-bg opacity-20" />

      {/* Scan line sweep */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
        <div
          className="w-full h-[2px] scan-line"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(0,240,255,0.12), rgba(168,85,247,0.08), transparent)",
          }}
        />
      </div>

      {/* Horizontal scan line repeater (CRT effect) */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,240,255,0.008) 3px, rgba(0,240,255,0.008) 4px)",
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 1: CONTENT
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-full">

        {/* ═══════ TOP NAV + IDENTITY + CLOCK ═══════ */}
        <header className="w-full px-4 sm:px-6 lg:px-10 pt-4 pb-2">

          {/* Nav bar */}
          <nav className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`game-btn px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] transition-all ${
                    n.active
                      ? "bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30"
                      : "bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.04] border border-white/[0.04]"
                  }`}
                >
                  <span className="mr-1.5 opacity-50">{n.icon}</span>
                  {n.label}
                </Link>
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse"
                  style={{ boxShadow: "0 0 8px rgba(0,240,255,0.8)" }} />
                <span className="text-[9px] font-mono text-[#00f0ff]/50 tracking-wider">SYSTEM ONLINE</span>
              </div>
            </div>
          </nav>

          {/* Identity + Clock row */}
          <div className="flex items-end justify-between mb-2">
            <div className="flex items-center gap-5">
              {/* Holographic logo mark */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 game-panel flex items-center justify-center group"
                style={{
                  background: "linear-gradient(135deg, rgba(0,240,255,0.08) 0%, rgba(168,85,247,0.06) 50%, rgba(0,240,255,0.04) 100%)",
                  border: "1px solid rgba(0,240,255,0.2)",
                }}>
                <span className="neon-text-cyan text-2xl sm:text-3xl font-black tracking-tight">R</span>
                <div className="absolute inset-0 neon-pulse opacity-40 game-panel" />
                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[#00f0ff]/40" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[#00f0ff]/40" />
              </div>
              <div>
                <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.5em] text-[#00f0ff]/30 font-mono mb-1">
                  RAMICHE OPS // MISSION CONTROL
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none">
                  <span className="bg-gradient-to-r from-[#00f0ff] via-[#a855f7] to-[#e879f9] bg-clip-text text-transparent bg-[length:200%_200%] animated-gradient-text">
                    COMMAND CENTER
                  </span>
                </h1>
              </div>
            </div>

            {/* Live clock */}
            <div className="hidden sm:block text-right">
              <div className="font-mono text-2xl lg:text-3xl neon-text-cyan tabular-nums tracking-[0.15em] leading-none">
                {time}
              </div>
              <div className="text-[9px] font-mono text-white/20 uppercase tracking-wider mt-1.5">
                {dateStr}
              </div>
              <div className="text-[8px] font-mono text-[#00f0ff]/20 tracking-widest mt-0.5">
                EST // LIVE FEED
              </div>
            </div>
          </div>
        </header>

        {/* ═══════ SYSTEM STATUS STRIP ═══════ */}
        <div className="w-full px-4 sm:px-6 lg:px-10 mb-6">
          <div
            className="game-panel game-panel-scan scan-sweep relative px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
            style={{
              background: "linear-gradient(90deg, rgba(0,240,255,0.03) 0%, rgba(168,85,247,0.02) 30%, rgba(232,121,249,0.02) 60%, rgba(0,240,255,0.03) 100%)",
              border: "1px solid rgba(0,240,255,0.1)",
            }}
          >
            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"
                  style={{ boxShadow: "0 0 10px rgba(0,240,255,0.8)" }} />
                <span className="text-[9px] font-mono text-[#00f0ff]/60 tracking-wider">ALL SYSTEMS NOMINAL</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="text-[9px] font-mono text-white/30">
                <span className="neon-text-cyan">{activeAgents}</span>/{AGENTS.length} AGENTS
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="text-[9px] font-mono text-white/30">
                <span className="neon-text-purple">{activeMissions}</span> ACTIVE MISSIONS
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="text-[9px] font-mono text-white/30">
                TASKS <span className="neon-text-gold">{doneT}</span>/{totalT}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1 max-w-xs min-w-[200px]">
              <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden xp-bar-segments">
                <div
                  className="h-full rounded-full xp-shimmer transition-all duration-1000"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono neon-text-cyan font-bold tabular-nums">{pct}%</span>
            </div>
          </div>
        </div>

        <div className="w-full px-4 sm:px-6 lg:px-10">

          {/* ═══════ ROW 1: SCRIPTURE + WEATHER + CALENDAR ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* ── Scripture Card ── */}
            <div
              className="game-panel game-panel-border game-panel-scan relative p-6 flex flex-col justify-between min-h-[220px]"
              style={{
                background: "linear-gradient(145deg, rgba(245,158,11,0.04) 0%, rgba(6,2,15,0.97) 40%, rgba(6,2,15,0.99) 100%)",
              }}
            >
              <div className="absolute top-3 right-4 text-[8px] font-mono text-[#f59e0b]/25 tracking-[0.3em] uppercase">
                DAILY WORD
              </div>
              <div className="absolute top-3 left-4">
                <div className="w-1 h-6" style={{ background: "linear-gradient(180deg, #f59e0b, transparent)" }} />
              </div>
              {verse ? (
                <div className="mt-4">
                  <p className="text-white/75 text-sm leading-[1.8] italic pr-6 mb-4">
                    &ldquo;{verse.text}&rdquo;
                  </p>
                  <div className="neon-text-gold text-[11px] font-mono tracking-wider">
                    &mdash; {verse.ref}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-4 h-4 rounded-full border-2 border-[#f59e0b]/30 border-t-[#f59e0b] animate-spin" />
                  <span className="text-white/20 text-sm font-mono">Receiving...</span>
                </div>
              )}
              <div className="flex gap-2 mt-5 pt-4 border-t border-[#f59e0b]/8">
                <button
                  onClick={fetchVerse}
                  className="game-btn px-4 py-2 text-[9px] font-mono uppercase tracking-wider bg-[#f59e0b]/8 text-[#f59e0b]/60 hover:text-[#f59e0b] hover:bg-[#f59e0b]/15 transition-all"
                >
                  NEW VERSE
                </button>
                <button
                  onClick={copyVerse}
                  className="game-btn px-4 py-2 text-[9px] font-mono uppercase tracking-wider bg-white/[0.03] text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-all"
                >
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
            </div>

            {/* ── Weather Card ── */}
            <div
              className="game-panel game-panel-border game-panel-scan relative p-6 min-h-[220px]"
              style={{
                background: "linear-gradient(145deg, rgba(0,240,255,0.04) 0%, rgba(6,2,15,0.97) 40%, rgba(6,2,15,0.99) 100%)",
              }}
            >
              <div className="absolute top-3 right-4 text-[8px] font-mono text-[#00f0ff]/25 tracking-[0.3em] uppercase">
                ATMOSPHERE
              </div>
              {weather ? (
                <>
                  <div className="flex items-start gap-5 mb-5">
                    <div>
                      <div className="text-5xl sm:text-6xl font-black neon-text-cyan leading-none">
                        {weather.tempF}<span className="text-3xl align-top">&deg;</span>
                      </div>
                      <div className="text-[9px] font-mono text-[#00f0ff]/30 mt-1">
                        Feels {weather.feelsLike}&deg;F
                      </div>
                    </div>
                    <div className="pt-1">
                      <div className="text-white/70 text-sm font-medium">{weather.condition}</div>
                      <div className="text-[10px] font-mono text-white/25 mt-1.5 space-y-0.5">
                        <div>{weather.humidity}% humidity</div>
                        <div>Wind {weather.wind}</div>
                      </div>
                      <div className="text-[8px] font-mono text-[#00f0ff]/20 mt-2 uppercase tracking-[0.3em]">
                        Boca Raton, FL
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {weather.forecast.map((d) => (
                      <div
                        key={d.day}
                        className="game-panel-sm text-center py-2.5 px-2 transition-all hover:scale-[1.02]"
                        style={{
                          background: "rgba(0,240,255,0.03)",
                          border: "1px solid rgba(0,240,255,0.06)",
                        }}
                      >
                        <div className="text-[9px] font-mono text-[#00f0ff]/40 uppercase">{d.day}</div>
                        <div className="text-sm text-white/70 font-bold mt-1">
                          {d.high}&deg;
                          <span className="text-white/25 text-xs">/{d.low}&deg;</span>
                        </div>
                        <div className="text-[8px] text-white/20 font-mono mt-0.5 truncate">{d.cond}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-4 h-4 rounded-full border-2 border-[#00f0ff]/30 border-t-[#00f0ff] animate-spin" />
                  <span className="text-white/20 text-sm font-mono">Scanning atmosphere...</span>
                </div>
              )}
            </div>

            {/* ── Calendar / Schedule Card ── */}
            <div
              className="game-panel game-panel-border game-panel-scan relative p-6 min-h-[220px]"
              style={{
                background: "linear-gradient(145deg, rgba(168,85,247,0.04) 0%, rgba(6,2,15,0.97) 40%, rgba(6,2,15,0.99) 100%)",
              }}
            >
              <div className="absolute top-3 right-4 text-[8px] font-mono text-[#a855f7]/25 tracking-[0.3em] uppercase">
                SCHEDULE
              </div>
              <div className="absolute top-3 left-4">
                <div className="w-1 h-6" style={{ background: "linear-gradient(180deg, #a855f7, transparent)" }} />
              </div>
              <div className="mt-2 space-y-2.5">
                {SCHEDULE.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 group"
                  >
                    <div
                      className="text-[10px] font-mono tabular-nums w-[40px] flex-shrink-0 text-right"
                      style={{ color: `${s.accent}60` }}
                    >
                      {s.time}
                    </div>
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all group-hover:scale-150"
                      style={{
                        background: s.accent,
                        boxShadow: `0 0 6px ${s.accent}50`,
                      }}
                    />
                    <div className="text-[11px] text-white/50 font-mono group-hover:text-white/70 transition-colors truncate">
                      {s.event}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ ROW 2: AGENT NETWORK ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[8px] font-mono uppercase tracking-[0.5em] text-[#00f0ff]/25">
                AGENT NETWORK
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.15), transparent)" }} />
              <div className="text-[8px] font-mono text-white/15">
                {activeAgents} ACTIVE // {AGENTS.length} TOTAL
              </div>
            </div>

            <div
              className="game-panel game-panel-border relative overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(0,240,255,0.02) 0%, rgba(6,2,15,0.98) 50%, rgba(168,85,247,0.02) 100%)",
                minHeight: "320px",
              }}
            >
              {/* Network visualization canvas */}
              <canvas
                ref={agentNetRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
              />

              {/* Agent cards positioned in network formation */}
              <div className="relative z-10 p-6">
                {/* Atlas - top center */}
                <div className="flex justify-center mb-6">
                  <AgentCard agent={AGENTS[0]} index={0} hovered={hoveredAgent} onHover={setHoveredAgent} />
                </div>
                {/* Builder, Voice, Scout - bottom row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <AgentCard agent={AGENTS[1]} index={1} hovered={hoveredAgent} onHover={setHoveredAgent} />
                  <AgentCard agent={AGENTS[3]} index={3} hovered={hoveredAgent} onHover={setHoveredAgent} />
                  <AgentCard agent={AGENTS[2]} index={2} hovered={hoveredAgent} onHover={setHoveredAgent} />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════ ROW 3: ACTIVE MISSIONS ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[8px] font-mono uppercase tracking-[0.5em] text-[#00f0ff]/25">
                ACTIVE MISSIONS
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.15), transparent)" }} />
              <div className="text-[8px] font-mono text-white/15">
                {activeMissions} ACTIVE // {MISSIONS.length} TOTAL
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {MISSIONS.map((m) => {
                const done = m.tasks.filter((t) => t.done).length;
                const total = m.tasks.length;
                const mpct = Math.round((done / total) * 100);
                const isExpanded = expandedMission === m.name;

                return (
                  <div
                    key={m.name}
                    className={`game-card game-panel relative overflow-hidden cursor-pointer transition-all duration-300 ${
                      m.status === "paused" ? "opacity-50" : ""
                    }`}
                    onClick={() => setExpandedMission(isExpanded ? null : m.name)}
                    style={{
                      background: `linear-gradient(145deg, ${m.accent}05 0%, rgba(3,1,8,0.98) 50%, rgba(3,1,8,0.99) 100%)`,
                      border: `1px solid ${m.accent}15`,
                    }}
                  >
                    {/* Scan sweep on active projects */}
                    {m.status === "active" && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div
                          className="absolute left-0 right-0 h-[1px] opacity-20"
                          style={{
                            background: `linear-gradient(90deg, transparent, ${m.accent}, transparent)`,
                            animation: "scanSweep 8s linear infinite",
                          }}
                        />
                      </div>
                    )}

                    <div className="relative z-10 p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{
                              background: m.accent,
                              boxShadow: `0 0 12px ${m.accent}50, 0 0 25px ${m.accent}20`,
                            }}
                          />
                          <div>
                            <h3 className="text-sm font-bold text-white/90 leading-tight">{m.name}</h3>
                            <p className="text-[10px] text-white/30 font-mono mt-0.5">{m.desc}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className="text-[7px] font-mono uppercase px-2 py-0.5 game-panel-sm"
                            style={{
                              color: m.status === "active" ? m.accent : "rgba(255,255,255,0.25)",
                              background: m.status === "active" ? `${m.accent}10` : "rgba(255,255,255,0.03)",
                              border: `1px solid ${m.status === "active" ? `${m.accent}20` : "rgba(255,255,255,0.06)"}`,
                            }}
                          >
                            {m.status}
                          </span>
                          {m.priority && (
                            <span
                              className="text-[7px] font-mono uppercase tracking-wider"
                              style={{
                                color: m.priority === "CRITICAL" ? "#ef4444" : m.priority === "HIGH" ? m.accent : "rgba(255,255,255,0.2)",
                              }}
                            >
                              {m.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden xp-bar-segments">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${mpct}%`,
                              background: `linear-gradient(90deg, ${m.accent}80, ${m.accent})`,
                              boxShadow: `0 0 8px ${m.accent}40`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums" style={{ color: `${m.accent}80` }}>
                          {done}/{total}
                        </span>
                      </div>

                      {/* Expandable task list */}
                      <div
                        className="athlete-card-wrapper"
                        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                      >
                        <div>
                          <div className="pt-3 mt-2 border-t border-white/[0.04] space-y-2">
                            {m.tasks.map((t) => (
                              <div key={t.t} className="flex items-center gap-2.5">
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center text-[9px] flex-shrink-0 ${
                                    t.done ? "" : "border border-white/10"
                                  }`}
                                  style={t.done ? { background: `${m.accent}20`, color: m.accent } : {}}
                                >
                                  {t.done ? "\u2713" : ""}
                                </div>
                                <span
                                  className={`text-[11px] font-mono ${
                                    t.done ? "text-white/30 line-through" : "text-white/55"
                                  }`}
                                >
                                  {t.t}
                                </span>
                              </div>
                            ))}
                            {m.link && (
                              <div className="pt-2">
                                <Link
                                  href={m.link.href}
                                  className="game-btn inline-block px-4 py-1.5 text-[9px] font-mono uppercase tracking-wider transition-all hover:scale-[1.02]"
                                  style={{
                                    background: `${m.accent}10`,
                                    color: m.accent,
                                    border: `1px solid ${m.accent}20`,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {m.link.label} &rarr;
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
          </div>

          {/* ═══════ ROW 4: HEALTH VITALS ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[8px] font-mono uppercase tracking-[0.5em] text-[#e879f9]/25">
                HEALTH VITALS
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(232,121,249,0.12), transparent)" }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Steps */}
              <VitalCard
                label="STEPS"
                value={steps.toLocaleString()}
                unit=""
                color="#a855f7"
                max={10000}
                current={steps}
                onInc={() => setSteps((s) => s + 500)}
                onDec={() => setSteps((s) => Math.max(0, s - 500))}
              />
              {/* Water */}
              <VitalCard
                label="WATER"
                value={String(waterG)}
                unit="glasses"
                color="#00f0ff"
                max={8}
                current={waterG}
                onInc={() => setWaterG((w) => w + 1)}
                onDec={() => setWaterG((w) => Math.max(0, w - 1))}
              />
              {/* Sleep */}
              <VitalCard
                label="SLEEP"
                value={String(sleepH)}
                unit="hrs"
                color="#f59e0b"
                max={10}
                current={sleepH}
                onInc={() => setSleepH((s) => Math.min(12, s + 0.5))}
                onDec={() => setSleepH((s) => Math.max(0, s - 0.5))}
              />
              {/* Workout toggle */}
              <div
                className="game-panel relative p-5 cursor-pointer group transition-all duration-300"
                onClick={() => setWorkedOut((w) => !w)}
                style={{
                  background: workedOut
                    ? "linear-gradient(145deg, rgba(232,121,249,0.1) 0%, rgba(3,1,8,0.95) 100%)"
                    : "linear-gradient(145deg, rgba(232,121,249,0.03) 0%, rgba(3,1,8,0.98) 100%)",
                  border: workedOut
                    ? "1px solid rgba(232,121,249,0.3)"
                    : "1px solid rgba(232,121,249,0.08)",
                  boxShadow: workedOut
                    ? "0 0 25px rgba(232,121,249,0.1), inset 0 0 20px rgba(232,121,249,0.03)"
                    : "none",
                }}
              >
                <div className="text-[8px] font-mono uppercase tracking-[0.3em] mb-3 text-[#e879f9]/40">
                  WORKOUT
                </div>
                <div
                  className="text-3xl font-black leading-none mb-2 transition-all"
                  style={{
                    color: workedOut ? "#e879f9" : "rgba(255,255,255,0.1)",
                    textShadow: workedOut ? "0 0 20px rgba(232,121,249,0.4)" : "none",
                  }}
                >
                  {workedOut ? "DONE" : "\u2014"}
                </div>
                <div
                  className="text-[9px] font-mono transition-all"
                  style={{ color: workedOut ? "#e879f9" : "rgba(255,255,255,0.15)" }}
                >
                  {workedOut ? "\u2713 Completed" : "Tap to mark"}
                </div>
                {workedOut && (
                  <div className="absolute top-2 right-3">
                    <div className="w-2 h-2 rounded-full bg-[#e879f9] animate-pulse"
                      style={{ boxShadow: "0 0 8px rgba(232,121,249,0.6)" }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════ ROW 5: REVENUE + OPPORTUNITY SCANNER ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* Revenue tracker */}
            <div
              className="game-panel game-panel-border game-panel-scan relative p-6"
              style={{
                background: "linear-gradient(145deg, rgba(245,158,11,0.04) 0%, rgba(6,2,15,0.98) 100%)",
              }}
            >
              <div className="absolute top-3 right-4 text-[8px] font-mono text-[#f59e0b]/25 tracking-[0.3em] uppercase">
                REVENUE
              </div>
              <div className="space-y-5 mt-1">
                {[
                  { label: "This Month", val: "$0", glow: false },
                  { label: "Pipeline", val: "$2,400", glow: true },
                  { label: "Monthly Target", val: "$5,000", glow: false },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-wider">{r.label}</span>
                    <span
                      className={`text-lg font-black tabular-nums ${r.glow ? "neon-text-gold" : "text-white/30"}`}
                    >
                      {r.val}
                    </span>
                  </div>
                ))}
              </div>
              {/* Revenue progress arc */}
              <div className="mt-5 pt-4 border-t border-[#f59e0b]/8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[8px] font-mono text-white/15">TARGET PROGRESS</span>
                  <span className="text-[9px] font-mono neon-text-gold">0%</span>
                </div>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden xp-bar-segments">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: "0%",
                      background: "linear-gradient(90deg, #f59e0b80, #f59e0b)",
                      boxShadow: "0 0 8px rgba(245,158,11,0.3)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Opportunity Scanner */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-[8px] font-mono uppercase tracking-[0.4em] text-white/15">
                  OPPORTUNITY SCANNER
                </div>
                <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.05), transparent)" }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {OPPS.map((o) => (
                  <div
                    key={o.title}
                    className="game-card game-panel-sm relative p-4 cursor-pointer group"
                    style={{
                      background: `linear-gradient(160deg, ${o.accent}04 0%, rgba(3,1,8,0.99) 100%)`,
                      border: `1px solid ${o.accent}10`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span
                        className="text-[7px] font-mono uppercase px-2 py-0.5 tracking-wider game-panel-sm"
                        style={{
                          color: o.tag === "READY" ? o.accent : o.tag === "SOON" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
                          background: `${o.accent}08`,
                          border: `1px solid ${o.accent}15`,
                        }}
                      >
                        {o.tag}
                      </span>
                      <span
                        className="text-sm font-black font-mono"
                        style={{ color: o.accent, textShadow: `0 0 10px ${o.accent}25` }}
                      >
                        {o.rev}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white/75 mb-1 group-hover:text-white/90 transition-colors">
                      {o.title}
                    </div>
                    <div className="text-[9px] text-white/25 font-mono leading-relaxed">
                      {o.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ ROW 6: QUICK LINKS HUB ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[8px] font-mono uppercase tracking-[0.5em] text-white/15">
                QUICK LINKS
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.05), transparent)" }} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="game-card game-panel-sm relative p-4 flex flex-col items-center justify-center gap-2 group transition-all"
                  style={{
                    background: `linear-gradient(145deg, ${l.accent}04 0%, rgba(3,1,8,0.99) 100%)`,
                    border: `1px solid ${l.accent}08`,
                    minHeight: "80px",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: `${l.accent}08`,
                      color: l.accent,
                      border: `1px solid ${l.accent}15`,
                      textShadow: `0 0 10px ${l.accent}30`,
                    }}
                  >
                    {l.icon}
                  </div>
                  <span className="text-[9px] font-mono text-white/30 group-hover:text-white/60 transition-colors uppercase tracking-wider">
                    {l.label}
                  </span>
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded"
                    style={{
                      background: `radial-gradient(circle at center, ${l.accent}08 0%, transparent 70%)`,
                    }}
                  />
                </a>
              ))}
            </div>
          </div>

          {/* ═══════ ROW 7: ACTIVITY FEED ═══════ */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-[8px] font-mono uppercase tracking-[0.5em] text-white/15">
                ACTIVITY FEED
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.05), transparent)" }} />
              <div className="text-[8px] font-mono text-white/10">LATEST</div>
            </div>

            <div
              className="game-panel game-panel-scan relative p-6"
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.01) 0%, rgba(3,1,8,0.99) 100%)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                {LOG.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 group py-2.5 border-b border-white/[0.03] last:border-b-0"
                  >
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div
                        className="w-2 h-2 rounded-full transition-all duration-300 group-hover:scale-150"
                        style={{
                          background: l.color,
                          boxShadow: `0 0 8px ${l.color}40`,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white/50 leading-snug group-hover:text-white/70 transition-colors truncate">
                        {l.text}
                      </div>
                    </div>
                    <div className="text-[8px] font-mono text-white/15 flex-shrink-0 uppercase">
                      {l.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ FOOTER ═══════ */}
          <footer className="text-center py-8 border-t border-white/[0.03]">
            <div className="text-[8px] font-mono text-white/8 tracking-[0.5em] uppercase">
              COMMAND CENTER v4 // RAMICHE OPERATIONS // SIGNAL FIRST // {new Date().getFullYear()}
            </div>
          </footer>

        </div>
      </div>
    </main>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Agent Card ── */
function AgentCard({
  agent,
  index,
  hovered,
  onHover,
}: {
  agent: typeof AGENTS[number];
  index: number;
  hovered: number | null;
  onHover: (i: number | null) => void;
}) {
  const isActive = agent.status === "active";
  const isHovered = hovered === index;

  return (
    <div
      className={`game-panel game-panel-scan relative p-4 transition-all duration-300 cursor-pointer ${
        isHovered ? "scale-[1.02]" : ""
      }`}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      style={{
        background: `linear-gradient(145deg, ${agent.color}${isHovered ? "0a" : "05"} 0%, rgba(3,1,8,0.98) 100%)`,
        border: `1px solid ${agent.color}${isHovered ? "30" : "12"}`,
        boxShadow: isHovered
          ? `0 0 30px ${agent.color}15, inset 0 0 20px ${agent.color}05`
          : isActive
            ? `0 0 15px ${agent.color}08`
            : "none",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Agent avatar */}
        <div className="relative flex-shrink-0">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center text-lg font-black transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${agent.color}15 0%, ${agent.color}05 100%)`,
              border: `1px solid ${agent.color}25`,
              color: agent.color,
              textShadow: `0 0 15px ${agent.color}50`,
              boxShadow: isActive ? `0 0 15px ${agent.color}20, inset 0 0 10px ${agent.color}08` : "none",
            }}
          >
            {agent.icon}
          </div>
          {/* Status indicator */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#030108] ${
              isActive ? "animate-pulse" : ""
            }`}
            style={{
              background: isActive ? "#00ff88" : "rgba(255,255,255,0.1)",
              boxShadow: isActive ? "0 0 8px rgba(0,255,136,0.6)" : "none",
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white/90">{agent.name}</span>
            <span
              className="text-[7px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: agent.color,
                background: `${agent.color}0a`,
                border: `1px solid ${agent.color}15`,
              }}
            >
              {agent.model}
            </span>
          </div>
          <div className="text-[10px] font-mono mt-0.5" style={{ color: `${agent.color}50` }}>
            {agent.role}
          </div>
          {/* Description on hover */}
          <div
            className="overflow-hidden transition-all duration-300"
            style={{
              maxHeight: isHovered ? "40px" : "0px",
              opacity: isHovered ? 1 : 0,
            }}
          >
            <div className="text-[9px] text-white/25 font-mono mt-1 leading-relaxed">
              {agent.desc}
            </div>
          </div>
        </div>
        {/* Status badge */}
        <div
          className="text-[7px] font-mono uppercase tracking-wider px-2 py-1 game-panel-sm flex-shrink-0"
          style={{
            color: isActive ? "#00ff88" : "rgba(255,255,255,0.2)",
            background: isActive ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${isActive ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.04)"}`,
          }}
        >
          {agent.status}
        </div>
      </div>
    </div>
  );
}

/* ── Vital Card ── */
function VitalCard({
  label,
  value,
  unit,
  color,
  max,
  current,
  onInc,
  onDec,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  max: number;
  current: number;
  onInc: () => void;
  onDec: () => void;
}) {
  const fillPct = Math.min(100, Math.round((current / max) * 100));

  return (
    <div
      className="game-panel relative p-5 group transition-all duration-300"
      style={{
        background: `linear-gradient(145deg, ${color}05 0%, rgba(3,1,8,0.98) 100%)`,
        border: `1px solid ${color}12`,
      }}
    >
      {/* Corner accent */}
      <div className="absolute top-0 left-0 w-6 h-[1px]" style={{ background: `${color}30` }} />
      <div className="absolute top-0 left-0 w-[1px] h-6" style={{ background: `${color}30` }} />

      <div className="text-[8px] font-mono uppercase tracking-[0.3em] mb-3" style={{ color: `${color}40` }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span
          className="text-3xl font-black tabular-nums leading-none"
          style={{ color, textShadow: `0 0 20px ${color}35` }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-mono text-white/15">{unit}</span>
        )}
      </div>

      {/* Mini progress ring */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${fillPct}%`,
              background: `linear-gradient(90deg, ${color}60, ${color})`,
              boxShadow: `0 0 6px ${color}30`,
            }}
          />
        </div>
        <span className="text-[8px] font-mono tabular-nums" style={{ color: `${color}50` }}>
          {fillPct}%
        </span>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={onDec}
          className="game-btn flex-1 h-8 text-xs font-mono flex items-center justify-center transition-all hover:brightness-125"
          style={{
            background: `${color}08`,
            color: `${color}60`,
            border: `1px solid ${color}10`,
          }}
        >
          &minus;
        </button>
        <button
          onClick={onInc}
          className="game-btn flex-1 h-8 text-xs font-mono flex items-center justify-center transition-all hover:brightness-125"
          style={{
            background: `${color}08`,
            color: `${color}60`,
            border: `1px solid ${color}10`,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
