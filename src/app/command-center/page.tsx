"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   COMMAND CENTER v4 — HOLOGRAPHIC MISSION CONTROL
   Apple x Rockstar Games, 50 years in the future.
   A living, breathing cockpit for Ramon's entire operation.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── AGENTS ─────────────────────────────────────────────────────────────────── */
const AGENTS = [
  {
    name: "Atlas", model: "Opus 4.6 / Sonnet 4.5", role: "Operations Lead",
    status: "active" as const, color: "#C9A84C", icon: "🧭",
    desc: "Carries the weight — orchestrates 18 agents, ships products, memory, mission control",
    connections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    credits: { used: 4800, limit: 5000 },
    activeTask: "Command Center upgrade + 120+ commits this week + ByteByteGo 52/52 implemented",
  },
  {
    name: "TheMAESTRO", model: "DeepSeek V3.2", role: "Music Production AI",
    status: "idle" as const, color: "#f59e0b", icon: "🎵",
    desc: "Ye + Quincy + Babyface — influence-based creative direction, sound design",
    connections: [0, 7],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Ramiche music pipeline",
  },
  {
    name: "SIMONS", model: "DeepSeek V3.2", role: "Algorithmic Analysis",
    status: "done" as const, color: "#22d3ee", icon: "📊",
    desc: "Jim Simons — pattern recognition, statistical arbitrage, pricing models",
    connections: [0, 4],
    credits: { used: 620, limit: 5000 },
    activeTask: "DELIVERED: Pricing analysis + marketing playbook + ClawGuard scanner + conversion strategies",
  },
  {
    name: "Dr. Strange", model: "DeepSeek V3.2", role: "Forecasting & Decisions",
    status: "idle" as const, color: "#a855f7", icon: "🔮",
    desc: "Scenario analysis, probable outcomes, strategic foresight, risk assessment",
    connections: [0, 2, 6],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Next strategic planning cycle",
  },
  {
    name: "SHURI", model: "DeepSeek V3.2", role: "Creative Coding",
    status: "done" as const, color: "#34d399", icon: "⚡",
    desc: "Prototyping, design systems, tech innovation, rapid builds",
    connections: [0, 7],
    credits: { used: 1800, limit: 5000 },
    activeTask: "DELIVERED: 18+ PRs — portals, meet mgmt, invite system, brand assets, desktop layouts",
  },
  {
    name: "Widow", model: "Haiku 4.5", role: "Cybersecurity & Intel",
    status: "done" as const, color: "#ef4444", icon: "🕷",
    desc: "Threat monitoring, risk analysis, data intelligence, security audits",
    connections: [0, 2],
    credits: { used: 480, limit: 5000 },
    activeTask: "DELIVERED: ClawGuard Pro (12-domain, $299-$1499) + CSP headers + Firestore rules + API security",
  },
  {
    name: "PROXIMON", model: "Gemini 3.0 Pro", role: "Systems Architect",
    status: "done" as const, color: "#f97316", icon: "🏗",
    desc: "Jobs + Musk + Bezos — first-principles, flywheels, compounding systems",
    connections: [0, 3, 4],
    credits: { used: 880, limit: 5000 },
    activeTask: "DELIVERED: Event sourcing + BFF pattern + DR plan + real-time sync hooks + denormalization",
  },
  {
    name: "Vee", model: "Kimi K2.5", role: "Brand & Marketing",
    status: "active" as const, color: "#ec4899", icon: "📣",
    desc: "Gary Vee + Seth Godin + Hormozi + Blakely + Virgil — makes brands impossible to ignore",
    connections: [0, 1, 6],
    credits: { used: 950, limit: 5000 },
    activeTask: "15-strategy conversion playbook + X/LinkedIn positioning + METTLE brand v5 consulting",
  },
  {
    name: "Aetherion", model: "Gemini 3.0 Pro", role: "Meta-Architect",
    status: "done" as const, color: "#818cf8", icon: "🌀",
    desc: "The Architect of Architects — patterns, emergence, meta-systems, blueprinting reality itself",
    connections: [0, 3, 6],
    credits: { used: 200, limit: 5000 },
    activeTask: "DELIVERED: Inter-agent workflow chains + white-label architecture",
  },
  {
    name: "MICHAEL", model: "GLM 4.6", role: "Swim Training AI",
    status: "done" as const, color: "#06b6d4", icon: "🏊",
    desc: "Phelps + Kobe + MJ + Bolt — swim mastery, mamba mentality, competitive fire",
    connections: [0, 3],
    credits: { used: 510, limit: 5000 },
    activeTask: "DELIVERED: Full meet management + splits + results + CSV export + post-meet reports",
  },
  {
    name: "Prophets", model: "Kimi K2.5", role: "Spiritual Wisdom",
    status: "active" as const, color: "#d4a574", icon: "📜",
    desc: "Solomon + Moses + Elijah + Isaiah + David — Scripture-rooted counsel, wisdom, moral clarity",
    connections: [0],
    credits: { used: 190, limit: 5000 },
    activeTask: "Daily Scripture + Prayer (7:00 AM cron active)",
  },
  {
    name: "SELAH", model: "DeepSeek V3.2", role: "Wellness & Sport Psychology",
    status: "done" as const, color: "#10b981", icon: "🧘",
    desc: "Robbins + Dispenza + Maté + Greene + Bashar — therapy, peak performance, mental transformation",
    connections: [0, 9, 10],
    credits: { used: 190, limit: 5000 },
    activeTask: "DELIVERED: Wellness check-in + journal + meditation in athlete portal",
  },
  {
    name: "MERCURY", model: "Gemini 3.0 Pro", role: "Sales & Revenue Ops",
    status: "active" as const, color: "#fbbf24", icon: "💰",
    desc: "Razor-sharp dealmaker — reads people and numbers simultaneously. Architects wins.",
    connections: [0, 7],
    credits: { used: 520, limit: 5000 },
    activeTask: "Upwork proposals + Stripe checkout wired + ClawGuard sales page + conversion strategies",
  },
  {
    name: "ECHO", model: "Kimi K2.5", role: "Community & Social",
    status: "active" as const, color: "#38bdf8", icon: "🌊",
    desc: "The heartbeat of the community — turns strangers into superfans with genuine warmth",
    connections: [0, 7],
    credits: { used: 540, limit: 5000 },
    activeTask: "X/LinkedIn posting + social listening cron + Berman thread + Building in Public content",
  },
  {
    name: "HAVEN", model: "DeepSeek V3.2", role: "Customer Success",
    status: "idle" as const, color: "#4ade80", icon: "🛡",
    desc: "Infinitely patient with a detective's eye — treats every ticket like a puzzle worth solving",
    connections: [0],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: First customer onboarding (Derrick deployment complete)",
  },
  {
    name: "INK", model: "DeepSeek V3.2", role: "Content Creator",
    status: "done" as const, color: "#c084fc", icon: "✒",
    desc: "Prolific voice-chameleon — technical blog at dawn, viral tweet at noon, cinematic script by sunset",
    connections: [0, 7],
    credits: { used: 650, limit: 5000 },
    activeTask: "DELIVERED: Weekly content calendar + Building in Public posts + coach quick-start guide + Berman analysis",
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
    desc: "ORACLE — 8 financial minds. Wealth architecture + business plan + patent strategy.",
    connections: [0, 2, 3],
    credits: { used: 720, limit: 5000 },
    activeTask: "DELIVERED: METTLE business plan v2 + tiered pricing + provisional patent (filing in progress)",
  },
  {
    name: "TRIAGE", model: "Sonnet 4.5", role: "System Doctor",
    status: "idle" as const, color: "#f472b6", icon: "🩺",
    desc: "Best SWE-bench score in the squad (77.2). Debugging, failure tracing, diagnostics.",
    connections: [0, 4],
    credits: { used: 0, limit: 5000 },
    activeTask: "Available on demand — system diagnostics + debugging",
  },
  {
    name: "THEMIS", model: "Opus 4.6", role: "Legal & Compliance",
    status: "idle" as const, color: "#8b5cf6", icon: "⚖",
    desc: "IP protection, compliance frameworks, contract review, legal strategy — the law is the shield",
    connections: [0, 5],
    credits: { used: 0, limit: 5000 },
    activeTask: "SOC 2 / HIPAA / GDPR compliance + patent filing support",
  },
];

/* ── AGENT → PROJECT ASSIGNMENTS ───────────────────────────────────────────── */
const AGENT_PROJECTS: Record<string, { project: string; role: string; status: "active" | "idle" | "done" }[]> = {
  Atlas: [
    { project: "METTLE", role: "Lead architect + game engine", status: "active" },
    { project: "Command Center", role: "Design + build", status: "active" },
    { project: "Galactik Antics", role: "Store pipeline + copy", status: "active" },
    { project: "Parallax Studio", role: "Landing page + outreach", status: "idle" },
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
    { project: "METTLE", role: "Attrition prediction + forecasting", status: "idle" },
    { project: "Business Strategy", role: "Scenario planning + risk analysis", status: "idle" },
  ],
  SHURI: [
    { project: "METTLE", role: "UI/UX + rapid prototyping", status: "active" },
    { project: "Replit Projects", role: "Social Cross-Poster build", status: "idle" },
    { project: "Galactik Antics", role: "Browser game MVP", status: "idle" },
  ],
  Widow: [
    { project: "Security Audit", role: "Platform security + API protection", status: "idle" },
    { project: "Competitive Intel", role: "Market monitoring + threat scan", status: "idle" },
  ],
  PROXIMON: [
    { project: "METTLE", role: "Systems architecture + scaling", status: "active" },
    { project: "Infrastructure", role: "Firebase + deployment pipeline", status: "idle" },
  ],
  Vee: [
    { project: "Galactik Antics", role: "Brand voice + launch marketing", status: "active" },
    { project: "Parallax Studio", role: "Client acquisition + positioning", status: "idle" },
    { project: "SCOWW", role: "Event marketing + social strategy", status: "idle" },
  ],
  Aetherion: [
    { project: "Multi-Agent Architecture", role: "Designing agent collaboration patterns", status: "active" },
    { project: "METTLE", role: "Scalable system blueprint (multi-team SaaS)", status: "idle" },
    { project: "Infrastructure", role: "Cross-project integration + emergence analysis", status: "idle" },
  ],
  MICHAEL: [
    { project: "METTLE", role: "Swim coaching intelligence + athlete motivation", status: "active" },
    { project: "Saint Andrew's Aquatics", role: "Training analysis + race strategy", status: "active" },
  ],
  Prophets: [
    { project: "Daily Scripture", role: "7 AM verse + prayer prompt via Telegram", status: "active" },
    { project: "Sanctuary", role: "Devotional tracking + reading plans + prayer focus", status: "active" },
    { project: "Life Guidance", role: "Faith-rooted wisdom for decisions", status: "active" },
  ],
  SELAH: [
    { project: "METTLE", role: "Sport psychology + athlete mental performance", status: "active" },
    { project: "Team Wellness", role: "Coach/athlete wellness support + burnout prevention", status: "active" },
    { project: "Personal Growth", role: "Ramon's peak performance + mindset coaching", status: "idle" },
  ],
  MERCURY: [
    { project: "Parallax Studio", role: "Client acquisition + deals", status: "idle" },
    { project: "Revenue Ops", role: "Pipeline + pricing strategy", status: "idle" },
  ],
  ECHO: [
    { project: "Community", role: "Discord + social engagement", status: "idle" },
    { project: "Galactik Antics", role: "Fan community + ambassador program", status: "idle" },
  ],
  HAVEN: [
    { project: "Customer Support", role: "Ticket system + onboarding", status: "idle" },
    { project: "METTLE", role: "Coach/parent support flows", status: "idle" },
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
    { project: "METTLE", role: "Financial model + pricing strategy", status: "done" },
    { project: "Wealth Architecture", role: "Investment analysis + cashflow optimization", status: "idle" },
  ],
  TRIAGE: [
    { project: "System Health", role: "Debugging + diagnostics + failure tracing", status: "idle" },
    { project: "METTLE", role: "Code review + performance audit", status: "idle" },
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
    name: "METTLE", accent: "#C9A84C", status: "active" as const,
    desc: "Gamified swim training \u2014 LIVE BETA \u2014 Stripe checkout live", priority: "CRITICAL",
    tasks: [
      { t: "Game engine + check-ins", done: true },
      { t: "Coach dashboard + leaderboard", done: true },
      { t: "Three-portal architecture (Coach/Athlete/Parent)", done: true },
      { t: "Multi-roster expansion (240+ athletes, 7 groups)", done: true },
      { t: "Stripe billing \u2014 3 tiers ($149/$349/$549)", done: true },
      { t: "CI/CD pipeline (GitHub Actions + Husky + Vitest)", done: true },
      { t: "Copyright filed (Feb 17, 2026)", done: true },
      { t: "Hy-Tek import (.hy3/.ev3) — iOS fix deployed", done: true },
      { t: "Quest flow UX polish", done: false },
      { t: "Firebase backend (v2) deploy", done: false },
    ],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Parallax Studio", accent: "#a855f7", status: "active" as const,
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
  { label: "METTLE", href: "https://ramiche-site.vercel.app/apex-athlete", icon: "M", accent: "#C9A84C" },
  { label: "Parallax Site", href: "https://parallax-site-ashen.vercel.app", icon: "P", accent: "#a855f7" },
  { label: "YOLO Builds", href: "/command-center/yolo", icon: "Y", accent: "#f59e0b" },
  { label: "Hijack", href: "https://ramiche-site.vercel.app/hijack", icon: "H", accent: "#ef4444" },
  { label: "Parallax Publish", href: "https://parallax-publish.vercel.app", icon: "PP", accent: "#38bdf8" },
  { label: "ClawGuard Pro", href: "https://parallax-site-ashen.vercel.app/clawguard", icon: "CG", accent: "#22d3ee" },
  { label: "Vercel", href: "https://vercel.com/dashboard", icon: "V", accent: "#ffffff" },
  { label: "GitHub", href: "https://github.com", icon: "GH", accent: "#737373" },
  { label: "Shopify", href: "https://admin.shopify.com", icon: "S", accent: "#96bf48" },
  { label: "GoMotion", href: "https://www.gomotionapp.com", icon: "G", accent: "#34d399" },
];

/* ── ACTIVITY LOG ──────────────────────────────────────────────────────────── */
const LOG = [
  { time: "Feb 24", text: "Command Center upgrade initiated — Parallax branding + agent approvals", color: "#C9A84C" },
  { time: "Feb 24", text: "ClawGuard Pro scan: 95/100 — all security issues resolved except firewall", color: "#ef4444" },
  { time: "Feb 24", text: "ByteByteGo PDF: 52/52 topics fully implemented across ecosystem", color: "#00f0ff" },
  { time: "Feb 24", text: "METTLE brand v5 (Forged M) locked — biblical colors, gold-outlined edges", color: "#C9A84C" },
  { time: "Feb 24", text: "15-strategy conversion playbook deployed site-wide (all products)", color: "#ec4899" },
  { time: "Feb 24", text: "Social listening cron live + Berman engagement thread posted", color: "#38bdf8" },
  { time: "Feb 24", text: "Desktop layouts fixed — full screen real estate, breathing room, symmetry", color: "#34d399" },
  { time: "Feb 24", text: "Agent knowledge bases updated — Vee, Mercury, Simons all have marketing playbook", color: "#a855f7" },
  { time: "Feb 23", text: "18 PRs merged in one day — security, monitoring, rate limiting, meet mgmt, onboarding", color: "#00f0ff" },
  { time: "Feb 23", text: "METTLE declared beta-ready for Saint Andrew's (240+ athletes)", color: "#C9A84C" },
  { time: "Feb 23", text: "Firestore security rules deployed and locked down", color: "#ef4444" },
  { time: "Feb 23", text: "ClawGuard Pro product page + Stripe checkout — 3 tiers ($299/$799/$1499)", color: "#fbbf24" },
  { time: "Feb 23", text: "METTLE invite link system — no more PIN sharing for onboarding", color: "#34d399" },
  { time: "Feb 23", text: "Content posted to X + LinkedIn — Monday AI Agents theme", color: "#38bdf8" },
  { time: "Feb 21", text: "First external deployment — Derrick (Windows), Enterprise bundle, 4 agents", color: "#a855f7" },
  { time: "Feb 21", text: "Upwork account live — 2 proposals submitted at $50/hr", color: "#fbbf24" },
  { time: "Feb 18", text: "METTLE name locked + provisional patent draft delivered", color: "#C9A84C" },
  { time: "Feb 17", text: "Copyright filed for METTLE at eco.copyright.gov — $65 paid", color: "#a855f7" },
  { time: "Feb 17", text: "Stripe checkout confirmed — all 3 tiers working end-to-end", color: "#34d399" },
];

/* ── SCHEDULE ──────────────────────────────────────────────────────────────── */
const SCHEDULE = [
  { time: "2:30 AM", event: "Night shift build (Atlas, isolated)", accent: "#C9A84C" },
  { time: "6:30 AM", event: "AI Self-Improvement Digest", accent: "#00f0ff" },
  { time: "7:00 AM", event: "Daily Scripture & Prayer (Prophets)", accent: "#d4a574" },
  { time: "7:15 AM", event: "Morning Brief Enhanced (weather, git, calendar, priorities)", accent: "#a855f7" },
  { time: "1:00 PM", event: "Midday Checkpoint (pulse check, blockers)", accent: "#22d3ee" },
  { time: "2:00 PM", event: "Social Listening Scan (X, LinkedIn, mentions)", accent: "#38bdf8" },
  { time: "6:00 PM", event: "Weekly Strategy Review (Fridays only)", accent: "#f59e0b" },
  { time: "7:00 AM", event: "Competitor Watch (Mondays only)", accent: "#ef4444" },
  { time: "9:00 PM", event: "Night build session", accent: "#22d3ee" },
  { time: "10:00 PM", event: "End of Day Recap", accent: "#C9A84C" },
];

/* ── NOTIFICATIONS / INBOX ────────────────────────────────────────────────── */
const NOTIFICATIONS = [
  { text: "METTLE beta-ready — 18 PRs merged, security hardened, onboarding complete", accent: "#C9A84C", icon: "\u25C8" },
  { text: "ByteByteGo PDF: 52/52 implementations complete across ecosystem", accent: "#00f0ff", icon: "\u25C8" },
  { text: "ClawGuard Pro LIVE — $299/$799/$1499, Stripe checkout wired", accent: "#ef4444", icon: "\u25C8" },
  { text: "Provisional patent filing in progress — USPTO Patent Center", accent: "#a855f7", icon: "\u25C8" },
  { text: "Conversion strategies deployed site-wide (15 ad agency tactics)", accent: "#ec4899", icon: "\u25C8" },
  { text: "Social listening cron active — daily X/LinkedIn/web monitoring", accent: "#38bdf8", icon: "\u25C8" },
  { text: "Hy-Tek import \u2014 .hy3/.ev3 iOS fix deployed, needs user test", accent: "#22d3ee", icon: "\u25C8" },
  { text: "TheMAESTRO blocked \u2014 needs release timeline from Ramon", accent: "#f59e0b", icon: "\u26A0" },
];

/* ── NAV ───────────────────────────────────────────────────────────────────── */
const NAV = [
  { label: "COMMAND", href: "/command-center", icon: "\u25C7", active: true },
  { label: "AGENTS", href: "/command-center/agents", icon: "\u2726" },
  { label: "TASKS", href: "/command-center/tasks", icon: "\u25A3" },
  { label: "CALENDAR", href: "/command-center/calendar", icon: "\u25CB" },
  { label: "PROJECTS", href: "/command-center/projects", icon: "\u25C9" },
  { label: "MEMORY", href: "/command-center/memory", icon: "\u25CE" },
  { label: "DOCS", href: "/command-center/docs", icon: "\u2261" },
  { label: "OFFICE", href: "/command-center/office", icon: "\u25A3" },
  { label: "METTLE", href: "/apex-athlete", icon: "\u2726" },
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
  const [liveAgents, setLiveAgents] = useState<typeof AGENTS | null>(null);
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

  /* ── live bridge data (auto-refresh every 60s) ── */
  const [bridgeData, setBridgeData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const fetchBridge = async () => {
      try {
        const res = await fetch("/api/bridge?type=all", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setBridgeData(data);
          // Update agent status from bridge if available
          if (data?.agents?.items && Array.isArray(data.agents.items)) {
            // Map bridge agent data to match hardcoded AGENTS shape
            const mapped = data.agents.items.map((a: any, i: number) => {
              const match = AGENTS.find(ha => ha.name.toLowerCase() === (a.name || '').toLowerCase());
              return {
                name: a.name || `Agent ${i}`,
                model: a.model || match?.model || '',
                role: a.role || match?.role || '',
                status: (a.status === 'active' ? 'active' : a.status === 'done' ? 'done' : 'idle') as 'active' | 'idle' | 'done',
                color: match?.color || '#737373',
                icon: match?.icon || '🤖',
                desc: match?.desc || a.capabilities || '',
                connections: match?.connections || [],
                credits: match?.credits || { used: 0, limit: 5000 },
                activeTask: a.activeTask || a.lastTask || match?.activeTask || 'Standing by',
              };
            });
            if (mapped.length > 0) setLiveAgents(mapped);
          }
        }
      } catch { /* silent — fallback to hardcoded */ }
    };
    fetchBridge();
    const id = setInterval(fetchBridge, 60000);
    return () => clearInterval(id);
  }, []);

  /* ── live CRUD state ── */
  const [liveCrons, setLiveCrons] = useState<any[]>([]);
  const [liveTasks, setLiveTasks] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAgent, setChatAgent] = useState('atlas');
  const [cronModal, setCronModal] = useState(false);
  const [taskModal, setTaskModal] = useState(false);
  const [cronForm, setCronForm] = useState({ name: '', schedule: '', agent: '', task: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignee: '', priority: 'medium' });

  /* ── fetch crons (mount + every 60s) ── */
  useEffect(() => {
    const fetchCrons = async () => {
      try {
        const res = await fetch('/api/bridge/crons', { cache: 'no-store' });
        if (res.ok) { const data = await res.json(); setLiveCrons(data.items || []); }
      } catch { /* silent */ }
    };
    fetchCrons();
    const id = setInterval(fetchCrons, 60000);
    return () => clearInterval(id);
  }, []);

  /* ── fetch tasks (mount + every 60s) ── */
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/bridge/tasks', { cache: 'no-store' });
        if (res.ok) { const data = await res.json(); setLiveTasks(data.items || []); }
      } catch { /* silent */ }
    };
    fetchTasks();
    const id = setInterval(fetchTasks, 60000);
    return () => clearInterval(id);
  }, []);

  /* ── fetch chat (mount + every 30s) ── */
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch('/api/bridge/chat', { cache: 'no-store' });
        if (res.ok) { const data = await res.json(); setChatMessages(data.items || data.messages || []); }
      } catch { /* silent */ }
    };
    fetchChat();
    const id = setInterval(fetchChat, 30000);
    return () => clearInterval(id);
  }, []);

  /* ── CRUD handlers ── */
  const bridgeHeaders = { 'Content-Type': 'application/json', 'x-bridge-secret': 'parallax-bridge-2026' };

  const handleCreateCron = async (name: string, schedule: string, agent: string, task: string) => {
    try {
      await fetch('/api/bridge/crons', { method: 'POST', headers: bridgeHeaders, body: JSON.stringify({ action: 'create', name, schedule, agent, task }) });
      const res = await fetch('/api/bridge/crons', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); setLiveCrons(data.items || []); }
    } catch { /* silent */ }
  };

  const handleDeleteCron = async (cronId: string) => {
    try {
      await fetch('/api/bridge/crons', { method: 'POST', headers: bridgeHeaders, body: JSON.stringify({ action: 'delete', cronId }) });
      setLiveCrons(prev => prev.filter(c => c.id !== cronId && c.cronId !== cronId));
    } catch { /* silent */ }
  };

  const handleCreateTask = async (title: string, description: string, assignee: string, priority: string) => {
    try {
      await fetch('/api/bridge/tasks', { method: 'POST', headers: bridgeHeaders, body: JSON.stringify({ action: 'create', title, description, assignee, priority }) });
      const res = await fetch('/api/bridge/tasks', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); setLiveTasks(data.items || []); }
    } catch { /* silent */ }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      await fetch('/api/bridge/tasks', { method: 'POST', headers: bridgeHeaders, body: JSON.stringify({ action: 'approve', taskId }) });
      setLiveTasks(prev => prev.map(t => (t.id === taskId || t.taskId === taskId) ? { ...t, status: 'approved' } : t));
    } catch { /* silent */ }
  };

  const handleRejectTask = async (taskId: string) => {
    try {
      await fetch('/api/bridge/tasks', { method: 'POST', headers: bridgeHeaders, body: JSON.stringify({ action: 'reject', taskId }) });
      setLiveTasks(prev => prev.map(t => (t.id === taskId || t.taskId === taskId) ? { ...t, status: 'rejected' } : t));
    } catch { /* silent */ }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    try {
      await fetch('/api/bridge/chat', { method: 'POST', headers: bridgeHeaders, body: JSON.stringify({ targetAgent: chatAgent, message: chatInput, sender: 'commander' }) });
      setChatMessages(prev => [{ sender: 'commander', targetAgent: chatAgent, message: chatInput, timestamp: new Date().toISOString() }, ...prev]);
      setChatInput('');
    } catch { /* silent */ }
  };


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

  /* ── fetch live agent data from status.json ── */
  useEffect(() => {
    fetch("/status.json", { cache: "no-store" })
      .then(r => r.json())
      .then((data: { agents?: { name: string; status: string; task: string }[] }) => {
        if (!data.agents) return;
        const merged = AGENTS.map(a => {
          const live = data.agents!.find(la => la.name === a.name);
          if (!live) return a;
          return {
            ...a,
            status: (live.status === "active" ? "active" : live.status === "done" ? "done" : "idle") as typeof a.status,
            activeTask: live.task || a.activeTask,
          };
        });
        setLiveAgents(merged);
      })
      .catch(() => { /* fallback to hardcoded */ });
  }, []);

  /* ── resolved agents: live data when available, fallback to static ── */
  const agents = liveAgents || AGENTS;

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
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const activeMissions = MISSIONS.filter((m) => m.status === "active").length;

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <main className="min-h-screen w-full relative overflow-x-hidden" style={{ background: '#0a0a0a', color: '#e5e5e5', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      <ParticleField variant="gold" theme="light" opacity={0.1} count={50} interactive connections />

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 0: HOLOGRAPHIC BACKGROUND SYSTEM
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Linear-style subtle dot grid background */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.4,
      }} />
      <div className="fixed z-0 pointer-events-none" style={{
        top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(124,58,237,0.04)', filter: 'blur(120px)', position: 'absolute',
      }} />
      <div className="fixed z-0 pointer-events-none" style={{
        bottom: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(59,130,246,0.03)', filter: 'blur(120px)', position: 'absolute',
      }} />

      {/* Clean light theme — no CRT scan lines */}

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 1: CONTENT
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-full">

        {/* ═══════ TOP NAV — MATCHING PARALLAX SITE (WHITE/GLASS) ═══════ */}
        <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/parallax-logo.jpg" alt="Parallax" style={{ width: 36, height: 44, objectFit: 'contain' }} />
              <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '0.1em', color: '#e5e5e5' }}>PARALLAX</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>|</span>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#888888' }}>COMMAND CENTER</span>
            </Link>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }} className="nav-desktop">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} style={{
                  fontSize: 13, fontWeight: 600, letterSpacing: '0.05em',
                  color: n.active ? '#e5e5e5' : '#888888', transition: 'color 150ms ease-in-out',
                }}>{n.label}</Link>
              ))}
            </div>
          </div>
        </nav>

        {/* ═══════ HERO SECTION — PARALLAX SITE STYLE ═══════ */}
        <section style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 24px 60px', position: 'relative' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 20, border: '1px solid #1e1e1e', marginBottom: 32, fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', color: '#888888' }}>
            MISSION CONTROL &middot; LIVE
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 16 }}>
            <span style={{ color: '#e5e5e5' }}>Command</span>{' '}
            <span className="gradient-text">Center.</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#888888', lineHeight: 1.6, maxWidth: 600, margin: '0 auto 24px' }}>
            Mission control for the Parallax ecosystem. 19 agents. 6 divisions. One coordinated operation.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#888888', fontSize: 12, fontWeight: 500 }}>
            <span style={{ fontFamily: 'monospace' }}>{time}</span>
            <span style={{ color: '#333' }}>|</span>
            <span style={{ fontFamily: 'monospace' }}>{dateStr}</span>
            <span style={{ color: '#333' }}>|</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>LIVE <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} /></span>
          </div>
        </section>

        {/* ═══════ SYSTEM STATUS STRIP ═══════ */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '12px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: '#e5e5e5', letterSpacing: '0.05em' }}>ALL SYSTEMS NOMINAL</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 14 }}>|</span>
              <span style={{ fontSize: 11, color: '#888888' }}><strong style={{ color: '#e5e5e5' }}>{activeAgents}</strong>/{agents.length} Agents</span>
              <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 14 }}>|</span>
              <span style={{ fontSize: 11, color: '#888888' }}><strong style={{ color: '#7c3aed' }}>{activeMissions}</strong> Active Missions</span>
              <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: 14 }}>|</span>
              <span style={{ fontSize: 11, color: '#888888' }}>Tasks <strong style={{ color: '#059669' }}>{doneT}</strong>/{totalT}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 200px', minWidth: 120 }}>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #7c3aed, #a855f7)', transition: 'width 1s ease' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#e5e5e5', fontFamily: 'monospace' }}>{pct}%</span>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          {/* ═══════ WHAT'S NEXT — #1 PRIORITY ═══════ */}
          <div style={{ marginBottom: 24 }}>
            <div className="heartbeat-btn" style={{ display: 'block', padding: '24px 28px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', transition: 'all 150ms ease-in-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, background: 'rgba(124,58,237,0.15)', color: '#a855f7', border: '1px solid rgba(124,58,237,0.3)' }}>
                    #1
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#888888' }}>
                      WHAT&apos;S NEXT
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', letterSpacing: '0.1em', color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4 }}>
                      CRITICAL
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-[#e5e5e5] leading-snug">
                    Quest flow UX polish + Firebase v2 deploy for METTLE
                  </div>
                  <div className="text-[10px] font-mono text-[#888888] mt-1">
                    Stripe live · Copyright filed · CI/CD deployed — now polish + scale
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
                    OPEN METTLE &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════ NOTIFICATIONS / INBOX ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(245,158,11,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b]"
                    style={{ boxShadow: "0 0 8px rgba(245,158,11,0.6)" }} />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#f59e0b] notif-ping" />
                </div>
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Notifications</h2>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(245,158,11,0.2), transparent)' }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {NOTIFICATIONS.map((n, i) => (
                <div
                  key={i}
                  className="relative p-4 flex items-center gap-3 group cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #1e1e1e',
                    borderRadius: 12,
                    borderLeft: `3px solid ${n.accent}`,
                    transition: 'all 150ms ease-in-out',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: `${n.accent}12`,
                      color: n.accent,
                      border: `1px solid ${n.accent}25`,
                    }}
                  >
                    {n.icon}
                  </div>
                  <span className="text-sm text-[#888888] group-hover:text-[#e5e5e5] leading-snug min-w-0" style={{ transition: 'color 150ms ease-in-out' }}>
                    {n.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ═══════ CRON MANAGEMENT ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(6,182,212,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#06b6d4]" style={{ boxShadow: '0 0 8px rgba(6,182,212,0.6)' }} />
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Cron Management</h2>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(6,182,212,0.2), transparent)' }} />
            </div>
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20 }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#e5e5e5]">{liveCrons.length} Active Crons</span>
                <button onClick={() => setCronModal(!cronModal)} className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 6, cursor: 'pointer' }}>
                  {cronModal ? 'Cancel' : '+ Add Cron'}
                </button>
              </div>
              {cronModal && (
                <div className="mb-4 p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {(['name', 'schedule', 'agent', 'task'] as const).map(field => (
                      <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)} value={cronForm[field]} onChange={e => setCronForm(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-md" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }} />
                    ))}
                  </div>
                  <button onClick={() => { handleCreateCron(cronForm.name, cronForm.schedule, cronForm.agent, cronForm.task); setCronForm({ name: '', schedule: '', agent: '', task: '' }); setCronModal(false); }}
                    className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 6, cursor: 'pointer' }}>
                    Create Cron
                  </button>
                </div>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {liveCrons.length === 0 && <div className="text-sm text-[#888888] text-center py-4">No crons loaded — data fetches on mount</div>}
                {liveCrons.map((cron, i) => (
                  <div key={cron.id || cron.cronId || i} className="flex items-center justify-between p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#e5e5e5] truncate">{cron.name || cron.label || 'Unnamed'}</div>
                      <div className="text-[10px] font-mono text-[#888888]">{cron.schedule || cron.cron || '—'} · {cron.agent || '—'}</div>
                    </div>
                    <button onClick={() => handleDeleteCron(cron.id || cron.cronId)} className="ml-2 px-2 py-1 text-[9px] font-mono uppercase" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, cursor: 'pointer' }}>
                      Del
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ TASK APPROVAL ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(139,92,246,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#8b5cf6]" style={{ boxShadow: '0 0 8px rgba(139,92,246,0.6)' }} />
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Task Approval</h2>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(139,92,246,0.2), transparent)' }} />
            </div>
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20 }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#e5e5e5]">{liveTasks.filter(t => t.status === 'pending').length} Pending · {liveTasks.length} Total</span>
                <button onClick={() => setTaskModal(!taskModal)} className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider" style={{ background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, cursor: 'pointer' }}>
                  {taskModal ? 'Cancel' : '+ New Task'}
                </button>
              </div>
              {taskModal && (
                <div className="mb-4 p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <input placeholder="Title" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-md" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }} />
                    <input placeholder="Assignee" value={taskForm.assignee} onChange={e => setTaskForm(p => ({ ...p, assignee: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-md" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }} />
                    <input placeholder="Description" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-md col-span-1 sm:col-span-2" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }} />
                    <select value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-md" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <button onClick={() => { handleCreateTask(taskForm.title, taskForm.description, taskForm.assignee, taskForm.priority); setTaskForm({ title: '', description: '', assignee: '', priority: 'medium' }); setTaskModal(false); }}
                    className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, cursor: 'pointer' }}>
                    Create Task
                  </button>
                </div>
              )}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {liveTasks.length === 0 && <div className="text-sm text-[#888888] text-center py-4">No tasks loaded — data fetches on mount</div>}
                {liveTasks.map((task, i) => {
                  const statusColor = task.status === 'approved' ? '#059669' : task.status === 'rejected' ? '#ef4444' : task.status === 'pending' ? '#f59e0b' : '#888888';
                  const prioColor = task.priority === 'critical' ? '#ef4444' : task.priority === 'high' ? '#f59e0b' : task.priority === 'medium' ? '#06b6d4' : '#888888';
                  return (
                    <div key={task.id || task.taskId || i} className="flex items-center justify-between p-3 gap-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-[#e5e5e5] truncate">{task.title || 'Untitled'}</span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${prioColor}15`, color: prioColor, border: `1px solid ${prioColor}30` }}>{(task.priority || 'med').toUpperCase()}</span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>{(task.status || 'unknown').toUpperCase()}</span>
                        </div>
                        <div className="text-[10px] text-[#888888]">{task.assignee || '—'}{task.description ? ` · ${task.description}` : ''}</div>
                      </div>
                      {(task.status === 'pending' || !task.status) && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => handleApproveTask(task.id || task.taskId)} className="px-2 py-1 text-[9px] font-mono uppercase" style={{ background: 'rgba(5,150,105,0.1)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 4, cursor: 'pointer' }}>OK</button>
                          <button onClick={() => handleRejectTask(task.id || task.taskId)} className="px-2 py-1 text-[9px] font-mono uppercase" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, cursor: 'pointer' }}>Rej</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══════ LIVE CHAT ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(52,211,153,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#34d399]" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.6)' }} />
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Live Chat</h2>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(52,211,153,0.2), transparent)' }} />
            </div>
            <div style={{ background: '#111111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20 }}>
              <div className="flex gap-2 mb-4">
                <select value={chatAgent} onChange={e => setChatAgent(e.target.value)} className="px-3 py-2 text-sm rounded-md flex-shrink-0" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }}>
                  {['atlas','shuri','vee','mercury','echo','simons','widow','proximon','aetherion','michael','prophets','selah','haven','ink','nova','kiyosaki','triage','themaestro','dr. strange'].map(a => (
                    <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
                  ))}
                </select>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }} placeholder="Message an agent..." className="flex-1 px-3 py-2 text-sm rounded-md" style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', color: '#e5e5e5', outline: 'none' }} />
                <button onClick={handleSendChat} className="px-4 py-2 text-[10px] font-mono uppercase tracking-wider flex-shrink-0" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, cursor: 'pointer' }}>Send</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {chatMessages.length === 0 && <div className="text-sm text-[#888888] text-center py-4">No messages yet — send one above</div>}
                {chatMessages.slice(0, 20).map((msg, i) => (
                  <div key={i} className="p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold" style={{ color: msg.sender === 'commander' ? '#34d399' : '#f59e0b' }}>{(msg.sender || 'system').toUpperCase()}</span>
                      {msg.targetAgent && <span className="text-[10px] text-[#888888]">→ {msg.targetAgent}</span>}
                      {msg.timestamp && <span className="text-[9px] font-mono text-[#555]">{new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                    </div>
                    <div className="text-sm text-[#e5e5e5]">{msg.message || msg.text || ''}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════ NAVIGATION CARDS — SUB-PAGES ═══════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: "AGENTS", href: "/command-center/agents", icon: "\u25C8", accent: "#7c3aed", desc: `${activeAgents} active \u00B7 ${agents.length} total`, sub: "Usage, skills, tools, config" },
              { label: "MISSIONS", href: "/command-center/missions", icon: "\u2726", accent: "#C9A84C", desc: `${activeMissions} active \u00B7 ${doneT}/${totalT} tasks`, sub: "Projects, progress, checklists" },
              { label: "VITALS", href: "/command-center/vitals", icon: "\u2665", accent: "#10b981", desc: "Health \u00B7 Spiritual \u00B7 Weather", sub: "Steps, water, sleep, scripture" },
              { label: "REVENUE", href: "/command-center/revenue", icon: "\u25C9", accent: "#d97706", desc: "Pipeline \u00B7 Opportunities", sub: "Sales, pricing, deals" },
              { label: "ACTIVITY", href: "/command-center/activity", icon: "\u25CF", accent: "#2563eb", desc: `${((bridgeData as any)?.activity?.items || LOG).length} recent events`, sub: "Feed, schedule, history" },
              { label: "TERMINAL", href: "/command-center/terminal", icon: ">_", accent: "#0f172a", desc: "Remote shell", sub: "Run commands on your Mac" },
              { label: "TASKS", href: "/command-center/tasks", icon: "\u2610", accent: "#8b5cf6", desc: "Kanban board", sub: "Backlog, in progress, review, done" },
              { label: "CALENDAR", href: "/command-center/calendar", icon: "\u2737", accent: "#06b6d4", desc: "Cron schedule", sub: "Agent schedules, events, reminders" },
              { label: "PROJECTS", href: "/command-center/projects", icon: "\u25B6", accent: "#10b981", desc: "7 tracked", sub: "Progress, milestones, blockers" },
              { label: "MEMORY", href: "/command-center/memory", icon: "\u25CE", accent: "#f59e0b", desc: "Agent journal", sub: "Daily logs, search, timeline" },
              { label: "DOCS", href: "/command-center/docs", icon: "\u2261", accent: "#3b82f6", desc: "Doc viewer", sub: "Plans, SOPs, configs, reports" },
              { label: "OFFICE", href: "/command-center/office", icon: "\u25A3", accent: "#a855f7", desc: "3D Office", sub: "Isometric workspace, live status" },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group relative p-6 flex flex-col justify-between min-h-[160px]"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 12, borderLeft: `3px solid ${card.accent}`, transition: 'all 150ms ease-in-out' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, background: `${card.accent}10`, color: card.accent, border: `1px solid ${card.accent}30` }}>
                      {card.icon}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.12em', color: '#e5e5e5' }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e5e5', marginBottom: 4 }}>{card.desc}</div>
                  <div style={{ fontSize: 12, color: '#888888', fontWeight: 500 }}>{card.sub}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <span className="group-hover:translate-x-1" style={{ fontSize: 14, fontWeight: 700, color: card.accent, transition: 'transform 150ms ease-in-out' }}>&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
          {/* ═══════ FOOTER ═══════ */}
          <footer className="text-center py-8" style={{ borderTop: '1px solid #1e1e1e' }}>
            <div className="text-[9px] font-mono text-[#888888] tracking-[0.4em] uppercase">
              COMMAND CENTER v6 // PARALLAX OPERATIONS // SIGNAL FIRST // {new Date().getFullYear()}
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
  Atlas: "/agents/atlas-3d.png",
  TheMAESTRO: "/agents/themaestro-3d.png",
  SIMONS: "/agents/simons-3d.png",
  "Dr. Strange": "/agents/drstrange-3d.png",
  SHURI: "/agents/shuri-3d.png",
  Widow: "/agents/widow-3d.png",
  PROXIMON: "/agents/proximon-3d.png",
  Vee: "/agents/vee-3d.png",
  Aetherion: "/agents/aetherion-3d.png",
  MICHAEL: "/agents/michael-3d.png",
  Prophets: "/agents/prophets-3d.png",
  SELAH: "/agents/selah-3d.png",
  MERCURY: "/agents/mercury-3d.png",
  ECHO: "/agents/echo-3d.png",
  HAVEN: "/agents/haven-3d.png",
  INK: "/agents/ink-3d.png",
  NOVA: "/agents/nova-3d.png",
  KIYOSAKI: "/agents/kiyosaki-3d.png",
  TRIAGE: "/agents/triage-3d.png",
};
const AGENT_AVATARS: Record<string, React.ReactNode> = Object.fromEntries(
  Object.entries(AGENT_IMG).map(([name, src]) => [
    name,
    <img key={name} src={src} alt={name} className="w-full h-full object-contain" style={{ imageRendering: "auto" }} />,
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
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#0a0a0a] ${
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
            className="text-sm font-bold leading-tight"
            style={{ color: isHovered ? agent.color : "#e5e5e5", transition: 'color 150ms ease-in-out' }}
          >
            {agent.name}
          </div>
          <div className="text-[10px] font-mono mt-0.5" style={{ color: '#888888' }}>
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
            background: "#141414",
            border: `1px solid #1e1e1e`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
            backdropFilter: "blur(16px)",
            zIndex: 50,
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: agent.color, background: `${agent.color}10`, border: `1px solid ${agent.color}18` }}>
              {agent.model}
            </span>
            <span className="text-[9px] font-mono" style={{ color: isActive ? "#00ff88" : "#888888" }}>
              {isActive ? "● ONLINE" : "○ SLEEP"}
            </span>
          </div>
          <div className="text-[10px] text-[#888888] font-mono leading-relaxed mb-2">{agent.desc}</div>
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
      className="glass-card relative p-5 group transition-all duration-300"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] mb-3" style={{ color: '#888888' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span
          className="text-3xl font-black tabular-nums leading-none"
          style={{ color }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[10px] font-mono text-[#888888]">{unit}</span>
        )}
      </div>

      {/* Mini progress ring */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPct}%`,
              background: `linear-gradient(90deg, ${color}90, ${color})`,
              transition: 'all 500ms ease-in-out',
            }}
          />
        </div>
        <span className="text-[8px] font-mono tabular-nums" style={{ color: '#888888' }}>
          {fillPct}%
        </span>
      </div>

      <div className="flex gap-1.5">
        <button
          onClick={onDec}
          className="flex-1 h-8 text-xs font-mono flex items-center justify-center rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            color,
            border: '1px solid #1e1e1e',
            borderRadius: 8,
            transition: 'all 150ms ease-in-out',
          }}
        >
          &minus;
        </button>
        <button
          onClick={onInc}
          className="flex-1 h-8 text-xs font-mono flex items-center justify-center rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            color,
            border: '1px solid #1e1e1e',
            borderRadius: 8,
            transition: 'all 150ms ease-in-out',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
