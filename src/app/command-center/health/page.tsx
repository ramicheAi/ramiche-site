"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   SYSTEM HEALTH — TRIAGE Dashboard
   Live SSE vitals, real service checks, agent status, cron health
   ══════════════════════════════════════════════════════════════════════════════ */

interface AgentStatus {
  id: string;
  name: string;
  model: string;
  role: string;
  status: string;
}

interface ServiceCheck {
  name: string;
  url: string;
  status: "up" | "down" | "checking";
  latency?: number;
  lastCheck?: string;
  type: "internal" | "external" | "local";
}

interface SystemVitals {
  cpu: { cores: number; model: string; load: string };
  memory: { total: string; free: string; used: string; percent: string };
  disk: { total: string; used: string; available: string; percent: string };
  uptime: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  lastResult?: string;
}

const SERVICES: { name: string; url: string; type: "internal" | "external" | "local" }[] = [
  { name: "CC API (Agents)", url: "/api/command-center/agents", type: "internal" },
  { name: "CC API (Chat)", url: "/api/command-center/chat", type: "internal" },
  { name: "CC API (SSE)", url: "/api/command-center/sse", type: "internal" },
  { name: "CC API (Projects)", url: "/api/command-center/projects", type: "internal" },
  { name: "CC API (Memory)", url: "/api/command-center/memory", type: "internal" },
  { name: "Bridge API", url: "/api/bridge", type: "internal" },
];

function getStatusColor(s: string) {
  if (s === "up" || s === "active") return "#22c55e";
  if (s === "down") return "#ef4444";
  if (s === "idle") return "#f59e0b";
  if (s === "checking") return "#f59e0b";
  return "#6b7280";
}

function getMemoryPercent(pct: string): number {
  return parseFloat(pct) || 0;
}

export default function SystemHealthPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [services, setServices] = useState<ServiceCheck[]>(
    SERVICES.map((s) => ({ ...s, status: "checking" as const }))
  );
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("");
  const [vitals, setVitals] = useState<SystemVitals | null>(null);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [sessions, setSessions] = useState<{ count: number; processes: { pid: string; cpu: string; mem: string; cmd: string }[] }>({ count: 0, processes: [] });
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const checkServices = useCallback(async () => {
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        const start = Date.now();
        try {
          const res = await fetch(svc.url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
          return { ...svc, status: res.ok ? ("up" as const) : ("down" as const), latency: Date.now() - start, lastCheck: new Date().toLocaleTimeString() };
        } catch {
          return { ...svc, status: "down" as const, latency: Date.now() - start, lastCheck: new Date().toLocaleTimeString() };
        }
      })
    );
    setServices(results);
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch { /* retain previous state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAgents();
    checkServices();
    const interval = setInterval(() => { fetchAgents(); checkServices(); }, 15_000);
    return () => clearInterval(interval);
  }, [fetchAgents, checkServices]);

  useEffect(() => {
    const es = new EventSource("/api/command-center/sse");
    sseRef.current = es;

    es.addEventListener("snapshot", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.vitals) setVitals(data.vitals);
        if (data.sessions) setSessions(data.sessions);
        if (data.crons) setCronJobs(data.crons);
      } catch { /* ignore */ }
    });

    es.addEventListener("vitals", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.vitals) setVitals(data.vitals);
        if (data.sessions) setSessions(data.sessions);
      } catch { /* ignore */ }
    });

    es.addEventListener("agents", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.crons) setCronJobs(data.crons);
      } catch { /* ignore */ }
    });

    return () => es.close();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/command-center/security", { cache: "no-store" });
      const data = await res.json();
      setScanResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setScanResult(`Scan error: ${err}`);
    }
    setScanning(false);
  };

  const activeCount = agents.filter((a) => a.status === "active").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const upCount = services.filter((s) => s.status === "up").length;
  const memPct = vitals ? getMemoryPercent(vitals.memory.percent) : 0;
  const enabledCrons = cronJobs.filter(c => c.enabled !== false).length;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 30% 20%, rgba(34,197,94,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 70% 80%, rgba(16,185,129,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(34,197,94,0.3)" }}>System Health</h1>
              <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
                {loading ? "SCANNING..." : `${activeCount} active · ${idleCount} idle · ${upCount}/${services.length} services up · ${enabledCrons} crons`}
                {lastSync && <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>● LIVE · {lastSync}</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { checkServices(); fetchAgents(); }} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#a3a3a3", cursor: "pointer" }}>
                REFRESH
              </button>
              <button onClick={handleScan} disabled={scanning} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: scanning ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.05)", border: "2px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", cursor: scanning ? "wait" : "pointer" }}>
                {scanning ? "SCANNING..." : "RE-SCAN"}
              </button>
            </div>
          </div>
        </div>

        {/* System Vitals Bar */}
        {vitals && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
            {[
              { label: "CPU", value: `${vitals.cpu.cores} cores`, sub: `Load: ${vitals.cpu.load}`, color: "#22d3ee", pct: null },
              { label: "MEMORY", value: vitals.memory.used, sub: `${vitals.memory.percent} of ${vitals.memory.total}`, color: memPct > 80 ? "#ef4444" : memPct > 60 ? "#f59e0b" : "#22c55e", pct: memPct },
              { label: "DISK", value: vitals.disk.used, sub: `${vitals.disk.percent} of ${vitals.disk.total}`, color: "#60a5fa", pct: vitals.disk.percent ? parseInt(vitals.disk.percent) : null },
              { label: "UPTIME", value: vitals.uptime.slice(0, 40), sub: "", color: "#C9A84C", pct: null },
              { label: "PROCESSES", value: `${sessions.count}`, sub: "OpenClaw / Claude / Node", color: "#a855f7", pct: null },
            ].map((m) => (
              <div key={m.label} style={{ padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: `2px solid ${m.color}20`, boxShadow: `0 0 16px ${m.color}08` }}>
                <div style={{ fontSize: 10, color: "#737373", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: "monospace" }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 10, color: "#525252", marginTop: 4 }}>{m.sub}</div>}
                {m.pct !== null && (
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: "width 0.5s" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Service Status */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Service Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {services.map((svc) => {
            const color = getStatusColor(svc.status);
            return (
              <div key={svc.name} style={{ padding: 20, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: `2px solid ${color}30`, boxShadow: `0 0 24px ${color}15, 0 8px 32px rgba(0,0,0,0.4)`, transition: "all 0.3s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{svc.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `${svc.type === "external" ? "#818cf8" : svc.type === "local" ? "#f59e0b" : "#34d399"}15`, color: svc.type === "external" ? "#818cf8" : svc.type === "local" ? "#f59e0b" : "#34d399", fontWeight: 700, letterSpacing: "0.1em" }}>
                      {svc.type.toUpperCase()}
                    </span>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, boxShadow: svc.status === "up" ? `0 0 8px ${color}80` : "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{svc.status.toUpperCase()}</span>
                  {svc.latency !== undefined && <span style={{ fontSize: 11, color: "#525252", fontFamily: "monospace" }}>{svc.latency}ms</span>}
                </div>
                {svc.lastCheck && <p style={{ fontSize: 10, color: "#404040", marginTop: 6 }}>Last: {svc.lastCheck}</p>}
              </div>
            );
          })}
        </div>

        {/* Active Processes */}
        {sessions.processes.length > 0 && (
          <>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#a855f7", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Active Processes ({sessions.count})</h2>
            <div style={{ marginBottom: 32, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(168,85,247,0.15)", overflow: "hidden" }}>
              {sessions.processes.slice(0, 10).map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 50px 50px 1fr", gap: 12, padding: "10px 16px", borderBottom: i < Math.min(sessions.processes.length, 10) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", fontSize: 11, fontFamily: "monospace" }}>
                  <span style={{ color: "#a855f7" }}>{p.pid}</span>
                  <span style={{ color: parseFloat(p.cpu) > 50 ? "#ef4444" : "#525252" }}>{p.cpu}%</span>
                  <span style={{ color: parseFloat(p.mem) > 5 ? "#f59e0b" : "#525252" }}>{p.mem}%</span>
                  <span style={{ color: "#737373", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cmd}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Agent Health Grid */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Agent Status ({agents.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
          {agents.map((agent) => {
            const color = getStatusColor(agent.status);
            return (
              <div key={agent.id} style={{ padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(255,255,255,0.06)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", transition: "all 0.3s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, boxShadow: agent.status === "active" ? `0 0 8px ${color}80` : "none", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</span>
                </div>
                <p style={{ fontSize: 10, color: "#525252", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.role}</p>
                <p style={{ fontSize: 9, color: "#404040", fontFamily: "monospace", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.model}</p>
              </div>
            );
          })}
        </div>

        {/* Security Scan Results */}
        {scanResult && (
          <>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#ef4444", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Security Scan Results</h2>
            <div style={{ padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "2px solid rgba(239,68,68,0.15)", fontFamily: "monospace", fontSize: 11, color: "#a3a3a3", whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto", marginBottom: 32 }}>
              {scanResult}
            </div>
          </>
        )}

        {/* Cron Health Summary */}
        {cronJobs.length > 0 && (
          <>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Cron Health ({cronJobs.length} jobs)</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {cronJobs.slice(0, 12).map((cron) => {
                const isEnabled = cron.enabled !== false;
                const color = isEnabled ? "#22c55e" : "#525252";
                return (
                  <div key={cron.id || cron.name} style={{ padding: 14, borderRadius: 10, background: "rgba(0,0,0,0.95)", border: `1px solid ${isEnabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`, opacity: isEnabled ? 1 : 0.5 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isEnabled ? "#e5e5e5" : "#525252" }}>{cron.name || cron.id}</span>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    </div>
                    <p style={{ fontSize: 9, color: "#525252", fontFamily: "monospace", margin: 0 }}>{cron.schedule}</p>
                    {cron.lastRun && <p style={{ fontSize: 9, color: "#404040", margin: "2px 0 0" }}>Last: {cron.lastRun}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
