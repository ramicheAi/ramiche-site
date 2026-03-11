"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ParticleField from "@/components/ParticleField";

/* ══════════════════════════════════════════════════════════════════════════════
   CONTENT — INK + ECHO Content Pipeline & Publishing Dashboard
   ══════════════════════════════════════════════════════════════════════════════ */

interface ContentDay { day: string; division: string; focus: string; angle: string; }
interface AgentStatus { id: string; name: string; status: string; role: string; }

const SCHEDULE: ContentDay[] = [
  { day: "Monday", division: "Parallax", focus: "Agent Marketplace", angle: "AI agent capabilities, skill spotlights, automation wins" },
  { day: "Tuesday", division: "Ramiche Studio", focus: "Creative Services", angle: "Portfolio pieces, design process, client results" },
  { day: "Wednesday", division: "Galactik Antics", focus: "AI Art + Merch", angle: "Art drops, merch reveals, creative culture" },
  { day: "Thursday", division: "ClawGuard Pro", focus: "Security", angle: "Security tips, vulnerability awareness, industry news" },
  { day: "Friday", division: "Community / BTS", focus: "Brand Storytelling", angle: "Day-in-the-life, founder journey, team culture" },
  { day: "Saturday", division: "Educational", focus: "AI + Tech Value", angle: "AI tips, productivity hacks, tutorials" },
  { day: "Sunday", division: "Recap + Engagement", focus: "Community", angle: "Week highlights, shoutouts, Q&A" },
];

const PLATFORMS = ["Instagram", "X", "LinkedIn"];
const STATUS_COLORS: Record<string, string> = { draft: "#f59e0b", reviewed: "#818cf8", approved: "#22c55e", posted: "#06b6d4" };

export default function ContentPage() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents((data.agents || []).filter((a: AgentStatus) => ["ink", "echo", "vee"].includes(a.id)));
      }
    } catch { /* keep existing */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 30_000); return () => clearInterval(i); }, [fetchData]);

  const todaySchedule = SCHEDULE.find((s) => s.day === activeDay);
  const TEAM = [
    { id: "ink", name: "INK", role: "Content Creator", color: "#f59e0b" },
    { id: "echo", name: "ECHO", role: "Community & Social", color: "#818cf8" },
    { id: "vee", name: "VEE", role: "Brand Strategy", color: "#06b6d4" },
  ];

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "#000000", color: "#e5e5e5", overflow: "hidden" }}>
      <ParticleField />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse 800px 600px at 25% 25%, rgba(249,115,22,0.08) 0%, transparent 60%), radial-gradient(ellipse 600px 600px at 75% 80%, rgba(245,158,11,0.06) 0%, transparent 60%)" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1400, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>&larr;</span> COMMAND CENTER
          </Link>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: "#e5e5e5", textShadow: "0 0 40px rgba(249,115,22,0.3)" }}>Content Pipeline</h1>
          <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>INK · ECHO · VEE — Content creation, publishing & engagement</p>
        </div>

        {/* Content Team */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Content Team</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {TEAM.map((agent) => {
            const live = agents.find((a) => a.id === agent.id);
            const statusColor = live?.status === "active" ? "#22c55e" : live?.status === "idle" ? "#f59e0b" : "#6b7280";
            return (
              <div key={agent.id} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: `0 0 24px ${agent.color}12, 0 8px 32px rgba(0,0,0,0.4)`, transition: "all 0.3s" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${agent.color}18`, color: agent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>{agent.name[0]}</div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{agent.name}</span>
                      <p style={{ fontSize: 10, color: "#737373", margin: "2px 0 0" }}>{agent.role}</p>
                    </div>
                  </div>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}80` }} />
                </div>
                <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.1em" }}>{live?.status?.toUpperCase() || "OFFLINE"}</span>
              </div>
            );
          })}
        </div>

        {/* Weekly Schedule */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Weekly Rotation</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 8 }}>
          {SCHEDULE.map((day) => (
            <button key={day.day} onClick={() => setActiveDay(day.day)} style={{
              padding: "10px 16px", borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.2s",
              background: activeDay === day.day ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
              border: activeDay === day.day ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(255,255,255,0.08)",
              color: activeDay === day.day ? "#fb923c" : "rgba(255,255,255,0.4)"
            }}>
              {day.day.slice(0, 3).toUpperCase()}
            </button>
          ))}
        </div>

        {todaySchedule && (
          <div style={{ padding: 28, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(249,115,22,0.25)", boxShadow: "0 0 32px rgba(249,115,22,0.1), 0 8px 32px rgba(0,0,0,0.4)", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f97316", boxShadow: "0 0 12px rgba(249,115,22,0.6)" }} />
              <span style={{ fontSize: 11, color: "#fb923c", letterSpacing: "0.15em", fontWeight: 700 }}>{todaySchedule.day.toUpperCase()} — {todaySchedule.division.toUpperCase()}</span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>{todaySchedule.focus}</h3>
            <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>{todaySchedule.angle}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {PLATFORMS.map((p) => (
                <span key={p} style={{ padding: "5px 12px", fontSize: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)" }}>{p.toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}

        {/* Pipeline Status */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Pipeline Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
          {(["draft", "reviewed", "approved", "posted"] as const).map((status) => (
            <div key={status} style={{ padding: 20, borderRadius: 12, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: STATUS_COLORS[status], marginBottom: 4 }}>0</div>
              <span style={{ fontSize: 10, color: "#525252", letterSpacing: "0.15em" }}>{status.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Active Platforms */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f97316", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>Active Platforms</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { name: "Instagram", followers: "16,106", status: "Connected", color: "#e11d48" },
            { name: "X (Twitter)", followers: "19", status: "Connected", color: "#1d9bf0" },
            { name: "LinkedIn", followers: "—", status: "Connected", color: "#0a66c2" },
          ].map((platform) => (
            <div key={platform.name} style={{ padding: 24, borderRadius: 16, background: "rgba(0,0,0,0.95)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 24px rgba(0,0,0,0.3)", transition: "all 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{platform.name}</span>
                <span style={{ fontSize: 10, color: "#22c55e", letterSpacing: "0.1em" }}>{platform.status.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: platform.color }}>{platform.followers}</div>
              <p style={{ fontSize: 10, color: "#404040", margin: "4px 0 0" }}>Followers</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
