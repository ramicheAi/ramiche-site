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
    status: "active" as const, color: "#00f0ff", icon: "🧭",
    desc: "Orchestrates all agents, system-wide reasoning, mission planning, memory",
    connections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    credits: { used: 1250, limit: 5000 },
    activeTask: "Full dashboard refresh + real-time deploy — all systems updated",
  },
  {
    name: "TheMAESTRO", model: "DeepSeek V3.2", role: "Music Production AI",
    status: "idle" as const, color: "#f59e0b", icon: "🎵",
    desc: "Ye + Quincy + Babyface — influence-based creative direction, sound design",
    connections: [0, 7],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Track inventory (F1)",
  },
  {
    name: "SIMONS", model: "DeepSeek V3.2", role: "Algorithmic Analysis",
    status: "idle" as const, color: "#22d3ee", icon: "📊",
    desc: "Jim Simons — pattern recognition, statistical arbitrage, data crunching",
    connections: [0, 4],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: SEO/competitor analysis (E1)",
  },
  {
    name: "Dr. Strange", model: "DeepSeek V3.2", role: "Forecasting & Decisions",
    status: "idle" as const, color: "#a855f7", icon: "🔮",
    desc: "Scenario analysis, probable outcomes, strategic foresight, risk assessment",
    connections: [0, 2, 6],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Kickstarter landscape (E3)",
  },
  {
    name: "SHURI", model: "DeepSeek V3.2", role: "Creative Coding",
    status: "active" as const, color: "#34d399", icon: "⚡",
    desc: "Prototyping, design systems, tech innovation, rapid builds",
    connections: [0, 7],
    credits: { used: 580, limit: 5000 },
    activeTask: "Three-portal UI extraction — modular architecture build (types → components → pages)",
  },
  {
    name: "Widow", model: "Haiku 3.5", role: "Cybersecurity & Intel",
    status: "idle" as const, color: "#ef4444", icon: "🕷",
    desc: "Threat monitoring, risk analysis, data intelligence, security audits",
    connections: [0, 2],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: API key audit (G1) + COPPA check (G2)",
  },
  {
    name: "PROXIMON", model: "Gemini 3.0 Pro", role: "Systems Architect",
    status: "active" as const, color: "#f97316", icon: "🏗",
    desc: "Jobs + Musk + Bezos — first-principles, flywheels, compounding systems",
    connections: [0, 3, 4],
    credits: { used: 480, limit: 5000 },
    activeTask: "Firebase v2 spec + deploy guide DELIVERED. GA pricing matrix in progress.",
  },
  {
    name: "Vee", model: "Kimi K2.5", role: "Brand & Marketing",
    status: "done" as const, color: "#ec4899", icon: "📣",
    desc: "Gary Vee + Seth Godin + Hormozi + Blakely + Virgil — makes brands impossible to ignore",
    connections: [0, 1, 6],
    credits: { used: 350, limit: 5000 },
    activeTask: "DELIVERED: GA Shopify copy + Studio outreach + SCOWW social (Track B complete)",
  },
  {
    name: "Aetherion", model: "Gemini 3.0 Pro", role: "Visionary Architect",
    status: "idle" as const, color: "#818cf8", icon: "🌀",
    desc: "The Architect of Architects — patterns, emergence, meta-systems, blueprinting reality itself",
    connections: [0, 3, 6],
    credits: { used: 0, limit: 5000 },
    activeTask: "Done: 5 blueprints + Phase 1 matrix + SHARED_CONTEXT",
  },
  {
    name: "MICHAEL", model: "GLM 4.6", role: "Swim Training AI",
    status: "done" as const, color: "#06b6d4", icon: "🏊",
    desc: "Phelps + Kobe + MJ + Bolt — swim mastery, mamba mentality, competitive fire, Jamaican joy",
    connections: [0, 3],
    credits: { used: 310, limit: 5000 },
    activeTask: "DELIVERED: Practice schedule builder — 7 group-specific templates",
  },
  {
    name: "Prophets", model: "Kimi K2.5", role: "Spiritual Wisdom",
    status: "idle" as const, color: "#d4a574", icon: "📜",
    desc: "Solomon + Moses + Elijah + Isaiah + David — Scripture-rooted counsel, wisdom, moral clarity",
    connections: [0],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Daily Scripture cron activation",
  },
  {
    name: "SELAH", model: "DeepSeek V3.2", role: "Wellness & Sport Psychology",
    status: "done" as const, color: "#10b981", icon: "🧘",
    desc: "Robbins + Dispenza + Maté + Greene + Bashar — therapy, peak performance, mental transformation",
    connections: [0, 9, 10],
    credits: { used: 190, limit: 5000 },
    activeTask: "DELIVERED: Meditation library + journaling system + athlete check-in (22 XP ops)",
  },
  {
    name: "MERCURY", model: "Gemini 3.0 Pro", role: "Sales & Revenue Ops",
    status: "idle" as const, color: "#fbbf24", icon: "💰",
    desc: "Razor-sharp dealmaker — reads people and numbers simultaneously. Architects wins.",
    connections: [0, 7],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Outbound sales pipeline setup",
  },
  {
    name: "ECHO", model: "Kimi K2.5", role: "Community & Social",
    status: "done" as const, color: "#38bdf8", icon: "🌊",
    desc: "The heartbeat of the community — turns strangers into superfans with genuine warmth",
    connections: [0, 7],
    credits: { used: 220, limit: 5000 },
    activeTask: "DELIVERED: Discord server architecture + community strategy",
  },
  {
    name: "HAVEN", model: "DeepSeek V3.2", role: "Customer Success",
    status: "idle" as const, color: "#4ade80", icon: "🛡",
    desc: "Infinitely patient with a detective's eye — treats every ticket like a puzzle worth solving",
    connections: [0],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Support system + onboarding flows",
  },
  {
    name: "INK", model: "DeepSeek V3.2", role: "Content Creator",
    status: "done" as const, color: "#c084fc", icon: "✒",
    desc: "Prolific voice-chameleon — technical blog at dawn, viral tweet at noon, cinematic script by sunset",
    connections: [0, 7],
    credits: { used: 280, limit: 5000 },
    activeTask: "DELIVERED: 5-piece Apex launch content package",
  },
  {
    name: "NOVA", model: "DeepSeek V3.2", role: "3D Fabrication",
    status: "idle" as const, color: "#14b8a6", icon: "🔧",
    desc: "Brilliant fabrication expert — runway model energy with patents. Bambu Lab A1 specialist.",
    connections: [0, 4],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Bambu Lab production pipeline",
  },
  {
    name: "KIYOSAKI", model: "DeepSeek V3.2", role: "Financial Intelligence",
    status: "done" as const, color: "#fcd34d", icon: "💎",
    desc: "ORACLE — 8 financial minds (Buffett/Dalio/Soros/Livermore/Ramsey/Kiyosaki/Taleb/Wood). Wealth architecture.",
    connections: [0, 2, 3],
    credits: { used: 420, limit: 5000 },
    activeTask: "DELIVERED: Apex financial model — $2.94M–$14.7M ARR, LTV:CAC 39:1",
  },
  {
    name: "TRIAGE", model: "Sonnet 4.5", role: "System Doctor",
    status: "idle" as const, color: "#f472b6", icon: "🩺",
    desc: "Best SWE-bench score in the squad (77.2). Debugging, failure tracing, health checks, diagnostics.",
    connections: [0, 4],
    credits: { used: 0, limit: 5000 },
    activeTask: "Available on demand — system diagnostics + debugging",
  },
];

/* ── AGENT → PROJECT ASSIGNMENTS ───────────────────────────────────────────── */
const AGENT_PROJECTS: Record<string, { project: string; role: string; status: "active" | "idle" | "done" }[]> = {
  Atlas: [
    { project: "Apex Athlete", role: "Lead architect + game engine", status: "active" },
    { project: "Command Center", role: "Design + build", status: "active" },
    { project: "Galactik Antics", role: "Store pipeline + copy", status: "active" },
    { project: "Ramiche Studio", role: "Landing page + outreach", status: "idle" },
  ],
  TheMAESTRO: [
    { project: "Music Pipeline", role: "Production direction + sound design", status: "idle" },
    { project: "Parallax", role: "Artist A&R + creative guidance", status: "idle" },
  ],
  SIMONS: [
    { project: "Replit Projects", role: "Sports Betting Engine analytics", status: "active" },
    { project: "Revenue Optimization", role: "Pricing models + market analysis", status: "idle" },
  ],
  "Dr. Strange": [
    { project: "Apex Athlete", role: "Attrition prediction + forecasting", status: "idle" },
    { project: "Business Strategy", role: "Scenario planning + risk analysis", status: "idle" },
  ],
  SHURI: [
    { project: "Apex Athlete", role: "UI/UX + rapid prototyping", status: "active" },
    { project: "Replit Projects", role: "Social Cross-Poster build", status: "idle" },
    { project: "Galactik Antics", role: "Browser game MVP", status: "idle" },
  ],
  Widow: [
    { project: "Security Audit", role: "Platform security + API protection", status: "idle" },
    { project: "Competitive Intel", role: "Market monitoring + threat scan", status: "idle" },
  ],
  PROXIMON: [
    { project: "Apex Athlete", role: "Systems architecture + scaling", status: "active" },
    { project: "Infrastructure", role: "Firebase + deployment pipeline", status: "idle" },
  ],
  Vee: [
    { project: "Galactik Antics", role: "Brand voice + launch marketing", status: "active" },
    { project: "Ramiche Studio", role: "Client acquisition + positioning", status: "idle" },
    { project: "SCOWW", role: "Event marketing + social strategy", status: "idle" },
  ],
  Aetherion: [
    { project: "Multi-Agent Architecture", role: "Designing agent collaboration patterns", status: "active" },
    { project: "Apex Athlete", role: "Scalable system blueprint (multi-team SaaS)", status: "idle" },
    { project: "Infrastructure", role: "Cross-project integration + emergence analysis", status: "idle" },
  ],
  MICHAEL: [
    { project: "Apex Athlete", role: "Swim coaching intelligence + athlete motivation", status: "active" },
    { project: "Saint Andrew's Aquatics", role: "Training analysis + race strategy", status: "active" },
  ],
  Prophets: [
    { project: "Daily Scripture", role: "7 AM verse + prayer prompt via Telegram", status: "active" },
    { project: "Sanctuary", role: "Devotional tracking + reading plans + prayer focus", status: "active" },
    { project: "Life Guidance", role: "Faith-rooted wisdom for decisions", status: "active" },
  ],
  SELAH: [
    { project: "Apex Athlete", role: "Sport psychology + athlete mental performance", status: "active" },
    { project: "Team Wellness", role: "Coach/athlete wellness support + burnout prevention", status: "active" },
    { project: "Personal Growth", role: "Ramon's peak performance + mindset coaching", status: "idle" },
  ],
  MERCURY: [
    { project: "Ramiche Studio", role: "Client acquisition + deals", status: "idle" },
    { project: "Revenue Ops", role: "Pipeline + pricing strategy", status: "idle" },
  ],
  ECHO: [
    { project: "Community", role: "Discord + social engagement", status: "idle" },
    { project: "Galactik Antics", role: "Fan community + ambassador program", status: "idle" },
  ],
  HAVEN: [
    { project: "Customer Support", role: "Ticket system + onboarding", status: "idle" },
    { project: "Apex Athlete", role: "Coach/parent support flows", status: "idle" },
  ],
  INK: [
    { project: "Content Pipeline", role: "Blog + social copy + scripts", status: "idle" },
    { project: "Galactik Antics", role: "Product descriptions + launch copy", status: "idle" },
  ],
  NOVA: [
    { project: "3D Print Studio", role: "Production pipeline + quoting", status: "idle" },
    { project: "Galactik Antics", role: "Physical merch prototyping", status: "idle" },
  ],
  KIYOSAKI: [
    { project: "Apex Athlete", role: "Financial model + pricing strategy", status: "done" },
    { project: "Wealth Architecture", role: "Investment analysis + cashflow optimization", status: "idle" },
  ],
  TRIAGE: [
    { project: "System Health", role: "Debugging + diagnostics + failure tracing", status: "idle" },
    { project: "Apex Athlete", role: "Code review + performance audit", status: "idle" },
  ],
};

/* ── PROJECTS / MISSIONS ───────────────────────────────────────────────────── */
const MISSIONS = [
  {
    name: "Galactik Antics", accent: "#00f0ff", status: "active" as const,
    desc: "AI art merch \u2192 Shopify store", priority: "HIGH",
    tasks: [
      { t: "Batch A art matched to 5 designs", done: true },
      { t: "Source files copied to iPhone case folders", done: true },
      { t: "Pre-launch content (4 briefs, 7-day calendar)", done: true },
      { t: "Product lineup confirmed (13 cases, 5 posters, 5 tees)", done: true },
      { t: "Weavy renders for 5 Batch A designs", done: false },
      { t: "Shopify store created \u2014 API token needed for product upload", done: false },
      { t: "Upload products + variants + pricing", done: false },
      { t: "Collector tier system (5 tiers, Shopify Flows)", done: false },
    ],
    link: { label: "Printful", href: "https://www.printful.com/dashboard" },
  },
  {
    name: "Apex Athlete", accent: "#f59e0b", status: "active" as const,
    desc: "Gamified swim training \u2014 LIVE BETA \u2014 tested Feb 7", priority: "CRITICAL",
    tasks: [
      { t: "Game engine + check-ins", done: true },
      { t: "Coach dashboard + leaderboard", done: true },
      { t: "Advanced analytics (attrition, culture, peak perf)", done: true },
      { t: "Multi-roster expansion (240+ athletes, 7 groups)", done: true },
      { t: "Sport-specific checkpoints (Diving + Water Polo)", done: true },
      { t: "Three-portal architecture (Coach/Athlete/Parent)", done: false },
      { t: "Practice schedule builder", done: false },
      { t: "Firebase backend (v2)", done: false },
      { t: "Monthly MVP per gender per group", done: false },
    ],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Ramiche Studio", accent: "#a855f7", status: "active" as const,
    desc: "Creative Services \u2014 48h Sprint $300-500", priority: "HIGH",
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
    desc: "Parent company \u2014 head of all brands \u2014 Yauggy, Niko Biswas, Gabe Greyson", priority: "MED",
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
  { time: "Now", text: "Atlas: Full HQ update \u2014 all dashboards refreshed Feb 10", color: "#00f0ff" },
  { time: "Now", text: "Shopify store created \u2014 GALAKTIK ANTICS (API setup pending)", color: "#96bf48" },
  { time: "Feb 10", text: "KIYOSAKI + TRIAGE agents added to squad (19 total)", color: "#fcd34d" },
  { time: "Feb 10", text: "KIYOSAKI: Apex financial model delivered ($2.94M\u2013$14.7M ARR)", color: "#fcd34d" },
  { time: "Feb 10", text: "INK: 5-piece launch content package completed", color: "#c084fc" },
  { time: "Feb 10", text: "ramichehq@gmail.com + @ramichehq (X) accounts created", color: "#00f0ff" },
  { time: "Feb 10", text: "SCOWW.com TLS fixed \u2014 DNS corrected", color: "#22d3ee" },
  { time: "Feb 10", text: "Financial Dashboard added to Command Center", color: "#fcd34d" },
  { time: "Feb 9", text: "RAMICHE HQ group chat activated \u2014 19 agents wired", color: "#a855f7" },
  { time: "Feb 9", text: "7 new agents: Mercury, Echo, Haven, Ink, Nova, Kiyosaki, Triage", color: "#fbbf24" },
  { time: "Feb 9", text: "Model tiers locked \u2014 Ramon's hard rule applied to all agents", color: "#00f0ff" },
  { time: "Feb 9", text: "Watchdog cron active (5-min cycle) \u2014 outage protection live", color: "#ef4444" },
  { time: "Feb 9", text: "Gateway restart completed \u2014 full squad operational", color: "#22d3ee" },
  { time: "Feb 8", text: "Apex Athlete v1 tested live \u2014 all checkpoints working", color: "#f59e0b" },
  { time: "Feb 8", text: "Multi-roster: 240+ athletes across 7 groups deployed", color: "#f59e0b" },
  { time: "Feb 8", text: "Aetherion: 5 blueprints + Phase 1 matrix + SHARED_CONTEXT", color: "#818cf8" },
  { time: "Feb 8", text: "Vee: GA pre-launch content (4 briefs, 7-day calendar)", color: "#ec4899" },
  { time: "Feb 8", text: "Squad expanded: 12 \u2192 19 agents (7 new roles provisioned)", color: "#a855f7" },
];

/* ── SCHEDULE ──────────────────────────────────────────────────────────────── */
const SCHEDULE = [
  { time: "6:00 AM", event: "Morning swim practice (Saint Andrew's)", accent: "#00f0ff" },
  { time: "7:00 AM", event: "Daily Scripture & Prayer (Prophets)", accent: "#d4a574" },
  { time: "8:15 AM", event: "Atlas Morning Brief", accent: "#a855f7" },
  { time: "2:00 PM", event: "Deep work / Build session", accent: "#22d3ee" },
  { time: "3:30 PM", event: "Afternoon swim practice", accent: "#00f0ff" },
  { time: "5:30 PM", event: "Weight room (Platinum)", accent: "#f59e0b" },
  { time: "7:00 PM", event: "Family time", accent: "#e879f9" },
  { time: "9:00 PM", event: "Night build session", accent: "#22d3ee" },
];

/* ── NOTIFICATIONS / INBOX ────────────────────────────────────────────────── */
const NOTIFICATIONS = [
  { text: "Shopify store live \u2014 GALAKTIK ANTICS \u2014 API token needed to load products", accent: "#96bf48", icon: "\u26A0" },
  { text: "KIYOSAKI delivered Apex financial model ($2.94M\u2013$14.7M ARR)", accent: "#fcd34d", icon: "\u25C8" },
  { text: "19 agents operational in RAMICHE HQ", accent: "#a855f7", icon: "\u25C8" },
  { text: "Apex three-portal build in progress (SHURI + PROXIMON)", accent: "#f59e0b", icon: "\u25C8" },
  { text: "5 Batch A Weavy renders still pending", accent: "#f59e0b", icon: "\u26A0" },
  { text: "TheMAESTRO blocked \u2014 needs release timeline from Ramon", accent: "#f59e0b", icon: "\u26A0" },
];

/* ── NAV ───────────────────────────────────────────────────────────────────── */
const NAV = [
  { label: "HQ", href: "/", icon: "\u25C8" },
  { label: "COMMAND", href: "/command-center", icon: "\u25C7", active: true },
  { label: "APEX", href: "/apex-athlete", icon: "\u2726" },
  { label: "FINANCE", href: "/financial", icon: "\u25C9" },
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
interface Verse { text: string; ref: string; book?: string; chapter?: number; }

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
  const [vitalsLoaded, setVitalsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<number | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<{text: string; time: string; status: "sent"|"done"}[]>([]);
  const [readingPlan, setReadingPlan] = useState<{book: string; chapter: number; progress: number}>(() => {
    try {
      const saved = localStorage.getItem("cc-reading-plan");
      return saved ? JSON.parse(saved) : { book: "Proverbs", chapter: 1, progress: 3 };
    } catch { return { book: "Proverbs", chapter: 1, progress: 3 }; }
  });
  const [prayerFocus, setPrayerFocus] = useState<string>(() => {
    const focuses = ["Discipline & Focus", "God's Vision for My Life", "Financial Wisdom", "Spiritual Growth", "Health & Strength", "Gratitude & Praise", "Family & Relationships"];
    const dayIndex = new Date().getDay();
    return focuses[dayIndex];
  });
  const [spiritualStreak, setSpiritualStreak] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("cc-spiritual-streak");
      if (!saved) return 0;
      const { count, lastDate } = JSON.parse(saved);
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (lastDate === today) return count;
      if (lastDate === yesterday) return count; // hasn't checked in yet today
      return 0; // streak broken
    } catch { return 0; }
  });
  const [devotionalCheckedIn, setDevotionalCheckedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("cc-spiritual-streak");
      if (!saved) return false;
      const { lastDate } = JSON.parse(saved);
      return lastDate === new Date().toDateString();
    } catch { return false; }
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentNetRef = useRef<HTMLCanvasElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);

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

  /* ── load health vitals from localStorage ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cc-vitals");
      if (saved) {
        const v = JSON.parse(saved);
        if (typeof v.steps === "number") setSteps(v.steps);
        if (typeof v.waterG === "number") setWaterG(v.waterG);
        if (typeof v.sleepH === "number") setSleepH(v.sleepH);
        if (typeof v.workedOut === "boolean") setWorkedOut(v.workedOut);
      }
    } catch { /* silent */ }
    setVitalsLoaded(true);
  }, []);

  /* ── persist health vitals to localStorage ── */
  useEffect(() => {
    if (!vitalsLoaded) return;
    try {
      localStorage.setItem("cc-vitals", JSON.stringify({ steps, waterG, sleepH, workedOut }));
    } catch { /* silent */ }
  }, [steps, waterG, sleepH, workedOut, vitalsLoaded]);

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

    const agentPositions = AGENTS.map((_, i) => {
      if (i === 0) return { x: 0.5, y: 0.15 }; // Atlas top center
      const angle = ((i - 1) / (AGENTS.length - 1)) * Math.PI + Math.PI * 0.15;
      return { x: 0.5 + Math.cos(angle) * 0.38, y: 0.55 + Math.sin(angle) * 0.3 };
    });

    const draw = () => {
      frameCount++;
      const t = frameCount * 0.015;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const positions = agentPositions.map((p) => ({
        x: p.x * canvas.width,
        y: p.y * canvas.height,
      }));

      // Draw connection lines — Atlas connected to all, plus neighbors
      const connections: [number, number][] = AGENTS.slice(1).map((_, i) => [0, i + 1] as [number, number]);
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

  const checkInDevotional = () => {
    const today = new Date().toDateString();
    const newCount = spiritualStreak + (devotionalCheckedIn ? 0 : 1);
    setSpiritualStreak(newCount);
    setDevotionalCheckedIn(true);
    localStorage.setItem("cc-spiritual-streak", JSON.stringify({ count: newCount, lastDate: today }));
    // Advance reading plan
    const nextChapter = readingPlan.chapter + 1;
    const maxChapters: Record<string, number> = { Proverbs: 31, Psalms: 150, Genesis: 50, Exodus: 40, Isaiah: 66, Matthew: 28, John: 21, Romans: 16, James: 5, Revelation: 22 };
    const max = maxChapters[readingPlan.book] || 31;
    const newPlan = nextChapter > max
      ? { ...readingPlan, chapter: 1, progress: Math.min(readingPlan.progress + 3, 100) }
      : { ...readingPlan, chapter: nextChapter, progress: Math.min(Math.round((nextChapter / max) * 100), 100) };
    setReadingPlan(newPlan);
    localStorage.setItem("cc-reading-plan", JSON.stringify(newPlan));
  };

  useEffect(() => {
    setMounted(true);
    fetchWeather();
    fetchVerse();
  }, [fetchWeather, fetchVerse]);

  /* ── 3D weather scene component ── */
  const WeatherScene = ({ condition }: { condition: string }) => {
    const c = condition.toLowerCase();
    const isSunny = c.includes("sun") || c.includes("clear");
    const isCloudy = c.includes("cloud");
    const isRainy = c.includes("rain") || c.includes("shower");
    const isStormy = c.includes("thunder") || c.includes("storm");

    return (
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-full"
          style={{
            background: isSunny
              ? "radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0.05) 50%, transparent 70%)"
              : isRainy || isStormy
                ? "radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 60%)"
                : "radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 60%)",
          }}
        />
        {/* Sun orb */}
        {(isSunny || (!isCloudy && !isRainy && !isStormy)) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <div className="w-14 h-14 rounded-full relative"
              style={{
                background: "radial-gradient(circle at 35% 35%, #fcd34d 0%, #f59e0b 40%, #d97706 80%)",
                boxShadow: "0 0 40px rgba(245,158,11,0.5), 0 0 80px rgba(245,158,11,0.2), inset 0 0 20px rgba(255,255,255,0.2)",
                animation: "float-gentle 4s ease-in-out infinite",
              }}>
              {/* Sun rays */}
              {[0,45,90,135,180,225,270,315].map(deg => (
                <div key={deg} className="absolute top-1/2 left-1/2 w-[3px] h-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    background: "linear-gradient(180deg, rgba(245,158,11,0.6), transparent)",
                    transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-22px)`,
                    animation: `float-gentle ${3 + (deg % 3)}s ease-in-out infinite`,
                    animationDelay: `${deg * 10}ms`,
                  }}
                />
              ))}
              {/* Inner highlight */}
              <div className="absolute top-2 left-3 w-4 h-3 rounded-full bg-white/20 blur-sm" />
            </div>
          </div>
        )}
        {/* Cloud layers */}
        {(isCloudy || isRainy || isStormy) && (
          <>
            <div className="absolute top-3 left-2"
              style={{
                width: "80px", height: "40px",
                borderRadius: "40px 40px 8px 8px",
                background: isStormy
                  ? "linear-gradient(180deg, rgba(100,100,130,0.9) 0%, rgba(60,60,80,0.8) 100%)"
                  : "linear-gradient(180deg, rgba(180,180,200,0.6) 0%, rgba(140,140,160,0.4) 100%)",
                boxShadow: isStormy
                  ? "0 8px 30px rgba(0,0,0,0.4), inset 0 -4px 15px rgba(0,0,0,0.3)"
                  : "0 8px 25px rgba(0,0,0,0.15), inset 0 -2px 10px rgba(255,255,255,0.1)",
                animation: "float-gentle 5s ease-in-out infinite",
              }}
            />
            <div className="absolute top-6 left-8"
              style={{
                width: "70px", height: "35px",
                borderRadius: "35px 35px 6px 6px",
                background: isStormy
                  ? "linear-gradient(180deg, rgba(80,80,110,0.85) 0%, rgba(50,50,70,0.7) 100%)"
                  : "linear-gradient(180deg, rgba(200,200,220,0.5) 0%, rgba(160,160,180,0.3) 100%)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
                animation: "float-gentle 6s ease-in-out infinite",
                animationDelay: "-1.5s",
              }}
            />
          </>
        )}
        {/* Rain drops */}
        {(isRainy || isStormy) && (
          <div className="absolute bottom-0 left-4 right-4 top-14 overflow-hidden">
            {Array.from({length: 12}).map((_, i) => (
              <div key={i} className="absolute w-[2px] rounded-full"
                style={{
                  height: `${8 + Math.random() * 10}px`,
                  left: `${5 + i * 8}%`,
                  background: "linear-gradient(180deg, rgba(0,240,255,0.5), rgba(0,240,255,0.1))",
                  animation: `rainDrop ${0.5 + Math.random() * 0.4}s linear infinite`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  top: 0,
                }}
              />
            ))}
          </div>
        )}
        {/* Lightning flash for storms */}
        {isStormy && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[3px] h-12 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(168,85,247,0.4), transparent)",
              clipPath: "polygon(50% 0%, 70% 40%, 55% 40%, 80% 100%, 40% 55%, 55% 55%, 30% 0%)",
              animation: "lightningFlash 4s ease-in-out infinite",
              opacity: 0,
            }}
          />
        )}
      </div>
    );
  };

  /* ── command handler ── */
  const sendCommand = () => {
    if (!commandInput.trim()) return;
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    setCommandHistory(prev => [{ text: commandInput, time: now, status: "sent" as const }, ...prev].slice(0, 10));
    setCommandInput("");
    cmdInputRef.current?.focus();
  };

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
          <nav className="flex items-center justify-between mb-4 overflow-visible">
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

          {/* ═══════ WHAT'S NEXT — #1 PRIORITY ═══════ */}
          <div className="mb-6">
            <div
              className="game-panel relative p-5 sm:p-6 priority-pulse"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(6,2,15,0.95) 40%, rgba(168,85,247,0.05) 100%)",
                border: "2px solid rgba(245,158,11,0.4)",
              }}
            >
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#f59e0b]/60" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#f59e0b]/60" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#f59e0b]/30" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#f59e0b]/30" />

              <div className="flex items-center gap-4 sm:gap-5">
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center text-xl sm:text-2xl font-black"
                    style={{
                      background: "linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.05) 100%)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      color: "#f59e0b",
                      textShadow: "0 0 15px rgba(245,158,11,0.5)",
                    }}
                  >
                    #1
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[8px] font-mono uppercase tracking-[0.4em] neon-text-gold">
                      WHAT&apos;S NEXT
                    </span>
                    <span
                      className="text-[7px] font-mono uppercase px-2 py-0.5 tracking-wider"
                      style={{
                        color: "#ef4444",
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
                      }}
                    >
                      CRITICAL
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white/90 leading-snug">
                    Three-portal architecture (Coach / Athlete / Parent) for Apex Athlete
                  </div>
                  <div className="text-[10px] font-mono text-white/25 mt-1">
                    Next milestone — game engine v2 with Firebase backend
                  </div>
                </div>
                <div className="hidden sm:block flex-shrink-0">
                  <Link
                    href="/apex-athlete"
                    className="game-btn px-5 py-2.5 text-[9px] font-mono uppercase tracking-wider transition-all hover:scale-[1.03]"
                    style={{
                      background: "rgba(245,158,11,0.12)",
                      color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,0.3)",
                    }}
                  >
                    OPEN APEX &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════ NOTIFICATIONS / INBOX ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b]"
                    style={{ boxShadow: "0 0 8px rgba(245,158,11,0.6)" }} />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#f59e0b] notif-ping" />
                </div>
                <span className="text-sm font-mono uppercase tracking-[0.35em] text-[#f59e0b]/50 font-bold">
                  NOTIFICATIONS
                </span>
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.12), transparent)" }} />
              <div className="text-[11px] font-mono text-white/30">
                {NOTIFICATIONS.length} ITEMS
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {NOTIFICATIONS.map((n, i) => (
                <div
                  key={i}
                  className="game-panel-sm relative p-3.5 flex items-center gap-3 group transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                  style={{
                    background: `linear-gradient(145deg, ${n.accent}08 0%, rgba(3,1,8,0.98) 100%)`,
                    border: `1px solid ${n.accent}15`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: `${n.accent}12`,
                      color: n.accent,
                      border: `1px solid ${n.accent}20`,
                    }}
                  >
                    {n.icon}
                  </div>
                  <span className="text-sm font-mono text-white/65 group-hover:text-white/85 transition-colors leading-snug min-w-0">
                    {n.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════ ROW 1: SCRIPTURE + WEATHER + CALENDAR ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* ── Scripture Card ── */}
            <div
              className="game-panel game-panel-border game-panel-scan relative p-6 flex flex-col justify-between min-h-[220px]"
              style={{
                background: "linear-gradient(145deg, rgba(245,158,11,0.04) 0%, rgba(6,2,15,0.97) 40%, rgba(6,2,15,0.99) 100%)",
              }}
            >
              <div className="absolute top-3 right-4 text-[10px] font-mono text-[#f59e0b]/40 tracking-[0.3em] uppercase font-bold">
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
              <div className="absolute top-3 right-4 text-[10px] font-mono text-[#00f0ff]/40 tracking-[0.3em] uppercase font-bold">
                ATMOSPHERE
              </div>
              {weather ? (
                <>
                  <div className="flex items-start gap-3 mb-4">
                    {/* 3D weather scene */}
                    <WeatherScene condition={weather.condition} />
                    <div className="flex-1 min-w-0">
                      <div className="text-5xl sm:text-6xl font-black neon-text-cyan leading-none">
                        {weather.tempF}<span className="text-4xl align-top">&deg;</span>
                      </div>
                      <div className="text-sm font-mono text-[#00f0ff]/50 mt-1.5">
                        Feels like {weather.feelsLike}&deg;F
                      </div>
                      <div className="text-white/85 text-lg font-bold mt-2">{weather.condition}</div>
                      <div className="text-sm font-mono text-white/40 mt-1.5 flex gap-4">
                        <span>💧 {weather.humidity}%</span>
                        <span>💨 {weather.wind}</span>
                      </div>
                      <div className="text-xs font-mono text-[#00f0ff]/30 mt-2 uppercase tracking-[0.3em]">
                        Boca Raton, FL
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {weather.forecast.map((d) => (
                      <div
                        key={d.day}
                        className="game-panel-sm text-center py-3 px-2 transition-all hover:scale-[1.02]"
                        style={{
                          background: "rgba(0,240,255,0.03)",
                          border: "1px solid rgba(0,240,255,0.06)",
                        }}
                      >
                        <div className="text-xs font-mono text-[#00f0ff]/50 uppercase">{d.day}</div>
                        <div className="text-base text-white/75 font-bold mt-1">
                          {d.high}&deg;
                          <span className="text-white/30 text-sm">/{d.low}&deg;</span>
                        </div>
                        <div className="text-[10px] text-white/25 font-mono mt-0.5 leading-snug">{d.cond}</div>
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
              <div className="absolute top-3 right-4 text-[10px] font-mono text-[#a855f7]/40 tracking-[0.3em] uppercase font-bold">
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
                      className="text-xs font-mono tabular-nums w-[64px] flex-shrink-0 text-right"
                      style={{ color: `${s.accent}70` }}
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
                    <div className="text-sm text-white/65 font-mono group-hover:text-white/80 transition-colors">
                      {s.event}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ ROW 2: AGENT NETWORK — 3D ISOMETRIC SPACE STATION ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-sm font-mono uppercase tracking-[0.35em] text-[#00f0ff]/45 font-bold">
                AGENT NETWORK
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.15), transparent)" }} />
              <div className="text-[11px] font-mono text-white/30">
                {activeAgents} ACTIVE // {AGENTS.length} TOTAL
              </div>
            </div>

            {/* 3D Isometric Space Station */}
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(170deg, #06031a 0%, #0a0628 30%, #080520 60%, #040210 100%)",
                border: "1px solid rgba(0,240,255,0.08)",
                minHeight: "500px",
              }}
            >
              {/* === Background: star field + nebula === */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(50)].map((_, si) => (
                  <div key={`star${si}`} className="absolute rounded-full" style={{
                    width: `${1 + si % 2}px`, height: `${1 + si % 2}px`,
                    background: "#fff",
                    opacity: 0.08 + (si % 5) * 0.04,
                    left: `${(si * 7.3 + 3) % 100}%`,
                    top: `${(si * 5.9 + 2) % 100}%`,
                    animation: `agent-float ${4 + si * 0.3}s ease-in-out ${si * 0.15}s infinite`,
                  }} />
                ))}
                <div style={{
                  position: "absolute", inset: 0,
                  background: `
                    radial-gradient(ellipse 60% 40% at 50% 30%, rgba(0,240,255,0.04) 0%, transparent 100%),
                    radial-gradient(ellipse 40% 30% at 20% 70%, rgba(168,85,247,0.03) 0%, transparent 100%),
                    radial-gradient(ellipse 40% 30% at 80% 60%, rgba(249,115,22,0.02) 0%, transparent 100%)
                  `,
                }} />
              </div>

              {/* === Isometric floor with perspective grid === */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `
                  repeating-linear-gradient(30deg, transparent, transparent 49px, rgba(0,240,255,0.04) 49px, rgba(0,240,255,0.04) 50px),
                  repeating-linear-gradient(150deg, transparent, transparent 49px, rgba(0,240,255,0.04) 49px, rgba(0,240,255,0.04) 50px)
                `,
                transform: "perspective(800px) rotateX(55deg) scaleY(2.2)",
                transformOrigin: "center 95%",
                maskImage: "linear-gradient(to top, black 0%, transparent 85%)",
                WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 85%)",
              }} />

              {/* === ATLAS — Command Hub (center top) === */}
              <div className="relative z-30 flex justify-center pt-6 pb-2">
                <div className="flex flex-col items-center cursor-pointer group"
                  onClick={() => setExpandedAgent(expandedAgent === "Atlas" ? null : "Atlas")}
                >
                  {/* Holographic command ring behind Atlas */}
                  <div className="absolute top-[60px] left-1/2 -translate-x-1/2 pointer-events-none" style={{
                    width: "180px", height: "60px", borderRadius: "50%",
                    border: "1px solid rgba(0,240,255,0.08)",
                    boxShadow: "0 0 40px rgba(0,240,255,0.04), inset 0 0 30px rgba(0,240,255,0.02)",
                    animation: "agent-orbit-smooth 12s linear infinite",
                  }} />

                  {/* Speech bubble */}
                  <div className="mb-3 relative" style={{ animation: "speech-pop 0.6s ease-out forwards" }}>
                    <div className="whitespace-nowrap px-4 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black"
                      style={{
                        background: "rgba(0,240,255,0.1)",
                        border: "1.5px solid rgba(0,240,255,0.25)",
                        color: "#00f0ff",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.6), 0 0 20px rgba(0,240,255,0.06)",
                        letterSpacing: "0.05em",
                      }}>
                      🧭 Coordinating all systems...
                    </div>
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                      style={{ background: "rgba(0,240,255,0.1)", borderRight: "1.5px solid rgba(0,240,255,0.25)", borderBottom: "1.5px solid rgba(0,240,255,0.25)" }} />
                  </div>

                  {/* Atlas 3D character */}
                  <div className="relative" style={{ animation: "chibi-bounce 4s ease-in-out infinite" }}>
                    <div className="relative mx-auto" style={{ width: "110px", height: "160px" }}>
                      {/* Energy aura */}
                      <div className="absolute inset-[-20px] pointer-events-none" style={{
                        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,240,255,0.08) 0%, transparent 70%)",
                        filter: "blur(16px)",
                        animation: "platform-glow 4s ease-in-out infinite",
                      }} />
                      {/* Character */}
                      <img src="/agents/atlas.png" alt="Atlas"
                        className="relative z-10 w-full h-full object-contain"
                        style={{ filter: "drop-shadow(0 0 12px rgba(0,240,255,0.2)) drop-shadow(0 8px 24px rgba(0,0,0,0.7))" }}
                      />
                      {/* Orbiting data ring */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2" style={{
                        width: "130px", height: "35px", borderRadius: "50%",
                        border: "2px solid rgba(0,240,255,0.15)",
                        animation: "agent-orbit-smooth 5s linear infinite",
                        boxShadow: "0 0 16px rgba(0,240,255,0.06)",
                      }} />
                      {/* Second orbiting ring (opposite direction) */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2" style={{
                        width: "120px", height: "30px", borderRadius: "50%",
                        border: "1px dashed rgba(0,240,255,0.08)",
                        animation: "agent-orbit-smooth 8s linear infinite reverse",
                      }} />
                      {/* Status badge */}
                      <div className="absolute -bottom-1 right-1 w-7 h-7 rounded-full border-[2.5px] border-[#06031a] animate-pulse flex items-center justify-center z-20"
                        style={{ background: "#00ff88", boxShadow: "0 0 18px rgba(0,255,136,0.5)" }}>
                        <span style={{ fontSize: "12px" }}>🧭</span>
                      </div>
                    </div>
                    {/* 3D Platform — hexagonal feel */}
                    <div className="mx-auto relative" style={{ width: "140px", height: "28px", marginTop: "-6px" }}>
                      <div className="absolute inset-0" style={{
                        background: "linear-gradient(180deg, rgba(0,240,255,0.15) 0%, rgba(0,240,255,0.04) 100%)",
                        borderRadius: "50%",
                        border: "1.5px solid rgba(0,240,255,0.12)",
                        boxShadow: "0 0 30px rgba(0,240,255,0.08)",
                      }} />
                      <div className="absolute left-[4%] right-[4%] bottom-[-10px]" style={{
                        height: "12px",
                        background: "linear-gradient(180deg, rgba(0,240,255,0.08), rgba(0,240,255,0.01))",
                        borderRadius: "0 0 50% 50% / 0 0 100% 100%",
                      }} />
                      <div className="absolute left-[8%] right-[8%] bottom-[-22px]" style={{
                        height: "16px",
                        background: "radial-gradient(ellipse, rgba(0,240,255,0.06) 0%, transparent 70%)",
                        borderRadius: "50%",
                        filter: "blur(10px)",
                      }} />
                    </div>
                  </div>

                  <div className="mt-5 text-center">
                    <div className="text-sm font-black tracking-[0.25em]" style={{ color: "#00f0ff", textShadow: "0 0 24px rgba(0,240,255,0.4), 0 2px 4px rgba(0,0,0,0.8)" }}>ATLAS</div>
                    <div className="text-[9px] font-mono text-white/35 mt-0.5 tracking-wider">LEAD STRATEGIST · Opus 4.6</div>
                    <div className="flex justify-center gap-1 mt-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: "#00f0ff", animation: "agent-typing 1.2s 0s infinite" }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: "#00f0ff", animation: "agent-typing 1.2s 0.2s infinite" }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: "#00f0ff", animation: "agent-typing 1.2s 0.4s infinite" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* === Connection lines from Atlas to each agent (SVG) === */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" style={{ opacity: 0.06 }}>
                <defs>
                  <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* === Squad Grid — 3D Characters at Workstations === */}
              <div className="relative z-10 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-4 px-3 sm:px-6 pb-6 mt-2">
                {AGENTS.slice(1).map((a, i) => {
                  const isActive = a.status === "active";
                  const isDone = a.status === "done";
                  const isWorking = isActive || isDone;
                  const isHov = hoveredAgent === i + 1;
                  const bobDelay = (i * 0.35).toFixed(2);

                  const actionTexts: Record<string, string> = {
                    SHURI: "⚡ Building UI!",
                    PROXIMON: "🏗️ Architecting!",
                    Widow: "🔍 Signal found!",
                    Vee: "📣 Marketing!",
                    MICHAEL: "🏊 Training!",
                    KIYOSAKI: "💰 Ka-ching!",
                    INK: "✍️ Writing...",
                    TheMAESTRO: "🎵 Composing!",
                    SIMONS: "📊 Crunching!",
                    "Dr. Strange": "🔮 Foreseeing!",
                    Aetherion: "🔷 Blueprinting!",
                    SELAH: "🧘 Breathing...",
                    MERCURY: "🤝 Deal closing!",
                    ECHO: "💬 Engaging!",
                    HAVEN: "🛡️ Helping!",
                    NOVA: "🔧 Fabricating!",
                    Prophets: "🙏 Praying...",
                    TRIAGE: "🩺 Diagnosing!",
                  };

                  return (
                    <div
                      key={a.name}
                      className="relative flex flex-col items-center cursor-pointer"
                      style={{
                        transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        transform: isHov ? "scale(1.15) translateY(-8px)" : "scale(1)",
                      }}
                      onMouseEnter={() => setHoveredAgent(i + 1)}
                      onMouseLeave={() => setHoveredAgent(null)}
                      onClick={() => setExpandedAgent(expandedAgent === a.name ? null : a.name)}
                    >
                      {/* Workstation backdrop — holographic screen behind character */}
                      {isWorking && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none" style={{
                          width: "60px", height: "50px",
                          background: `linear-gradient(180deg, ${a.color}08, transparent)`,
                          borderRadius: "8px 8px 0 0",
                          borderTop: `1px solid ${a.color}15`,
                          borderLeft: `1px solid ${a.color}08`,
                          borderRight: `1px solid ${a.color}08`,
                          transform: "perspective(200px) rotateX(-5deg)",
                          opacity: isHov ? 0.8 : 0.4,
                          transition: "opacity 0.3s",
                        }} />
                      )}

                      {/* Speech bubble */}
                      {isWorking && (
                        <div className="mb-1 relative z-20" style={{ animation: "speech-pop 0.5s ease-out forwards", animationDelay: `${i * 0.08}s`, animationFillMode: "both" }}>
                          <div className="whitespace-nowrap px-2.5 py-0.5 rounded-xl text-[7px] sm:text-[8px] font-black"
                            style={{
                              background: `${a.color}12`,
                              border: `1.5px solid ${a.color}25`,
                              color: a.color,
                              boxShadow: `0 3px 12px rgba(0,0,0,0.5)`,
                              opacity: isHov ? 1 : 0.7,
                              transition: "opacity 0.3s",
                            }}>
                            {actionTexts[a.name] || "Working!"}
                          </div>
                          <div className="absolute bottom-[-3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45"
                            style={{ background: `${a.color}12`, borderRight: `1.5px solid ${a.color}25`, borderBottom: `1.5px solid ${a.color}25` }} />
                        </div>
                      )}

                      {/* 3D Character Figure */}
                      <div className="relative"
                        style={{
                          animation: isActive
                            ? `chibi-work ${2.5 + (i % 3) * 0.3}s ease-in-out ${bobDelay}s infinite`
                            : isDone
                            ? `chibi-bounce ${3.5 + (i % 4) * 0.5}s ease-in-out ${bobDelay}s infinite`
                            : `chibi-wobble ${4.5 + (i % 3) * 0.5}s ease-in-out ${bobDelay}s infinite`,
                        }}>
                        <div className="mx-auto relative" style={{ width: "68px", height: "100px" }}>
                          {/* Character aura — stronger for active */}
                          <div className="absolute inset-[-12px] pointer-events-none" style={{
                            background: `radial-gradient(ellipse 70% 55% at 50% 50%, ${a.color}${isWorking ? "10" : "04"} 0%, transparent 70%)`,
                            filter: "blur(10px)",
                          }} />
                          {/* THE CHARACTER — full standing 3D body */}
                          <img
                            src={AGENT_IMG[a.name] || ""}
                            alt={a.name}
                            className="relative z-10 w-full h-full object-contain transition-all duration-300"
                            style={{
                              filter: a.status === "idle"
                                ? "brightness(0.5) saturate(0.25) drop-shadow(0 6px 14px rgba(0,0,0,0.7))"
                                : `drop-shadow(0 0 8px ${a.color}15) drop-shadow(0 6px 18px rgba(0,0,0,0.6))`,
                            }}
                          />
                          {/* Active: orbiting energy ring */}
                          {isActive && (
                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 pointer-events-none" style={{
                              width: "110%", height: "22px", borderRadius: "50%",
                              border: `1.5px solid ${a.color}20`,
                              animation: "agent-orbit-smooth 4s linear infinite",
                              boxShadow: `0 0 10px ${a.color}08`,
                            }} />
                          )}
                          {/* Status LED */}
                          <div className={`absolute -bottom-0.5 right-0.5 w-4 h-4 rounded-full border-2 border-[#06031a] z-20 ${isActive ? "animate-pulse" : ""}`}
                            style={{
                              background: isActive ? "#00ff88" : isDone ? a.color : "rgba(255,255,255,0.06)",
                              boxShadow: isActive ? "0 0 12px rgba(0,255,136,0.5)" : isDone ? `0 0 8px ${a.color}25` : "none",
                            }} />
                        </div>
                        {/* 3D Platform */}
                        <div className="mx-auto relative" style={{ width: "76px", height: "18px", marginTop: "-3px" }}>
                          {/* Platform top (ellipse) */}
                          <div className="absolute inset-0" style={{
                            background: `linear-gradient(180deg, ${a.color}${isWorking ? "12" : "06"} 0%, ${a.color}${isWorking ? "06" : "02"} 100%)`,
                            borderRadius: "50%",
                            border: `1px solid ${a.color}${isWorking ? "10" : "05"}`,
                            boxShadow: isActive ? `0 0 20px ${a.color}08` : "none",
                          }} />
                          {/* Platform 3D depth (side) */}
                          <div className="absolute left-[5%] right-[5%] bottom-[-7px]" style={{
                            height: "8px",
                            background: `linear-gradient(180deg, ${a.color}08, ${a.color}01)`,
                            borderRadius: "0 0 50% 50% / 0 0 100% 100%",
                          }} />
                          {/* Ground shadow cast */}
                          <div className="absolute left-[8%] right-[8%] bottom-[-16px]" style={{
                            height: "12px",
                            background: `radial-gradient(ellipse, ${isWorking ? `${a.color}06` : "rgba(0,0,0,0.12)"} 0%, transparent 70%)`,
                            borderRadius: "50%", filter: "blur(6px)",
                          }} />
                        </div>
                      </div>

                      {/* Name plate */}
                      <div className="mt-2 text-center max-w-[90px]">
                        <div className="text-[9px] sm:text-[10px] font-black leading-tight truncate tracking-wide transition-colors"
                          style={{ color: isHov ? a.color : "rgba(255,255,255,0.85)", textShadow: isHov ? `0 0 12px ${a.color}30` : "none" }}>
                          {a.name}
                        </div>
                        <div className="text-[6px] sm:text-[7px] font-mono truncate mt-0.5 tracking-wider" style={{ color: `${a.color}45` }}>
                          {a.role}
                        </div>
                        {isActive && (
                          <div className="flex justify-center gap-0.5 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.color, animation: "agent-typing 1.2s 0s infinite" }} />
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.color, animation: "agent-typing 1.2s 0.2s infinite" }} />
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.color, animation: "agent-typing 1.2s 0.4s infinite" }} />
                          </div>
                        )}
                        <div className="mt-0.5 text-[6px] font-mono tracking-widest uppercase font-bold"
                          style={{ color: isActive ? "#00ff88" : isDone ? `${a.color}70` : "rgba(255,255,255,0.12)" }}>
                          {isActive ? "● ACTIVE" : isDone ? "✓ DONE" : "○ STANDBY"}
                        </div>
                      </div>

                      {/* Hover detail tooltip */}
                      <div className={`absolute top-full mt-2 left-1/2 -translate-x-1/2 w-52 p-3 rounded-xl transition-all duration-200 pointer-events-none ${isHov ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
                        style={{
                          background: "rgba(3,1,8,0.97)",
                          border: `1.5px solid ${a.color}30`,
                          boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 24px ${a.color}08`,
                          backdropFilter: "blur(16px)",
                          zIndex: 60,
                        }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: a.color, background: `${a.color}10`, border: `1px solid ${a.color}18` }}>{a.model}</span>
                          <span className="text-[9px] font-mono font-bold" style={{ color: isActive ? "#00ff88" : isDone ? a.color : "rgba(255,255,255,0.3)" }}>
                            {isActive ? "● ACTIVE" : isDone ? "✓ DONE" : "○ STANDBY"}
                          </span>
                        </div>
                        <div className="text-[10px] text-white/40 font-mono leading-relaxed mb-2">{a.desc}</div>
                        {a.activeTask && (
                          <div className="text-[9px] font-mono truncate" style={{ color: `${a.color}55` }}>→ {a.activeTask}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* === Workflow phases — isometric bottom bar === */}
              <div className="relative z-10 pb-6 flex justify-center gap-2 sm:gap-3 flex-wrap px-4">
                {[
                  { label: "DETECT", color: "#ef4444", icon: "🔍" },
                  { label: "PLAN", color: "#f59e0b", icon: "💡" },
                  { label: "BUILD", color: "#34d399", icon: "⚡" },
                  { label: "SHIP", color: "#00f0ff", icon: "🚀" },
                  { label: "MONITOR", color: "#a855f7", icon: "📡" },
                  { label: "ITERATE", color: "#ec4899", icon: "🔄" },
                ].map((stage, si) => (
                  <div
                    key={stage.label}
                    className="font-mono font-black text-[8px] sm:text-[9px] tracking-[0.15em] px-2.5 py-1.5 rounded-full flex items-center gap-1.5"
                    style={{
                      color: stage.color,
                      background: `linear-gradient(135deg, ${stage.color}10, ${stage.color}04)`,
                      border: `1.5px solid ${stage.color}18`,
                      textShadow: `0 0 8px ${stage.color}25`,
                      boxShadow: `0 4px 14px rgba(0,0,0,0.35)`,
                    }}
                  >
                    <span style={{ fontSize: "10px" }}>{stage.icon}</span>
                    {stage.label}
                    {si < 5 && <span style={{ color: `${stage.color}30`, marginLeft: "2px" }}>→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* ═══════ ROW 3: ACTIVE MISSIONS ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-sm font-mono uppercase tracking-[0.35em] text-[#00f0ff]/45 font-bold">
                ACTIVE MISSIONS
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.15), transparent)" }} />
              <div className="text-[11px] font-mono text-white/30">
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
                            <h3 className="text-base font-bold text-white/90 leading-tight">{m.name}</h3>
                            <p className="text-xs text-white/35 font-mono mt-0.5 leading-snug">{m.desc}</p>
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
              <div className="text-sm font-mono uppercase tracking-[0.35em] text-[#e879f9]/45 font-bold">
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
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] mb-3 text-[#e879f9]/40">
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
              <div className="absolute top-3 right-4 text-[10px] font-mono text-[#f59e0b]/40 tracking-[0.3em] uppercase font-bold">
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
                  <span className="text-[11px] font-mono text-white/30">TARGET PROGRESS</span>
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
                        className="text-sm font-black font-mono whitespace-nowrap"
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
              <div className="text-sm font-mono uppercase tracking-[0.35em] text-white/30 font-bold">
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
                  className="game-card game-panel-sm relative p-4 flex flex-col items-center justify-center gap-2 group transition-all overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${l.accent}04 0%, rgba(3,1,8,0.99) 100%)`,
                    border: `1px solid ${l.accent}08`,
                    minHeight: "88px",
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
              <div className="text-sm font-mono uppercase tracking-[0.35em] text-white/30 font-bold">
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
                      <div className="text-sm text-white/55 leading-snug group-hover:text-white/75 transition-colors line-clamp-2">
                        {l.text}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-white/30 flex-shrink-0 uppercase">
                      {l.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ COMMAND INPUT — Send commands/approvals ═══════ */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-sm font-mono uppercase tracking-[0.35em] text-[#00f0ff]/40 font-bold">
                COMMAND LINE
              </div>
              <div className="flex-1 h-[1px]" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.15), transparent)" }} />
              <div className="text-[9px] font-mono text-white/20">
                Send instructions to Atlas
              </div>
            </div>

            <div
              className="game-panel game-panel-scan relative"
              style={{
                background: "linear-gradient(145deg, rgba(0,240,255,0.03) 0%, rgba(3,1,8,0.99) 100%)",
                border: "1px solid rgba(0,240,255,0.12)",
              }}
            >
              {/* Input row */}
              <div className="flex items-center gap-3 p-4">
                <span className="text-[#00f0ff]/60 font-mono text-sm font-bold">&gt;</span>
                <input
                  ref={cmdInputRef}
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendCommand()}
                  placeholder="Type a command..."
                  className="flex-1 bg-transparent text-white/80 text-sm font-mono outline-none placeholder:text-white/15"
                />
                <button
                  onClick={sendCommand}
                  className="game-btn px-5 py-2 text-[10px] font-mono uppercase tracking-wider transition-all hover:scale-[1.03]"
                  style={{
                    background: commandInput.trim() ? "rgba(0,240,255,0.15)" : "rgba(0,240,255,0.05)",
                    color: commandInput.trim() ? "#00f0ff" : "rgba(0,240,255,0.3)",
                    border: `1px solid ${commandInput.trim() ? "rgba(0,240,255,0.3)" : "rgba(0,240,255,0.08)"}`,
                  }}
                >
                  SEND
                </button>
              </div>

              {/* Command history */}
              {commandHistory.length > 0 && (
                <div className="border-t border-white/[0.04] px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
                  {commandHistory.map((cmd, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-white/30 w-16 flex-shrink-0">{cmd.time}</span>
                      <span className="text-[#00f0ff]/40 font-mono text-xs">&gt;</span>
                      <span className="text-[11px] font-mono text-white/50 flex-1 truncate">{cmd.text}</span>
                      <span
                        className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          color: cmd.status === "done" ? "#00ff88" : "#f59e0b",
                          background: cmd.status === "done" ? "rgba(0,255,136,0.08)" : "rgba(245,158,11,0.08)",
                        }}
                      >
                        {cmd.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══════ FOOTER ═══════ */}
          <footer className="text-center py-8 border-t border-white/[0.03]">
            <div className="text-[9px] font-mono text-white/10 tracking-[0.4em] uppercase">
              COMMAND CENTER v6 // RAMICHE OPERATIONS // SIGNAL FIRST // {new Date().getFullYear()}
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

/* ── Agent Card — animated, with credits + working state ── */
/* ── GA Character Avatars per agent ── */
const AGENT_IMG: Record<string, string> = {
  Atlas: "/agents/atlas.png",
  TheMAESTRO: "/agents/themaestro.png",
  SIMONS: "/agents/simons.png",
  "Dr. Strange": "/agents/drstrange.png",
  SHURI: "/agents/shuri.png",
  Widow: "/agents/widow.png",
  PROXIMON: "/agents/proximon.png",
  Vee: "/agents/vee.png",
  Aetherion: "/agents/aetherion.png",
  MICHAEL: "/agents/michael.png",
  Prophets: "/agents/prophets.png",
  SELAH: "/agents/selah.png",
  MERCURY: "/agents/mercury.png",
  ECHO: "/agents/echo.png",
  HAVEN: "/agents/haven.png",
  INK: "/agents/ink.png",
  NOVA: "/agents/nova.png",
  KIYOSAKI: "/agents/kiyosaki.png",
  TRIAGE: "/agents/triage.png",
};
const AGENT_AVATARS: Record<string, React.ReactNode> = Object.fromEntries(
  Object.entries(AGENT_IMG).map(([name, src]) => [
    name,
    <img key={name} src={src} alt={name} className="w-full h-full object-cover rounded-full" style={{ imageRendering: "auto" }} />,
  ])
);

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
  const isLead = index === 0;
  const creditPct = Math.round((agent.credits.used / agent.credits.limit) * 100);

  return (
    <div
      className={`relative transition-all duration-300 cursor-pointer group ${
        isHovered ? "scale-[1.05] z-20" : "z-10"
      }`}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      style={{ width: isLead ? "140px" : "110px" }}
    >
      {/* Ambient glow behind */}
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${agent.color}${isHovered ? "25" : isActive ? "10" : "04"} 0%, transparent 70%)`,
          transform: "scale(1.8)",
        }}
      />

      {/* Avatar container */}
      <div className="relative flex flex-col items-center">
        {/* Hex avatar frame with animated ring */}
        <div className="relative" style={{ width: isLead ? "80px" : "64px", height: isLead ? "80px" : "64px" }}>
          {/* Outer rotating ring for active agents */}
          {isActive && (
            <div
              className="absolute inset-[-6px] rounded-full pointer-events-none"
              style={{
                border: `1.5px solid ${agent.color}25`,
                animation: "agent-orbit 8s linear infinite",
                borderTopColor: `${agent.color}60`,
              }}
            />
          )}
          {/* Inner glow ring */}
          <div
            className="absolute inset-[-2px] rounded-full transition-all duration-300"
            style={{
              border: `2px solid ${agent.color}${isHovered ? "50" : isActive ? "25" : "08"}`,
              boxShadow: isHovered
                ? `0 0 25px ${agent.color}30, inset 0 0 15px ${agent.color}10`
                : isActive
                  ? `0 0 12px ${agent.color}15`
                  : "none",
            }}
          />
          {/* Avatar background */}
          <div
            className="w-full h-full rounded-full overflow-hidden flex items-center justify-center p-2.5"
            style={{
              background: `radial-gradient(circle at 35% 35%, ${agent.color}12 0%, rgba(3,1,8,0.95) 70%)`,
            }}
          >
            {AGENT_AVATARS[agent.name] || <span className="text-3xl">{agent.icon}</span>}
          </div>
          {/* Status dot */}
          <div
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#030108] ${
              isActive ? "animate-pulse" : ""
            }`}
            style={{
              background: isActive ? "#00ff88" : "rgba(255,255,255,0.15)",
              boxShadow: isActive ? "0 0 8px rgba(0,255,136,0.6)" : "none",
            }}
          />
        </div>

        {/* Name + role below avatar */}
        <div className="mt-2 text-center">
          <div
            className="text-sm font-bold leading-tight transition-colors duration-200"
            style={{ color: isHovered ? agent.color : "rgba(255,255,255,0.9)" }}
          >
            {agent.name}
          </div>
          <div className="text-[10px] font-mono mt-0.5" style={{ color: `${agent.color}50` }}>
            {agent.role}
          </div>
        </div>

        {/* Active task indicator */}
        {isActive && agent.activeTask && (
          <div className="mt-1 flex items-center gap-1">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full" style={{ background: agent.color, animation: "agent-typing 1.2s 0s infinite" }} />
              <span className="w-1 h-1 rounded-full" style={{ background: agent.color, animation: "agent-typing 1.2s 0.2s infinite" }} />
              <span className="w-1 h-1 rounded-full" style={{ background: agent.color, animation: "agent-typing 1.2s 0.4s infinite" }} />
            </span>
          </div>
        )}

        {/* Hover tooltip with details */}
        <div
          className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 w-52 p-3 rounded-lg transition-all duration-200 pointer-events-none ${
            isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
          style={{
            background: "rgba(3,1,8,0.95)",
            border: `1px solid ${agent.color}30`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px ${agent.color}10`,
            backdropFilter: "blur(16px)",
            zIndex: 50,
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: agent.color, background: `${agent.color}10`, border: `1px solid ${agent.color}18` }}>
              {agent.model}
            </span>
            <span className="text-[9px] font-mono" style={{ color: isActive ? "#00ff88" : "rgba(255,255,255,0.3)" }}>
              {isActive ? "● ONLINE" : "○ SLEEP"}
            </span>
          </div>
          <div className="text-[10px] text-white/40 font-mono leading-relaxed mb-2">{agent.desc}</div>
          {agent.activeTask && (
            <div className="text-[9px] font-mono truncate" style={{ color: `${agent.color}60` }}>
              → {agent.activeTask}
            </div>
          )}
          {/* Mini credit bar */}
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${creditPct}%`, background: agent.color, boxShadow: `0 0 4px ${agent.color}40` }} />
            </div>
            <span className="text-[8px] font-mono" style={{ color: `${agent.color}50` }}>{creditPct}%</span>
          </div>
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

      <div className="text-[10px] font-mono uppercase tracking-[0.25em] mb-3" style={{ color: `${color}40` }}>
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
