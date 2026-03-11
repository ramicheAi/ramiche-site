"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   SETTINGS — System Configuration & Agent Management
   Live data from /api/command-center/agents + /api/command-center/crons
   ══════════════════════════════════════════════════════════════════════════════ */

interface AgentConfig {
  id: string;
  name: string;
  model: string;
  provider: string;
  role: string;
  capabilities: string[];
  skills: string[];
  escalationLevel: string;
  status: string;
}

const TIER_COLORS: Record<string, string> = {
  APEX: "#C9A84C",
  PRO: "#818cf8",
  CORE: "#34d399",
  LOCAL: "#f59e0b",
};

const TIER_MAP: Record<string, string> = {
  atlas: "APEX", themis: "APEX", triage: "PRO", proximon: "PRO",
  aetherion: "PRO", mercury: "PRO", shuri: "CORE", simons: "CORE",
  drstrange: "CORE", vee: "CORE", ink: "CORE", haven: "CORE",
  nova: "CORE", kiyosaki: "CORE", themaestro: "LOCAL", michael: "LOCAL",
  prophets: "LOCAL", selah: "LOCAL", echo: "LOCAL", widow: "LOCAL",
};

function getStatusColor(status: string) {
  if (status === "active") return "#22c55e";
  if (status === "idle") return "#f59e0b";
  return "#6b7280";
}

export default function SettingsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState("");
  const [activeTab, setActiveTab] = useState<"agents" | "system">("agents");

  const fetchData = useCallback(async () => {
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
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const tabs = [
    { id: "agents" as const, label: "AGENTS", count: agents.length },
    { id: "system" as const, label: "SYSTEM", count: null },
  ];

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />

      {/* Ambient glow layer */}
      <div style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        background: "radial-gradient(ellipse 800px 600px at 25% 15%, rgba(201,168,76,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 85%, rgba(249,115,22,0.06) 0%, transparent 60%)"
      }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/command-center"
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#737373",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
              transition: "all 0.15s"
            }}
          >
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(201,168,76,0.3)" }}>
            Settings
          </h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>
            {loading ? "LOADING..." : `${agents.length} agents registered`}
            {lastSync && <span style={{ marginLeft: 8, color: "rgba(34,197,94,0.6)" }}>● LIVE · {lastSync}</span>}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                border: activeTab === tab.id ? "1px solid rgba(201,168,76,0.3)" : "1px solid transparent",
                background: activeTab === tab.id ? "rgba(201,168,76,0.12)" : "transparent",
                color: activeTab === tab.id ? "#C9A84C" : "rgba(255,255,255,0.35)",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {tab.label}
              {tab.count !== null && (
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Agents Grid */}
        {activeTab === "agents" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {agents.map((agent) => {
              const tier = TIER_MAP[agent.id.toLowerCase()] || "CORE";
              const tierColor = TIER_COLORS[tier] || "#34d399";
              const statusColor = getStatusColor(agent.status);
              return (
                <div
                  key={agent.id}
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    background: "rgba(0,0,0,0.95)",
                    border: `1px solid rgba(255,255,255,0.1)`,
                    boxShadow: `0 0 24px ${tierColor}15, 0 8px 32px rgba(0,0,0,0.4)`,
                    transition: "all 0.3s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: statusColor,
                        boxShadow: `0 0 12px ${statusColor}80`
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#e5e5e5" }}>{agent.name}</span>
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      padding: "4px 10px",
                      borderRadius: 6,
                      color: tierColor,
                      border: `1px solid ${tierColor}40`,
                      background: `${tierColor}12`,
                      textTransform: "uppercase"
                    }}>
                      {tier}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#737373", margin: "0 0 6px" }}>{agent.role}</p>
                  <p style={{ fontSize: 11, color: "#525252", fontFamily: "monospace" }}>{agent.model}</p>
                  {agent.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                      {agent.skills.slice(0, 3).map((s) => (
                        <span key={s} style={{
                          fontSize: 9,
                          padding: "3px 8px",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.3)"
                        }}>
                          {s}
                        </span>
                      ))}
                      {agent.skills.length > 3 && (
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>+{agent.skills.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* System Tab */}
        {activeTab === "system" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {[
              { label: "PLATFORM", value: "macOS Darwin 24.6.0 (x64)" },
              { label: "NODE", value: "v25.5.0" },
              { label: "RUNTIME", value: "OpenClaw Gateway" },
              { label: "PRIMARY MODEL", value: "Claude Opus 4.6" },
              { label: "FALLBACK MODEL", value: "Claude Sonnet 4.5" },
              { label: "FIREBASE PROJECT", value: "apex-athlete-73755" },
              { label: "WORKSPACE", value: "/Users/admin/.openclaw/workspace" },
              { label: "DEPLOY TARGET", value: "Vercel (ramiche-site)" },
              { label: "AGENT COUNT", value: `${agents.length} registered` },
              { label: "CHANNEL", value: "Telegram + Discord" },
            ].map((item) => (
              <div key={item.label} style={{
                padding: 20,
                borderRadius: 12,
                background: "rgba(0,0,0,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
              }}>
                <p style={{ fontSize: 10, color: "#737373", letterSpacing: "0.2em", fontWeight: 600, margin: "0 0 8px", textTransform: "uppercase" }}>{item.label}</p>
                <p style={{ fontSize: 14, color: "#e5e5e5", fontFamily: "monospace", margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
