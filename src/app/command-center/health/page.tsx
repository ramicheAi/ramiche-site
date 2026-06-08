"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ParticleField from "@/components/ParticleField";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
  if (s === "up" || s === "active") return "var(--c-green)";
  if (s === "down") return "var(--c-red)";
  if (s === "idle") return "var(--c-amber)";
  if (s === "checking") return "var(--c-amber)";
  return "var(--t-lo)";
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
          // 2xx = up. 405 / 401 / 400 mean the service responded but rejects
          // an unauthenticated GET probe (e.g. POST-only routes such as
          // /api/command-center/chat). Those still indicate the service is up.
          const reachable = res.ok || res.status === 405 || res.status === 401 || res.status === 400;
          return {
            ...svc,
            status: reachable ? ("up" as const) : ("down" as const),
            latency: Date.now() - start,
            lastCheck: new Date().toLocaleTimeString(),
          };
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
    <InstrumentPage
      id="health"
      title="System Health"
      section="Operations"
      icon="health"
      accent="var(--c-cyan)"
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { checkServices(); fetchAgents(); }} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "var(--ink-2)", border: "2px solid var(--line)", borderRadius: "var(--r-sm)", color: "var(--t-hi)", cursor: "pointer" }}>
            REFRESH
          </button>
          <button onClick={handleScan} disabled={scanning} style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: scanning ? "color-mix(in srgb, var(--c-red) 10%, transparent)" : "color-mix(in srgb, var(--c-red) 5%, transparent)", border: "2px solid color-mix(in srgb, var(--c-red) 30%, transparent)", borderRadius: "var(--r-sm)", color: "var(--c-red)", cursor: scanning ? "wait" : "pointer" }}>
            {scanning ? "SCANNING..." : "RE-SCAN"}
          </button>
        </div>
      }
    >
      <ParticleField />
      <p style={{ fontSize: 13, color: "var(--t-mid)", margin: "0 0 24px" }} className="mono">
        {loading ? "SCANNING..." : `${activeCount} active · ${idleCount} idle · ${upCount}/${services.length} services up · ${enabledCrons} crons`}
        {lastSync && <span style={{ marginLeft: 8, color: "var(--c-green)" }}>● LIVE · {lastSync}</span>}
      </p>

        {/* System Vitals Bar */}
        {vitals && (
          <Panel title="System Vitals" icon="pulse">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { label: "CPU", value: `${vitals.cpu.cores} cores`, sub: `Load: ${vitals.cpu.load}`, color: "var(--c-cyan)", pct: null },
              { label: "MEMORY", value: vitals.memory.used, sub: `${vitals.memory.percent} of ${vitals.memory.total}`, color: memPct > 80 ? "var(--c-red)" : memPct > 60 ? "var(--c-amber)" : "var(--c-green)", pct: memPct },
              { label: "DISK", value: vitals.disk.used, sub: `${vitals.disk.percent} of ${vitals.disk.total}`, color: "var(--c-sky)", pct: vitals.disk.percent ? parseInt(vitals.disk.percent) : null },
              { label: "UPTIME", value: vitals.uptime.slice(0, 40), sub: "", color: "var(--c-gold)", pct: null },
              { label: "PROCESSES", value: `${sessions.count}`, sub: "OpenClaw / Claude / Node", color: "var(--c-purple)", pct: null },
            ].map((m) => (
              <div key={m.label} style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: `2px solid color-mix(in srgb, ${m.color} 20%, transparent)` }}>
                <div style={{ fontSize: 10, color: "var(--t-mid)", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 6 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: "var(--f-mono)" }}>{m.value}</div>
                {m.sub && <div style={{ fontSize: 10, color: "var(--t-lo)", marginTop: 4 }}>{m.sub}</div>}
                {m.pct !== null && (
                  <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "var(--line)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${m.pct}%`, background: m.color, borderRadius: 2, transition: "width 0.5s" }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          </Panel>
        )}

        <div style={{ height: 20 }} />

        {/* Service Status */}
        <Panel title="Service Status" icon="gateway">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {services.map((svc) => {
            const color = getStatusColor(svc.status);
            return (
              <div key={svc.name} style={{ padding: 20, borderRadius: "var(--r-lg)", background: "var(--ink-2)", border: `2px solid color-mix(in srgb, ${color} 30%, transparent)`, transition: "all 0.3s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t-hi)" }}>{svc.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: `color-mix(in srgb, ${svc.type === "external" ? "var(--c-indigo)" : svc.type === "local" ? "var(--c-amber)" : "var(--c-green)"} 15%, transparent)`, color: svc.type === "external" ? "var(--c-indigo)" : svc.type === "local" ? "var(--c-amber)" : "var(--c-green)", fontWeight: 700, letterSpacing: "0.1em" }}>
                      {svc.type.toUpperCase()}
                    </span>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, boxShadow: svc.status === "up" ? `0 0 8px color-mix(in srgb, ${color} 50%, transparent)` : "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{svc.status.toUpperCase()}</span>
                  {svc.latency !== undefined && <span style={{ fontSize: 11, color: "var(--t-lo)", fontFamily: "var(--f-mono)" }}>{svc.latency}ms</span>}
                </div>
                {svc.lastCheck && <p style={{ fontSize: 10, color: "var(--t-lo)", marginTop: 6 }}>Last: {svc.lastCheck}</p>}
              </div>
            );
          })}
        </div>
        </Panel>

        {/* Active Processes */}
        {sessions.processes.length > 0 && (
          <>
            <div style={{ height: 20 }} />
            <Panel title={`Active Processes (${sessions.count})`} icon="pulse">
            <div style={{ borderRadius: "var(--r-md)", overflow: "hidden" }}>
              {sessions.processes.slice(0, 10).map((p, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 50px 50px 1fr", gap: 12, padding: "10px 16px", borderBottom: i < Math.min(sessions.processes.length, 10) - 1 ? "1px solid var(--line)" : "none", fontSize: 11, fontFamily: "var(--f-mono)" }}>
                  <span style={{ color: "var(--c-purple)" }}>{p.pid}</span>
                  <span style={{ color: parseFloat(p.cpu) > 50 ? "var(--c-red)" : "var(--t-lo)" }}>{p.cpu}%</span>
                  <span style={{ color: parseFloat(p.mem) > 5 ? "var(--c-amber)" : "var(--t-lo)" }}>{p.mem}%</span>
                  <span style={{ color: "var(--t-mid)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cmd}</span>
                </div>
              ))}
            </div>
            </Panel>
          </>
        )}

        <div style={{ height: 20 }} />

        {/* Agent Health Grid */}
        <Panel title={`Agent Status (${agents.length})`} icon="agents">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {agents.map((agent) => {
            const color = getStatusColor(agent.status);
            return (
              <div key={agent.id} style={{ padding: 16, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "2px solid var(--line)", transition: "all 0.3s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, boxShadow: agent.status === "active" ? `0 0 8px color-mix(in srgb, ${color} 50%, transparent)` : "none", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</span>
                </div>
                <p style={{ fontSize: 10, color: "var(--t-lo)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.role}</p>
                <p style={{ fontSize: 9, color: "var(--t-lo)", fontFamily: "var(--f-mono)", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.model}</p>
              </div>
            );
          })}
        </div>
        </Panel>

        {/* Security Scan Results */}
        {scanResult && (
          <>
            <div style={{ height: 20 }} />
            <Panel title="Security Scan Results" icon="security">
            <div style={{ borderRadius: "var(--r-md)", fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--t-mid)", whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto" }}>
              {scanResult}
            </div>
            </Panel>
          </>
        )}

        {/* Cron Health Summary */}
        {cronJobs.length > 0 && (
          <>
            <div style={{ height: 20 }} />
            <Panel title={`Cron Health (${cronJobs.length} jobs)`} icon="clock">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {cronJobs.slice(0, 12).map((cron) => {
                const isEnabled = cron.enabled !== false;
                const color = isEnabled ? "var(--c-green)" : "var(--t-lo)";
                return (
                  <div key={cron.id || cron.name} style={{ padding: 14, borderRadius: "var(--r-md)", background: "var(--ink-2)", border: "1px solid var(--line)", opacity: isEnabled ? 1 : 0.5 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isEnabled ? "var(--t-hi)" : "var(--t-lo)" }}>{cron.name || cron.id}</span>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    </div>
                    <p style={{ fontSize: 9, color: "var(--t-lo)", fontFamily: "var(--f-mono)", margin: 0 }}>{cron.schedule}</p>
                    {cron.lastRun && <p style={{ fontSize: 9, color: "var(--t-lo)", margin: "2px 0 0" }}>Last: {cron.lastRun}</p>}
                  </div>
                );
              })}
            </div>
            </Panel>
          </>
        )}
    </InstrumentPage>
  );
}
