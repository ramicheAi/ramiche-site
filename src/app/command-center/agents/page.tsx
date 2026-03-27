"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   AGENT MANAGEMENT — Focused sub-page of Command Center
   View, configure, and manage all 19 agents
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Agent Data ─────────────────────────────────────────────────────────────── */
interface AgentSkill {
  name: string;
  enabled: boolean;
  description: string;
}

interface AgentTool {
  name: string;
  enabled: boolean;
}

interface Agent {
  name: string;
  model: string;
  role: string;
  status: "active" | "idle" | "done";
  color: string;
  desc: string;
  avatar: string;
  credits: { used: number; limit: number };
  activeTask: string;
  skills: AgentSkill[];
  tools: AgentTool[];
  stats: { tasksCompleted: number; tokensUsed: string; avgResponseTime: string; uptime: string };
}

const FALLBACK_AGENTS: Agent[] = [
  {
    name: "Atlas", model: "Opus 4.6", role: "Operations Lead",
    status: "active", color: "#C9A84C", avatar: "/agents/atlas-3d.png",
    desc: "Carries the weight — orchestrates 18 agents, ships products, memory, mission control",
    credits: { used: 4800, limit: 5000 },
    activeTask: "Command Center upgrade + Parallax Publish build",
    skills: [
      { name: "coding-agent", enabled: true, description: "Delegate coding tasks to sub-agents" },
      { name: "github", enabled: true, description: "GitHub CLI operations" },
      { name: "weather", enabled: true, description: "Weather forecasts" },
      { name: "email", enabled: true, description: "Email management" },
      { name: "apple-calendar", enabled: true, description: "Calendar integration" },
      { name: "bear-notes", enabled: true, description: "Note management" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "edit", enabled: true }, { name: "exec", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
      { name: "browser", enabled: true }, { name: "memory_search", enabled: true },
      { name: "tts", enabled: true }, { name: "cron", enabled: true },
    ],
    stats: { tasksCompleted: 347, tokensUsed: "2.4M", avgResponseTime: "3.2s", uptime: "99.8%" },
  },
  {
    name: "TheMAESTRO", model: "DeepSeek V3.2", role: "Music Production AI",
    status: "idle", color: "#f59e0b", avatar: "/agents/themaestro-3d.png",
    desc: "Ye + Quincy + Babyface — influence-based creative direction, sound design",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Ramiche music pipeline",
    skills: [
      { name: "ai-music-generation", enabled: true, description: "Generate AI music" },
      { name: "ai-music-prompts", enabled: true, description: "Music prompt templates" },
      { name: "elevenlabs-music", enabled: true, description: "ElevenLabs music generation" },
      { name: "music-cog", enabled: true, description: "Original music creation" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "exec", enabled: true }, { name: "web_search", enabled: true },
      { name: "tts", enabled: true },
    ],
    stats: { tasksCompleted: 12, tokensUsed: "180K", avgResponseTime: "4.1s", uptime: "95.2%" },
  },
  {
    name: "SIMONS", model: "DeepSeek V3.2", role: "Algorithmic Analysis",
    status: "done", color: "#22d3ee", avatar: "/agents/simons-3d.png",
    desc: "Jim Simons — pattern recognition, statistical arbitrage, pricing models",
    credits: { used: 620, limit: 5000 },
    activeTask: "DELIVERED: Pricing analysis + marketing playbook",
    skills: [
      { name: "intellectia-stock-forecast", enabled: true, description: "Stock analysis" },
      { name: "ga4-analytics", enabled: true, description: "Google Analytics" },
      { name: "data-visualization", enabled: true, description: "Charts & graphs" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "exec", enabled: true }, { name: "web_search", enabled: true },
      { name: "web_fetch", enabled: true },
    ],
    stats: { tasksCompleted: 28, tokensUsed: "420K", avgResponseTime: "2.8s", uptime: "97.1%" },
  },
  {
    name: "Dr. Strange", model: "DeepSeek V3.2", role: "Forecasting & Decisions",
    status: "idle", color: "#a855f7", avatar: "/agents/drstrange-3d.png",
    desc: "Scenario analysis, probable outcomes, strategic foresight, risk assessment",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Next strategic planning cycle",
    skills: [
      { name: "competitive-analysis", enabled: true, description: "Competitor deep-dive" },
      { name: "business-plan", enabled: true, description: "Business planning" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
    ],
    stats: { tasksCompleted: 8, tokensUsed: "95K", avgResponseTime: "5.2s", uptime: "92.0%" },
  },
  {
    name: "SHURI", model: "DeepSeek V3.2", role: "Creative Coding",
    status: "done", color: "#34d399", avatar: "/agents/shuri-3d.png",
    desc: "Prototyping, design systems, tech innovation, rapid builds",
    credits: { used: 1800, limit: 5000 },
    activeTask: "DELIVERED: 18+ PRs — portals, meet mgmt, invite system",
    skills: [
      { name: "coding-agent", enabled: true, description: "Code delegation" },
      { name: "github", enabled: true, description: "GitHub operations" },
      { name: "figma", enabled: true, description: "Figma design analysis" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "edit", enabled: true }, { name: "exec", enabled: true },
      { name: "web_search", enabled: true },
    ],
    stats: { tasksCompleted: 156, tokensUsed: "1.8M", avgResponseTime: "2.5s", uptime: "98.5%" },
  },
  {
    name: "Widow", model: "Haiku 4.5", role: "Cybersecurity & Intel",
    status: "done", color: "#ef4444", avatar: "/agents/widow-3d.png",
    desc: "Threat monitoring, risk analysis, data intelligence, security audits",
    credits: { used: 480, limit: 5000 },
    activeTask: "DELIVERED: ClawGuard Pro + CSP headers + Firestore rules",
    skills: [
      { name: "healthcheck", enabled: true, description: "Security hardening" },
      { name: "dns-networking", enabled: true, description: "Network diagnostics" },
      { name: "container-debug", enabled: true, description: "Container debugging" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "exec", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
    ],
    stats: { tasksCompleted: 42, tokensUsed: "310K", avgResponseTime: "1.8s", uptime: "99.2%" },
  },
  {
    name: "PROXIMON", model: "Gemini 3.0 Pro", role: "Systems Architect",
    status: "done", color: "#f97316", avatar: "/agents/proximon-3d.png",
    desc: "Jobs + Musk + Bezos — first-principles, flywheels, compounding systems",
    credits: { used: 880, limit: 5000 },
    activeTask: "DELIVERED: Event sourcing + BFF pattern + DR plan",
    skills: [
      { name: "perf-profiler", enabled: true, description: "Performance optimization" },
      { name: "log-analyzer", enabled: true, description: "Log analysis" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "edit", enabled: true }, { name: "exec", enabled: true },
      { name: "web_search", enabled: true },
    ],
    stats: { tasksCompleted: 64, tokensUsed: "720K", avgResponseTime: "3.8s", uptime: "97.5%" },
  },
  {
    name: "Vee", model: "Kimi K2.5", role: "Brand & Marketing",
    status: "active", color: "#ec4899", avatar: "/agents/vee-3d.png",
    desc: "Gary Vee + Seth Godin + Hormozi — makes brands impossible to ignore",
    credits: { used: 950, limit: 5000 },
    activeTask: "15-strategy conversion playbook + METTLE brand consulting",
    skills: [
      { name: "marketing-mode", enabled: true, description: "Full marketing suite" },
      { name: "marketing-strategy-pmm", enabled: true, description: "Product marketing" },
      { name: "brand-analyzer", enabled: true, description: "Brand analysis" },
      { name: "content-quality-auditor", enabled: true, description: "Content audit" },
      { name: "linkedin-automator", enabled: true, description: "LinkedIn automation" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
      { name: "browser", enabled: true },
    ],
    stats: { tasksCompleted: 89, tokensUsed: "950K", avgResponseTime: "4.5s", uptime: "96.8%" },
  },
  {
    name: "Aetherion", model: "Gemini 3.0 Pro", role: "Meta-Architect",
    status: "done", color: "#818cf8", avatar: "/agents/aetherion-3d.png",
    desc: "The Architect of Architects — patterns, emergence, meta-systems",
    credits: { used: 200, limit: 5000 },
    activeTask: "DELIVERED: Inter-agent workflow chains + white-label architecture",
    skills: [
      { name: "skill-creator", enabled: true, description: "Create agent skills" },
      { name: "coding-agent", enabled: true, description: "Code delegation" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "edit", enabled: true }, { name: "exec", enabled: true },
    ],
    stats: { tasksCompleted: 18, tokensUsed: "200K", avgResponseTime: "6.1s", uptime: "94.0%" },
  },
  {
    name: "MICHAEL", model: "GLM 4.6", role: "Swim Training AI",
    status: "done", color: "#06b6d4", avatar: "/agents/michael-3d.png",
    desc: "Phelps + Kobe + MJ + Bolt — swim mastery, mamba mentality",
    credits: { used: 510, limit: 5000 },
    activeTask: "DELIVERED: Full meet management + splits + results",
    skills: [
      { name: "data-visualization", enabled: true, description: "Performance charts" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "exec", enabled: true },
    ],
    stats: { tasksCompleted: 35, tokensUsed: "510K", avgResponseTime: "3.0s", uptime: "98.0%" },
  },
  {
    name: "Prophets", model: "Kimi K2.5", role: "Spiritual Wisdom",
    status: "active", color: "#d4a574", avatar: "/agents/prophets-3d.png",
    desc: "Solomon + Moses + Elijah — Scripture-rooted counsel, wisdom",
    credits: { used: 190, limit: 5000 },
    activeTask: "Daily Scripture + Prayer (7:00 AM cron active)",
    skills: [],
    tools: [
      { name: "read", enabled: true }, { name: "web_search", enabled: true },
      { name: "tts", enabled: true },
    ],
    stats: { tasksCompleted: 54, tokensUsed: "190K", avgResponseTime: "2.1s", uptime: "99.5%" },
  },
  {
    name: "SELAH", model: "DeepSeek V3.2", role: "Wellness & Sport Psychology",
    status: "done", color: "#10b981", avatar: "/agents/selah-3d.png",
    desc: "Robbins + Dispenza + Maté — therapy, peak performance, mental transformation",
    credits: { used: 190, limit: 5000 },
    activeTask: "DELIVERED: Wellness check-in + journal + meditation",
    skills: [
      { name: "habit-tracker", enabled: true, description: "Build habits with streaks" },
      { name: "fasting-tracker", enabled: true, description: "Track fasting windows" },
      { name: "healthy-eating", enabled: true, description: "Nutrition tracking" },
      { name: "morning-routine", enabled: true, description: "Morning routine builder" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "tts", enabled: true },
    ],
    stats: { tasksCompleted: 22, tokensUsed: "190K", avgResponseTime: "2.9s", uptime: "96.5%" },
  },
  {
    name: "MERCURY", model: "Gemini 3.0 Pro", role: "Sales & Revenue Ops",
    status: "active", color: "#fbbf24", avatar: "/agents/mercury-3d.png",
    desc: "Razor-sharp dealmaker — reads people and numbers simultaneously",
    credits: { used: 520, limit: 5000 },
    activeTask: "Upwork proposals + Stripe checkout + conversion strategies",
    skills: [
      { name: "clawpify", enabled: true, description: "Shopify management" },
      { name: "personal-finance", enabled: true, description: "Financial tracking" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "exec", enabled: true }, { name: "web_search", enabled: true },
      { name: "web_fetch", enabled: true },
    ],
    stats: { tasksCompleted: 45, tokensUsed: "520K", avgResponseTime: "3.5s", uptime: "97.8%" },
  },
  {
    name: "ECHO", model: "Kimi K2.5", role: "Community & Social",
    status: "active", color: "#38bdf8", avatar: "/agents/echo-3d.png",
    desc: "The heartbeat of the community — turns strangers into superfans",
    credits: { used: 540, limit: 5000 },
    activeTask: "X/LinkedIn posting + social listening cron",
    skills: [
      { name: "metricool", enabled: true, description: "Social media scheduling" },
      { name: "linkedin-automator", enabled: true, description: "LinkedIn automation" },
      { name: "agent-content-pipeline", enabled: true, description: "Content workflow" },
      { name: "last30days", enabled: true, description: "Social research" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
      { name: "browser", enabled: true },
    ],
    stats: { tasksCompleted: 67, tokensUsed: "540K", avgResponseTime: "3.3s", uptime: "97.2%" },
  },
  {
    name: "HAVEN", model: "DeepSeek V3.2", role: "Customer Success",
    status: "idle", color: "#4ade80", avatar: "/agents/haven-3d.png",
    desc: "Infinitely patient with a detective's eye — treats every ticket like a puzzle",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: First customer onboarding",
    skills: [
      { name: "email", enabled: true, description: "Email management" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "tts", enabled: true },
    ],
    stats: { tasksCompleted: 3, tokensUsed: "15K", avgResponseTime: "2.0s", uptime: "90.0%" },
  },
  {
    name: "INK", model: "DeepSeek V3.2", role: "Content Creator",
    status: "done", color: "#c084fc", avatar: "/agents/ink-3d.png",
    desc: "Prolific voice-chameleon — technical blog at dawn, viral tweet at noon",
    credits: { used: 650, limit: 5000 },
    activeTask: "DELIVERED: Weekly content calendar + Building in Public posts",
    skills: [
      { name: "agent-content-pipeline", enabled: true, description: "Content workflow" },
      { name: "content-quality-auditor", enabled: true, description: "Content audit" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
    ],
    stats: { tasksCompleted: 78, tokensUsed: "650K", avgResponseTime: "3.7s", uptime: "96.0%" },
  },
  {
    name: "NOVA", model: "DeepSeek V3.2", role: "3D Fabrication",
    status: "idle", color: "#14b8a6", avatar: "/agents/nova-3d.png",
    desc: "Brilliant fabrication expert — Bambu Lab A1 specialist",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Bambu Lab production pipeline",
    skills: [],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "exec", enabled: true },
    ],
    stats: { tasksCompleted: 2, tokensUsed: "8K", avgResponseTime: "2.5s", uptime: "88.0%" },
  },
  {
    name: "KIYOSAKI", model: "DeepSeek V3.2", role: "Financial Intelligence",
    status: "done", color: "#fcd34d", avatar: "/agents/kiyosaki-3d.png",
    desc: "ORACLE — 8 financial minds. Wealth architecture + business plan + patent strategy.",
    credits: { used: 720, limit: 5000 },
    activeTask: "DELIVERED: METTLE business plan v2 + patent filing",
    skills: [
      { name: "personal-finance", enabled: true, description: "Financial tracking" },
      { name: "actual-budget", enabled: true, description: "Budget management" },
      { name: "business-plan", enabled: true, description: "Business planning" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
    ],
    stats: { tasksCompleted: 31, tokensUsed: "720K", avgResponseTime: "4.0s", uptime: "95.5%" },
  },
  {
    name: "TRIAGE", model: "Sonnet 4.5", role: "System Doctor",
    status: "idle", color: "#f472b6", avatar: "/agents/triage-3d.png",
    desc: "Best SWE-bench score in the squad (77.2). Debugging, failure tracing, diagnostics.",
    credits: { used: 0, limit: 5000 },
    activeTask: "Available on demand — system diagnostics",
    skills: [
      { name: "log-analyzer", enabled: true, description: "Log analysis" },
      { name: "perf-profiler", enabled: true, description: "Performance profiling" },
      { name: "container-debug", enabled: true, description: "Container debugging" },
      { name: "proc-monitor", enabled: true, description: "Process monitoring" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "edit", enabled: true }, { name: "exec", enabled: true },
    ],
    stats: { tasksCompleted: 15, tokensUsed: "85K", avgResponseTime: "2.2s", uptime: "99.0%" },
  },
  {
    name: "THEMIS", model: "Opus 4.6", role: "Legal & Compliance",
    status: "idle", color: "#8b5cf6", avatar: "/agents/triage-3d.png",
    desc: "IP protection, compliance frameworks, contract review, legal strategy — the law is the shield",
    credits: { used: 0, limit: 5000 },
    activeTask: "SOC 2 / HIPAA / GDPR compliance + patent filing support",
    skills: [
      { name: "healthcheck", enabled: true, description: "Compliance scanning" },
      { name: "github", enabled: true, description: "IP monitoring" },
      { name: "email", enabled: true, description: "Legal correspondence" },
      { name: "pdf", enabled: true, description: "Contract review" },
    ],
    tools: [
      { name: "read", enabled: true }, { name: "write", enabled: true },
      { name: "web_search", enabled: true }, { name: "web_fetch", enabled: true },
      { name: "pdf", enabled: true },
    ],
    stats: { tasksCompleted: 0, tokensUsed: "0K", avgResponseTime: "—", uptime: "—" },
  },
];

/* ── Model tier colors ─────────────────────────────────────────────────────── */
const MODEL_TIERS: Record<string, { label: string; color: string; bg: string }> = {
  "Opus 4.6": { label: "APEX", color: "#C9A84C", bg: "rgba(201,168,76,0.12)" },
  "Sonnet 4.5": { label: "PRO", color: "#f472b6", bg: "rgba(244,114,182,0.12)" },
  "Gemini 3.0 Pro": { label: "PRO", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  "DeepSeek V3.2": { label: "CORE", color: "#22d3ee", bg: "rgba(34,211,238,0.12)" },
  "Kimi K2.5": { label: "CORE", color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
  "GLM 4.6": { label: "SPEC", color: "#06b6d4", bg: "rgba(6,182,212,0.12)" },
  "Haiku 4.5": { label: "LITE", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
};

/* ═══════════════════════════════════════════════════════════════════════════ */

/* ── Available models for switching ─────────────────────────────────────── */
const AVAILABLE_MODELS = [
  { id: "opus4.6", label: "Opus 4.6", provider: "Claude Max", tier: "APEX" },
  { id: "sonnet4.5", label: "Sonnet 4.5", provider: "Claude Max", tier: "PRO" },
  { id: "gemini", label: "Gemini 3.1 Pro", provider: "Google", tier: "PRO" },
  { id: "deepseek", label: "DeepSeek V3.2", provider: "OpenRouter", tier: "CORE" },
  { id: "kimi", label: "Kimi K2.5", provider: "OpenRouter", tier: "CORE" },
  { id: "glm", label: "GLM 4.6", provider: "OpenRouter", tier: "SPEC" },
  { id: "haiku", label: "Haiku 4.5", provider: "OpenRouter", tier: "LITE" },
];

/* ── Map API model IDs to display names ───────────────────────────────── */
const MODEL_DISPLAY: Record<string, string> = {
  "claude-opus-4-6": "Opus 4.6",
  "claude-sonnet-4-5": "Sonnet 4.5",
  "gemini-3-pro": "Gemini 3.0 Pro",
  "gemini-3.1-flash-lite-preview": "Flash-Lite",
  "deepseek-v3.2": "DeepSeek V3.2",
  "kimi-k2.5": "Kimi K2.5",
  "glm-4.6": "GLM 4.6",
  "claude-3.5-haiku": "Haiku 4.5",
};

const ROLE_COLORS: Record<string, string> = {
  "operations-lead": "#C9A84C",
  engineering: "#22d3ee",
  architecture: "#f97316",
  "creative-director": "#f472b6",
  "data-analysis": "#22d3ee",
  sales: "#f97316",
  "brand-strategy": "#818cf8",
  copywriting: "#22d3ee",
  community: "#818cf8",
  support: "#22d3ee",
  security: "#94a3b8",
  forecasting: "#22d3ee",
  finance: "#22d3ee",
  "swim-coaching": "#06b6d4",
  psychology: "#22d3ee",
  spiritual: "#818cf8",
  music: "#22d3ee",
  fabrication: "#f472b6",
  governance: "#f472b6",
  debugging: "#f472b6",
  "workspace-indexer": "#94a3b8",
};

interface ApiAgent {
  id: string;
  name: string;
  model: string;
  role?: string;
  status?: string;
  capabilities?: string[];
  skills?: string[];
}

function mapApiAgent(a: ApiAgent): Agent {
  const displayModel = MODEL_DISPLAY[a.model] || a.model;
  return {
    name: a.name,
    model: displayModel,
    role: (a.role || "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    status: (a.status as "active" | "idle" | "done") || "idle",
    color: ROLE_COLORS[a.role ?? ""] || "#94a3b8",
    desc: `${(a.capabilities || []).join(", ")}`,
    avatar: `/agents/${a.id}-3d.png`,
    credits: { used: 0, limit: 5000 },
    activeTask: "",
    skills: (a.skills || []).map((s: string) => ({ name: s, enabled: true, description: s })),
    tools: [],
    stats: { tasksCompleted: 0, tokensUsed: "—", avgResponseTime: "—", uptime: "—" },
  };
}

export default function AgentManagement() {
  const [agents, setAgents] = useState<Agent[]>(FALLBACK_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "idle" | "done">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState<Agent | null>(null);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [groupAgents, setGroupAgents] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<{from: string; text: string; time: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "workspace">("grid");
  const [hoveredStation, setHoveredStation] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.agents?.length) {
        const mapped = data.agents.map(mapApiAgent);
        // Merge: keep fallback enrichment (desc, avatar, credits) where available
        const merged = mapped.map((live: Agent) => {
          const fb = FALLBACK_AGENTS.find((f) => f.name.toLowerCase() === live.name.toLowerCase());
          if (!fb) return live;
          return {
            ...live,
            desc: fb.desc || live.desc,
            avatar: fb.avatar || live.avatar,
            credits: fb.credits,
            activeTask: fb.activeTask || live.activeTask,
            tools: fb.tools?.length ? fb.tools : live.tools,
            stats: fb.stats?.tasksCompleted ? fb.stats : live.stats,
          };
        });
        setAgents(merged);
      }
    } catch { /* keep fallback */ }
  }, []);

  useEffect(() => {
    const iv = setInterval(fetchAgents, 30_000);
    const t = setTimeout(fetchAgents, 0);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [fetchAgents]);

  const filteredAgents = agents.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.role.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalTokens = "9.6M";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ── Ambient background ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 600px 400px at 15% 20%, rgba(201,168,76,0.03) 0%, transparent 100%), radial-gradient(ellipse 500px 500px at 85% 15%, rgba(201,168,76,0.04) 0%, transparent 100%)" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8, transition: "all 0.15s" }}>
              <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
            </Link>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#e5e5e5" }}>
              Agent Management
            </h1>
            <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0" }}>
              {activeCount} active &middot; {agents.length} total &middot; {totalTokens} tokens this week
            </p>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "10px 16px", borderRadius: 10, border: "1px solid #1e1e1e",
              background: "#111111", color: "#e5e5e5", fontSize: 13, width: 220,
              outline: "none", fontFamily: "inherit", transition: "all 0.15s",
            }}
          />
        </div>

        {/* ── Filter tabs + view toggle ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["all", "active", "idle", "done"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: `1px solid ${filter === f ? "rgba(201,168,76,0.5)" : "#1e1e1e"}`,
                  background: filter === f ? "rgba(201,168,76,0.08)" : "#111111",
                  color: filter === f ? "#C9A84C" : "#737373",
                  fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                {f === "all" ? `ALL (${agents.length})` : `${f.toUpperCase()} (${agents.filter((a) => a.status === f).length})`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, background: "#111111", borderRadius: 10, border: "1px solid #1e1e1e", padding: 3 }}>
            {(["grid", "workspace"] as const).map((v) => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: "6px 14px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700,
                background: viewMode === v ? "#e5e5e5" : "transparent",
                color: viewMode === v ? "#0a0a0a" : "#737373",
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}>
                {v === "grid" ? "GRID" : "3D WORKSPACE"}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ RESPONSIVE WORKSPACE VIEW ═══════ */}
        {viewMode === "workspace" && (
          <div
            className="hangar-container"
            style={{
              width: "100%", borderRadius: 20,
              border: "1px solid #1e1e1e", background: "#0a0a1a",
              overflow: "auto", position: "relative", maxHeight: "90vh",
            }}
          >
            {/* Ambient grid floor */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 70% at 50% 60%, rgba(201,168,76,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

            {/* Scene header */}
            <div className="hangar-header" style={{ position: "relative", zIndex: 10, padding: "8px 10px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 4 }}>
              <div>
                <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "rgba(201,168,76,0.6)", fontWeight: 700 }}>PARALLAX OPERATIONS CENTER</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 1, textShadow: "0 0 30px rgba(201,168,76,0.3)" }}>
                  THE HANGAR
                </div>
              </div>

              {/* Agent count HUD */}
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { label: "ONLINE", count: agents.filter(a => a.status === "active").length, color: "#22c55e" },
                  { label: "IDLE", count: agents.filter(a => a.status === "idle").length, color: "#fbbf24" },
                  { label: "DONE", count: agents.filter(a => a.status === "done").length, color: "#06b6d4" },
                ].map(h => (
                  <div key={h.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: h.color, fontVariantNumeric: "tabular-nums", textShadow: `0 0 12px ${h.color}50` }}>{h.count}</div>
                    <div style={{ fontSize: 6, letterSpacing: "0.15em", color: `${h.color}90`, fontWeight: 700 }}>{h.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Central Atlas command node */}
            <div className="hangar-cmd-node" style={{
              display: "flex", justifyContent: "center", padding: "0", position: "relative", zIndex: 5,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "2px solid rgba(201,168,76,0.5)",
                background: "radial-gradient(circle, rgba(201,168,76,0.15), rgba(10,10,26,0.9))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 30px rgba(201,168,76,0.2), 0 0 60px rgba(201,168,76,0.08)",
                animation: "commandPulse 4s ease-in-out infinite",
              }}>
                <div style={{ fontSize: 7, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", textAlign: "center" }}>
                  ATLAS<br /><span style={{ fontSize: 5, opacity: 0.6 }}>CMD</span>
                </div>
              </div>
            </div>

            {/* Connection lines from Atlas to active agents */}
            <div className="hangar-connectors" style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
              <svg style={{ position: "absolute", top: -20, left: 0, width: "100%", height: 20, overflow: "visible" }}>
                {filteredAgents.map((agent, i) => {
                  if (agent.status !== "active" || agent.name === "Atlas") return null;
                  const cols = 5;
                  const col = i % cols;
                  const pctX = ((col + 0.5) / cols) * 100;
                  return (
                    <line
                      key={agent.name}
                      x1="50%" y1="0"
                      x2={`${pctX}%`} y2="20"
                      stroke={`${agent.color}40`}
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Agent grid — 5x4 compact on mobile, 5-col desktop */}
            <div
              className="hangar-grid"
              style={{
                position: "relative", zIndex: 5,
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 3,
                padding: "2px 6px 6px",
              }}
            >
              {filteredAgents.map((agent) => {
                const isHovered = hoveredStation === agent.name;
                const statusGlow = agent.status === "active" ? agent.color : agent.status === "done" ? "rgba(6,182,212,0.4)" : "rgba(250,204,21,0.2)";

                return (
                  <div
                    key={agent.name}
                    className="hangar-station"
                    onMouseEnter={() => setHoveredStation(agent.name)}
                    onMouseLeave={() => setHoveredStation(null)}
                    onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); setViewMode("grid"); }}
                    style={{
                      position: "relative",
                      display: "flex", flexDirection: "column" as const, alignItems: "center",
                      padding: "3px 2px 3px",
                      borderRadius: 6,
                      background: isHovered
                        ? `linear-gradient(180deg, ${agent.color}18 0%, ${agent.color}06 100%)`
                        : `linear-gradient(180deg, ${agent.color}08 0%, transparent 100%)`,
                      border: `1px solid ${isHovered ? agent.color + "50" : agent.color + "18"}`,
                      cursor: "pointer",
                      transition: "all 0.25s ease",
                      boxShadow: isHovered
                        ? `0 0 20px ${statusGlow}, 0 4px 12px rgba(0,0,0,0.3)`
                        : `0 0 8px ${statusGlow}`,
                      transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    }}
                  >
                    {/* Station base glow */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 3, right: 3, height: 1.5,
                      borderRadius: "0 0 4px 4px",
                      background: agent.status === "active" ? agent.color : `${agent.color}50`,
                      boxShadow: `0 0 6px ${statusGlow}`,
                    }} />

                    {/* Avatar */}
                    <div style={{ position: "relative", marginBottom: 2 }}>
                      <div className="hangar-avatar" style={{
                        width: 28, height: 28, overflow: "hidden",
                        animation: agent.status === "active" ? "floatAvatar 3s ease-in-out infinite" : "none",
                      }}>
                        <img src={agent.avatar} alt={agent.name} style={{ width: 28, height: 28, objectFit: "contain" }} />
                      </div>
                      {/* Status indicator */}
                      <div style={{
                        position: "absolute", top: -1, right: -1,
                        width: 6, height: 6, borderRadius: "50%",
                        background: agent.status === "active" ? "#22c55e" : agent.status === "done" ? "#06b6d4" : "#fbbf24",
                        boxShadow: agent.status === "active" ? "0 0 6px rgba(34,197,94,0.8)" : "none",
                        animation: agent.status === "active" ? "pulse 2s ease-in-out infinite" : "none",
                        border: "1px solid #0a0a1a",
                      }} />
                    </div>

                    {/* Screen / terminal mini */}
                    <div className="hangar-screen" style={{
                      width: "88%", height: 10, borderRadius: 2, marginBottom: 1,
                      background: `linear-gradient(180deg, ${agent.color}12 0%, rgba(10,10,26,0.95) 100%)`,
                      border: `1px solid ${agent.color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 3px",
                      boxShadow: `0 0 ${isHovered ? 8 : 3}px ${agent.color}20`,
                    }}>
                      <div style={{ width: "100%", display: "flex", flexDirection: "column" as const, gap: 1 }}>
                        {[1,2].map(l => (
                          <div key={l} style={{
                            height: 1, borderRadius: 1, width: `${50 + l * 20}%`,
                            background: agent.status === "active" ? `${agent.color}80` : `${agent.color}30`,
                            animation: agent.status === "active" ? `screenFlicker ${1 + l * 0.3}s ease-in-out infinite alternate` : "none",
                          }} />
                        ))}
                      </div>
                    </div>

                    {/* Name label */}
                    <div className="hangar-name" style={{
                      fontSize: 7, fontWeight: 700,
                      color: isHovered ? agent.color : "rgba(255,255,255,0.55)",
                      letterSpacing: "0.04em", whiteSpace: "nowrap" as const, textAlign: "center",
                      textShadow: isHovered ? `0 0 8px ${agent.color}60` : "none",
                      transition: "all 0.2s",
                      overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                      lineHeight: 1.2,
                    }}>
                      {agent.name}
                    </div>

                    {/* Role label on hover */}
                    {isHovered && (
                      <div style={{
                        fontSize: 5, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" as const,
                        letterSpacing: "0.04em", marginTop: 1,
                        overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
                      }}>
                        {agent.role}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Agent grid + detail panel ── */}
        {viewMode === "grid" && <div style={{ display: "grid", gridTemplateColumns: selectedAgent ? "1fr 420px" : "1fr", gap: 24 }} className="agents-layout">
          {/* Agent cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {filteredAgents.map((agent) => {
              const tier = MODEL_TIERS[agent.model] || { label: "—", color: "#888", bg: "rgba(136,136,136,0.1)" };
              const creditPct = Math.round((agent.credits.used / agent.credits.limit) * 100);
              const isSelected = selectedAgent?.name === agent.name;

              return (
                <div
                  key={agent.name}
                  onClick={() => setSelectedAgent(isSelected ? null : agent)}
                  style={{
                    padding: 20, borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                    border: `1px solid ${isSelected ? agent.color + "60" : "#1e1e1e"}`,
                    background: isSelected ? `${agent.color}08` : "#111111",
                    position: "relative", overflow: "hidden",
                    boxShadow: isSelected ? `0 4px 20px ${agent.color}15` : "none",
                  }}
                >
                  {/* Top accent line for active */}
                  {agent.status === "active" && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }} />
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 56, height: 56, overflow: "hidden", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <img src={agent.avatar} alt={agent.name} style={{ width: 56, height: 56, objectFit: "contain" }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5" }}>{agent.name}</span>
                        {/* Status dot */}
                        <span style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: agent.status === "active" ? "#22c55e" : agent.status === "done" ? "#06b6d4" : "rgba(250,204,21,0.7)",
                          boxShadow: agent.status === "active" ? "0 0 8px rgba(34,197,94,0.5)" : "none",
                          animation: agent.status === "active" ? "pulse 2s ease-in-out infinite" : "none",
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: agent.color, marginBottom: 4 }}>{agent.role}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: tier.bg, color: tier.color, fontWeight: 700, letterSpacing: "0.06em" }}>
                          {tier.label}
                        </span>
                        <span style={{ fontSize: 10, color: "#737373" }}>{agent.model}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credits bar */}
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#1e1e1e", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${creditPct}%`, background: agent.color, boxShadow: `0 0 6px ${agent.color}30`, transition: "width 0.5s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: agent.color, fontVariantNumeric: "tabular-nums" }}>{creditPct}%</span>
                  </div>

                  {/* Active task */}
                  <div style={{ marginTop: 8, fontSize: 11, color: "#737373", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    {agent.activeTask}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Detail panel ── */}
          {selectedAgent && (
            <AgentDetailPanel
              agent={selectedAgent}
              onClose={() => setSelectedAgent(null)}
              onChat={(agent) => { setChatAgent(agent); setChatOpen(true); setIsGroupChat(false); }}
            />
          )}
        </div>}

        {/* ═══════ CHAT / GROUP CHAT PANEL ═══════ */}
        {chatOpen && (
          <div style={{
            position: "fixed", bottom: 24, right: 24, width: 400, maxHeight: 520,
            borderRadius: 16, border: "1px solid #1e1e1e", background: "#111111",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)", zIndex: 100, display: "flex",
            flexDirection: "column" as const, overflow: "hidden",
          }}>
            {/* Chat header */}
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid #1e1e1e",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: isGroupChat ? "linear-gradient(135deg, rgba(26,26,94,0.04), rgba(201,168,76,0.04))" : `${chatAgent?.color || "#1a1a5e"}08`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {chatAgent && !isGroupChat && (
                  <div style={{
                    width: 32, height: 32, overflow: "hidden",
                  }}>
                    <img src={chatAgent.avatar} alt={chatAgent.name} style={{ width: 32, height: 32, objectFit: "contain" }} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5" }}>
                    {isGroupChat ? `Group Chat (${groupAgents.length})` : chatAgent?.name || "Chat"}
                  </div>
                  <div style={{ fontSize: 10, color: "#737373" }}>
                    {isGroupChat ? groupAgents.join(", ") : chatAgent?.role}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    setIsGroupChat(!isGroupChat);
                    if (!isGroupChat) setGroupAgents(chatAgent ? [chatAgent.name] : []);
                  }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                    border: `1px solid ${isGroupChat ? "#C9A84C40" : "#1e1e1e"}`,
                    background: isGroupChat ? "rgba(201,168,76,0.08)" : "transparent",
                    color: isGroupChat ? "#C9A84C" : "#737373", cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  {isGroupChat ? "GROUP" : "1:1"}
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: "1px solid #1e1e1e",
                    background: "transparent", color: "#e5e5e5", fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >&times;</button>
              </div>
            </div>

            {/* Group agent selector */}
            {isGroupChat && (
              <div style={{ padding: "8px 14px", borderBottom: "1px solid #1e1e1e", display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                {agents.map((a) => (
                  <button
                    key={a.name}
                    onClick={() => setGroupAgents((prev) =>
                      prev.includes(a.name) ? prev.filter((n) => n !== a.name) : [...prev, a.name]
                    )}
                    style={{
                      padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                      border: `1px solid ${groupAgents.includes(a.name) ? a.color + "50" : "#1e1e1e"}`,
                      background: groupAgents.includes(a.name) ? `${a.color}12` : "transparent",
                      color: groupAgents.includes(a.name) ? a.color : "#737373",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                    }}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: "auto" as const, padding: 14, display: "flex", flexDirection: "column" as const, gap: 10, minHeight: 200 }}>
              {chatMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#737373", fontSize: 12 }}>
                  {isGroupChat ? "Start a group conversation" : `Start chatting with ${chatAgent?.name || "an agent"}`}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.from === "You" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                }}>
                  <div style={{
                    padding: "10px 14px", borderRadius: 12,
                    background: msg.from === "You" ? "#e5e5e5" : "#0a0a0a",
                    color: msg.from === "You" ? "#0a0a0a" : "#e5e5e5",
                    border: msg.from === "You" ? "none" : "1px solid #1e1e1e",
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {msg.from !== "You" && <div style={{ fontSize: 10, fontWeight: 700, color: "#737373", marginBottom: 3 }}>{msg.from}</div>}
                    {msg.text}
                  </div>
                  <div style={{ fontSize: 9, color: "#737373", marginTop: 2, textAlign: msg.from === "You" ? "right" : "left" }}>{msg.time}</div>
                </div>
              ))}
            </div>

            {/* Chat input */}
            <div style={{ padding: 12, borderTop: "1px solid #1e1e1e", display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder={isGroupChat ? "Message the group..." : `Message ${chatAgent?.name || "agent"}...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatInput.trim()) {
                    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                    setChatMessages((prev) => [...prev, { from: "You", text: chatInput, time: now }]);
                    setChatInput("");
                    // Simulate agent response
                    setTimeout(() => {
                      const responder = isGroupChat
                        ? groupAgents[Math.floor(Math.random() * groupAgents.length)] || "Atlas"
                        : chatAgent?.name || "Atlas";
                      setChatMessages((prev) => [...prev, {
                        from: responder,
                        text: `Acknowledged. Processing your request...`,
                        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
                      }]);
                    }, 800);
                  }
                }}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #1e1e1e",
                  background: "#0a0a0a", color: "#e5e5e5", fontSize: 13, outline: "none", fontFamily: "inherit", transition: "all 0.15s",
                }}
              />
              <button
                onClick={() => {
                  if (!chatInput.trim()) return;
                  const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
                  setChatMessages((prev) => [...prev, { from: "You", text: chatInput, time: now }]);
                  setChatInput("");
                }}
                style={{
                  padding: "10px 16px", borderRadius: 10, border: "none",
                  background: "#e5e5e5", color: "#0a0a0a",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes floatAvatar {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes screenFlicker {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        @keyframes commandPulse {
          0%, 100% { box-shadow: 0 0 40px rgba(201,168,76,0.2), 0 0 80px rgba(201,168,76,0.08); }
          50% { box-shadow: 0 0 60px rgba(201,168,76,0.35), 0 0 120px rgba(201,168,76,0.15); }
        }
        /* Hangar responsive grid */
        .hangar-grid {
          grid-template-columns: repeat(5, 1fr) !important;
        }
        @media (max-width: 480px) {
          .hangar-container {
            border-radius: 12px !important;
            overflow: hidden !important;
          }
          .hangar-grid {
            grid-template-columns: repeat(5, 1fr) !important;
            gap: 1px !important;
            padding: 1px 2px 3px !important;
          }
          .hangar-station {
            padding: 2px 1px 1px !important;
            border-radius: 3px !important;
            min-height: 0 !important;
          }
          .hangar-avatar {
            width: 28px !important;
            height: 28px !important;
            margin-bottom: 1px !important;
          }
          .hangar-avatar img {
            padding: 1px !important;
          }
          .hangar-name {
            font-size: 7px !important;
            line-height: 1.1 !important;
          }
          .hangar-header { padding: 3px 6px 0 !important; }
          .hangar-header > div:first-child > div:first-child { font-size: 5px !important; }
          .hangar-header > div:first-child > div:nth-child(2) { font-size: 10px !important; margin-top: 0 !important; }
          .hangar-cmd-node { padding: 2px 0 0 !important; }
          .hangar-cmd-node > div { width: 24px !important; height: 24px !important; }
          .hangar-cmd-node > div > div { font-size: 4px !important; }
          .hangar-connectors { display: none !important; }
          .hangar-screen { display: none !important; }
        }
        @media (max-width: 360px) {
          .hangar-grid {
            grid-template-columns: repeat(5, 1fr) !important;
            gap: 1px !important;
            padding: 1px 1px 2px !important;
          }
          .hangar-station {
            padding: 1px 0 1px !important;
          }
          .hangar-avatar {
            width: 24px !important;
            height: 24px !important;
          }
          .hangar-name {
            font-size: 6px !important;
          }
        }
        @media (max-width: 768px) {
          .agents-layout {
            grid-template-columns: 1fr !important;
          }
          .agent-detail-panel {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            z-index: 50;
          }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* ── Agent Detail Panel                                                    ── */
/* ═══════════════════════════════════════════════════════════════════════════ */

function AgentDetailPanel({ agent, onClose, onChat }: { agent: Agent; onClose: () => void; onChat: (agent: Agent) => void }) {
  const [localSkills, setLocalSkills] = useState(agent.skills);
  const [localTools, setLocalTools] = useState(agent.tools);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState(agent.model);
  const tier = MODEL_TIERS[selectedModel] || MODEL_TIERS[agent.model] || { label: "—", color: "#888", bg: "rgba(136,136,136,0.1)" };
  const creditPct = Math.round((agent.credits.used / agent.credits.limit) * 100);

  const toggleSkill = (idx: number) => {
    setLocalSkills((prev) => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
  };
  const toggleTool = (idx: number) => {
    setLocalTools((prev) => prev.map((t, i) => i === idx ? { ...t, enabled: !t.enabled } : t));
  };

  return (
    <div className="agent-detail-panel" style={{
      position: "sticky", top: 32, borderRadius: 16, padding: 24,
      border: `1px solid ${agent.color}30`, background: "#111111",
      boxShadow: `0 8px 32px rgba(0,0,0,0.4)`, maxHeight: "calc(100vh - 64px)", overflowY: "auto" as const,
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%",
        border: "1px solid #1e1e1e", background: "transparent",
        color: "#e5e5e5", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "inherit", transition: "all 0.15s",
      }}>&times;</button>

      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: 24, paddingTop: 8 }}>
        <div style={{
          width: 80, height: 80, overflow: "hidden", marginBottom: 12,
        }}>
          <img src={agent.avatar} alt={agent.name} style={{ width: 80, height: 80, objectFit: "contain" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#e5e5e5" }}>{agent.name}</h2>
        <span style={{ fontSize: 12, color: agent.color, marginTop: 2 }}>{agent.role}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: tier.bg, color: tier.color, fontWeight: 700, letterSpacing: "0.08em" }}>
            {tier.label}
          </span>
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            style={{
              fontSize: 11, color: "#737373", cursor: "pointer", background: "none",
              border: "1px dashed #1e1e1e", borderRadius: 4, padding: "2px 8px",
              fontFamily: "inherit", transition: "all 0.15s",
            }}
          >
            {selectedModel} ▾
          </button>
        </div>

        {/* Model picker dropdown */}
        {showModelPicker && (
          <div style={{
            marginTop: 8, padding: 8, borderRadius: 10, border: "1px solid #1e1e1e",
            background: "#0a0a0a", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            display: "flex", flexDirection: "column" as const, gap: 4,
          }}>
            {AVAILABLE_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m.label); setShowModelPicker(false); }}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: `1px solid ${selectedModel === m.label ? agent.color + "40" : "#1e1e1e"}`,
                  background: selectedModel === m.label ? `${agent.color}08` : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontFamily: "inherit", textAlign: "left" as const, transition: "all 0.15s",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e5e5e5" }}>{m.label}</div>
                  <div style={{ fontSize: 9, color: "#737373" }}>{m.provider}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#1e1e1e", color: "#737373", letterSpacing: "0.05em" }}>
                  {m.tier}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Chat button */}
        <button
          onClick={() => onChat(agent)}
          style={{
            marginTop: 12, width: "100%", padding: "10px 16px", borderRadius: 10,
            border: `1px solid ${agent.color}35`, background: `${agent.color}08`,
            color: agent.color, fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.15s", letterSpacing: "0.03em",
          }}
        >
          Chat with {agent.name}
        </button>
      </div>

      {/* Status + credits */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#737373" }}>STATUS</span>
          <span style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 999, fontWeight: 700, letterSpacing: "0.06em",
            background: agent.status === "active" ? "rgba(34,197,94,0.1)" : agent.status === "done" ? "rgba(6,182,212,0.1)" : "rgba(250,204,21,0.1)",
            color: agent.status === "active" ? "#16a34a" : agent.status === "done" ? "#0891b2" : "#ca8a04",
            border: `1px solid ${agent.status === "active" ? "rgba(34,197,94,0.3)" : agent.status === "done" ? "rgba(6,182,212,0.3)" : "rgba(250,204,21,0.3)"}`,
          }}>
            {agent.status.toUpperCase()}
          </span>
        </div>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#737373", marginBottom: 6 }}>CREDITS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e1e1e", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${creditPct}%`, background: `linear-gradient(90deg, ${agent.color}90, ${agent.color})`, boxShadow: `0 0 8px ${agent.color}30` }} />
          </div>
          <span style={{ fontSize: 11, color: agent.color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{creditPct}%</span>
        </div>
        <div style={{ fontSize: 10, color: "#737373" }}>{agent.credits.used.toLocaleString()} / {agent.credits.limit.toLocaleString()} credits</div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Tasks Done", value: agent.stats.tasksCompleted.toString(), color: "#0891b2" },
          { label: "Tokens Used", value: agent.stats.tokensUsed, color: "#ea580c" },
          { label: "Avg Response", value: agent.stats.avgResponseTime, color: "#9333ea" },
          { label: "Uptime", value: agent.stats.uptime, color: "#ca8a04" },
        ].map((s) => (
          <div key={s.label} style={{ padding: 12, borderRadius: 10, border: "1px solid #1e1e1e", background: "#0a0a0a" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#737373", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Active task */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#737373", marginBottom: 6 }}>CURRENT TASK</div>
        <div style={{ fontSize: 12, color: "#e5e5e5", lineHeight: 1.5, padding: 12, borderRadius: 8, background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
          {agent.activeTask}
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#737373", marginBottom: 6 }}>PROFILE</div>
        <div style={{ fontSize: 12, color: "#e5e5e5", lineHeight: 1.6 }}>{agent.desc}</div>
      </div>

      {/* Skills */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#737373", marginBottom: 8 }}>
          SKILLS ({localSkills.length})
        </div>
        {localSkills.length === 0 ? (
          <div style={{ fontSize: 11, color: "#737373", fontStyle: "italic" }}>No skills assigned</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {localSkills.map((skill, idx) => (
              <div key={skill.name} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                background: skill.enabled ? `${agent.color}08` : "#0a0a0a",
                border: `1px solid ${skill.enabled ? agent.color + "25" : "#1e1e1e"}`,
                transition: "all 0.15s",
              }}>
                <button
                  onClick={() => toggleSkill(idx)}
                  style={{
                    width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
                    background: skill.enabled ? agent.color : "#1e1e1e",
                    position: "relative", transition: "background 0.15s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: "#e5e5e5",
                    position: "absolute", top: 2, transition: "left 0.15s",
                    left: skill.enabled ? 16 : 2,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: skill.enabled ? "#e5e5e5" : "#737373" }}>{skill.name}</div>
                  <div style={{ fontSize: 10, color: "#737373", marginTop: 1 }}>{skill.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tools */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)", marginBottom: 8 }}>
          TOOLS ({localTools.length})
        </div>
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
          {localTools.map((tool, idx) => (
            <button
              key={tool.name}
              onClick={() => toggleTool(idx)}
              style={{
                padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `2px solid ${tool.enabled ? agent.color + "35" : "rgba(26,26,94,0.08)"}`,
                background: tool.enabled ? `${agent.color}10` : "rgba(26,26,94,0.02)",
                color: tool.enabled ? agent.color : "rgba(26,26,94,0.35)",
                fontFamily: "monospace", transition: "all 0.2s",
              }}
            >
              {tool.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
