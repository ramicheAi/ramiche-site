"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   SETTINGS — System Configuration & Agent Management
   Live data from /api/command-center/agents + SSE vitals
   No hardcoded agents — purely API-driven
   ══════════════════════════════════════════════════════════════════════════════ */

interface AgentConfig {
  id: string;
  name: string;
  model: string;
  provider?: string;
  role: string;
  capabilities: string[];
  skills: string[];
  escalation_level?: string;
  escalationLevel?: string;
  status: string;
}

const TIER_COLORS: Record<string, string> = {
  APEX: "#C9A84C",
  AUTHORITY: "#C9A84C",
  PRO: "#818cf8",
  SPECIALIST: "#818cf8",
  CORE: "#34d399",
  EXECUTOR: "#34d399",
  LOCAL: "#f59e0b",
  SYSTEM: "#6b7280",
};

const AVAILABLE_MODELS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", tier: "APEX" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", tier: "PRO" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", tier: "PRO" },
  { value: "kimi-k2.5", label: "Kimi K2.5", tier: "CORE" },
  { value: "deepseek-v3.2", label: "DeepSeek V3.2", tier: "CORE" },
  { value: "qwen3:14b", label: "Qwen3 14B", tier: "LOCAL" },
  { value: "qwen3:8b", label: "Qwen3 8B", tier: "LOCAL" },
  { value: "gemma2:9b", label: "Gemma2 9B", tier: "LOCAL" },
  { value: "llama3.1:8b", label: "Llama 3.1 8B", tier: "LOCAL" },
];

function getStatusColor(status: string) {
  if (status === "active") return "#22c55e";
  if (status === "idle") return "#f59e0b";
  return "#6b7280";
}

function getTierFromEscalation(level: string): string {
  const map: Record<string, string> = {
    final: "APEX", authority: "APEX", specialist: "PRO",
    executor: "CORE", "level-0": "SYSTEM",
  };
  return map[level?.toLowerCase()] || "CORE";
}

interface SystemVitals {
  cpu: { cores: number; model: string; load: string };
  memory: { total: string; free: string; used: string; percent: string };
  disk: { total: string; used: string; available: string; percent: string };
  uptime: string;
}

export default function SettingsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "system" | "crons">("agents");
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editModel, setEditModel] = useState("");
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [gatewayAction, setGatewayAction] = useState<string | null>(null);
  const [gatewayOutput, setGatewayOutput] = useState("");
  const [source, setSource] = useState<"live" | "static">("static");
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.agents?.length > 0) {
          setAgents(data.agents);
          setSource(data.source || "static");
        }
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch { /* retry next cycle */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const es = new EventSource("/api/command-center/sse");
    es.addEventListener("vitals", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.vitals) setVitals(data.vitals);
      } catch { /* ignore parse errors */ }
    });
    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.vitals) setVitals(data.vitals);
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, []);

  const handleSaveModel = async (agentId: string, newModel: string) => {
    setSaveError(null);
    try {
      const res = await fetch("/api/command-center/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, updates: { model: newModel } }),
      });
      if (res.ok) {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, model: newModel } : a));
        setEditingAgent(null);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
        setSaveError(data.detail || data.error || `Save failed (${res.status})`);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Network error");
    }
  };

  const handleGatewayAction = async (action: string) => {
    setGatewayAction(action);
    setGatewayOutput("Executing...");
    try {
      const res = await fetch("/api/command-center/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setGatewayOutput(data.output || data.error || "Done");
    } catch (err) {
      setGatewayOutput(`Error: ${err}`);
    }
    setTimeout(() => setGatewayAction(null), 5000);
  };

  const tabs = [
    { id: "agents" as const, label: "AGENTS", count: agents.length },
    { id: "system" as const, label: "SYSTEM", count: null },
    { id: "crons" as const, label: "CRONS", count: null },
  ];

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />

      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 800px 600px at 25% 15%, rgba(201,168,76,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 85%, rgba(249,115,22,0.06) 0%, transparent 60%)"
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8, transition: "all 0.15s" }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(201,168,76,0.3)" }}>Settings</h1>
              <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
                {loading ? "LOADING..." : `${agents.length} agents registered`}
                {lastSync && <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>● LIVE · {lastSync}</span>}
                <span style={{ marginLeft: 8, fontSize: 10, color: source === "live" ? "#22c55e" : "#f59e0b" }}>
                  [{source === "live" ? "FILESYSTEM" : "STATIC FALLBACK"}]
                </span>
              </p>
            </div>
            <button onClick={fetchData} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#a3a3a3", cursor: "pointer", transition: "all 0.2s" }}>
              REFRESH
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 20px", borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              border: activeTab === tab.id ? "2px solid rgba(201,168,76,0.3)" : "2px solid transparent",
              background: activeTab === tab.id ? "rgba(201,168,76,0.12)" : "transparent",
              color: activeTab === tab.id ? "#C9A84C" : "rgba(255,255,255,0.35)",
              cursor: "pointer", transition: "all 0.2s"
            }}>
              {tab.label}
              {tab.count !== null && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Agents Grid */}
        {activeTab === "agents" && (
          <div>
            {saveError && (
              <div style={{ marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5", fontSize: 13 }}>
                {saveError}
              </div>
            )}
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.06)", height: 140 }}>
                    <div style={{ width: "60%", height: 12, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
                    <div style={{ width: "40%", height: 10, borderRadius: 4, background: "rgba(255,255,255,0.04)", marginBottom: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
                    <div style={{ width: "80%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.03)", animation: "pulse 1.5s ease-in-out infinite" }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {agents.map((agent) => {
                  const tier = getTierFromEscalation(agent.escalation_level || agent.escalationLevel || "");
                  const tierColor = TIER_COLORS[tier] || "#34d399";
                  const statusColor = getStatusColor(agent.status);
                  const isEditing = editingAgent === agent.id;
                  return (
                    <div key={agent.id} style={{
                      padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)",
                      border: `2px solid ${isEditing ? `${tierColor}40` : "rgba(255,255,255,0.1)"}`,
                      boxShadow: `0 0 24px ${tierColor}15, 0 8px 32px rgba(0,0,0,0.4)`,
                      transition: "all 0.3s"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: statusColor, boxShadow: agent.status === "active" ? `0 0 12px ${statusColor}80` : "none" }} />
                          <span style={{ fontWeight: 700, fontSize: 15, color: "#e5e5e5" }}>{agent.name}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", padding: "4px 10px", borderRadius: 6, color: tierColor, border: `1px solid ${tierColor}40`, background: `${tierColor}12`, textTransform: "uppercase" }}>
                            {tier}
                          </span>
                          <button onClick={() => { setEditingAgent(isEditing ? null : agent.id); setEditModel(agent.model.split("/").pop() || agent.model); }} style={{
                            fontSize: 9, padding: "4px 8px", borderRadius: 4, cursor: "pointer", transition: "all 0.2s",
                            background: isEditing ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
                            border: isEditing ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.08)",
                            color: isEditing ? "#C9A84C" : "#525252"
                          }}>
                            {isEditing ? "CANCEL" : "EDIT"}
                          </button>
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: "#737373", margin: "0 0 6px" }}>{agent.role}</p>

                      {isEditing ? (
                        <div style={{ marginTop: 10 }}>
                          <label style={{ fontSize: 9, color: "#525252", letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>MODEL</label>
                          <select value={editModel} onChange={e => setEditModel(e.target.value)} style={{
                            width: "100%", padding: "8px 10px", borderRadius: 6, fontSize: 11,
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                            color: "#e5e5e5", fontFamily: "monospace", cursor: "pointer", outline: "none"
                          }}>
                            {AVAILABLE_MODELS.map(m => (
                              <option key={m.value} value={m.value} style={{ background: "#111", color: "#e5e5e5" }}>
                                {m.label} ({m.tier})
                              </option>
                            ))}
                          </select>
                          <button onClick={() => handleSaveModel(agent.id, editModel)} style={{
                            marginTop: 8, width: "100%", padding: "8px", fontSize: 10, fontWeight: 700,
                            letterSpacing: "0.1em", borderRadius: 6, cursor: "pointer",
                            background: "rgba(34,197,94,0.15)", border: "2px solid rgba(34,197,94,0.3)",
                            color: "#22c55e", transition: "all 0.2s"
                          }}>
                            SAVE MODEL
                          </button>
                        </div>
                      ) : (
                        <p style={{ fontSize: 11, color: "#525252", fontFamily: "monospace" }}>{agent.model}</p>
                      )}

                      {agent.skills && agent.skills.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                          {agent.skills.slice(0, 3).map((s) => (
                            <span key={s} style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                              {s}
                            </span>
                          ))}
                          {agent.skills.length > 3 && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>+{agent.skills.length - 3}</span>}
                        </div>
                      )}

                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                          {agent.capabilities.slice(0, 4).map((c) => (
                            <span key={c} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `${tierColor}08`, border: `1px solid ${tierColor}15`, color: `${tierColor}99` }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* System Tab — Live Vitals + Gateway Controls */}
        {activeTab === "system" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Live System Vitals */}
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>System Vitals</h2>
              {vitals ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {[
                    { label: "CPU", value: `${vitals.cpu.cores} cores`, sub: vitals.cpu.load, color: "#22d3ee" },
                    { label: "CPU MODEL", value: vitals.cpu.model.split("@")[0].trim().slice(0, 30), sub: vitals.cpu.model.includes("@") ? vitals.cpu.model.split("@")[1] : "", color: "#818cf8" },
                    { label: "MEMORY USED", value: vitals.memory.used, sub: `${vitals.memory.percent} of ${vitals.memory.total}`, color: parseFloat(vitals.memory.percent) > 80 ? "#ef4444" : "#22c55e" },
                    { label: "MEMORY FREE", value: vitals.memory.free, sub: `Total: ${vitals.memory.total}`, color: "#34d399" },
                    { label: "DISK USED", value: vitals.disk.used, sub: `${vitals.disk.percent} of ${vitals.disk.total}`, color: vitals.disk.percent && parseInt(vitals.disk.percent) > 80 ? "#f59e0b" : "#22c55e" },
                    { label: "DISK FREE", value: vitals.disk.available, sub: `Total: ${vitals.disk.total}`, color: "#60a5fa" },
                    { label: "UPTIME", value: vitals.uptime.slice(0, 50), sub: "", color: "#C9A84C" },
                    { label: "AGENT COUNT", value: `${agents.length} registered`, sub: `${agents.filter(a => a.status === "active").length} active`, color: "#22c55e" },
                  ].map((item) => (
                    <div key={item.label} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                      <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>{item.label}</p>
                      <p style={{ fontSize: 16, color: item.color, fontFamily: "monospace", fontWeight: 700, margin: 0 }}>{item.value}</p>
                      {item.sub && <p style={{ fontSize: 11, color: "#525252", margin: "4px 0 0", fontFamily: "monospace" }}>{item.sub}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#525252", fontSize: 13 }}>
                  Connecting to SSE for live vitals...
                </div>
              )}
            </div>

            {/* Gateway Controls */}
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Gateway Controls</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {[
                  { label: "Restart Gateway", action: "restart-gateway", color: "#f59e0b", desc: "Restart the OpenClaw Gateway process" },
                  { label: "Run Doctor", action: "run-doctor", color: "#22c55e", desc: "Run diagnostics on the OpenClaw system" },
                  { label: "Reload Crons", action: "reload-crons", color: "#818cf8", desc: "Force-reload cron schedules from jobs.json" },
                ].map((ctrl) => (
                  <div key={ctrl.action} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: `2px solid ${ctrl.color}20`, boxShadow: `0 0 16px ${ctrl.color}08` }}>
                    <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 6px", textTransform: "uppercase" }}>{ctrl.label}</p>
                    <p style={{ fontSize: 11, color: "#525252", margin: "0 0 12px" }}>{ctrl.desc}</p>
                    <button onClick={() => handleGatewayAction(ctrl.action)} disabled={gatewayAction === ctrl.action} style={{
                      padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      background: `${ctrl.color}15`, border: `2px solid ${ctrl.color}30`, borderRadius: 6,
                      color: ctrl.color, cursor: gatewayAction === ctrl.action ? "wait" : "pointer",
                      opacity: gatewayAction === ctrl.action ? 0.5 : 1, transition: "all 0.2s"
                    }}>
                      {gatewayAction === ctrl.action ? "RUNNING..." : "EXECUTE"}
                    </button>
                  </div>
                ))}
              </div>
              {gatewayOutput && (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace", fontSize: 11, color: "#a3a3a3", whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
                  {gatewayOutput}
                </div>
              )}
            </div>

            {/* Platform Info */}
            <div>
              <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Platform</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {[
                  { label: "RUNTIME", value: "OpenClaw Gateway" },
                  { label: "FIREBASE PROJECT", value: "apex-athlete-73755" },
                  { label: "WORKSPACE", value: "/Users/admin/.openclaw/workspace" },
                  { label: "DEPLOY TARGET", value: "Vercel (ramiche-site)" },
                  { label: "TUNNEL", value: "command.parallaxvinc.com" },
                  { label: "CHANNEL", value: "Telegram + Discord" },
                ].map((item) => (
                  <div key={item.label} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.06)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                    <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>{item.label}</p>
                    <p style={{ fontSize: 14, color: "#e5e5e5", fontFamily: "monospace", margin: 0 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Crons Tab Placeholder */}
        {activeTab === "crons" && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ color: "#525252", fontSize: 13 }}>Cron management is available on the Calendar page.</p>
            <Link href="/command-center/calendar" style={{ color: "#C9A84C", fontSize: 12, textDecoration: "none", marginTop: 8, display: "inline-block" }}>
              Go to Calendar →
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        select option { background: #111; color: #e5e5e5; }
      `}</style>
    </div>
  );
}
