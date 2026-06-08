"use client";

import { useState, useEffect, useCallback } from "react";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   NEXUS — native experiment lab. Design an experiment, dispatch it to an analyst
   agent (as an analysis Job), and read the result. (Replaces the old embedded
   HTML build.) Every experiment is a tracked Job.
   ══════════════════════════════════════════════════════════════════════════════ */

interface Job { id: string; title: string; kind: string; status: string; result: string | null; error: string | null; progress: string | null; created_at: string; }

const STATUS_COLOR: Record<string, string> = { queued: "var(--c-amber)", running: "var(--c-violet)", done: "var(--c-green)", failed: "var(--c-red)", canceled: "var(--t-lo)" };

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

  const card: React.CSSProperties = { padding: "18px 20px", borderRadius: 14, background: "var(--ink-2)", border: "1px solid var(--line)" };
  const input: React.CSSProperties = { background: "var(--ink-1)", border: "1px solid var(--line-2)", borderRadius: 8, color: "var(--t-hi)", fontSize: 14, padding: "11px 14px", outline: "none" };

  return (
    <InstrumentPage id="nexus" title="Nexus" section="Operations" icon="nexus" accent="var(--c-cyan)">
      <p style={{ fontSize: 13, color: "var(--t-mid)", margin: "0 0 18px" }}>Pose a hypothesis or question. An analyst agent runs it and reports findings. Data-driven decisions, not guesswork.</p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 18 }}>
        {[
          { label: "Experiments", value: experiments.length, color: "var(--c-violet)" },
          { label: "Running", value: running, color: "var(--c-amber)" },
          { label: "Completed", value: done, color: "var(--c-green)" },
        ].map((s) => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "var(--t-mid)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <Panel title="New Experiment" icon="spark">
        <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)}
          placeholder="State a hypothesis or question… (e.g. 'Which pricing tier maximizes METTLE revenue at 200 athletes — Team, Program, or Elite? Show the math.')"
          style={{ ...input, width: "100%", minHeight: 84, resize: "vertical", boxSizing: "border-box" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button onClick={run} disabled={busy || !hypothesis.trim()} style={{
            padding: "10px 24px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
            cursor: busy || !hypothesis.trim() ? "default" : "pointer",
            background: busy || !hypothesis.trim() ? "var(--ink-3)" : "linear-gradient(135deg, #9b5de5, #7c3aed)", color: "#fff",
          }}>{busy ? "Running…" : "Run Experiment ⚗"}</button>
        </div>
      </Panel>

      {/* Experiments */}
      <Panel title="Experiments" icon="dispatch">
        {experiments.length === 0 && <div style={{ color: "var(--t-lo)", fontSize: 14, padding: 20, textAlign: "center" }}>No experiments yet. Pose one above.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {experiments.map((j) => {
            const color = STATUS_COLOR[j.status] || "var(--t-lo)";
            const isOpen = open === j.id;
            return (
              <div key={j.id} style={{ borderRadius: 12, background: "var(--ink-1)", border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`, overflow: "hidden" }}>
                <div onClick={() => setOpen(isOpen ? null : j.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", cursor: "pointer" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0, animation: j.status === "running" ? "ccPulse 1.2s ease-in-out infinite" : undefined }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t-hi)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
                    <div style={{ fontSize: 11, color: "var(--t-mid)", marginTop: 3 }}>
                      <span style={{ color, textTransform: "uppercase", fontWeight: 700 }}>{j.status}</span>
                      {j.status === "running" && j.progress ? ` · ${j.progress}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--t-lo)" }}>{isOpen ? "▾" : "▸"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 18px 16px 41px", borderTop: "1px solid var(--line)" }}>
                    <pre className="mono" style={{ marginTop: 12, background: "var(--void)", borderRadius: 8, padding: 14, fontSize: 12.5, color: j.status === "failed" ? "#fca5a5" : "var(--t-mid)", whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 360, lineHeight: 1.55 }}>
                      {j.result || j.error || (j.status === "running" ? "Running experiment…" : "Queued.")}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
      <style>{`@keyframes ccPulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }`}</style>
    </InstrumentPage>
  );
}
