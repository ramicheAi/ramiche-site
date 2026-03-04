"use client";

import { useState } from "react";
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

const AGENTS: Agent[] = [
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

export default function AgentManagement() {
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
  const [cameraAngle, setCameraAngle] = useState({ x: -25, y: 35 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const filteredAgents = AGENTS.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.role.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeCount = AGENTS.filter((a) => a.status === "active").length;
  const totalTokens = "9.6M";

  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#1a1a5e", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ── Ambient background ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 600px 400px at 15% 20%, rgba(26,26,94,0.03) 0%, transparent 100%), radial-gradient(ellipse 500px 500px at 85% 15%, rgba(201,168,76,0.04) 0%, transparent 100%)" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#1a1a5e", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
            </Link>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, background: "linear-gradient(135deg, #1a1a5e 0%, #C9A84C 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Agent Management
            </h1>
            <p style={{ fontSize: 13, color: "rgba(26,26,94,0.5)", margin: "4px 0 0" }}>
              {activeCount} active &middot; {AGENTS.length} total &middot; {totalTokens} tokens this week
            </p>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "10px 16px", borderRadius: 10, border: "2px solid rgba(26,26,94,0.1)",
              background: "#fff", color: "#1a1a5e", fontSize: 13, width: 220,
              outline: "none", fontFamily: "inherit",
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
                  padding: "8px 16px", borderRadius: 8, border: `2px solid ${filter === f ? "rgba(201,168,76,0.5)" : "rgba(26,26,94,0.08)"}`,
                  background: filter === f ? "rgba(201,168,76,0.08)" : "#fff",
                  color: filter === f ? "#C9A84C" : "rgba(26,26,94,0.5)",
                  fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                }}
              >
                {f === "all" ? `ALL (${AGENTS.length})` : `${f.toUpperCase()} (${AGENTS.filter((a) => a.status === f).length})`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 10, border: "2px solid rgba(26,26,94,0.08)", padding: 3 }}>
            {(["grid", "workspace"] as const).map((v) => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                padding: "6px 14px", borderRadius: 7, border: "none", fontSize: 11, fontWeight: 700,
                background: viewMode === v ? "linear-gradient(135deg, #1a1a5e, #3730a3)" : "transparent",
                color: viewMode === v ? "#fff" : "rgba(26,26,94,0.4)",
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", letterSpacing: "0.06em",
                textTransform: "uppercase" as const,
              }}>
                {v === "grid" ? "GRID" : "3D WORKSPACE"}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════ 3D WORKSPACE VIEW ═══════ */}
        {viewMode === "workspace" && (
          <div
            style={{
              width: "100%", height: "calc(100vh - 220px)", borderRadius: 20,
              border: "2px solid rgba(26,26,94,0.12)", background: "#0a0a1a",
              overflow: "hidden", position: "relative", cursor: isDragging ? "grabbing" : "grab",
            }}
            onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); }}
            onMouseMove={(e) => {
              if (!isDragging) return;
              setCameraAngle({ x: cameraAngle.x + (e.clientY - dragStart.y) * 0.15, y: cameraAngle.y + (e.clientX - dragStart.x) * 0.15 });
              setDragStart({ x: e.clientX, y: e.clientY });
            }}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            {/* Ambient grid floor */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 800px 600px at 50% 60%, rgba(201,168,76,0.06) 0%, transparent 70%)" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

            {/* Scene label */}
            <div style={{ position: "absolute", top: 20, left: 24, zIndex: 10 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(201,168,76,0.6)", fontWeight: 700 }}>PARALLAX OPERATIONS CENTER</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginTop: 2, textShadow: "0 0 30px rgba(201,168,76,0.3)" }}>
                THE HANGAR
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Drag to rotate &middot; Click station to inspect</div>
            </div>

            {/* Agent count HUD */}
            <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10, display: "flex", gap: 12 }}>
              {[
                { label: "ONLINE", count: AGENTS.filter(a => a.status === "active").length, color: "#22c55e" },
                { label: "IDLE", count: AGENTS.filter(a => a.status === "idle").length, color: "#fbbf24" },
                { label: "DONE", count: AGENTS.filter(a => a.status === "done").length, color: "#06b6d4" },
              ].map(h => (
                <div key={h.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: h.color, fontVariantNumeric: "tabular-nums", textShadow: `0 0 12px ${h.color}50` }}>{h.count}</div>
                  <div style={{ fontSize: 8, letterSpacing: "0.15em", color: `${h.color}90`, fontWeight: 700 }}>{h.label}</div>
                </div>
              ))}
            </div>

            {/* 3D perspective container */}
            <div style={{
              width: "100%", height: "100%", perspective: 1200, perspectiveOrigin: "50% 40%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                position: "relative", width: 900, height: 700,
                transformStyle: "preserve-3d" as const,
                transform: `rotateX(${cameraAngle.x}deg) rotateY(${cameraAngle.y}deg)`,
                transition: isDragging ? "none" : "transform 0.3s ease-out",
              }}>
                {/* Floor plane */}
                <div style={{
                  position: "absolute", width: 1100, height: 900, left: -100, top: -100,
                  background: "linear-gradient(135deg, rgba(26,26,94,0.15) 0%, rgba(10,10,26,0.9) 100%)",
                  border: "1px solid rgba(201,168,76,0.15)", borderRadius: 8,
                  transform: "rotateX(90deg) translateZ(-200px)",
                  boxShadow: "0 0 80px rgba(201,168,76,0.08) inset",
                }} />

                {/* Agent workstations — arranged in concentric arcs */}
                {filteredAgents.map((agent, i) => {
                  const total = filteredAgents.length;
                  const cols = 5;
                  const row = Math.floor(i / cols);
                  const col = i % cols;
                  const xOffset = (col - (cols - 1) / 2) * 170;
                  const zOffset = row * 160 - 100;
                  const isHovered = hoveredStation === agent.name;
                  const statusGlow = agent.status === "active" ? agent.color : agent.status === "done" ? "rgba(6,182,212,0.4)" : "rgba(250,204,21,0.2)";

                  return (
                    <div
                      key={agent.name}
                      onMouseEnter={() => setHoveredStation(agent.name)}
                      onMouseLeave={() => setHoveredStation(null)}
                      onClick={(e) => { e.stopPropagation(); setSelectedAgent(agent); setViewMode("grid"); }}
                      style={{
                        position: "absolute",
                        left: 450 + xOffset - 60, top: 350 + zOffset - 50,
                        width: 130, height: 120,
                        transformStyle: "preserve-3d" as const,
                        transform: `translateZ(${isHovered ? 40 : 0}px)`,
                        transition: "transform 0.3s ease-out",
                        cursor: "pointer",
                      }}
                    >
                      {/* Station base / desk */}
                      <div style={{
                        position: "absolute", bottom: 0, left: 5, right: 5, height: 35,
                        background: `linear-gradient(180deg, ${agent.color}25 0%, ${agent.color}08 100%)`,
                        border: `1px solid ${agent.color}40`, borderRadius: 6,
                        boxShadow: `0 0 ${isHovered ? 30 : 12}px ${statusGlow}`,
                        transform: "rotateX(60deg) translateZ(10px)",
                        transition: "box-shadow 0.3s",
                      }} />

                      {/* Screen / terminal */}
                      <div style={{
                        position: "absolute", top: 10, left: 15, right: 15, height: 50,
                        background: `linear-gradient(180deg, ${agent.color}15 0%, rgba(10,10,26,0.95) 100%)`,
                        border: `1px solid ${agent.color}50`, borderRadius: 4,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 0 ${isHovered ? 25 : 8}px ${agent.color}30`,
                        transition: "box-shadow 0.3s",
                      }}>
                        {/* Mini screen content */}
                        <div style={{ width: "80%", display: "flex", flexDirection: "column" as const, gap: 3 }}>
                          {[1,2,3].map(l => (
                            <div key={l} style={{
                              height: 2, borderRadius: 1, width: `${60 + Math.random() * 40}%`,
                              background: agent.status === "active" ? `${agent.color}80` : `${agent.color}30`,
                              animation: agent.status === "active" ? `screenFlicker ${1 + l * 0.3}s ease-in-out infinite alternate` : "none",
                            }} />
                          ))}
                        </div>
                      </div>

                      {/* Avatar floating above station */}
                      <div style={{
                        position: "absolute", top: -35, left: "50%", transform: "translateX(-50%)",
                        width: 48, height: 48, borderRadius: "50%", overflow: "hidden",
                        border: `2px solid ${agent.color}70`,
                        background: `radial-gradient(circle at 35% 35%, ${agent.color}20 0%, #1a1a2e 70%)`,
                        boxShadow: `0 0 ${isHovered ? 30 : 12}px ${agent.color}40`,
                        animation: agent.status === "active" ? "floatAvatar 3s ease-in-out infinite" : "none",
                        transition: "box-shadow 0.3s",
                      }}>
                        <img src={agent.avatar} alt={agent.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                      </div>

                      {/* Status indicator */}
                      <div style={{
                        position: "absolute", top: -38, left: "50%", transform: "translateX(16px)",
                        width: 8, height: 8, borderRadius: "50%",
                        background: agent.status === "active" ? "#22c55e" : agent.status === "done" ? "#06b6d4" : "#fbbf24",
                        boxShadow: agent.status === "active" ? "0 0 8px rgba(34,197,94,0.8)" : "none",
                        animation: agent.status === "active" ? "pulse 2s ease-in-out infinite" : "none",
                      }} />

                      {/* Name label */}
                      <div style={{
                        position: "absolute", bottom: -18, left: "50%", transform: "translateX(-50%)",
                        fontSize: 9, fontWeight: 700, color: isHovered ? agent.color : "rgba(255,255,255,0.5)",
                        letterSpacing: "0.08em", whiteSpace: "nowrap" as const, textAlign: "center",
                        textShadow: isHovered ? `0 0 10px ${agent.color}60` : "none",
                        transition: "all 0.2s",
                      }}>
                        {agent.name}
                      </div>

                      {/* Role label on hover */}
                      {isHovered && (
                        <div style={{
                          position: "absolute", bottom: -30, left: "50%", transform: "translateX(-50%)",
                          fontSize: 7, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" as const,
                          letterSpacing: "0.05em",
                        }}>
                          {agent.role}
                        </div>
                      )}

                      {/* Connection lines to Atlas (index 0) — show for active agents */}
                      {agent.status === "active" && i > 0 && (
                        <div style={{
                          position: "absolute", top: "50%", left: "50%",
                          width: 1, height: 80,
                          background: `linear-gradient(180deg, ${agent.color}40, transparent)`,
                          transformOrigin: "top center",
                          transform: `rotate(${-45 + (col * 20)}deg)`,
                          pointerEvents: "none",
                        }} />
                      )}
                    </div>
                  );
                })}

                {/* Central Atlas command node — elevated */}
                <div style={{
                  position: "absolute", left: 410, top: 280, width: 80, height: 80,
                  borderRadius: "50%", border: "2px solid rgba(201,168,76,0.5)",
                  background: "radial-gradient(circle, rgba(201,168,76,0.15), rgba(10,10,26,0.9))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transform: "translateZ(80px)",
                  boxShadow: "0 0 60px rgba(201,168,76,0.2), 0 0 120px rgba(201,168,76,0.08)",
                  animation: "commandPulse 4s ease-in-out infinite",
                  pointerEvents: "none",
                }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", textAlign: "center" }}>
                    ATLAS<br /><span style={{ fontSize: 6, opacity: 0.6 }}>CMD</span>
                  </div>
                </div>
              </div>
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
                    padding: 20, borderRadius: 14, cursor: "pointer", transition: "all 0.2s",
                    border: `2px solid ${isSelected ? agent.color + "60" : "rgba(26,26,94,0.08)"}`,
                    background: isSelected ? `${agent.color}08` : "#fff",
                    position: "relative", overflow: "hidden",
                    boxShadow: isSelected ? `0 4px 20px ${agent.color}15` : "0 1px 4px rgba(26,26,94,0.05)",
                  }}
                >
                  {/* Top accent line for active */}
                  {agent.status === "active" && (
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }} />
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 56, height: 56, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                      border: `2px solid ${agent.color}40`,
                      background: `radial-gradient(circle at 35% 35%, ${agent.color}15 0%, #f0f0f5 70%)`,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 6,
                      boxShadow: agent.status === "active" ? `0 0 16px ${agent.color}25` : "none",
                    }}>
                      <img src={agent.avatar} alt={agent.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#1a1a5e" }}>{agent.name}</span>
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
                        <span style={{ fontSize: 10, color: "rgba(26,26,94,0.4)" }}>{agent.model}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credits bar */}
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(26,26,94,0.06)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 2, width: `${creditPct}%`, background: agent.color, boxShadow: `0 0 6px ${agent.color}30`, transition: "width 0.5s" }} />
                    </div>
                    <span style={{ fontSize: 10, color: agent.color, fontVariantNumeric: "tabular-nums" }}>{creditPct}%</span>
                  </div>

                  {/* Active task */}
                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(26,26,94,0.45)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
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
            borderRadius: 16, border: "2px solid rgba(26,26,94,0.12)", background: "#fff",
            boxShadow: "0 16px 48px rgba(26,26,94,0.15)", zIndex: 100, display: "flex",
            flexDirection: "column" as const, overflow: "hidden",
          }}>
            {/* Chat header */}
            <div style={{
              padding: "14px 18px", borderBottom: "2px solid rgba(26,26,94,0.06)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: isGroupChat ? "linear-gradient(135deg, rgba(26,26,94,0.04), rgba(201,168,76,0.04))" : `${chatAgent?.color || "#1a1a5e"}08`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {chatAgent && !isGroupChat && (
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", overflow: "hidden",
                    border: `2px solid ${chatAgent.color}40`, padding: 3,
                    background: `radial-gradient(circle, ${chatAgent.color}15, #f0f0f5)`,
                  }}>
                    <img src={chatAgent.avatar} alt={chatAgent.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a5e" }}>
                    {isGroupChat ? `Group Chat (${groupAgents.length})` : chatAgent?.name || "Chat"}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(26,26,94,0.4)" }}>
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
                    border: `2px solid ${isGroupChat ? "#C9A84C40" : "rgba(26,26,94,0.1)"}`,
                    background: isGroupChat ? "rgba(201,168,76,0.08)" : "transparent",
                    color: isGroupChat ? "#C9A84C" : "rgba(26,26,94,0.4)", cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {isGroupChat ? "GROUP" : "1:1"}
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: "2px solid rgba(26,26,94,0.1)",
                    background: "transparent", color: "#1a1a5e", fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
                  }}
                >&times;</button>
              </div>
            </div>

            {/* Group agent selector */}
            {isGroupChat && (
              <div style={{ padding: "8px 14px", borderBottom: "2px solid rgba(26,26,94,0.06)", display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                {AGENTS.map((a) => (
                  <button
                    key={a.name}
                    onClick={() => setGroupAgents((prev) =>
                      prev.includes(a.name) ? prev.filter((n) => n !== a.name) : [...prev, a.name]
                    )}
                    style={{
                      padding: "3px 8px", borderRadius: 4, fontSize: 9, fontWeight: 600,
                      border: `1px solid ${groupAgents.includes(a.name) ? a.color + "50" : "rgba(26,26,94,0.08)"}`,
                      background: groupAgents.includes(a.name) ? `${a.color}12` : "transparent",
                      color: groupAgents.includes(a.name) ? a.color : "rgba(26,26,94,0.35)",
                      cursor: "pointer", fontFamily: "inherit",
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
                <div style={{ textAlign: "center", padding: 40, color: "rgba(26,26,94,0.25)", fontSize: 12 }}>
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
                    background: msg.from === "You" ? "linear-gradient(135deg, #1a1a5e, #3730a3)" : "rgba(26,26,94,0.04)",
                    color: msg.from === "You" ? "#fff" : "#1a1a5e",
                    border: msg.from === "You" ? "none" : "2px solid rgba(26,26,94,0.06)",
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {msg.from !== "You" && <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(26,26,94,0.5)", marginBottom: 3 }}>{msg.from}</div>}
                    {msg.text}
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(26,26,94,0.3)", marginTop: 2, textAlign: msg.from === "You" ? "right" : "left" }}>{msg.time}</div>
                </div>
              ))}
            </div>

            {/* Chat input */}
            <div style={{ padding: 12, borderTop: "2px solid rgba(26,26,94,0.06)", display: "flex", gap: 8 }}>
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
                  flex: 1, padding: "10px 14px", borderRadius: 10, border: "2px solid rgba(26,26,94,0.1)",
                  background: "#fafafa", color: "#1a1a5e", fontSize: 13, outline: "none", fontFamily: "inherit",
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
                  background: "linear-gradient(135deg, #1a1a5e, #3730a3)", color: "#fff",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
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
          0%, 100% { transform: translateX(-50%) translateY(0px); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
        @keyframes screenFlicker {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        @keyframes commandPulse {
          0%, 100% { box-shadow: 0 0 60px rgba(201,168,76,0.2), 0 0 120px rgba(201,168,76,0.08); }
          50% { box-shadow: 0 0 80px rgba(201,168,76,0.35), 0 0 160px rgba(201,168,76,0.15); }
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
      border: `2px solid ${agent.color}30`, background: "#fff",
      boxShadow: `0 8px 32px rgba(26,26,94,0.08)`, maxHeight: "calc(100vh - 64px)", overflowY: "auto" as const,
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%",
        border: "2px solid rgba(26,26,94,0.1)", background: "rgba(26,26,94,0.03)",
        color: "#1a1a5e", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "inherit",
      }}>&times;</button>

      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: 24, paddingTop: 8 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", overflow: "hidden", marginBottom: 12,
          border: `3px solid ${agent.color}40`, padding: 8,
          background: `radial-gradient(circle at 35% 35%, ${agent.color}15 0%, #f0f0f5 70%)`,
          boxShadow: `0 0 30px ${agent.color}12`,
        }}>
          <img src={agent.avatar} alt={agent.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: "#1a1a5e" }}>{agent.name}</h2>
        <span style={{ fontSize: 12, color: agent.color, marginTop: 2 }}>{agent.role}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: tier.bg, color: tier.color, fontWeight: 700, letterSpacing: "0.08em" }}>
            {tier.label}
          </span>
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            style={{
              fontSize: 11, color: "rgba(26,26,94,0.5)", cursor: "pointer", background: "none",
              border: "1px dashed rgba(26,26,94,0.15)", borderRadius: 4, padding: "2px 8px",
              fontFamily: "inherit", transition: "all 0.2s",
            }}
          >
            {selectedModel} ▾
          </button>
        </div>

        {/* Model picker dropdown */}
        {showModelPicker && (
          <div style={{
            marginTop: 8, padding: 8, borderRadius: 10, border: "2px solid rgba(26,26,94,0.1)",
            background: "#fff", boxShadow: "0 4px 16px rgba(26,26,94,0.08)",
            display: "flex", flexDirection: "column" as const, gap: 4,
          }}>
            {AVAILABLE_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setSelectedModel(m.label); setShowModelPicker(false); }}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: `2px solid ${selectedModel === m.label ? agent.color + "40" : "rgba(26,26,94,0.06)"}`,
                  background: selectedModel === m.label ? `${agent.color}08` : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontFamily: "inherit", textAlign: "left" as const,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a5e" }}>{m.label}</div>
                  <div style={{ fontSize: 9, color: "rgba(26,26,94,0.4)" }}>{m.provider}</div>
                </div>
                <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "rgba(26,26,94,0.04)", color: "rgba(26,26,94,0.4)", letterSpacing: "0.05em" }}>
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
            border: `2px solid ${agent.color}35`, background: `${agent.color}08`,
            color: agent.color, fontSize: 13, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit", transition: "all 0.2s", letterSpacing: "0.03em",
          }}
        >
          Chat with {agent.name}
        </button>
      </div>

      {/* Status + credits */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)" }}>STATUS</span>
          <span style={{
            fontSize: 10, padding: "3px 10px", borderRadius: 999, fontWeight: 700, letterSpacing: "0.06em",
            background: agent.status === "active" ? "rgba(34,197,94,0.1)" : agent.status === "done" ? "rgba(6,182,212,0.1)" : "rgba(250,204,21,0.1)",
            color: agent.status === "active" ? "#16a34a" : agent.status === "done" ? "#0891b2" : "#ca8a04",
            border: `1px solid ${agent.status === "active" ? "rgba(34,197,94,0.3)" : agent.status === "done" ? "rgba(6,182,212,0.3)" : "rgba(250,204,21,0.3)"}`,
          }}>
            {agent.status.toUpperCase()}
          </span>
        </div>

        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)", marginBottom: 6 }}>CREDITS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(26,26,94,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${creditPct}%`, background: `linear-gradient(90deg, ${agent.color}90, ${agent.color})`, boxShadow: `0 0 8px ${agent.color}30` }} />
          </div>
          <span style={{ fontSize: 11, color: agent.color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{creditPct}%</span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(26,26,94,0.35)" }}>{agent.credits.used.toLocaleString()} / {agent.credits.limit.toLocaleString()} credits</div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
        {[
          { label: "Tasks Done", value: agent.stats.tasksCompleted.toString(), color: "#0891b2" },
          { label: "Tokens Used", value: agent.stats.tokensUsed, color: "#ea580c" },
          { label: "Avg Response", value: agent.stats.avgResponseTime, color: "#9333ea" },
          { label: "Uptime", value: agent.stats.uptime, color: "#ca8a04" },
        ].map((s) => (
          <div key={s.label} style={{ padding: 12, borderRadius: 10, border: "2px solid rgba(26,26,94,0.06)", background: "rgba(26,26,94,0.02)" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Active task */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)", marginBottom: 6 }}>CURRENT TASK</div>
        <div style={{ fontSize: 12, color: "rgba(26,26,94,0.65)", lineHeight: 1.5, padding: 12, borderRadius: 8, background: "rgba(26,26,94,0.02)", border: "2px solid rgba(26,26,94,0.06)" }}>
          {agent.activeTask}
        </div>
      </div>

      {/* Description */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)", marginBottom: 6 }}>PROFILE</div>
        <div style={{ fontSize: 12, color: "rgba(26,26,94,0.55)", lineHeight: 1.6 }}>{agent.desc}</div>
      </div>

      {/* Skills */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "rgba(26,26,94,0.4)", marginBottom: 8 }}>
          SKILLS ({localSkills.length})
        </div>
        {localSkills.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(26,26,94,0.3)", fontStyle: "italic" }}>No skills assigned</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {localSkills.map((skill, idx) => (
              <div key={skill.name} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8,
                background: skill.enabled ? `${agent.color}08` : "rgba(26,26,94,0.02)",
                border: `2px solid ${skill.enabled ? agent.color + "25" : "rgba(26,26,94,0.06)"}`,
                transition: "all 0.2s",
              }}>
                <button
                  onClick={() => toggleSkill(idx)}
                  style={{
                    width: 32, height: 18, borderRadius: 9, border: "none", cursor: "pointer",
                    background: skill.enabled ? agent.color : "rgba(26,26,94,0.12)",
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2, transition: "left 0.2s",
                    left: skill.enabled ? 16 : 2,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  }} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: skill.enabled ? "#1a1a5e" : "rgba(26,26,94,0.35)" }}>{skill.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(26,26,94,0.4)", marginTop: 1 }}>{skill.description}</div>
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
