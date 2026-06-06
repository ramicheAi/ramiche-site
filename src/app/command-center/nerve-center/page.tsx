"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   NERVE CENTER — native agent war room. Real fleet status, build champions, and
   live jobs in motion. (Replaces the old embedded-HTML build.)
   ══════════════════════════════════════════════════════════════════════════════ */

interface Agent { id: string; name: string; role?: string; model?: string; status?: string; }
interface Build { folder: string; agent: string; status: string; }
interface Job { id: string; title: string; kind: string; status: string; agent: string | null; }

const STATUS_COLOR: Record<string, string> = { active: "#22c55e", idle: "#f59e0b", offline: "#6b7280", busy: "#7c3aed", done: "#22c55e", running: "#7c3aed", failed: "#ef4444", queued: "#f59e0b" };

export default function NerveCenterPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = useCallback(async () => {
    try {
      const [a, b, j] = await Promise.all([
        fetch("/api/command-center/agents", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/command-center/yolo-builds", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/command-center/jobs?limit=30", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (a?.agents) setAgents(a.agents);
      if (Array.isArray(b)) setBuilds(b);
      if (j?.jobs) setJobs(j.jobs);
    } catch { /* keep */ }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 4000); return () => clearInterval(i); }, [load]);

  const activeAgents = agents.filter((a) => a.status === "active").length;
  const champions = Object.entries(builds.reduce<Record<string, number>>((acc, b) => {
    const name = (b.agent || "Unknown");
    acc[name] = (acc[name] || 0) + 1; return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxBuilds = champions[0]?.[1] || 1;
  const workingBuilds = builds.filter((b) => b.status === "working").length;
  const liveJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");

  const card: React.CSSProperties = { padding: "18px 20px", borderRadius: 14, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "32px 28px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none" }}>← COMMAND CENTER</Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Nerve Center</h1>
          <span style={{ fontSize: 12, color: "#7c3aed", letterSpacing: "0.1em", textTransform: "uppercase" }}>Agent War Room · {agents.length} units</span>
        </div>
        <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>Live fleet status, build champions, and everything in motion.</p>

        {/* Stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 24 }}>
          {[
            { label: "Active Agents", value: `${activeAgents}/${agents.length}`, color: "#22c55e" },
            { label: "Total Builds", value: builds.length, color: "#f59e0b" },
            { label: "Working Builds", value: workingBuilds, color: "#22d3ee" },
            { label: "In Motion", value: liveJobs.length, color: "#7c3aed" },
          ].map((s) => (
            <div key={s.label} style={card}>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18, marginTop: 18 }}>
          {/* Build champions */}
          <div style={card}>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 16px" }}>Build Champions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {champions.map(([name, count], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 18, fontSize: 12, color: "#52525b", fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ width: 110, fontSize: 13, fontWeight: 600 }}>{name}</span>
                  <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(count / maxBuilds) * 100}%`, height: "100%", background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 30, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#a855f7" }}>{count}</span>
                </div>
              ))}
              {champions.length === 0 && <div style={{ color: "#52525b", fontSize: 13 }}>Loading fleet build data…</div>}
            </div>
          </div>

          {/* In motion */}
          <div style={card}>
            <h2 style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 16px" }}>In Motion</h2>
            {liveJobs.length === 0 && <div style={{ color: "#52525b", fontSize: 13 }}>Nothing running. <Link href="/command-center/jobs" style={{ color: "#a855f7" }}>Dispatch a job →</Link></div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {liveJobs.slice(0, 8).map((j) => (
                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[j.status], boxShadow: `0 0 8px ${STATUS_COLOR[j.status]}`, animation: j.status === "running" ? "ccPulse 1.2s ease-in-out infinite" : undefined }} />
                  <span style={{ flex: 1, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</span>
                  <span style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase" }}>{j.kind}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Roster */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#71717a", letterSpacing: "0.14em", textTransform: "uppercase", margin: "26px 0 12px" }}>Fleet Roster</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {agents.map((a) => {
            const c = STATUS_COLOR[a.status || "offline"] || "#6b7280";
            return (
              <div key={a.id} style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${c}22`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 6px ${c}`, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: "#71717a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.role || a.model || ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes ccPulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>
    </div>
  );
}
