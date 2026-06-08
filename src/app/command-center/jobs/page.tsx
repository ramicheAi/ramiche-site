"use client";

import { useState, useEffect, useCallback, useRef } from "react";

import { play, initSoundPref, isSoundEnabled, setSoundEnabled } from "@/lib/cc-sounds";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

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
  queued: "var(--c-amber)",
  running: "var(--accent)",
  done: "var(--c-green)",
  failed: "var(--c-red)",
  canceled: "var(--t-lo)",
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
  const [soundOn, setSoundOn] = useState(true);
  const prevStatus = useRef<Record<string, string>>({});
  const seeded = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/jobs?limit=80", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        const next: Job[] = Array.isArray(d.jobs) ? d.jobs : [];
        // Play a cue when a job transitions to done/failed (skip first load).
        if (seeded.current) {
          for (const j of next) {
            const was = prevStatus.current[j.id];
            if (was && was !== j.status) {
              if (j.status === "done") play("success");
              else if (j.status === "failed") play("alert");
            }
          }
        }
        for (const j of next) prevStatus.current[j.id] = j.status;
        seeded.current = true;
        setJobs(next);
      }
    } catch { /* keep */ }
  }, []);

  useEffect(() => {
    initSoundPref();
    setSoundOn(isSoundEnabled());
    load();
    const i = setInterval(load, 2500);
    return () => clearInterval(i);
  }, [load]);

  const dispatch = useCallback(async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    play("dispatch");
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
    background: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: 8,
    color: "var(--t-hi)", fontSize: 14, padding: "11px 14px", outline: "none",
  };

  return (
    <InstrumentPage
      id="jobs"
      title="Jobs"
      section="Operations"
      icon="bolt"
      accent="var(--c-amber)"
      actions={
        <button
          onClick={() => { const n = !soundOn; setSoundOn(n); setSoundEnabled(n); }}
          title={soundOn ? "Mute cues" : "Enable cues"}
          style={{ padding: "5px 11px", fontSize: 12, borderRadius: 7, cursor: "pointer", background: "transparent", color: soundOn ? "var(--accent)" : "var(--t-lo)", border: `1px solid ${soundOn ? "var(--line-2)" : "var(--line)"}` }}
        >{soundOn ? "🔊 cues on" : "🔇 cues off"}</button>
      }
    >
      <p style={{ fontSize: 13, color: "var(--t-lo)", margin: "0 0 20px" }}>Everything in motion. Dispatch work to the fleet and watch it run end to end.</p>

      {/* Dispatch box */}
      <Panel title="Dispatch" icon="dispatch">
        <div style={{ display: "flex", gap: 10, padding: "14px 16px" }}>
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
              background: busy || !title.trim() ? "var(--ink-3)" : "var(--accent)",
              color: "#fff", whiteSpace: "nowrap",
            }}
          >{busy ? "Dispatching…" : "Run ⚡"}</button>
        </div>
      </Panel>

      {/* Status counts */}
      <div style={{ display: "flex", gap: 10, margin: "18px 0", flexWrap: "wrap" }}>
        {(["running", "queued", "done", "failed"] as const).map((s) => (
          <div key={s} style={{ padding: "8px 16px", borderRadius: 10, background: "var(--ink-1)", border: `1px solid var(--line)`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: STATUS_COLOR[s] }}>{counts[s] || 0}</span>
            <span style={{ fontSize: 10, color: "var(--t-lo)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Job list */}
      {jobs.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--t-lo)", fontSize: 14 }}>No jobs yet. Dispatch one above, or use the ⌘K command bar.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {jobs.map((j) => {
          const color = STATUS_COLOR[j.status] || "var(--t-lo)";
          const isOpen = open === j.id;
          const finished = j.status === "done" || j.status === "failed";
          return (
            <div key={j.id} style={{ borderRadius: 12, background: "var(--ink-1)", border: `1px solid var(--line)`, overflow: "hidden" }}>
              <div onClick={() => setOpen(isOpen ? null : j.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer" }}>
                <span style={{
                  width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0,
                  boxShadow: `0 0 8px ${color}`, animation: j.status === "running" ? "ccPulse 1.2s ease-in-out infinite" : undefined,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t-mid)", marginTop: 3 }}>
                    <span style={{ color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{j.status}</span>
                    {" · "}{j.kind}{j.agent ? ` · ${j.agent}` : ""}{j.source ? ` · ${j.source}` : ""} · {ago(j.created_at)}
                    {j.status === "running" && j.progress ? ` · ${j.progress}` : ""}
                  </div>
                </div>
                {finished && (
                  <button onClick={(e) => { e.stopPropagation(); rerun(j.id); }} style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                    background: "var(--ink-3)", color: "var(--accent)", border: "1px solid var(--line-2)",
                  }}>↻ Re-run</button>
                )}
                <span style={{ fontSize: 12, color: "var(--t-lo)" }}>{isOpen ? "▾" : "▸"}</span>
              </div>
              {isOpen && (
                <div style={{ padding: "0 18px 16px 41px", borderTop: "1px solid var(--line)" }}>
                  <pre style={{
                    marginTop: 12, background: "var(--ink-2)", borderRadius: 8, padding: 14, fontSize: 12.5,
                    color: j.status === "failed" ? "var(--c-red)" : "var(--t-mid)", whiteSpace: "pre-wrap", overflowX: "auto",
                    maxHeight: 360, lineHeight: 1.55, fontFamily: "var(--f-mono)",
                  }}>{j.result || j.error || (j.status === "running" ? "Running… result will appear here." : "Queued.")}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes ccPulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>
    </InstrumentPage>
  );
}
