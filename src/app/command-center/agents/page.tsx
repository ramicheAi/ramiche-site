"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   AGENT MANAGEMENT — Focused agent dashboard
   View usage, skills, tools. Toggle capabilities per agent.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── SKILLS REGISTRY ──────────────────────────────────────────────────────── */
const SKILLS_REGISTRY: Record<string, string[]> = {
  coding: ["coding-agent", "github", "container-debug", "perf-profiler", "log-analyzer"],
  content: ["agent-content-pipeline", "linkedin-automator", "marketing-mode", "content-quality-auditor"],
  music: ["ai-music-generation", "music-cog", "elevenlabs-music", "clawtunes", "songsee"],
  research: ["last30days", "competitive-analysis", "market-research", "web_search", "web_fetch"],
  finance: ["actual-budget", "personal-finance", "intellectia-stock-forecast"],
  wellness: ["fasting-tracker", "habit-tracker", "healthy-eating", "morning-routine"],
  security: ["healthcheck", "dns-networking", "container-debug"],
  communication: ["email", "wacli", "imsg", "metricool"],
  design: ["figma", "nano-banana-pro", "openai-image-gen", "brand-cog"],
  analytics: ["ga4-analytics", "app-log-analyzer", "proc-monitor", "mactop"],
};

/* ── TOOLS REGISTRY ───────────────────────────────────────────────────────── */
const TOOLS_REGISTRY = [
  "read", "write", "edit", "exec", "web_search", "web_fetch", "browser",
  "canvas", "memory_get", "memory_search", "tts", "image", "cron",
  "message", "sessions_spawn", "subagents", "nodes",
];

/* ── AGENT DATA ───────────────────────────────────────────────────────────── */
interface Agent {
  name: string;
  model: string;
  role: string;
  status: "active" | "idle" | "done" | "error";
  color: string;
  icon: string;
  desc: string;
  credits: { used: number; limit: number };
  activeTask: string;
  skills: string[];
  tools: string[];
  domain: string;
}

const AGENTS: Agent[] = [
  {
    name: "Atlas", model: "Opus 4.6", role: "Lead Strategist",
    status: "active", color: "#00f0ff", icon: "🧭",
    desc: "Orchestrates all agents, system-wide reasoning, mission planning, memory",
    credits: { used: 1250, limit: 5000 },
    activeTask: "Command center redesign + Qwen local setup",
    skills: ["coding-agent", "github", "agent-content-pipeline", "last30days", "competitive-analysis", "ga4-analytics", "healthcheck"],
    tools: ["read", "write", "edit", "exec", "web_search", "web_fetch", "browser", "canvas", "memory_get", "memory_search", "tts", "image", "cron", "message", "sessions_spawn", "subagents", "nodes"],
    domain: "operations",
  },
  {
    name: "TheMAESTRO", model: "DeepSeek V3.2", role: "Music Production AI",
    status: "idle", color: "#f59e0b", icon: "🎵",
    desc: "Ye + Quincy + Babyface — influence-based creative direction, sound design",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Track inventory",
    skills: ["ai-music-generation", "music-cog", "elevenlabs-music", "clawtunes", "songsee"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "memory_get", "memory_search", "tts"],
    domain: "music",
  },
  {
    name: "SIMONS", model: "DeepSeek V3.2", role: "Algorithmic Analysis",
    status: "idle", color: "#22d3ee", icon: "📊",
    desc: "Jim Simons — pattern recognition, statistical arbitrage, data crunching",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: SEO/competitor analysis",
    skills: ["ga4-analytics", "competitive-analysis", "intellectia-stock-forecast", "app-log-analyzer"],
    tools: ["read", "exec", "web_search", "web_fetch", "memory_get", "memory_search"],
    domain: "analytics",
  },
  {
    name: "Dr. Strange", model: "DeepSeek V3.2", role: "Forecasting & Decisions",
    status: "idle", color: "#a855f7", icon: "🔮",
    desc: "Scenario analysis, probable outcomes, strategic foresight, risk assessment",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Kickstarter landscape",
    skills: ["competitive-analysis", "last30days", "intellectia-stock-forecast"],
    tools: ["read", "exec", "web_search", "web_fetch", "memory_get", "memory_search"],
    domain: "strategy",
  },
  {
    name: "SHURI", model: "DeepSeek V3.2", role: "Creative Coding",
    status: "active", color: "#34d399", icon: "⚡",
    desc: "Prototyping, design systems, tech innovation, rapid builds",
    credits: { used: 580, limit: 5000 },
    activeTask: "Three-portal UI extraction",
    skills: ["coding-agent", "github", "container-debug", "perf-profiler", "figma"],
    tools: ["read", "write", "edit", "exec", "web_search", "web_fetch", "browser", "memory_get", "memory_search"],
    domain: "engineering",
  },
  {
    name: "Widow", model: "Haiku 3.5", role: "Cybersecurity & Intel",
    status: "idle", color: "#ef4444", icon: "🕷",
    desc: "Threat monitoring, risk analysis, data intelligence, security audits",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: API key audit + COPPA check",
    skills: ["healthcheck", "dns-networking", "container-debug", "log-analyzer"],
    tools: ["read", "exec", "web_search", "web_fetch", "memory_get", "memory_search"],
    domain: "security",
  },
  {
    name: "PROXIMON", model: "Gemini 3.0 Pro", role: "Systems Architect",
    status: "active", color: "#f97316", icon: "🏗",
    desc: "Jobs + Musk + Bezos — first-principles, flywheels, compounding systems",
    credits: { used: 480, limit: 5000 },
    activeTask: "Firebase v2 spec + deploy guide",
    skills: ["coding-agent", "github", "perf-profiler", "container-debug"],
    tools: ["read", "write", "edit", "exec", "web_search", "web_fetch", "memory_get", "memory_search"],
    domain: "architecture",
  },
  {
    name: "Vee", model: "Kimi K2.5", role: "Brand & Marketing",
    status: "done", color: "#ec4899", icon: "📣",
    desc: "Gary Vee + Seth Godin + Hormozi — makes brands impossible to ignore",
    credits: { used: 350, limit: 5000 },
    activeTask: "DELIVERED: GA Shopify copy + Studio outreach",
    skills: ["marketing-mode", "marketing-strategy-pmm", "linkedin-automator", "content-quality-auditor", "brand-analyzer", "metricool"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "browser", "memory_get", "memory_search", "message"],
    domain: "marketing",
  },
  {
    name: "Aetherion", model: "Gemini 3.0 Pro", role: "Visionary Architect",
    status: "idle", color: "#818cf8", icon: "🌀",
    desc: "The Architect of Architects — patterns, emergence, meta-systems",
    credits: { used: 0, limit: 5000 },
    activeTask: "Done: 5 blueprints + Phase 1 matrix",
    skills: ["coding-agent", "github", "competitive-analysis", "business-plan"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "memory_get", "memory_search"],
    domain: "architecture",
  },
  {
    name: "MICHAEL", model: "GLM 4.6", role: "Swim Training AI",
    status: "done", color: "#06b6d4", icon: "🏊",
    desc: "Phelps + Kobe + MJ — swim mastery, competitive fire",
    credits: { used: 310, limit: 5000 },
    activeTask: "DELIVERED: Practice schedule builder",
    skills: ["data-visualization", "habit-tracker"],
    tools: ["read", "write", "exec", "memory_get", "memory_search"],
    domain: "athletics",
  },
  {
    name: "Prophets", model: "Kimi K2.5", role: "Spiritual Wisdom",
    status: "idle", color: "#d4a574", icon: "📜",
    desc: "Solomon + Moses + Elijah — Scripture-rooted counsel, wisdom, moral clarity",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Daily Scripture cron",
    skills: ["obsidian", "bear-notes"],
    tools: ["read", "write", "exec", "web_search", "memory_get", "memory_search", "tts"],
    domain: "spiritual",
  },
  {
    name: "SELAH", model: "DeepSeek V3.2", role: "Wellness & Sport Psychology",
    status: "done", color: "#10b981", icon: "🧘",
    desc: "Robbins + Dispenza + Maté — therapy, peak performance, mental transformation",
    credits: { used: 190, limit: 5000 },
    activeTask: "DELIVERED: Meditation library + journaling system",
    skills: ["fasting-tracker", "habit-tracker", "healthy-eating", "morning-routine", "focus-deep-work"],
    tools: ["read", "write", "exec", "web_search", "memory_get", "memory_search", "tts", "cron"],
    domain: "wellness",
  },
  {
    name: "MERCURY", model: "Gemini 3.0 Pro", role: "Sales & Revenue Ops",
    status: "idle", color: "#fbbf24", icon: "💰",
    desc: "Razor-sharp dealmaker — reads people and numbers simultaneously",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Outbound sales pipeline",
    skills: ["email", "linkedin-automator", "competitive-analysis", "clawpify"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "browser", "memory_get", "memory_search", "message"],
    domain: "sales",
  },
  {
    name: "ECHO", model: "Kimi K2.5", role: "Community & Social",
    status: "done", color: "#38bdf8", icon: "🌊",
    desc: "The heartbeat of the community — turns strangers into superfans",
    credits: { used: 220, limit: 5000 },
    activeTask: "DELIVERED: Discord server architecture",
    skills: ["metricool", "linkedin-automator", "agent-content-pipeline", "last30days"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "memory_get", "memory_search", "message"],
    domain: "community",
  },
  {
    name: "HAVEN", model: "DeepSeek V3.2", role: "Customer Success",
    status: "idle", color: "#4ade80", icon: "🛡",
    desc: "Infinitely patient with a detective's eye — every ticket is a puzzle",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Support system + onboarding",
    skills: ["email", "app-log-analyzer", "api-health-check"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "memory_get", "memory_search", "message"],
    domain: "support",
  },
  {
    name: "INK", model: "DeepSeek V3.2", role: "Content Creator",
    status: "done", color: "#c084fc", icon: "✒",
    desc: "Prolific voice-chameleon — technical blog, viral tweet, cinematic script",
    credits: { used: 280, limit: 5000 },
    activeTask: "DELIVERED: 5-piece launch content package",
    skills: ["agent-content-pipeline", "content-quality-auditor", "marketing-mode", "ai-music-prompts", "linkedin-automator"],
    tools: ["read", "write", "exec", "web_search", "web_fetch", "memory_get", "memory_search", "tts"],
    domain: "content",
  },
  {
    name: "NOVA", model: "DeepSeek V3.2", role: "3D Fabrication",
    status: "idle", color: "#14b8a6", icon: "🔧",
    desc: "Brilliant fabrication expert — Bambu Lab A1 specialist",
    credits: { used: 0, limit: 5000 },
    activeTask: "Awaiting: Bambu Lab production pipeline",
    skills: ["data-visualization"],
    tools: ["read", "write", "exec", "web_search", "memory_get", "memory_search"],
    domain: "fabrication",
  },
  {
    name: "KIYOSAKI", model: "DeepSeek V3.2", role: "Financial Intelligence",
    status: "done", color: "#fcd34d", icon: "💎",
    desc: "ORACLE — 8 financial minds. Wealth architecture.",
    credits: { used: 420, limit: 5000 },
    activeTask: "DELIVERED: Apex financial model — tiered pricing validated",
    skills: ["actual-budget", "personal-finance", "intellectia-stock-forecast", "competitive-analysis"],
    tools: ["read", "exec", "web_search", "web_fetch", "memory_get", "memory_search"],
    domain: "finance",
  },
  {
    name: "TRIAGE", model: "Sonnet 4.5", role: "System Doctor",
    status: "idle", color: "#f472b6", icon: "🩺",
    desc: "Best SWE-bench score (77.2). Debugging, failure tracing, diagnostics.",
    credits: { used: 0, limit: 5000 },
    activeTask: "Available on demand — system diagnostics",
    skills: ["coding-agent", "github", "container-debug", "perf-profiler", "log-analyzer", "dns-networking", "proc-monitor"],
    tools: ["read", "write", "edit", "exec", "web_search", "web_fetch", "memory_get", "memory_search", "nodes"],
    domain: "diagnostics",
  },
];

/* ── DOMAIN COLORS ────────────────────────────────────────────────────────── */
const DOMAIN_COLORS: Record<string, string> = {
  operations: "#00f0ff",
  music: "#f59e0b",
  analytics: "#22d3ee",
  strategy: "#a855f7",
  engineering: "#34d399",
  security: "#ef4444",
  architecture: "#f97316",
  marketing: "#ec4899",
  athletics: "#06b6d4",
  spiritual: "#d4a574",
  wellness: "#10b981",
  sales: "#fbbf24",
  community: "#38bdf8",
  support: "#4ade80",
  content: "#c084fc",
  fabrication: "#14b8a6",
  finance: "#fcd34d",
  diagnostics: "#f472b6",
};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: "ACTIVE", bg: "rgba(52, 211, 153, 0.15)", text: "#34d399" },
  idle: { label: "IDLE", bg: "rgba(148, 163, 184, 0.12)", text: "#94a3b8" },
  done: { label: "DONE", bg: "rgba(96, 165, 250, 0.12)", text: "#60a5fa" },
  error: { label: "ERROR", bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444" },
};

/* ══════════════════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [agentOverrides, setAgentOverrides] = useState<Record<string, { skills: string[]; tools: string[] }>>({});

  const getAgentConfig = useCallback((agent: Agent) => {
    const override = agentOverrides[agent.name];
    return {
      skills: override?.skills ?? agent.skills,
      tools: override?.tools ?? agent.tools,
    };
  }, [agentOverrides]);

  const toggleSkill = useCallback((agentName: string, skill: string, currentSkills: string[]) => {
    setAgentOverrides((prev) => {
      const existing = prev[agentName];
      const skills = existing?.skills ?? currentSkills;
      const updated = skills.includes(skill) ? skills.filter((s) => s !== skill) : [...skills, skill];
      return { ...prev, [agentName]: { skills: updated, tools: existing?.tools ?? AGENTS.find((a) => a.name === agentName)!.tools } };
    });
  }, []);

  const toggleTool = useCallback((agentName: string, tool: string, currentTools: string[]) => {
    setAgentOverrides((prev) => {
      const existing = prev[agentName];
      const tools = existing?.tools ?? currentTools;
      const updated = tools.includes(tool) ? tools.filter((t) => t !== tool) : [...tools, tool];
      return { ...prev, [agentName]: { tools: updated, skills: existing?.skills ?? AGENTS.find((a) => a.name === agentName)!.skills } };
    });
  }, []);

  const filteredAgents = AGENTS.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter || a.domain === filter;
    const matchesSearch = !searchQuery ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.domain.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusCounts = {
    active: AGENTS.filter((a) => a.status === "active").length,
    idle: AGENTS.filter((a) => a.status === "idle").length,
    done: AGENTS.filter((a) => a.status === "done").length,
  };

  const domains = [...new Set(AGENTS.map((a) => a.domain))];

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      padding: "32px 40px 80px",
      background: "#0a0a0f",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Geist', -apple-system, system-ui, sans-serif",
      color: "#e2e8f0",
    }}>
      {/* ── background glow ── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: `
          radial-gradient(ellipse 600px 400px at 15% 20%, rgba(45, 212, 191, 0.06) 0%, transparent 100%),
          radial-gradient(ellipse 500px 500px at 85% 15%, rgba(168, 85, 247, 0.05) 0%, transparent 100%),
          radial-gradient(ellipse 700px 400px at 50% 60%, rgba(249, 115, 22, 0.04) 0%, transparent 100%)
        `,
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* ── HEADER ── */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{
            color: "#94a3b8", textDecoration: "none", fontSize: 13,
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: 12,
          }}>
            ← Command Center
          </Link>
          <h1 style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: 0,
          }}>
            Agent Management
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "8px 0 0" }}>
            {AGENTS.length} agents · {statusCounts.active} active · {statusCounts.idle} idle · {statusCounts.done} completed
          </p>
        </div>

        {/* ── FILTERS + SEARCH ── */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24,
          alignItems: "center",
        }}>
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.15)",
              background: "rgba(255, 255, 255, 0.03)",
              color: "#e2e8f0",
              fontSize: 13,
              outline: "none",
              width: 200,
              fontFamily: "inherit",
            }}
          />
          {["all", "active", "idle", "done"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: filter === f ? "1px solid rgba(0, 240, 255, 0.4)" : "1px solid rgba(148, 163, 184, 0.12)",
                background: filter === f ? "rgba(0, 240, 255, 0.08)" : "rgba(255, 255, 255, 0.02)",
                color: filter === f ? "#00f0ff" : "#94a3b8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontFamily: "inherit",
              }}
            >
              {f}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: "rgba(148,163,184,0.12)", margin: "0 4px" }} />
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => setFilter(filter === d ? "all" : d)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: filter === d ? `1px solid ${DOMAIN_COLORS[d] || "#94a3b8"}44` : "1px solid rgba(148, 163, 184, 0.08)",
                background: filter === d ? `${DOMAIN_COLORS[d] || "#94a3b8"}12` : "transparent",
                color: filter === d ? (DOMAIN_COLORS[d] || "#94a3b8") : "#64748b",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* ── AGENT GRID ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}>
          {filteredAgents.map((agent) => {
            const st = STATUS_LABELS[agent.status] || STATUS_LABELS.idle;
            const usagePct = Math.round((agent.credits.used / agent.credits.limit) * 100);
            const isSelected = selectedAgent?.name === agent.name;
            const isEditing = editingAgent === agent.name;
            const config = getAgentConfig(agent);

            return (
              <div
                key={agent.name}
                onClick={() => setSelectedAgent(isSelected ? null : agent)}
                style={{
                  padding: 20,
                  borderRadius: 14,
                  border: isSelected
                    ? `2px solid ${agent.color}66`
                    : "1px solid rgba(148, 163, 184, 0.08)",
                  background: isSelected
                    ? `linear-gradient(135deg, ${agent.color}08, ${agent.color}04)`
                    : "rgba(255, 255, 255, 0.02)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {/* top row: icon + name + status */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${agent.color}15`,
                    border: `1px solid ${agent.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20,
                  }}>
                    {agent.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{agent.model} · {agent.role}</div>
                  </div>
                  <div style={{
                    padding: "3px 8px", borderRadius: 6,
                    background: st.bg, color: st.text,
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                  }}>
                    {st.label}
                  </div>
                </div>

                {/* description */}
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 12px", lineHeight: 1.5 }}>
                  {agent.desc}
                </p>

                {/* current task */}
                <div style={{
                  padding: "8px 10px", borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(148, 163, 184, 0.06)",
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 4 }}>
                    CURRENT TASK
                  </div>
                  <div style={{ fontSize: 12, color: "#cbd5e1" }}>{agent.activeTask}</div>
                </div>

                {/* usage bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginBottom: 4 }}>
                    <span>USAGE</span>
                    <span>{agent.credits.used.toLocaleString()} / {agent.credits.limit.toLocaleString()} credits ({usagePct}%)</span>
                  </div>
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: "rgba(148, 163, 184, 0.08)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${usagePct}%`,
                      background: usagePct > 80 ? "#ef4444" : agent.color,
                      transition: "width 0.5s ease",
                    }} />
                  </div>
                </div>

                {/* skills chips */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.05em" }}>
                      SKILLS ({config.skills.length})
                    </div>
                    {isSelected && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingAgent(isEditing ? null : agent.name); }}
                        style={{
                          padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 600,
                          border: isEditing ? "1px solid rgba(249, 115, 22, 0.4)" : "1px solid rgba(148, 163, 184, 0.15)",
                          background: isEditing ? "rgba(249, 115, 22, 0.1)" : "rgba(255, 255, 255, 0.03)",
                          color: isEditing ? "#f97316" : "#94a3b8",
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        {isEditing ? "DONE" : "EDIT"}
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(isEditing
                      ? Object.values(SKILLS_REGISTRY).flat().filter((v, i, a) => a.indexOf(v) === i)
                      : config.skills.slice(0, isSelected ? undefined : 4)
                    ).map((s) => {
                      const isActive = config.skills.includes(s);
                      return (
                        <span
                          key={s}
                          onClick={isEditing ? (e) => { e.stopPropagation(); toggleSkill(agent.name, s, config.skills); } : undefined}
                          style={{
                            padding: "2px 8px", borderRadius: 4,
                            background: isActive ? `${agent.color}10` : "rgba(148, 163, 184, 0.03)",
                            border: isActive ? `1px solid ${agent.color}20` : "1px dashed rgba(148, 163, 184, 0.12)",
                            color: isActive ? agent.color : "#475569",
                            fontSize: 10,
                            cursor: isEditing ? "pointer" : "default",
                            opacity: isEditing && !isActive ? 0.5 : 1,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {isEditing && <span style={{ marginRight: 3 }}>{isActive ? "✓" : "+"}</span>}
                          {s}
                        </span>
                      );
                    })}
                    {!isSelected && !isEditing && config.skills.length > 4 && (
                      <span style={{ fontSize: 10, color: "#64748b", padding: "2px 4px" }}>
                        +{config.skills.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {/* tools — only when expanded */}
                {isSelected && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 6 }}>
                      TOOLS ({config.tools.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(isEditing ? TOOLS_REGISTRY : config.tools).map((t) => {
                        const isActive = config.tools.includes(t);
                        return (
                          <span
                            key={t}
                            onClick={isEditing ? (e) => { e.stopPropagation(); toggleTool(agent.name, t, config.tools); } : undefined}
                            style={{
                              padding: "2px 8px", borderRadius: 4,
                              background: isActive ? "rgba(148, 163, 184, 0.06)" : "rgba(148, 163, 184, 0.02)",
                              border: isActive ? "1px solid rgba(148, 163, 184, 0.1)" : "1px dashed rgba(148, 163, 184, 0.08)",
                              color: isActive ? "#94a3b8" : "#475569",
                              fontSize: 10,
                              cursor: isEditing ? "pointer" : "default",
                              opacity: isEditing && !isActive ? 0.5 : 1,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {isEditing && <span style={{ marginRight: 3 }}>{isActive ? "✓" : "+"}</span>}
                            {t}
                          </span>
                        );
                      })}
                    </div>

                    {/* domain badge */}
                    <div style={{
                      marginTop: 12,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: DOMAIN_COLORS[agent.domain] || "#94a3b8",
                        boxShadow: `0 0 8px ${DOMAIN_COLORS[agent.domain] || "#94a3b8"}40`,
                      }} />
                      <span style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {agent.domain}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── responsive ── */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 480px) {
          div[style*="padding: \\"32px 40px"] {
            padding: 16px 16px 60px !important;
          }
        }
      `}</style>
    </div>
  );
}
