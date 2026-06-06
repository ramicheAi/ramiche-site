"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

const STATUS_COLOR: Record<string, string> = { queued: "#f59e0b", running: "#00f0ff", done: "#22c55e", failed: "#ef4444", canceled: "#6b7280" };

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

  const accent = mode === "dev" ? "#00f0ff" : "#a855f7";
  const inputStyle: React.CSSProperties = { background: "#09090b", border: "1px solid #27272a", borderRadius: 8, color: "#e4e4e7", fontSize: 14, padding: "11px 14px", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "32px 28px 80px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <Link href="/command-center" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#737373", textDecoration: "none" }}>← COMMAND CENTER</Link>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "8px 0 0" }}>Builder</h1>
        <p style={{ fontSize: 13, color: "#737373", margin: "6px 0 0" }}>Dispatch dev &amp; design work to Claude Code inside a project. It edits files, runs commands, and reports back. Tracked as Jobs.</p>

        {/* Composer */}
        <div style={{ marginTop: 22, padding: 20, borderRadius: 14, background: "rgba(0,0,0,0.5)", border: `1px solid ${accent}28` }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            {/* Project */}
            <div style={{ display: "flex", gap: 6 }}>
              {PROJECTS.map((p) => (
                <button key={p.id} onClick={() => setProject(p)} style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, cursor: "pointer",
                  background: project.id === p.id ? "rgba(255,255,255,0.08)" : "transparent",
                  color: project.id === p.id ? "#fff" : "#a1a1aa", border: `1px solid ${project.id === p.id ? "rgba(255,255,255,0.2)" : "#27272a"}`,
                }}>{p.label}</button>
              ))}
            </div>
            {/* Mode */}
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              {(["dev", "design"] as const).map((m) => {
                const a = m === "dev" ? "#00f0ff" : "#a855f7";
                return (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: "7px 16px", fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
                    background: mode === m ? `${a}1f` : "transparent", color: mode === m ? a : "#71717a", border: `1px solid ${mode === m ? a + "55" : "#27272a"}`,
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
            <span style={{ fontSize: 11, color: "#52525b", fontFamily: "monospace" }}>{project.dir}</span>
            <button onClick={run} disabled={busy || !task.trim()} style={{
              padding: "10px 24px", fontSize: 14, fontWeight: 700, borderRadius: 8, border: "none",
              cursor: busy || !task.trim() ? "default" : "pointer",
              background: busy || !task.trim() ? "#27272a" : `linear-gradient(135deg, ${accent}, ${accent}aa)`,
              color: busy || !task.trim() ? "#71717a" : "#001016",
            }}>{busy ? "Dispatching…" : `Run ${mode} ⚡`}</button>
          </div>
        </div>

        {/* Runs */}
        <h2 style={{ fontSize: 12, fontWeight: 800, color: "#71717a", letterSpacing: "0.15em", textTransform: "uppercase", margin: "28px 0 12px" }}>
          Builder Runs · <Link href="/command-center/jobs" style={{ color: "#a855f7" }}>all jobs →</Link>
        </h2>
        {jobs.length === 0 && <div style={{ color: "#52525b", fontSize: 14, padding: 20, textAlign: "center" }}>No builder runs yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {jobs.map((j) => {
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
                      {" · "}{j.kind} · {j.input?.workingDir?.split("/").pop() || "?"}
                      {j.status === "running" && j.progress ? ` · ${j.progress}` : ""}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "#52525b" }}>{isOpen ? "▾" : "▸"}</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 18px 16px 41px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <pre style={{ marginTop: 12, background: "#09090b", borderRadius: 8, padding: 14, fontSize: 12.5, color: j.status === "failed" ? "#fca5a5" : "#a1a1aa", whiteSpace: "pre-wrap", overflowX: "auto", maxHeight: 360, lineHeight: 1.55 }}>
                      {j.result || j.error || (j.status === "running" ? "Building… result will appear here." : "Queued.")}
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
