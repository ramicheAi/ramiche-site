"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function SettingsContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
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

  const [cronEvents, setCronEvents] = useState<
    {
      id: string;
      time: string;
      label: string;
      agent: string;
      enabled: boolean;
      schedule: string;
      frequency: string;
      lastRun?: string | null;
      lastResult?: string | null;
    }[]
  >([]);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronSource, setCronSource] = useState<string>("");
  const [cronStats, setCronStats] = useState({ total: 0, enabled: 0, disabled: 0 });
  const [syncPaths, setSyncPaths] = useState<Record<string, string> | null>(null);

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
    const tab = searchParams.get("tab");
    if (tab === "agents" || tab === "system" || tab === "crons") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const selectTab = useCallback(
    (id: "agents" | "system" | "crons") => {
      setActiveTab(id);
      router.replace(`${pathname}?tab=${id}`, { scroll: false });
    },
    [pathname, router]
  );

  useEffect(() => {
    if (activeTab !== "crons") return;
    let cancelled = false;
    setCronLoading(true);
    void (async () => {
      try {
        const [calRes, fsRes] = await Promise.all([
          fetch("/api/command-center/calendar", { cache: "no-store" }),
          fetch("/api/command-center/firestore-sync", { cache: "no-store" }),
        ]);
        if (cancelled) return;

        if (fsRes.ok) {
          try {
            const fsData = (await fsRes.json()) as { paths?: Record<string, string> };
            const p = fsData.paths;
            if (p && typeof p === "object" && !cancelled) {
              setSyncPaths(p);
            } else if (!cancelled) setSyncPaths(null);
          } catch {
            if (!cancelled) setSyncPaths(null);
          }
        } else if (!cancelled) {
          setSyncPaths(null);
        }

        if (!calRes.ok || cancelled) {
          if (!cancelled) {
            setCronEvents([]);
            setCronSource("error");
            setCronStats({ total: 0, enabled: 0, disabled: 0 });
          }
          return;
        }
        const data = await calRes.json();
        if (cancelled) return;
        setCronEvents(Array.isArray(data.events) ? data.events : []);
        setCronSource(typeof data.source === "string" ? data.source : "empty");
        setCronStats({
          total: typeof data.total === "number" ? data.total : 0,
          enabled: typeof data.enabled === "number" ? data.enabled : 0,
          disabled: typeof data.disabled === "number" ? data.disabled : 0,
        });
      } catch {
        if (!cancelled) {
          setCronEvents([]);
          setCronSource("error");
          setSyncPaths(null);
        }
      } finally {
        if (!cancelled) setCronLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

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
      if (action === "reload-crons" && res.ok) {
        try {
          const cal = await fetch("/api/command-center/calendar", { cache: "no-store" });
          if (cal.ok) {
            const j = await cal.json();
            if (Array.isArray(j.events)) {
              setCronEvents(j.events);
              setCronSource(typeof j.source === "string" ? j.source : "empty");
              setCronStats({
                total: typeof j.total === "number" ? j.total : 0,
                enabled: typeof j.enabled === "number" ? j.enabled : 0,
                disabled: typeof j.disabled === "number" ? j.disabled : 0,
              });
            }
          }
        } catch {
          /* ignore refresh errors */
        }
      }
    } catch (err) {
      setGatewayOutput(`Error: ${err}`);
    }
    setTimeout(() => setGatewayAction(null), 5000);
  };

  const tabs = [
    { id: "agents" as const, label: "AGENTS", count: agents.length },
    { id: "system" as const, label: "SYSTEM", count: null },
    {
      id: "crons" as const,
      label: "CRONS",
      count: cronStats.total > 0 ? cronStats.total : null,
    },
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
            <button key={tab.id} type="button" onClick={() => selectTab(tab.id)} style={{
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

        {activeTab === "crons" && (
          <div style={{ maxWidth: 1100 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 12, fontWeight: 800, color: "#C9A84C", letterSpacing: "0.15em", margin: "0 0 8px", textTransform: "uppercase" }}>
                  Cron jobs
                </h2>
                <p style={{ fontSize: 12, color: "#737373", margin: 0, maxWidth: 560 }}>
                  Same data as Calendar — local <code style={{ color: "#a3a3a3", fontSize: 11 }}>jobs.json</code> under the resolved cron directory (default{" "}
                  <code style={{ color: "#a3a3a3", fontSize: 11 }}>~/.openclaw/cron</code>; override with{" "}
                  <code style={{ color: "#a3a3a3", fontSize: 11 }}>OPENCLAW_CRON_DIR</code> or{" "}
                  <code style={{ color: "#a3a3a3", fontSize: 11 }}>OPENCLAW_HOME</code>) when this server can read the OpenClaw host; otherwise{" "}
                  <code style={{ color: "#a3a3a3", fontSize: 11 }}>POST /api/command-center/firestore-sync</code> pushes jobs to Firestore for Vercel.
                </p>
                <p style={{ fontSize: 11, color: "#525252", margin: "10px 0 0" }}>
                  {cronLoading
                    ? "Loading…"
                    : cronSource === "live" || cronSource === "firestore"
                      ? `● ${cronStats.enabled} enabled · ${cronStats.disabled} disabled · ${cronStats.total} total${cronSource === "firestore" ? " (Firestore)" : ""}`
                      : cronSource === "empty"
                        ? "No jobs.json on this host (or empty)."
                        : cronSource === "error"
                          ? "Could not load schedule."
                          : ""}
                </p>
                {syncPaths && !cronLoading && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 10,
                      color: "#737373",
                      fontFamily: "ui-monospace, monospace",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#525252", display: "block", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Sync paths (this server)
                    </span>
                    {Object.entries(syncPaths).map(([k, v]) => (
                      <div key={k}>
                        <span style={{ color: "#a3a3a3" }}>{k}</span>
                        {": "}
                        <span style={{ color: "#d4d4d4", wordBreak: "break-all" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Link
                  href="/command-center/calendar"
                  style={{
                    padding: "10px 18px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    background: "rgba(168,85,247,0.12)",
                    border: "2px solid rgba(168,85,247,0.35)",
                    borderRadius: 8,
                    color: "#c4b5fd",
                    textDecoration: "none",
                  }}
                >
                  Open calendar →
                </Link>
                <button
                  type="button"
                  onClick={() => handleGatewayAction("reload-crons")}
                  disabled={gatewayAction === "reload-crons"}
                  style={{
                    padding: "10px 18px",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    background: "rgba(129,140,248,0.12)",
                    border: "2px solid rgba(129,140,248,0.35)",
                    borderRadius: 8,
                    color: "#a5b4fc",
                    cursor: gatewayAction === "reload-crons" ? "wait" : "pointer",
                    opacity: gatewayAction === "reload-crons" ? 0.6 : 1,
                  }}
                >
                  {gatewayAction === "reload-crons" ? "Reloading…" : "Reload crons (gateway)"}
                </button>
              </div>
            </div>

            {cronLoading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#525252", fontSize: 13 }}>Loading cron schedule…</div>
            ) : cronEvents.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  borderRadius: 12,
                  border: "1px dashed rgba(255,255,255,0.1)",
                  background: "rgba(0,0,0,0.4)",
                }}
              >
                <p style={{ color: "#737373", fontSize: 14, margin: 0 }}>No cron jobs to show here.</p>
                <p style={{ color: "#525252", fontSize: 12, margin: "10px 0 0" }}>
                  Edit <code style={{ color: "#a3a3a3" }}>jobs.json</code> on the OpenClaw host or sync via your bridge.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.5)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", textAlign: "left" }}>
                      <th style={{ padding: "12px 14px", color: "#737373", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10, textTransform: "uppercase" }}>Job</th>
                      <th style={{ padding: "12px 14px", color: "#737373", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10, textTransform: "uppercase" }}>Agent</th>
                      <th style={{ padding: "12px 14px", color: "#737373", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10, textTransform: "uppercase" }}>Time</th>
                      <th style={{ padding: "12px 14px", color: "#737373", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10, textTransform: "uppercase" }}>Frequency</th>
                      <th style={{ padding: "12px 14px", color: "#737373", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10, textTransform: "uppercase" }}>Status</th>
                      <th style={{ padding: "12px 14px", color: "#737373", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10, textTransform: "uppercase" }}>Last run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronEvents.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "12px 14px", color: "#e5e5e5", fontWeight: 600, verticalAlign: "top" }}>{row.label}</td>
                        <td style={{ padding: "12px 14px", color: "#a3a3a3", fontFamily: "monospace", verticalAlign: "top" }}>{row.agent}</td>
                        <td style={{ padding: "12px 14px", color: "#a3a3a3", fontFamily: "monospace", verticalAlign: "top" }}>{row.time}</td>
                        <td style={{ padding: "12px 14px", color: "#737373", verticalAlign: "top", maxWidth: 220 }}>{row.frequency}</td>
                        <td style={{ padding: "12px 14px", verticalAlign: "top" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              color: row.enabled ? "#22c55e" : "#f59e0b",
                            }}
                          >
                            {row.enabled ? "ON" : "OFF"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", color: "#525252", fontSize: 11, fontFamily: "monospace", verticalAlign: "top" }}>
                          {row.lastRun || "—"}
                          {row.lastResult ? ` · ${row.lastResult}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {gatewayOutput && activeTab === "crons" && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "#a3a3a3",
                  whiteSpace: "pre-wrap",
                  maxHeight: 160,
                  overflow: "auto",
                }}
              >
                {gatewayOutput}
              </div>
            )}
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

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#000000",
            color: "#737373",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            letterSpacing: "0.08em",
          }}
        >
          Loading settings…
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
