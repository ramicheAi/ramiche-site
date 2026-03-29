/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @next/next/no-img-element */
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
    name: "Atlas", model: "Opus 4.6", role: "Operations Lead",
    status: "active" as const, color: "#C9A84C", icon: "🧭",
    desc: "Carries the weight — orchestrates 18 agents, ships products, memory, mission control",
    connections: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    credits: { used: 4800, limit: 5000 },
    activeTask: "YOLO build fix + Command Center update + Power Challenge email wiring",
  },
  {
    name: "TheMAESTRO", model: "qwen3:14b", role: "Music Production AI",
    status: "idle" as const, color: "#f59e0b", icon: "🎵",
    desc: "Ye + Quincy + Babyface — influence-based creative direction, sound design",
    connections: [0, 7],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Ramiche music pipeline",
  },
  {
    name: "SIMONS", model: "Sonnet 4.5", role: "Algorithmic Analysis",
    status: "idle" as const, color: "#22d3ee", icon: "📊",
    desc: "Jim Simons — pattern recognition, statistical arbitrage, pricing models",
    connections: [0, 4],
    credits: { used: 620, limit: 5000 },
    activeTask: "DELIVERED: Pricing analysis + marketing playbook + ClawGuard scanner",
  },
  {
    name: "Dr. Strange", model: "Sonnet 4.5", role: "Forecasting & Decisions",
    status: "idle" as const, color: "#a855f7", icon: "🔮",
    desc: "Scenario analysis, probable outcomes, strategic foresight, risk assessment",
    connections: [0, 2, 6],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Next strategic planning cycle",
  },
  {
    name: "SHURI", model: "Sonnet 4.5", role: "Creative Coding",
    status: "idle" as const, color: "#34d399", icon: "⚡",
    desc: "Prototyping, design systems, tech innovation, rapid builds",
    connections: [0, 7],
    credits: { used: 1800, limit: 5000 },
    activeTask: "DELIVERED: 18+ PRs — portals, meet mgmt, invite system, brand assets",
  },
  {
    name: "Widow", model: "qwen3:14b", role: "Cybersecurity & Intel",
    status: "idle" as const, color: "#ef4444", icon: "🕷",
    desc: "Read-only security scanner. Threat monitoring, risk analysis, security audits",
    connections: [0, 2],
    credits: { used: 480, limit: 5000 },
    activeTask: "DELIVERED: ClawGuard Pro + CSP headers + Firestore rules + API security",
  },
  {
    name: "PROXIMON", model: "Sonnet 4.5", role: "Systems Architect",
    status: "active" as const, color: "#f97316", icon: "🏗",
    desc: "Jobs + Musk + Bezos — first-principles, flywheels, compounding systems",
    connections: [0, 3, 4],
    credits: { used: 880, limit: 5000 },
    activeTask: "YOLO overnight builds + architecture reviews",
  },
  {
    name: "Vee", model: "Kimi K2.5", role: "Brand & Marketing",
    status: "active" as const, color: "#ec4899", icon: "📣",
    desc: "Gary Vee + Seth Godin + Hormozi + Blakely + Virgil — makes brands impossible to ignore",
    connections: [0, 1, 6],
    credits: { used: 950, limit: 5000 },
    activeTask: "Brand strategy + X/LinkedIn positioning + METTLE brand v5",
  },
  {
    name: "Aetherion", model: "Gemini 3.1 Pro", role: "Visual & Brand Design",
    status: "idle" as const, color: "#818cf8", icon: "🌀",
    desc: "Visuals, animation, brand identity — the creative eye of the operation",
    connections: [0, 3, 6],
    credits: { used: 200, limit: 5000 },
    activeTask: "DELIVERED: Inter-agent workflow chains + white-label architecture",
  },
  {
    name: "MICHAEL", model: "qwen3:14b", role: "Swim Training AI",
    status: "active" as const, color: "#06b6d4", icon: "🏊",
    desc: "Phelps + Kobe + MJ + Bolt — swim mastery, mamba mentality, competitive fire",
    connections: [0, 3],
    credits: { used: 510, limit: 5000 },
    activeTask: "METTLE coaching intelligence + race strategy + athlete motivation",
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
    name: "SELAH", model: "qwen3:14b", role: "Wellness & Sport Psychology",
    status: "idle" as const, color: "#10b981", icon: "🧘",
    desc: "Robbins + Dispenza + Maté + Greene + Bashar — therapy, peak performance, mental transformation",
    connections: [0, 9, 10],
    credits: { used: 190, limit: 5000 },
    activeTask: "DELIVERED: Wellness check-in + journal + meditation in athlete portal",
  },
  {
    name: "MERCURY", model: "Sonnet 4.5", role: "Sales & Revenue Ops",
    status: "idle" as const, color: "#fbbf24", icon: "💰",
    desc: "Razor-sharp dealmaker — reads people and numbers simultaneously. Architects wins.",
    connections: [0, 7],
    credits: { used: 520, limit: 5000 },
    activeTask: "Upwork proposals + Stripe checkout + ClawGuard sales",
  },
  {
    name: "ECHO", model: "qwen3:14b", role: "Community & Social",
    status: "active" as const, color: "#38bdf8", icon: "🌊",
    desc: "The heartbeat of the community — turns strangers into superfans with genuine warmth",
    connections: [0, 7],
    credits: { used: 540, limit: 5000 },
    activeTask: "Social posting + community engagement + NEURAL RADIO",
  },
  {
    name: "HAVEN", model: "Sonnet 4.5", role: "Customer Success",
    status: "idle" as const, color: "#4ade80", icon: "🛡",
    desc: "Infinitely patient with a detective's eye — treats every ticket like a puzzle worth solving",
    connections: [0],
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: First customer onboarding",
  },
  {
    name: "INK", model: "Sonnet 4.5", role: "Content Creator",
    status: "active" as const, color: "#c084fc", icon: "✒",
    desc: "Prolific voice-chameleon — technical blog at dawn, viral tweet at noon, cinematic script by sunset",
    connections: [0, 7],
    credits: { used: 650, limit: 5000 },
    activeTask: "Content calendar + Building in Public + daily social posts",
  },
  {
    name: "NOVA", model: "Sonnet 4.5", role: "Overnight Builder",
    status: "active" as const, color: "#14b8a6", icon: "🔧",
    desc: "YOLO overnight prototype builder — ships functional apps while you sleep",
    connections: [0, 4],
    credits: { used: 300, limit: 5000 },
    activeTask: "YOLO builds — G-Code Surgeon, Agent Arena + 44 builds shipped",
  },
  {
    name: "KIYOSAKI", model: "Sonnet 4.5", role: "Financial Intelligence",
    status: "idle" as const, color: "#fcd34d", icon: "💎",
    desc: "ORACLE — 8 financial minds. Wealth architecture + business plan + patent strategy.",
    connections: [0, 2, 3],
    credits: { used: 720, limit: 5000 },
    activeTask: "DELIVERED: METTLE business plan v2 + tiered pricing + provisional patent",
  },
  {
    name: "TRIAGE", model: "Sonnet 4.5", role: "System Doctor",
    status: "active" as const, color: "#f472b6", icon: "🩺",
    desc: "Best SWE-bench score in the squad (77.2). Debugging, failure tracing, diagnostics.",
    connections: [0, 4],
    credits: { used: 100, limit: 5000 },
    activeTask: "YOLO builds + system diagnostics + EKG System Vitals",
  },
  {
    name: "THEMIS", model: "Sonnet 4.5", role: "Legal & Compliance",
    status: "idle" as const, color: "#8b5cf6", icon: "⚖",
    desc: "IP protection, compliance frameworks, contract review, legal strategy — the law is the shield",
    connections: [0, 5],
    credits: { used: 0, limit: 5000 },
    activeTask: "Patent filing support + trademark Class 9+41+42",
  },
];

/* ── AGENT → PROJECT ASSIGNMENTS ─────────────────────────────────────────────────── */
const AGENT_PROJECTS: Record<string, { project: string; role: string; status: "active" | "idle" | "done" }[]> = {
  Atlas: [
    { project: "METTLE", role: "Lead architect + game engine", status: "active" },
    { project: "Command Center", role: "Live backend + bridge sync", status: "active" },
    { project: "Parallax Site", role: "Marketplace + deployment", status: "active" },
  ],
  TheMAESTRO: [
    { project: "Music Pipeline", role: "Production direction + sound design", status: "idle" },
    { project: "Parallax", role: "Artist A&R + creative guidance", status: "idle" },
  ],
  SIMONS: [
    { project: "Revenue Optimization", role: "Pricing models + market analysis", status: "idle" },
    { project: "METTLE", role: "Growth analytics", status: "idle" },
  ],
  "Dr. Strange": [
    { project: "METTLE", role: "Attrition prediction + forecasting", status: "idle" },
    { project: "Business Strategy", role: "Scenario planning + risk analysis", status: "idle" },
  ],
  SHURI: [
    { project: "Command Center", role: "Office page redesign", status: "active" },
    { project: "METTLE", role: "UI/UX + rapid prototyping", status: "active" },
    { project: "Parallax Site", role: "Linear restyle", status: "done" },
  ],
  Widow: [
    { project: "ClawGuard Pro", role: "Security scanning + threat detection", status: "active" },
    { project: "Competitive Intel", role: "Market monitoring + threat scan", status: "idle" },
  ],
  PROXIMON: [
    { project: "Command Center", role: "Systems architecture", status: "active" },
    { project: "METTLE", role: "Scaling architecture", status: "idle" },
  ],
  Vee: [
    { project: "Content Pipeline", role: "Daily content lead + brand voice", status: "active" },
    { project: "Ramiche Studio", role: "Client acquisition + positioning", status: "active" },
  ],
  Aetherion: [
    { project: "Multi-Agent Architecture", role: "Agent collaboration patterns", status: "active" },
    { project: "Infrastructure", role: "Cross-project integration", status: "idle" },
  ],
  MICHAEL: [
    { project: "METTLE", role: "Swim coaching intelligence + athlete motivation", status: "active" },
    { project: "Saint Andrew\'s Aquatics", role: "Training analysis + race strategy", status: "active" },
  ],
  Prophets: [
    { project: "Daily Scripture", role: "7 AM verse + prayer via Telegram", status: "active" },
    { project: "Life Guidance", role: "Faith-rooted wisdom", status: "active" },
  ],
  SELAH: [
    { project: "METTLE", role: "Sport psychology + mental performance", status: "active" },
    { project: "Team Wellness", role: "Coach/athlete wellness + burnout prevention", status: "active" },
  ],
  MERCURY: [
    { project: "Ramiche Studio", role: "Client acquisition + deals", status: "idle" },
    { project: "Revenue Ops", role: "Pipeline + pricing strategy", status: "idle" },
  ],
  ECHO: [
    { project: "Content Pipeline", role: "Social engagement + community", status: "active" },
    { project: "Galactik Antics", role: "@galactikantics IG content", status: "active" },
  ],
  HAVEN: [
    { project: "Customer Support", role: "Ticket system + onboarding", status: "idle" },
    { project: "METTLE", role: "Coach/parent support flows", status: "idle" },
  ],
  INK: [
    { project: "Content Pipeline", role: "Blog + social copy + scripts", status: "active" },
    { project: "Ramiche Studio", role: "Client content + case studies", status: "idle" },
  ],
  NOVA: [
    { project: "YOLO Builds", role: "Overnight prototype builder", status: "active" },
    { project: "Galactik Antics", role: "Physical merch prototyping", status: "idle" },
  ],
  KIYOSAKI: [
    { project: "METTLE", role: "Financial model + pricing strategy", status: "done" },
    { project: "Wealth Architecture", role: "Investment analysis + cashflow", status: "idle" },
  ],
  TRIAGE: [
    { project: "System Health", role: "Debugging + diagnostics + failure tracing", status: "idle" },
    { project: "METTLE", role: "Code review + performance audit", status: "idle" },
  ],
};

/* ── HARDCODED FALLBACKS REMOVED — all data now comes from bridge API ── */


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
    if (typeof window === "undefined") return { book: "Proverbs", chapter: 1, progress: 3 };
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
    if (typeof window === "undefined") return 0;
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
    if (typeof window === "undefined") return false;
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

  /* ── live bridge data (auto-refresh every 15s) ── */
  const [bridgeData, setBridgeData] = useState<Record<string, unknown> | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");
  const [bridgeLoaded, setBridgeLoaded] = useState(false);
  useEffect(() => {
    const fetchBridge = async () => {
      try {
        const res = await fetch("/api/bridge?type=all", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setBridgeData(data);
          setBridgeLoaded(true);
          setLastSynced(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
          // Update agent status from bridge display array (pre-formatted by sync script)
          const displayAgents = data?.agents?.display;
          if (Array.isArray(displayAgents) && displayAgents.length > 0) {
            setLiveAgents(displayAgents);
          }
          // Populate other live data sections
          if (data?.missions?.items && Array.isArray(data.missions.items) && data.missions.items.length > 0) {
            setLiveMissions(data.missions.items);
          }
          if (data?.schedule?.items && Array.isArray(data.schedule.items) && data.schedule.items.length > 0) {
            setLiveSchedule(data.schedule.items);
          }
          if (data?.notifications?.items && Array.isArray(data.notifications.items) && data.notifications.items.length > 0) {
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
          if (data?.agentActivity?.items && Array.isArray(data.agentActivity.items) && data.agentActivity.items.length > 0) {
            setLiveAgentActivity(data.agentActivity.items);
          }
        }
      } catch { /* silent — fallback to hardcoded */ }
    };
    fetchBridge();
    const id = setInterval(fetchBridge, 15000);
    return () => clearInterval(id);
  }, []);

  /* ── live data from bridge ── */
  const [liveMissions, setLiveMissions] = useState<any[] | null>(null);
  const [liveSchedule, setLiveSchedule] = useState<any[] | null>(null);
  const [liveNotifications, setLiveNotifications] = useState<any[] | null>(null);
  const [liveOpps, setLiveOpps] = useState<any[] | null>(null);
  const [liveActivity, setLiveActivity] = useState<any[] | null>(null);
  const [liveLinks, setLiveLinks] = useState<any[] | null>(null);
  const [liveAgentActivity, setLiveAgentActivity] = useState<any[] | null>(null);

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

  /* ── REAL-TIME SSE STREAM ── */
  const [sseConnected, setSseConnected] = useState(false);
  const [liveVitals, setLiveVitals] = useState<any>(null);
  const [liveCommits, setLiveCommits] = useState<any[]>([]);
  const [liveForge, setLiveForge] = useState<any[]>([]);
  const [liveMemoryLog, setLiveMemoryLog] = useState<any>(null);
  const [liveSessionCount, setLiveSessionCount] = useState(0);
  const [sseLastPing, setSseLastPing] = useState("");
  const [liveYoloBuilds, setLiveYoloBuilds] = useState<any[]>([]);
  const [liveCronHistory, setLiveCronHistory] = useState<any[]>([]);
  const [liveAgentDir, setLiveAgentDir] = useState<any>(null);
  const [liveCronList, setLiveCronList] = useState<any[]>([]);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource("/api/command-center/sse");

      es.addEventListener("snapshot", (e) => {
        const data = JSON.parse(e.data);
        setLiveVitals(data.vitals);
        setLiveCommits(data.commits ?? []);
        setLiveForge(data.forge ?? []);
        setLiveMemoryLog(data.memory);
        setLiveSessionCount(data.activeSessions ?? 0);
        setLiveYoloBuilds(data.yoloBuilds ?? []);
        setLiveCronHistory(data.cronHistory ?? []);
        if (data.agents) setLiveAgentDir(data.agents);
        if (data.crons) setLiveCronList(Array.isArray(data.crons) ? data.crons : []);
        setSseConnected(true);
        setSseLastPing(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      });

      es.addEventListener("vitals", (e) => {
        const data = JSON.parse(e.data);
        setLiveVitals(data.vitals);
        if (typeof data.activeSessions === "number") setLiveSessionCount(data.activeSessions);
        setSseLastPing(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      });

      es.addEventListener("commits", (e) => {
        const data = JSON.parse(e.data);
        setLiveCommits(data.commits ?? []);
      });

      es.addEventListener("forge", (e) => {
        const data = JSON.parse(e.data);
        setLiveForge(data.forge ?? []);
      });

      es.addEventListener("memory", (e) => {
        const data = JSON.parse(e.data);
        setLiveMemoryLog(data.memory);
      });

      es.addEventListener("yolo", (e) => {
        const data = JSON.parse(e.data);
        setLiveYoloBuilds(data.yoloBuilds ?? []);
      });

      es.addEventListener("cronHistory", (e) => {
        const data = JSON.parse(e.data);
        setLiveCronHistory(data.cronHistory ?? []);
      });

      es.addEventListener("agents", (e) => {
        const data = JSON.parse(e.data);
        if (data.agents) setLiveAgentDir(data.agents);
        if (data.crons) setLiveCronList(Array.isArray(data.crons) ? data.crons : []);
      });

      es.addEventListener("heartbeat", () => {
        setSseLastPing(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      });

      es.onerror = () => {
        setSseConnected(false);
        es?.close();
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => { es?.close(); clearTimeout(retryTimer); };
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

  /* ── resolved agents: live first, hardcoded while loading, empty if bridge confirmed no data ── */
  const agents = liveAgents || (bridgeLoaded ? [] : AGENTS);

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

  /* ── resolved data: live first, empty if bridge has no data ── */
  const missions = liveMissions || [];
  const schedule = liveSchedule || [];
  const notifications = liveNotifications || [];
  const opps = liveOpps || [];
  const activityLog = liveActivity || [];
  const links = liveLinks || [];

  /* ── computed ── */
   
  const totalT = missions.reduce((s: number, p: Record<string, any>) => s + (p.totalTasks || p.tasks?.length || 0), 0);
   
  const doneT = missions.reduce((s: number, p: Record<string, any>) => s + (p.completedTasks || p.tasks?.filter((t: any) => t.done).length || 0), 0);
  const pct = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;
  const activeAgents = agents.filter((a) => a.status === "active").length;
   
  const activeMissions = missions.filter((m: Record<string, any>) => m.status === "active").length;

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

        {/* Nav handled by Sidebar layout — no duplicate nav needed */}

        {/* ═══════ HERO SECTION — PARALLAX SITE STYLE ═══════ */}
        <section style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 24px 60px', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, border: '1px solid #1e1e1e', marginBottom: 32, fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', color: '#888888' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: sseConnected ? '#22c55e' : (lastSynced ? '#f59e0b' : '#ef4444'), boxShadow: sseConnected ? '0 0 8px #22c55e' : (lastSynced ? '0 0 8px #f59e0b' : '0 0 8px #ef4444'), animation: 'pulse 2s ease-in-out infinite' }} />
            MISSION CONTROL &middot; {sseConnected ? 'LIVE STREAM' : 'POLLING'}{sseLastPing ? ` · ${sseLastPing}` : (lastSynced ? ` · ${lastSynced}` : '')}
            <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', background: bridgeLoaded ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: bridgeLoaded ? '#22c55e' : '#f59e0b', border: `1px solid ${bridgeLoaded ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
              {bridgeLoaded ? 'LIVE' : 'CACHED'}
            </span>
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

        {/* ═══════ REAL-TIME TELEMETRY STRIP ═══════ */}
        {liveVitals && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
              {[
                { label: 'CPU LOAD', value: liveVitals.cpu?.load || 'N/A', accent: '#7c3aed' },
                { label: 'MEMORY', value: `${liveVitals.memory?.percent || '?'}`, accent: '#22d3ee' },
                { label: 'DISK', value: `${liveVitals.disk?.percent || '?'}`, accent: '#f59e0b' },
                { label: 'SESSIONS', value: `${liveSessionCount}`, accent: '#059669' },
                { label: 'FORGE', value: `${liveForge.length}/20`, accent: '#a855f7' },
                { label: 'COMMITS (24h)', value: `${liveCommits.length}`, accent: '#38bdf8' },
              ].map((m) => (
                <div key={m.label} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: '#666', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.accent, fontFamily: 'monospace' }}>{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ LIVE GIT FEED ═══════ */}
        {liveCommits.length > 0 && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', animation: 'pulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888' }}>LIVE GIT FEED</span>
                </div>
                <span style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>{sseLastPing}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {liveCommits.slice(0, 8).map((c, i) => (
                  <div key={`${c.hash}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: 600, flexShrink: 0 }}>{c.hash}</span>
                    <span style={{ color: '#22d3ee', fontWeight: 600, flexShrink: 0, minWidth: 80 }}>{c.author}</span>
                    <span style={{ color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                    <span style={{ marginLeft: 'auto', color: '#555', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>
                      {c.date ? new Date(c.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ FORGE REFLECTIONS (TODAY) ═══════ */}
        {liveForge.length > 0 && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>🔥</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888' }}>FORGE REFLECTIONS — TODAY</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#a855f7', fontFamily: 'monospace' }}>{liveForge.length}/20</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {liveForge.map((f) => (
                  <div key={f.agent} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 4, textTransform: 'uppercase' }}>{f.agent}</div>
                    <div style={{ fontSize: 10, color: '#777', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>{f.snippet?.slice(0, 120)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ DAILY MEMORY LOG ═══════ */}
        {liveMemoryLog && liveMemoryLog.entries?.length > 0 && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>📝</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888' }}>DAILY MEMORY LOG — {liveMemoryLog.date}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {liveMemoryLog.entries.slice(0, 6).map((e: any, i: number) => (
                  <div key={i} style={{ fontSize: 11, color: '#aaa', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                    <span style={{ fontWeight: 600, color: '#e5e5e5' }}>{e.heading}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ YOLO BUILDS (LIVE) ═══════ */}
        {liveYoloBuilds.length > 0 && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>🚀</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888' }}>YOLO BUILDS</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>{liveYoloBuilds.length} recent</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {liveYoloBuilds.map((b: any) => (
                  <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                    <span style={{ fontFamily: 'monospace', color: '#f59e0b', fontWeight: 600, flexShrink: 0, fontSize: 10 }}>YOLO</span>
                    <span style={{ color: '#e5e5e5', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    <span style={{ marginLeft: 'auto', color: '#555', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>
                      {b.date ? new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ CRON HISTORY (LIVE) ═══════ */}
        {liveCronHistory.length > 0 && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>⏰</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888' }}>CRON HISTORY</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {liveCronHistory.map((h: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: h.status === 'ok' || h.result === 'ok' ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                    <span style={{ color: '#aaa', fontFamily: 'monospace', flexShrink: 0, minWidth: 60, fontSize: 10 }}>{h.time || h.timestamp || ''}</span>
                    <span style={{ color: '#e5e5e5', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name || h.job || h.id || 'cron'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ LIVE AGENT DIRECTORY (FROM SSE) ═══════ */}
        {liveAgentDir?.agents?.length > 0 && (
          <div style={{ maxWidth: 1200, margin: '0 auto 16px', padding: '0 24px' }}>
            <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>🤖</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#888' }}>AGENT DIRECTORY (LIVE)</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>{liveAgentDir.agents.length} agents</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {liveAgentDir.agents.slice(0, 20).map((a: any) => (
                  <div key={a.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#e5e5e5', textTransform: 'uppercase' }}>{a.id}</div>
                      <div style={{ fontSize: 9, color: '#777', fontFamily: 'monospace' }}>{a.model} · {a.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>

          {/* ═══════ WHAT'S NEXT — #1 PRIORITY (DYNAMIC) ═══════ */}
          {missions.length === 0 ? (
            <div style={{ marginBottom: 24, padding: '24px 28px', borderRadius: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e' }}>
              <span style={{ fontSize: 13, color: '#555' }}>No missions loaded — waiting for bridge sync</span>
            </div>
          ) : (() => {
            const topMission = missions.find((m: any) => m.priority === "CRITICAL" || m.priority === 1) || missions[0];
            const mName = topMission?.name || "METTLE";
            const mDesc = topMission?.desc || topMission?.description || "";
            const mAccent = topMission?.accent || "#C9A84C";
            const rawLink = topMission?.link;
            const mLink = typeof rawLink === 'string' ? rawLink : (rawLink && typeof rawLink === 'object' && 'href' in rawLink ? (rawLink as any).href : null);
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
              {notifications.length === 0 && (
                <span style={{ fontSize: 13, color: '#555', padding: '12px 0' }}>No notifications — waiting for bridge sync</span>
              )}
              {notifications.map((n: any, i: number) => {
                const nAccent = n.accent || '#888888';
                return (
                <div
                  key={i}
                  className="relative p-4 flex items-center gap-3 group cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #1e1e1e',
                    borderRadius: 12,
                    borderLeft: `3px solid ${nAccent}`,
                    transition: 'all 150ms ease-in-out',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: `${nAccent}12`,
                      color: nAccent,
                      border: `1px solid ${nAccent}25`,
                    }}
                  >
                    {n.icon || '\u25C8'}
                  </div>
                  <span className="text-sm text-[#888888] group-hover:text-[#e5e5e5] leading-snug min-w-0" style={{ transition: 'color 150ms ease-in-out' }}>
                    {n.text || ''}
                  </span>
                </div>
                );
              })}
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
              { label: "ACTIVITY", href: "/command-center/activity", icon: "\u25CF", accent: "#2563eb", desc: `${activityLog.length} recent events`, sub: "Feed, schedule, history" },
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
          {/* ═══════ AGENT ACTIVITY FEED ═══════ */}
          {liveAgentActivity && liveAgentActivity.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, rgba(34,211,238,0.2), transparent)' }} />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#22d3ee]" style={{ boxShadow: '0 0 8px rgba(34,211,238,0.6)', animation: 'pulse 2s ease-in-out infinite' }} />
                <h2 className="text-xs tracking-[0.25em] uppercase text-[#888888] font-medium">Agent Activity Feed</h2>
                <span className="text-[9px] font-mono text-[#22d3ee]">{liveAgentActivity.length} entries</span>
              </div>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, rgba(34,211,238,0.2), transparent)' }} />
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e1e1e', padding: 16 }}>
              {liveAgentActivity.slice(0, 40).map((entry: any, i: number) => {
                const agentMatch = agents.find((a: any) => a.name?.toLowerCase().replace(/[\s.]/g, '') === entry.agent?.toLowerCase().replace(/[\s.]/g, '') || a.key === entry.agent);
                const agentColor = agentMatch?.color || '#888888';
                const agentIcon = agentMatch?.icon || '🤖';
                const agentLabel = agentMatch?.name || entry.agent;
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 39 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: `${agentColor}15`, border: `1px solid ${agentColor}30` }}>
                      {agentIcon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: agentColor }}>{agentLabel}</span>
                        {entry.date && <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#555' }}>{entry.date}{entry.time ? ` ${entry.time}` : ''}</span>}
                        {entry.source === 'scratch' && <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>THINKING</span>}
                        {entry.source === 'intel' && <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontWeight: 600 }}>INTEL</span>}
                        {entry.source === 'heartbeat' && <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600 }}>HEARTBEAT</span>}
                        {entry.source === 'identity' && <span style={{ fontSize: 8, padding: '1px 6px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', color: '#a855f7', fontWeight: 600 }}>IDENTITY</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#ccc', fontWeight: 500, lineHeight: 1.4 }}>{entry.title}</div>
                      {entry.body && <div style={{ fontSize: 10, color: '#666', marginTop: 4, lineHeight: 1.4, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>{entry.body.slice(0, 200)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {links.length === 0 && (
                <span style={{ fontSize: 13, color: '#555', padding: '12px 0' }}>No links — waiting for bridge sync</span>
              )}
              {links.map((link: any, i: number) => {
                const lAccent = link.accent || '#888888';
                const lHref = link.href || '#';
                return (
                <a
                  key={i}
                  href={lHref}
                  target={lHref.startsWith('http') ? '_blank' : undefined}
                  rel={lHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="group relative p-4 flex flex-col items-center gap-2 text-center"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid #1e1e1e',
                    borderRadius: 12,
                    transition: 'all 150ms ease-in-out',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black"
                    style={{
                      background: `${lAccent}12`,
                      color: lAccent,
                      border: `1px solid ${lAccent}30`,
                    }}
                  >
                    {link.icon || '?'}
                  </div>
                  <span className="text-[11px] font-semibold text-[#888888] group-hover:text-[#e5e5e5]" style={{ transition: 'color 150ms ease-in-out' }}>
                    {link.label || ''}
                  </span>
                </a>
                );
              })}
            </div>
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
  const credits = agent.credits || { used: 0, limit: 5000 };
  const creditPct = credits.limit > 0 ? Math.round((credits.used / credits.limit) * 100) : 0;

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
