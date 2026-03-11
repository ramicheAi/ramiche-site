"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   STRATEGY — Dr. Strange + Aetherion Decision Support
   ══════════════════════════════════════════════════════════════════════════════ */

interface AgentStatus { id: string; name: string; status: string; role: string; }
interface Project { slug: string; name: string; priority: string; status: string; }

const PRIORITIES = [
  { rank: "#1", name: "METTLE", type: "SaaS — Athlete Management", status: "Beta", detail: "ARM (Athlete Relations Manager). Beta: Saint Andrew's Aquatics (240+ athletes). Patent + copyright filed.", color: "#C9A84C" },
  { rank: "#2", name: "Verified Agent Business", type: "Agent Rental — $100-500/hr", status: "Pre-launch", detail: "First vertical: legal (THEMIS). Wed Mar 12 meeting with BIG financier (~$2B AUM). Co-founder: Eric.", color: "#818cf8" },
  { rank: "#3", name: "Ramiche Studio", type: "Creative Services — $400-$6K+", status: "Kit Complete", detail: "Landing page, inquiry form, checkout, DM scripts, email sequences, onboarding runbook. Blocked on Stripe key + first clients.", color: "#06b6d4" },
  { rank: "#4", name: "Parallax Agent Marketplace", type: "Agent Skills — $149-499", status: "Live", detail: "19 routes, white-label system, Setup Service e2e verified. Claude Skills selling.", color: "#22c55e" },
  { rank: "#5", name: "ClawGuard Pro", type: "Security Scanner — $299-$1,499", status: "Live", detail: "GitHub + Stripe wired. Scanning product live.", color: "#34d399" },
];

const STRATEGIC_QUESTIONS = [
  "What's the fastest path to $10K MRR?",
  "Should we raise capital or bootstrap?",
  "Which product should we double down on?",
  "What's the competitive moat?",
  "How do we scale the agent fleet?",
];

const TEAM = [
  { id: "strange", name: "DR. STRANGE", role: "Forecasting & Decisions", color: "#818cf8" },
  { id: "aetherion", name: "AETHERION", role: "Meta-Architect", color: "#C9A84C" },
  { id: "mercury", name: "MERCURY", role: "Sales Strategy", color: "#22c55e" },
  { id: "kiyosaki", name: "KIYOSAKI", role: "Financial Intelligence", color: "#f59e0b" },
];

export default function StrategyPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, projectsRes] = await Promise.all([fetch("/api/command-center/agents"), fetch("/api/command-center/projects")]);
      if (agentsRes.ok) { const data = await agentsRes.json(); setAgents((data.agents || []).filter((a: AgentStatus) => ["strange", "aetherion", "mercury", "kiyosaki"].includes(a.id))); }
      if (projectsRes.ok) { const data = await projectsRes.json(); setProjects(data.projects || []); }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 60_000); return () => clearInterval(i); }, [fetchData]);

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 25% 20%, rgba(129,140,248,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 80%, rgba(168,85,247,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(129,140,248,0.3)" }}>Strategy War Room</h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>DR. STRANGE · AETHERION — Forecasting, scenarios & strategic decisions</p>
        </div>

        {/* Strategy Team */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Strategy Team</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 32 }}>
          {TEAM.map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            const statusColor = live?.status === "active" ? "#22c55e" : live?.status === "idle" ? "#f59e0b" : "#6b7280";
            return (
              <div key={agent.id} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 20px ${agent.color}10, 0 4px 20px rgba(0,0,0,0.3)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${agent.color}18`, color: agent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{agent.name.split(" ").pop()?.[0]}</div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{agent.name}</span>
                    <p style={{ fontSize: 9, color: "#525252", margin: "2px 0 0" }}>{agent.role}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: statusColor }} />
                  <span style={{ fontSize: 9, color: "#525252", letterSpacing: "0.1em" }}>{live?.status?.toUpperCase() || "OFFLINE"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Priority Stack */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Priority Stack</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {PRIORITIES.map((p) => (
            <div key={p.name} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: `0 0 20px ${p.color}08, 0 4px 20px rgba(0,0,0,0.3)`, transition: "all 0.3s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: p.color, width: 40, textAlign: "center" }}>{p.rank}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: 9, padding: "4px 10px", borderRadius: 6, background: `${p.color}18`, color: p.color, letterSpacing: "0.1em", fontWeight: 600 }}>{p.status.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#737373", margin: "4px 0 0" }}>{p.type}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#525252", margin: 0, paddingLeft: 56 }}>{p.detail}</p>
            </div>
          ))}
        </div>

        {/* Projects from API */}
        {projects.length > 0 && (
          <>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Live Projects ({projects.length})</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
              {projects.map((proj) => (
                <div key={proj.slug} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{proj.name || proj.slug}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.1em" }}>{proj.status?.toUpperCase() || "ACTIVE"}</span>
                    {proj.priority && <span style={{ fontSize: 9, color: "rgba(129,140,248,0.5)", letterSpacing: "0.1em" }}>P{proj.priority}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Strategic Questions */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#818cf8", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Strategic Questions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {STRATEGIC_QUESTIONS.map((q) => (
            <div key={q} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(129,140,248,0.12)", cursor: "pointer", transition: "all 0.3s", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", margin: 0 }}>{q}</p>
              <span style={{ fontSize: 9, color: "rgba(129,140,248,0.3)", letterSpacing: "0.15em", marginTop: 10, display: "block" }}>ASK DR. STRANGE →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
