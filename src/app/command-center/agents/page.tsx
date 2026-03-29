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
  const [agents, setAgents] = useState<Agent[]>([]);
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
        setAgents(mapped);
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
            {agents.length === 0 && (
              <span style={{ fontSize: 13, color: '#555', padding: '24px 0', gridColumn: '1 / -1' }}>No agents loaded — waiting for API sync</span>
            )}
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
