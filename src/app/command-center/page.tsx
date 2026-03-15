"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";
import agentMetricsData from "@/data/agent-metrics.json";

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
    name: "PROXIMON", model: "DeepSeek V3.2", role: "Systems Architect",
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
    name: "MERCURY", model: "DeepSeek V3.2", role: "Sales & Revenue Ops",
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

/* ── AGENT → PROJECT ASSIGNMENTS ─────────────────────────────────────────────────── */
const AGENT_PROJECTS: Record<string, { project: string; role: string; status: "active" | "idle" | "done" }[]> = {
  Atlas: [
    { project: "METTLE", role: "Lead architect — beta launch with Saint Andrew's", status: "active" },
    { project: "Command Center", role: "Live backend + bridge sync + task board", status: "active" },
    { project: "Agent Ecosystem", role: "Mailbox relay, delegation, 19-agent coordination", status: "active" },
  ],
  TheMAESTRO: [
    { project: "Music Pipeline", role: "Production + sound design", status: "idle" },
    { project: "The Baba Studio", role: "Audio division creative lead", status: "idle" },
  ],
  SIMONS: [
    { project: "METTLE", role: "Growth analytics + data insights", status: "active" },
    { project: "Revenue Optimization", role: "Pricing models + market analysis", status: "idle" },
  ],
  "Dr. Strange": [
    { project: "METTLE", role: "Attrition prediction + scenario modeling", status: "active" },
    { project: "Business Strategy", role: "Strategic forecasting", status: "idle" },
  ],
  SHURI: [
    { project: "METTLE", role: "UI/UX + rapid prototyping", status: "active" },
    { project: "Command Center", role: "Frontend live data wiring", status: "active" },
    { project: "Parallax Publish", role: "3-platform social publishing", status: "active" },
  ],
  Widow: [
    { project: "ClawGuard Pro", role: "Security scanning ($299-$1499)", status: "active" },
    { project: "System Security", role: "Vulnerability monitoring", status: "active" },
  ],
  PROXIMON: [
    { project: "Command Center", role: "Systems architecture", status: "active" },
    { project: "METTLE", role: "Scaling architecture", status: "active" },
  ],
  Vee: [
    { project: "Content Pipeline", role: "Daily content lead + brand voice", status: "active" },
    { project: "Ramiche Studio", role: "Client acquisition + positioning", status: "active" },
  ],
  Aetherion: [
    { project: "Creative Direction", role: "Master image + animation design", status: "active" },
    { project: "Brand Systems", role: "Visual identity across all brands", status: "active" },
  ],
  MICHAEL: [
    { project: "METTLE", role: "Swim coaching intelligence + race strategy", status: "active" },
    { project: "Saint Andrew's Aquatics", role: "240+ athlete beta program", status: "active" },
  ],
  Prophets: [
    { project: "Daily Scripture", role: "7 AM verse + prayer via Telegram", status: "active" },
    { project: "Life Guidance", role: "Faith-rooted wisdom", status: "active" },
  ],
  SELAH: [
    { project: "METTLE", role: "Sport psychology + mental performance", status: "active" },
    { project: "Team Wellness", role: "Coach/athlete wellness", status: "active" },
  ],
  MERCURY: [
    { project: "Ramiche Studio", role: "Client acquisition + deals", status: "active" },
    { project: "METTLE", role: "Sales strategy + pricing", status: "active" },
  ],
  ECHO: [
    { project: "Content Pipeline", role: "Social engagement + community", status: "active" },
    { project: "Galactik Antics", role: "@galactikantics IG (16K followers)", status: "active" },
  ],
  HAVEN: [
    { project: "METTLE", role: "Coach/parent onboarding + support", status: "active" },
    { project: "Customer Support", role: "Ticket system + FAQ", status: "idle" },
  ],
  INK: [
    { project: "Content Pipeline", role: "Copy + marketing (23 tactics)", status: "active" },
    { project: "Ramiche Studio", role: "Client content + case studies", status: "active" },
  ],
  NOVA: [
    { project: "YOLO Builds", role: "1 AM overnight prototype builder", status: "active" },
    { project: "Galactik Antics", role: "Physical merch prototyping", status: "idle" },
  ],
  KIYOSAKI: [
    { project: "METTLE", role: "Financial model + pricing", status: "done" },
    { project: "Wealth Architecture", role: "Investment analysis + cashflow", status: "idle" },
  ],
  TRIAGE: [
    { project: "System Health", role: "Debugging + failure tracing", status: "active" },
    { project: "METTLE", role: "Code review + performance audit", status: "active" },
  ],
  THEMIS: [
    { project: "Governance", role: "Rule enforcement + token efficiency", status: "active" },
    { project: "Agent Audit", role: "Cron health + agent dashboard", status: "active" },
  ],
};

/* ── PROJECTS / MISSIONS ───────────────────────────────────────────────────────────── */
const MISSIONS = [
  {
    name: "METTLE", accent: "#C9A84C", status: "active" as const,
    desc: "Gamified athlete SaaS — BETA with Saint Andrew\'s Aquatics (240+ athletes)", priority: "CRITICAL",
    tasks: [
      { t: "Three-portal architecture (Coach/Athlete/Parent)", done: true },
      { t: "Game engine + level system (Rookie → Legend)", done: true },
      { t: "Meet management (Hy-Tek parser, seeds, heat/lane, results)", done: true },
      { t: "Stripe billing — 3 tiers ($149/$349/$549)", done: true },
      { t: "CI/CD pipeline + security scanning (0 errors)", done: true },
      { t: "ByteByteGo: 52/52 items implemented", done: true },
      { t: "Copyright filed (Feb 17, 2026)", done: true },
      { t: "Beta invite system + CSV import + setup wizard", done: true },
      { t: "Patent filing at USPTO ($65 micro entity)", done: false },
      { t: "Trademark: Class 9+41+42", done: false },
    ],
    link: { label: "Open App", href: "/apex-athlete" },
  },
  {
    name: "Command Center", accent: "#7c3aed", status: "active" as const,
    desc: "Live operations dashboard — bridge API + real-time sync", priority: "HIGH",
    tasks: [
      { t: "Bridge API (agent status, crons, links, activity)", done: true },
      { t: "Frontend wired to bridge with 60s polling", done: true },
      { t: "Bridge sync script (iMac → Firestore)", done: true },
      { t: "Chat relay to agents", done: true },
      { t: "Task approval API", done: true },
      { t: "Cron CRUD API", done: true },
      { t: "Live data rendering (replace hardcoded)", done: true },
      { t: "Office page redesign", done: false },
    ],
    link: { label: "Command Center", href: "/command-center" },
  },
  {
    name: "Parallax Site", accent: "#a855f7", status: "active" as const,
    desc: "Agent marketplace + Claude Skills — 19 routes LIVE", priority: "HIGH",
    tasks: [
      { t: "White-label system (115 files, 7,554 LOC, 20 agents)", done: true },
      { t: "Agent marketplace + payment-to-delivery e2e", done: true },
      { t: "/forge creative tools hub (6 tools)", done: true },
      { t: "Setup service verified e2e", done: true },
      { t: "Linear restyle (agents page)", done: true },
      { t: "Remaining pages audit + polish", done: false },
    ],
    link: { label: "Parallax Site", href: "https://parallax-site-ashen.vercel.app" },
  },
  {
    name: "Parallax Publish", accent: "#38bdf8", status: "active" as const,
    desc: "Social media publishing — 3 platforms LIVE (Twitter, Bluesky, LinkedIn)", priority: "HIGH",
    tasks: [
      { t: "Twitter OAuth2 + posting", done: true },
      { t: "Bluesky AT Protocol + posting", done: true },
      { t: "LinkedIn OAuth2 + posting", done: true },
      { t: "6-tab UI (Compose, History, Calendar, Accounts, Analytics, AI Writer)", done: true },
      { t: "Instagram OAuth (blocked on Facebook Developer Portal)", done: false },
      { t: "Scheduling backend (SQLite → hosted DB)", done: false },
      { t: "Facebook/Threads/TikTok/YouTube", done: false },
    ],
    link: { label: "Parallax Publish", href: "https://parallax-publish.vercel.app" },
  },
  {
    name: "Ramiche Studio", accent: "#e879f9", status: "active" as const,
    desc: "Creative services — $400/$1,500/$3,000/$6,000+", priority: "HIGH",
    tasks: [
      { t: "Landing page + inquiry form + checkout", done: true },
      { t: "4-platform DM scripts + email sequences", done: true },
      { t: "UGC video scripts + SOPs + onboarding runbook", done: true },
      { t: "Niche outreach kit (skincare, coffee, supplements, pet)", done: true },
      { t: "Stripe integration (needs STRIPE_SECRET_KEY)", done: false },
      { t: "First UGC video filmed", done: false },
      { t: "First 5 warm DMs sent", done: false },
    ],
    link: { label: "Studio", href: "/studio" },
  },
  {
    name: "Galactik Antics", accent: "#00f0ff", status: "active" as const,
    desc: "AI art + merch — @galactikantics on IG", priority: "MED",
    tasks: [
      { t: "Product lineup confirmed (13 cases, 5 posters, 5 tees)", done: true },
      { t: "Pre-launch content (4 briefs, 7-day calendar)", done: true },
      { t: "Shopify store + API credentials (blocked on Ramon)", done: false },
      { t: "Upload products + variants + pricing", done: false },
    ],
    link: null,
  },
  {
    name: "ClawGuard Pro", accent: "#22d3ee", status: "active" as const,
    desc: "Security scanner — $299/$799/$1,499 — LIVE", priority: "MED",
    tasks: [
      { t: "Scanner live + Stripe wired", done: true },
      { t: "GitHub integration", done: true },
      { t: "Customer onboarding flow", done: false },
    ],
    link: { label: "ClawGuard", href: "https://parallax-site-ashen.vercel.app/clawguard" },
  },
];

/* ── OPPORTUNITIES ───────────────────────────────────────────────────────────────── */
const OPPS = [
  { title: "Ramiche Studio Sprint", rev: "$400", tag: "LIVE", accent: "#e879f9", desc: "48h Creative Direction Sprint" },
  { title: "Ramiche Studio Starter", rev: "$1,500", tag: "LIVE", accent: "#a855f7", desc: "Full brand kit + strategy" },
  { title: "Ramiche Studio Pro", rev: "$3,000", tag: "LIVE", accent: "#7c3aed", desc: "Complete brand transformation" },
  { title: "Ramiche Studio Elite", rev: "$6,000+", tag: "LIVE", accent: "#C9A84C", desc: "Enterprise-level creative ops" },
  { title: "ClawGuard Pro", rev: "$299-$1,499", tag: "LIVE", accent: "#22d3ee", desc: "Security scanning as a service" },
  { title: "Claude Skills", rev: "$149-$499", tag: "LIVE", accent: "#a855f7", desc: "Agent skills marketplace" },
  { title: "AI Agent Setup", rev: "$1-3K", tag: "SOON", accent: "#00f0ff", desc: "OpenClaw-style full setup" },
];

/* ── QUICK LINKS ─────────────────────────────────────────────────────────────────── */
const LINKS = [
  { label: "METTLE", href: "https://ramiche-site.vercel.app/apex-athlete/coach", icon: "M", accent: "#C9A84C" },
  { label: "METTLE Demo", href: "https://ramiche-site.vercel.app/apex-athlete/demo", icon: "MD", accent: "#f59e0b" },
  { label: "Parallax Site", href: "https://parallax-site-ashen.vercel.app", icon: "P", accent: "#a855f7" },
  { label: "Parallax Publish", href: "https://parallax-publish.vercel.app", icon: "PP", accent: "#38bdf8" },
  { label: "ClawGuard Pro", href: "https://parallax-site-ashen.vercel.app/clawguard", icon: "CG", accent: "#22d3ee" },
  { label: "YOLO Builds", href: "/command-center/yolo", icon: "Y", accent: "#f59e0b" },
  { label: "Vercel", href: "https://vercel.com/dashboard", icon: "V", accent: "#ffffff" },
  { label: "GitHub", href: "https://github.com/ramicheAi", icon: "GH", accent: "#737373" },
  { label: "Firebase", href: "https://console.firebase.google.com/project/apex-athlete-73755", icon: "FB", accent: "#f59e0b" },
  { label: "Shopify", href: "https://admin.shopify.com", icon: "S", accent: "#96bf48" },
  { label: "GoMotion", href: "https://www.gomotionapp.com", icon: "G", accent: "#34d399" },
];

/* ── ACTIVITY LOG ────────────────────────────────────────────────────────────────── */
const LOG = [
  { time: "Mar 5", text: "Chat listener built — Command Center messages now reach agents", color: "#7c3aed" },
  { time: "Mar 5", text: "Bridge sync live — 21 agents, 39 crons syncing to Firestore every 60s", color: "#059669" },
  { time: "Mar 5", text: "Command Center backend wired — task approval, cron CRUD, chat relay APIs deployed", color: "#7c3aed" },
  { time: "Mar 5", text: "Daily content posting schedule built — weekly rotation, VEE/INK/ECHO pipeline", color: "#a855f7" },
  { time: "Mar 5", text: "Inter-agent communication system — directory, escalation protocol, comms log", color: "#00f0ff" },
  { time: "Mar 5", text: "Smart cron system — scheduling playbook, audit trail, budget caps", color: "#f59e0b" },
  { time: "Mar 4", text: "SHURI: Agents page + CC main page Linear restyle deployed", color: "#e879f9" },
  { time: "Mar 3", text: "Parallax Publish — 3 platforms live (Twitter, Bluesky, LinkedIn)", color: "#38bdf8" },
  { time: "Mar 2", text: "Service worker ban enforced — self-destruct SW deployed across all apps", color: "#ef4444" },
  { time: "Mar 1", text: "Ramiche Studio client acquisition kit COMPLETE — all assets built", color: "#e879f9" },
  { time: "Feb 28", text: "Context+ MCP server installed — AST parsing, semantic search, blast radius", color: "#22d3ee" },
  { time: "Feb 27", text: "Parallax Publish launched — Twitter + Bluesky + LinkedIn OAuth2", color: "#38bdf8" },
  { time: "Feb 24", text: "ByteByteGo: 52/52 topics fully implemented across ecosystem", color: "#00f0ff" },
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
  const [readingPlan, setReadingPlan] = useState<{book: string; chapter: number; progress: number}>({ book: "Proverbs", chapter: 1, progress: 3 });
  const [prayerFocus, setPrayerFocus] = useState<string>(() => {
    const focuses = ["Discipline & Focus", "God's Vision for My Life", "Financial Wisdom", "Spiritual Growth", "Health & Strength", "Gratitude & Praise", "Family & Relationships"];
    const dayIndex = new Date().getDay();
    return focuses[dayIndex];
  });
  const [spiritualStreak, setSpiritualStreak] = useState<number>(0);
  const [devotionalCheckedIn, setDevotionalCheckedIn] = useState<boolean>(false);
  const agentNetRef = useRef<HTMLCanvasElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  /* ── live bridge data (auto-refresh every 15s) ── */
  const [bridgeData, setBridgeData] = useState<Record<string, unknown> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchBridge = useCallback(async () => {
    try {
      const res = await fetch("/api/bridge?type=all", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBridgeData(data);
        setLastUpdated(new Date());
        const displayAgents = data?.agents?.display;
        if (Array.isArray(displayAgents) && displayAgents.length > 0) {
          setLiveAgents(displayAgents);
        }
        if (data?.missions?.items && Array.isArray(data.missions.items) && data.missions.items.length > 0) {
          setLiveMissions(data.missions.items);
        }
        if (data?.schedule?.items && Array.isArray(data.schedule.items) && data.schedule.items.length > 0) {
          setLiveSchedule(data.schedule.items);
        }
        if (data?.notifications?.items && Array.isArray(data.notifications.items)) {
          setLiveNotifications(data.notifications.items);
        }
        if (data?.opportunities?.items && Array.isArray(data.opportunities.items) && data.opportunities.items.length > 0) {
          setLiveOpps(data.opportunities.items);
        }
        if (data?.activity?.items && Array.isArray(data.activity.items) && data.activity.items.length > 0) {
          setLiveActivity(data.activity.items);
        }
        if (data?.links?.items && Array.isArray(data.links.items) && data.links.items.length > 0) {
          setLiveLinks(data.links.items);
        }
      }
    } catch { /* silent — fallback to hardcoded */ }
  }, []);
  useEffect(() => {
    fetchBridge();
    const id = setInterval(fetchBridge, 15000);
    return () => clearInterval(id);
  }, [fetchBridge]);

  /* ── live data from bridge ── */
  const [liveMissions, setLiveMissions] = useState<any[] | null>(null);
  const [liveSchedule, setLiveSchedule] = useState<any[] | null>(null);
  const [liveNotifications, setLiveNotifications] = useState<any[] | null>(null);
  const [liveOpps, setLiveOpps] = useState<any[] | null>(null);
  const [liveActivity, setLiveActivity] = useState<any[] | null>(null);
  const [liveLinks, setLiveLinks] = useState<any[] | null>(null);

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

  /* ── fetch crons (mount + every 15s) ── */
  const fetchCrons = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/crons', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); setLiveCrons(data.items || []); }
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    fetchCrons();
    const id = setInterval(fetchCrons, 15000);
    return () => clearInterval(id);
  }, [fetchCrons]);

  /* ── fetch tasks (mount + every 15s) ── */
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/bridge/tasks', { cache: 'no-store' });
      if (res.ok) { const data = await res.json(); setLiveTasks(data.items || []); }
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    fetchTasks();
    const id = setInterval(fetchTasks, 15000);
    return () => clearInterval(id);
  }, [fetchTasks]);

  /* ── fetch chat (mount + every 30s) ── */
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const res = await fetch('/api/bridge/chat', { cache: 'no-store' });
        if (res.ok) { const data = await res.json(); setChatMessages(data.items || data.messages || []); }
      } catch { /* silent */ }
    };
    fetchChat();
    const id = setInterval(fetchChat, 10000);
    return () => clearInterval(id);
  }, []);

  /* ── CRUD handlers ── */
  const bridgeHeaders = { 'Content-Type': 'application/json', 'x-bridge-secret': process.env.NEXT_PUBLIC_BRIDGE_SECRET || '' };

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

  /* ── agent network SVG lines canvas ── */
  useEffect(() => {
    try {
    const isMobile = window.innerWidth < 768;
    if (isMobile) return; // Skip agent network canvas on mobile
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
    } catch { /* canvas/window not available */ }
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
    try {
      navigator.clipboard.writeText(`"${verse.text}" \u2014 ${verse.ref}`);
    } catch { /* clipboard not available */ }
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

  /* ── fetch live agent data from status.json (mount + every 15s) ── */
  useEffect(() => {
    const fetchStatus = () => {
      fetch("/api/command-center/agents", { cache: "no-store" })
        .then(r => r.json())
        .then((data: { agents?: { id: string; name: string; model: string; role: string; status: string; skills?: string[] }[] }) => {
          if (!data.agents) return;
          const merged = AGENTS.map(a => {
            const live = data.agents!.find(la => la.name.toLowerCase() === a.name.toLowerCase());
            if (!live) return a;
            return {
              ...a,
              model: live.model || a.model,
              status: (live.status === "active" ? "active" : live.status === "done" ? "done" : "idle") as typeof a.status,
            };
          });
          setLiveAgents(merged);
        })
        .catch(() => { /* fallback to hardcoded */ });
    };
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
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
                  height: `${8 + (i * 1.3) % 10}px`,
                  left: `${5 + i * 8}%`,
                  background: "linear-gradient(180deg, rgba(0,240,255,0.5), rgba(0,240,255,0.1))",
                  animation: `rainDrop ${0.5 + (i * 0.037) % 0.4}s linear infinite`,
                  animationDelay: `${(i * 0.047) % 0.5}s`,
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

  /* ── resolved data: live first, fallback to hardcoded ── */
  const missions = liveMissions || MISSIONS;
  const schedule = liveSchedule || SCHEDULE;
  const notifications = liveNotifications || NOTIFICATIONS;
  const opps = liveOpps || OPPS;
  const activityLog = liveActivity || LOG;
  const links = liveLinks || LINKS;

  /* ── computed ── */
  const totalT = missions.reduce((s: number, p: any) => s + (p.totalTasks ?? (Array.isArray(p.tasks) ? p.tasks.length : 0)), 0);
  const doneT = missions.reduce((s: number, p: any) => s + (p.completedTasks ?? (Array.isArray(p.tasks) ? p.tasks.filter((t: any) => t.done).length : 0)), 0);
  const pct = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const activeMissions = missions.filter((m: any) => m.status === "active").length;

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: '#0a0a0a', color: '#e5e5e5', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      <ParticleField variant="gold" theme="light" opacity={0.1} count={20} />

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 0: HOLOGRAPHIC BACKGROUND SYSTEM
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Linear-style subtle dot grid background */}
      <div className="absolute inset-0 z-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.4,
      }} />
      <div className="absolute z-0 pointer-events-none" style={{
        top: '10%', left: '5%', width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(124,58,237,0.04)', filter: 'blur(120px)',
      }} />
      <div className="absolute z-0 pointer-events-none" style={{
        bottom: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(59,130,246,0.03)', filter: 'blur(120px)',
      }} />

      {/* Clean light theme — no CRT scan lines */}

      {/* ═══════════════════════════════════════════════════════════════════
          LAYER 1: CONTENT
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 w-full">

        {/* Top nav removed — navigation lives in sidebar now */}

        {/* ═══════ HERO SECTION — PARALLAX SITE STYLE ═══════ */}
        <section style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px 60px', position: 'relative' }}>
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

          {/* ═══════ WHAT'S NEXT — #1 PRIORITY (DYNAMIC) ═══════ */}
          {(() => {
            const topMission = missions.find((m: any) => m.priority === "CRITICAL" || m.priority === 1) || missions[0];
            const mName = topMission?.name || "METTLE";
            const mDesc = topMission?.desc || topMission?.description || "";
            const mAccent = topMission?.accent || "#C9A84C";
            const rawLink = topMission?.link;
            const mLink = typeof rawLink === 'string' ? rawLink : rawLink?.href || "/apex-athlete";
            const mPriority = topMission?.priority || "HIGH";
            const mDone = topMission?.completedTasks ?? (topMission?.tasks?.filter((t: any) => t.done).length ?? 0);
            const mTotal = topMission?.totalTasks ?? (topMission?.tasks?.length ?? 0);
            return (
            <div style={{ marginBottom: 24 }}>
              <div className="heartbeat-btn" style={{ display: 'block', padding: '24px 28px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', transition: 'all 150ms ease-in-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, background: `${mAccent}20`, color: mAccent, border: `1px solid ${mAccent}40` }}>
                      #1
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: '#888888' }}>
                        WHAT&apos;S NEXT
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', letterSpacing: '0.1em', color: mPriority === 'CRITICAL' || mPriority === 1 ? '#ef4444' : '#f59e0b', background: mPriority === 'CRITICAL' || mPriority === 1 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${mPriority === 'CRITICAL' || mPriority === 1 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 4 }}>
                        {typeof mPriority === 'number' ? (mPriority === 1 ? 'CRITICAL' : 'HIGH') : mPriority}
                      </span>
                    </div>
                    <div className="text-base sm:text-lg font-bold text-[#e5e5e5] leading-snug">
                      {mName}
                    </div>
                    <div className="text-[10px] font-mono text-[#888888] mt-1">
                      {mDesc} {mTotal > 0 ? `· ${mDone}/${mTotal} tasks` : ''}
                    </div>
                  </div>
                  {mLink && (
                  <div className="hidden sm:block flex-shrink-0">
                    <Link
                      href={mLink}
                      className="game-btn px-5 py-2.5 text-[9px] font-mono uppercase tracking-wider transition-all hover:scale-[1.03]"
                      style={{
                        background: `${mAccent}18`,
                        color: mAccent,
                        border: `1px solid ${mAccent}40`,
                      }}
                    >
                      OPEN {mName} &rarr;
                    </Link>
                  </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

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
              {notifications.map((n: any, i: number) => (
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

          {/* ═══════ QUICK LINKS ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(201,168,76,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#C9A84C]" style={{ boxShadow: '0 0 8px rgba(201,168,76,0.6)' }} />
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Quick Links</h2>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(201,168,76,0.2), transparent)' }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {LINKS.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target={link.href.startsWith('/') ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    borderColor: `${link.accent}20`,
                    background: `${link.accent}06`,
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: `${link.accent}15`, color: link.accent }}
                  >
                    {link.icon}
                  </div>
                  <span className="text-xs font-medium text-white/70 truncate">{link.label}</span>
                </a>
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
                <span className="text-sm font-semibold text-[#e5e5e5]">{liveCrons.length > 0 ? liveCrons.length : SCHEDULE.length} Active Crons</span>
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
                {liveCrons.length === 0 && SCHEDULE.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', borderRadius: 8 }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#e5e5e5] truncate">{s.event}</div>
                      <div className="text-[10px] font-mono" style={{ color: s.accent }}>{s.time}</div>
                    </div>
                  </div>
                ))}
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

          {/* ═══════ AGENT PERFORMANCE METRICS ═══════ */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(168,85,247,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#a855f7]" style={{ boxShadow: '0 0 8px rgba(168,85,247,0.6)' }} />
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Agent Performance</h2>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(168,85,247,0.2), transparent)' }} />
            </div>

            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              {(() => {
                const m = agentMetricsData.agents;
                const activeCount = m.filter(a => a.status === 'active').length;
                const idleCount = m.filter(a => a.status === 'idle').length;
                const offlineCount = m.filter(a => a.status === 'offline').length;
                const totalTasks = m.reduce((s, a) => s + a.tasksCompletedToday, 0);
                const avgResp = (m.filter(a => a.status === 'active').reduce((s, a) => s + a.avgResponseTime, 0) / (activeCount || 1)).toFixed(1);
                return (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.15)' }}>
                      <div className="w-2 h-2 rounded-full bg-[#00ff88]" style={{ boxShadow: '0 0 6px rgba(0,255,136,0.5)' }} />
                      <span className="text-[11px] font-mono text-[#00ff88]">{activeCount} Active</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.15)' }}>
                      <div className="w-2 h-2 rounded-full bg-[#facc15]" />
                      <span className="text-[11px] font-mono text-[#facc15]">{idleCount} Idle</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
                      <div className="w-2 h-2 rounded-full bg-[#555]" />
                      <span className="text-[11px] font-mono text-[#555]">{offlineCount} Offline</span>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                      <span className="text-[11px] font-mono text-[#888]">{totalTasks} tasks today</span>
                      <span className="text-[11px] font-mono text-[#888]">~{avgResp}s avg</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Agent grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {agentMetricsData.agents.map((agent) => {
                const statusColor = agent.status === 'active' ? '#00ff88' : agent.status === 'idle' ? '#facc15' : '#555';
                const statusLabel = agent.status === 'active' ? 'ACTIVE' : agent.status === 'idle' ? 'IDLE' : 'OFFLINE';
                const lastActiveDate = new Date(agent.lastActive);
                const now = new Date();
                const minsAgo = Math.round((now.getTime() - lastActiveDate.getTime()) / 60000);
                const lastActiveStr = minsAgo < 60 ? `${minsAgo}m ago` : minsAgo < 1440 ? `${Math.round(minsAgo / 60)}h ago` : `${Math.round(minsAgo / 1440)}d ago`;

                return (
                  <div
                    key={agent.name}
                    className="relative p-4 rounded-xl transition-all duration-300 group hover:scale-[1.02]"
                    style={{
                      background: '#111111',
                      border: `1px solid ${agent.status === 'active' ? agent.color + '25' : '#1e1e1e'}`,
                      boxShadow: agent.status === 'active' ? `0 0 20px ${agent.color}08` : 'none',
                    }}
                  >
                    {/* Status + name header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${agent.status === 'active' ? 'animate-pulse' : ''}`}
                        style={{
                          background: statusColor,
                          boxShadow: agent.status === 'active' ? `0 0 8px ${statusColor}80` : 'none',
                        }}
                      />
                      <span className="text-sm font-bold truncate" style={{ color: agent.color }}>{agent.name}</span>
                    </div>

                    {/* Model tag */}
                    <div className="mb-3">
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: '#888', background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e' }}>
                        {agent.model}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#666]">Tasks</span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: agent.tasksCompletedToday > 0 ? '#e5e5e5' : '#555' }}>
                          {agent.tasksCompletedToday}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#666]">Resp</span>
                        <span className="text-sm font-mono tabular-nums" style={{ color: agent.avgResponseTime < 3 ? '#34d399' : agent.avgResponseTime < 5 ? '#facc15' : '#f97316' }}>
                          {agent.avgResponseTime}s
                        </span>
                      </div>
                    </div>

                    {/* Footer: status + last active */}
                    <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid #1e1e1e' }}>
                      <span className="text-[8px] font-mono tracking-wider" style={{ color: statusColor }}>{statusLabel}</span>
                      <span className="text-[8px] font-mono text-[#555]">{lastActiveStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation moved to sidebar */}
          {/* ═══════ FOOTER ═══════ */}
          <footer className="text-center py-8" style={{ borderTop: '1px solid #1e1e1e' }}>
            <div className="text-[9px] font-mono text-[#888888] tracking-[0.4em] uppercase">
              COMMAND CENTER v6 // PARALLAX OPERATIONS // SIGNAL FIRST // {new Date().getFullYear()}
            </div>
          </footer>

        </div>
      </div>
    </div>
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
