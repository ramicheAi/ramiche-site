"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { InstrumentPage, Panel } from "@/components/command-center/po/Instrument";

/* ══════════════════════════════════════════════════════════════════════════════
   BUILDER — dispatch DEV or DESIGN tasks to a tool-enabled Claude Code instance
   working inside one of your projects. It reads/edits files and runs commands,
   then reports what it changed. Every run is a tracked Job.
   ══════════════════════════════════════════════════════════════════════════════ */

const PROJECTS = [
  { id: "ramiche-site", label: "Ramiche / Command Center", dir: "/Users/admin/ramiche-site" },
  { id: "mettle", label: "METTLE", dir: "/Users/admin/mettle" },
];

interface Job {
  id: string;
  title: string;
  kind: string;
  status: "queued" | "running" | "done" | "failed" | "canceled";
  result: string | null;
  error: string | null;
  progress: string | null;
  input: { workingDir?: string } | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = { queued: "var(--c-amber)", running: "var(--c-cyan)", done: "var(--c-green)", failed: "var(--c-red)", canceled: "var(--t-lo)" };

export default function BuilderPage() {
  const [project, setProject] = useState(PROJECTS[0]);
  const [mode, setMode] = useState<"dev" | "design">("dev");
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/command-center/jobs?limit=60", { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        const all: Job[] = Array.isArray(d.jobs) ? d.jobs : [];
        setJobs(all.filter((j) => j.kind === "dev" || j.kind === "design"));
      }
    } catch { /* keep */ }
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 2500);
    return () => clearInterval(i);
  }, [load]);

  const run = useCallback(async () => {
    const t = task.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await fetch("/api/command-center/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: t.length > 90 ? t.slice(0, 90) + "…" : t,
          kind: mode,
          agent: mode === "dev" ? "Shuri" : "Vee",
          source: "builder",
          input: { workingDir: project.dir, detail: t },
        }),
      });
      setTask("");
      await load();
    } finally {
      setBusy(false);
    }
  }, [task, mode, project, busy, load]);

  const accent = mode === "dev" ? "var(--c-cyan)" : "var(--c-violet)";
  const inputStyle: React.CSSProperties = { background: "var(--ink-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", color: "var(--t-hi)", fontSize: 14, padding: "11px 14px", outline: "none" };

  return (
    <InstrumentPage
      id="builder"
      title="Builder"
      section="Creative"
      icon="dispatch"
      accent="var(--c-cyan)"
    >
      <p style={{ fontSize: 12, color: "var(--t-mid)", margin: "0 0 20px", lineHeight: 1.6 }}>
        Dispatch dev &amp; design work to Claude Code inside a project. It edits files, runs commands, and reports back. Tracked as Jobs.
      </p>

      {/* Composer */}
      <Panel style={{ marginBottom: 24, borderColor: `color-mix(in srgb, ${accent} 28%, var(--line))` }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          {/* Project */}
          <div style={{ display: "flex", gap: 6 }}>
            {PROJECTS.map((p) => (
              <button key={p.id} onClick={() => setProject(p)} style={{
                padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: "var(--r-sm)", cursor: "pointer",
                background: project.id === p.id ? "var(--ink-3)" : "transparent",
                color: project.id === p.id ? "var(--t-hi)" : "var(--t-mid)", border: `1px solid ${project.id === p.id ? "var(--line-2)" : "var(--line)"}`,
              }}>{p.label}</button>
            ))}
          </div>
          {/* Mode */}
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {(["dev", "design"] as const).map((m) => {
              const a = m === "dev" ? "var(--c-cyan)" : "var(--c-violet)";
              return (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "7px 16px", fontSize: 12, fontWeight: 700, borderRadius: "var(--r-sm)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
                  background: mode === m ? `color-mix(in srgb, ${a} 14%, transparent)` : "transparent", color: mode === m ? a : "var(--t-lo)", border: `1px solid ${mode === m ? `color-mix(in srgb, ${a} 45%, transparent)` : "var(--line)"}`,
                }}>{m}</button>
              );
            })}
          </div>
        </div>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder={mode === "dev"
            ? "Describe the code task… (e.g. 'Add a CSV export button to the Reports page')"
            : "Describe the design task… (e.g. 'Redesign the pricing cards with a cleaner hierarchy')"}
          style={{ ...inputStyle, width: "100%", minHeight: 92, resize: "vertical", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--t-lo)" }}>{project.dir}</span>
          <button onClick={run} disabled={busy || !task.trim()} style={{
            padding: "10px 24px", fontSize: 14, fontWeight: 700, borderRadius: "var(--r-sm)", border: "none",
            cursor: busy || !task.trim() ? "default" : "pointer",
            background: busy || !task.trim() ? "var(--ink-3)" : `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 67%, transparent))`,
            color: busy || !task.trim() ? "var(--t-lo)" : "var(--ink-1)",
          }}>{busy ? "Dispatching…" : `Run ${mode} ⚡`}</button>
        </div>
      </Panel>

      {/* Runs */}
      <Panel
        title="Builder Runs"
        icon="pulse"
        badge={<Link href="/command-center/jobs" style={{ color: "var(--c-violet)", fontSize: 11 }}>all jobs →</Link>}
      >
        {jobs.length === 0 && <div style={{ color: "var(--t-lo)", fontSize: 14, padding: 20, textAlign: "center" }}>No builder runs yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {jobs.map((j) => {
            const color = STATUS_COLOR[j.status] || "var(--t-lo)";
            const isOpen = open === j.id;
            return (
              <div key={j.id} style={{ borderRadius: "var(--r-md)", background: "var(--ink-2)", border: `1px solid color-mix(in srgb, ${color} 22%, var(--line))`, overflow: "hidden" }}>
                <div onClick={() => setOpen(isOpen ? null : j.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", cursor: "pointer" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0, animation: j.status === "running" ? "ccPulse 1.2s ease-in-out infinite" : undefined }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--t-hi)" }}>{j.title}</div>
                    <div style={{ fontSize: 11, color: "var(--t-mid)", marginTop: 3 }}>
                      <span style={{ color, textTransform: "uppercase", fontWeight: 700 }}>{j.status}</span>
                      {" · "}{j.kind} · {j.input?.workingDir?.split("/").pop() || "?"}
                      {j.status === "running" && j.progress ? ` · ${j.progress}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--t-lo)" }}>{isOpen ? "▾" : "▸"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 18px 16px 41px", borderTop: "1px solid var(--line)" }}>
                    <pre className="mono" style={{ marginTop: 12, background: "var(--ink-1)", borderRadius: "var(--r-sm)", padding: 14, fontSize: 12.5, color: j.status === "failed" ? "var(--c-red)" : "var(--t-mid)", whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 360, lineHeight: 1.55 }}>
                      {j.result || j.error || (j.status === "running" ? "Building… result will appear here." : "Queued.")}
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
