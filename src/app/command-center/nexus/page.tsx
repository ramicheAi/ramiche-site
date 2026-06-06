"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   NEXUS — native experiment lab. Design an experiment, dispatch it to an analyst
   agent (as an analysis Job), and read the result. (Replaces the old embedded
   HTML build.) Every experiment is a tracked Job.
   ══════════════════════════════════════════════════════════════════════════════ */

interface Job { id: string; title: string; kind: string; status: string; result: string | null; error: string | null; progress: string | null; created_at: string; }

const STATUS_COLOR: Record<string, string> = { queued: "#f59e0b", running: "#9b5de5", done: "#22c55e", failed: "#ef4444", canceled: "#6b7280" };

export default function NexusPage() {
  const [hypothesis, setHypothesis] = useState("");
  const [busy, setBusy] = useState(false);
  const [experiments, setExperiments] = useState<Job[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/jobs?limit=60", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setExperiments((Array.isArray(d.jobs) ? d.jobs : []).filter((j: Job) => j.kind === "analysis"));
      }
    } catch { /* keep */ }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 2500); return () => clearInterval(i); }, [load]);

  const run = useCallback(async () => {
    const h = hypothesis.trim();
    if (!h || busy) return;
    setBusy(true);
    try {
      await fetch("/api/command-center/jobs", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: h.length > 90 ? h.slice(0, 90) + "…" : h,
          kind: "analysis", agent: "Simons", source: "nexus",
          input: { detail: `Run this experiment / analysis and report findings with a recommendation:\n${h}` },
        }),
      });
      setHypothesis("");
      await load();
    } finally { setBusy(false); }
  }, [hypothesis, busy, load]);

  const done = experiments.filter((e) => e.status === "done").length;
  const running = experiments.filter((e) => e.status === "running" || e.status === "queued").length;

  const card: React.CSSProperties = { padding: "18px 20px", borderRadius: 14, background: "rgba(0,0,0,0.55)", border: "1px solid rgba(155,93,229,0.18)" };
  const input: React.CSSProperties = { background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7", fontSize: 14, padding: "11px 14px", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "32px 28px 80px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none" }}>← COMMAND CENTER</Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Nexus</h1>
          <span style={{ fontSize: 12, color: "#9b5de5", letterSpacing: "0.1em", textTransform: "uppercase" }}>Experiment Lab</span>
        </div>
        <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>Pose a hypothesis or question. An analyst agent runs it and reports findings. Data-driven decisions, not guesswork.</p>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginTop: 22, marginBottom: 18 }}>
          {[
            { label: "Experiments", value: experiments.length, color: "#9b5de5" },
            { label: "Running", value: running, color: "#f59e0b" },
            { label: "Completed", value: done, color: "#22c55e" },
          ].map((s) => (
            <div key={s.label} style={card}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div style={card}>
          <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)}
            placeholder="State a hypothesis or question… (e.g. 'Which pricing tier maximizes METTLE revenue at 200 athletes — Team, Program, or Elite? Show the math.')"
            style={{ ...input, width: "100%", minHeight: 84, resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={run} disabled={busy || !hypothesis.trim()} style={{
              padding: "10px 24px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
              cursor: busy || !hypothesis.trim() ? "default" : "pointer",
              background: busy || !hypothesis.trim() ? "#27272a" : "linear-gradient(135deg, #9b5de5, #7c3aed)", color: "#fff",
            }}>{busy ? "Running…" : "Run Experiment ⚗"}</button>
          </div>
        </div>

        {/* Experiments */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#71717a", letterSpacing: "0.14em", textTransform: "uppercase", margin: "26px 0 12px" }}>Experiments</h2>
        {experiments.length === 0 && <div style={{ color: "#52525b", fontSize: 14, padding: 20, textAlign: "center" }}>No experiments yet. Pose one above.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {experiments.map((j) => {
            const color = STATUS_COLOR[j.status] || "#6b7280";
            const isOpen = open === j.id;
            return (
              <div key={j.id} style={{ borderRadius: 12, background: "rgba(0,0,0,0.6)", border: `1px solid ${color}22`, overflow: "hidden" }}>
                <div onClick={() => setOpen(isOpen ? null : j.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", cursor: "pointer" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0, animation: j.status === "running" ? "ccPulse 1.2s ease-in-out infinite" : undefined }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
                    <div style={{ fontSize: 11, color: "#71717a", marginTop: 3 }}>
                      <span style={{ color, textTransform: "uppercase", fontWeight: 700 }}>{j.status}</span>
                      {j.status === "running" && j.progress ? ` · ${j.progress}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#52525b" }}>{isOpen ? "▾" : "▸"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 18px 16px 41px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <pre style={{ marginTop: 12, background: "#09090b", borderRadius: 8, padding: 14, fontSize: 12.5, color: j.status === "failed" ? "#fca5a5" : "#a1a1aa", whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 360, lineHeight: 1.55 }}>
                      {j.result || j.error || (j.status === "running" ? "Running experiment…" : "Queued.")}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes ccPulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>
    </div>
  );
}
