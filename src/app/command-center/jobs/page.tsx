"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ══════════════════════════════════════════════════════════════════════════════
   JOBS — the live run feed. Every action in the Command Center is a tracked Job:
   queued → running → done/failed, dispatched to the fleet, result streamed back.
   ══════════════════════════════════════════════════════════════════════════════ */

interface Job {
  id: string;
  title: string;
  kind: string;
  agent: string | null;
  status: "queued" | "running" | "done" | "failed" | "canceled";
  source: string | null;
  result: string | null;
  error: string | null;
  progress: string | null;
  created_at: string;
  finished_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  queued: "#f59e0b",
  running: "#7c3aed",
  done: "#22c55e",
  failed: "#ef4444",
  canceled: "#6b7280",
};

const KINDS = ["generic", "dev", "design", "prospect", "outreach", "content", "analysis"];

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("generic");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/jobs?limit=80", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setJobs(Array.isArray(d.jobs) ? d.jobs : []);
      }
    } catch { /* keep */ }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 2500);
    return () => clearInterval(i);
  }, [load]);

  const dispatch = useCallback(async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await fetch("/api/command-center/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: t, kind, source: "jobs-page" }),
      });
      setTitle("");
      await load();
    } finally {
      setBusy(false);
    }
  }, [title, kind, busy, load]);

  const rerun = useCallback(async (id: string) => {
    await fetch(`/api/command-center/jobs/${id}`, { method: "POST" });
    await load();
  }, [load]);

  const counts = jobs.reduce<Record<string, number>>((a, j) => { a[j.status] = (a[j.status] || 0) + 1; return a; }, {});

  const input: React.CSSProperties = {
    background: "#09090b", border: "1px solid #27272a", borderRadius: 8,
    color: "#e4e4e7", fontSize: 14, padding: "11px 14px", outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "32px 28px 80px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none" }}>← COMMAND CENTER</Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 8 }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Jobs</h1>
          <span style={{ fontSize: 12, color: "#22c55e", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", display: "inline-block" }} /> LIVE · auto-refresh
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>Everything in motion. Dispatch work to the fleet and watch it run end to end.</p>

        {/* Dispatch box */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, marginBottom: 18 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") dispatch(); }}
            placeholder="Describe a job for the fleet… (e.g. 'Draft 3 cold emails for Fort Lauderdale gyms')"
            style={{ ...input, flex: 1 }}
          />
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...input, minWidth: 130 }}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button
            onClick={dispatch}
            disabled={busy || !title.trim()}
            style={{
              padding: "11px 22px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
              cursor: busy || !title.trim() ? "default" : "pointer",
              background: busy || !title.trim() ? "#27272a" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", whiteSpace: "nowrap",
            }}
          >{busy ? "Dispatching…" : "Run ⚡"}</button>
        </div>

        {/* Status counts */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {(["running", "queued", "done", "failed"] as const).map((s) => (
            <div key={s} style={{ padding: "8px 16px", borderRadius: 10, background: "rgba(0,0,0,0.5)", border: `1px solid ${STATUS_COLOR[s]}33`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: STATUS_COLOR[s] }}>{counts[s] || 0}</span>
              <span style={{ fontSize: 10, color: "#737373", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Job list */}
        {jobs.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#52525b", fontSize: 14 }}>No jobs yet. Dispatch one above, or use the ⌘K command bar.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j) => {
            const color = STATUS_COLOR[j.status] || "#6b7280";
            const isOpen = open === j.id;
            const finished = j.status === "done" || j.status === "failed";
            return (
              <div key={j.id} style={{ borderRadius: 12, background: "rgba(0,0,0,0.6)", border: `1px solid ${color}22`, overflow: "hidden" }}>
                <div onClick={() => setOpen(isOpen ? null : j.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}>
                  <span style={{
                    width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0,
                    boxShadow: `0 0 8px ${color}`, animation: j.status === "running" ? "ccPulse 1.2s ease-in-out infinite" : undefined,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
                    <div style={{ fontSize: 11, color: "#71717a", marginTop: 3 }}>
                      <span style={{ color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{j.status}</span>
                      {" · "}{j.kind}{j.agent ? ` · ${j.agent}` : ""}{j.source ? ` · ${j.source}` : ""} · {ago(j.created_at)}
                      {j.status === "running" && j.progress ? ` · ${j.progress}` : ""}
                    </div>
                  </div>
                  {finished && (
                    <button onClick={(e) => { e.stopPropagation(); rerun(j.id); }} style={{
                      padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                      background: "rgba(124,58,237,0.12)", color: "#a855f7", border: "1px solid rgba(124,58,237,0.3)",
                    }}>↻ Re-run</button>
                  )}
                  <span style={{ fontSize: 12, color: "#52525b" }}>{isOpen ? "▾" : "▸"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 18px 16px 41px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <pre style={{
                      marginTop: 12, background: "#09090b", borderRadius: 8, padding: 14, fontSize: 12.5,
                      color: j.status === "failed" ? "#fca5a5" : "#a1a1aa", whiteSpace: "pre-wrap", overflowX: "auto",
                      maxHeight: 360, lineHeight: 1.55,
                    }}>{j.result || j.error || (j.status === "running" ? "Running… result will appear here." : "Queued.")}</pre>
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
