"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   SYSTEM HEALTH — TRIAGE Dashboard
   Live polling: agent status, cron health, service checks
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
}

const SERVICES: { name: string; url: string }[] = [
  { name: "Vercel (ramiche-site)", url: "/api/command-center/agents" },
  { name: "Supabase", url: "/api/command-center/chat" },
  { name: "Firebase (Firestore)", url: "/api/command-center/crons" },
];

function getStatusColor(s: string) {
  if (s === "up" || s === "active") return "#22c55e";
  if (s === "down") return "#ef4444";
  if (s === "idle") return "#f59e0b";
  if (s === "checking") return "#f59e0b";
  return "#6b7280";
}

export default function SystemHealthPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [services, setServices] = useState<ServiceCheck[]>(
    SERVICES.map((s) => ({ ...s, status: "checking" as const }))
  );
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("");

  const checkServices = useCallback(async () => {
    const results = await Promise.all(
      SERVICES.map(async (svc) => {
        const start = Date.now();
        try {
          const res = await fetch(svc.url, { cache: "no-store" });
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
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAgents();
    checkServices();
    const interval = setInterval(() => { fetchAgents(); checkServices(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAgents, checkServices]);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;
  const upCount = services.filter((s) => s.status === "up").length;

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 30% 20%, rgba(34,197,94,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 70% 80%, rgba(16,185,129,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(34,197,94,0.3)" }}>System Health</h1>
              <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
                {loading ? "SCANNING..." : `${activeCount} active · ${idleCount} idle · ${upCount}/${services.length} services up`}
                {lastSync && <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>● LIVE · {lastSync}</span>}
              </p>
            </div>
            <button
              onClick={() => { checkServices(); fetchAgents(); }}
              style={{ padding: "8px 16px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#a3a3a3", cursor: "pointer" }}
            >
              REFRESH
            </button>
          </div>
        </div>

        {/* Service Status */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Service Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {services.map((svc) => {
            const color = getStatusColor(svc.status);
            return (
              <div key={svc.name} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: `1px solid ${color}30`, boxShadow: `0 0 24px ${color}15, 0 8px 32px rgba(0,0,0,0.4)`, transition: "all 0.3s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{svc.name}</span>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 12px ${color}80` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color }}>{svc.status.toUpperCase()}</span>
                  {svc.latency !== undefined && <span style={{ fontSize: 11, color: "#525252", fontFamily: "monospace" }}>{svc.latency}ms</span>}
                </div>
                {svc.lastCheck && <p style={{ fontSize: 10, color: "#404040", marginTop: 8 }}>Last check: {svc.lastCheck}</p>}
              </div>
            );
          })}
        </div>

        {/* Agent Health Grid */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#22c55e", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Agent Status ({agents.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {agents.map((agent) => {
            const color = getStatusColor(agent.status);
            return (
              <div key={agent.id} style={{ padding: 16, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", transition: "all 0.3s" }}>
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
      </div>
    </div>
  );
}
