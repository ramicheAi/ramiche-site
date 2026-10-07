"use client";
/**
 * P06 M6C: execution from a shadow-routed command, inside the command palette. Least effort: one button when the
 * decision is Claude Code work, then the smallest approval ("Claude Code wants to modify METTLE locally."), then the
 * result. The client only ever sends the command id, the founder's narrowing choices and the binding hash it was shown;
 * the server derives and checks everything else. Rendered only when execution is enabled (it is not in production).
 *
 * M6H: approval returns as soon as the run is recorded. The card then follows the job (status route, polled every 3 s)
 * with a Cancel control, and shows the result when it lands. A run in progress is found on the server for this command,
 * so any tab resumes it.
 */
import { useEffect, useState } from "react";
import { cockpitFetch } from "@/lib/cockpit-fetch";
import type { ExecutionResult } from "@/lib/execution/contract-core";
import type { ShadowRecord } from "@/lib/command/types";
import { ExecutionApprovalCard, ExecutionResultCard } from "./ExecutionCards";

type Prepared = { sentence: string; bindingHash: string; details: Record<string, string>; capability: string; project: string };
type View = { state: "running" | "done" | "canceled" | "failed"; executionId: string | null; result: ExecutionResult | null; message: string | null };
type State =
  | { s: "checking" } | { s: "idle" } | { s: "preparing" } | { s: "prepared"; p: Prepared } | { s: "starting"; p: Prepared }
  | { s: "running"; p: Prepared | null; jobId: string; cancel: "ready" | "requested" }
  | { s: "done"; result: ExecutionResult; projectName: string; open: boolean } | { s: "canceled"; result: ExecutionResult | null; projectName: string }
  | { s: "stopped"; message: string; candidates: string[] };
const TERMINAL_PROGRESS_MS = 3_000;

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string; candidates: string[] }> {
  try {
    const res = await cockpitFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.data) return { ok: true, data: j.data as T };
    const candidates = Array.isArray(j?.error?.candidates) ? (j.error.candidates as unknown[]).filter((c): c is string => typeof c === "string") : [];
    return { ok: false, message: j?.error?.question ?? j?.error?.message ?? `Request failed (${res.status}).`, candidates };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Network error.", candidates: [] }; }
}

export function ExecutionFlow({ record, onOpenDetails }: { record: Pick<ShadowRecord, "id" | "decision">; onOpenDetails: () => void }) {
  // Starting is not offered until the server has said whether a run already exists for this command: a second Start
  // before the answer could run the same command twice (Codex P2 on 22c8ca4).
  const [st, setSt] = useState<State>({ s: "checking" });
  // A run already in progress for this command (started in any tab) is followed from the server, not from this tab.
  useEffect(() => {
    if (record.decision.handler !== "claude_code") return;
    let gone = false;
    void (async () => {
      let next: State = { s: "idle" };
      try {
        const res = await cockpitFetch(`/api/command-center/execution/status?commandId=${encodeURIComponent(record.id)}`);
        const j = await res.json().catch(() => null);
        if (res.ok && j?.data?.jobId && j.data.state === "running") next = { s: "running", p: null, jobId: j.data.jobId as string, cancel: "ready" };
      } catch { /* the lookup failed: offer Start (the server still refuses a duplicate of a running attempt) */ }
      if (!gone) setSt((cur) => (cur.s === "checking" ? next : cur));
    })();
    return () => { gone = true; };
  }, [record.id, record.decision.handler]);
  // Follow the running job until it has a result; poll only while it runs.
  useEffect(() => {
    if (st.s !== "running") return;
    const { jobId } = st;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await cockpitFetch(`/api/command-center/execution/status?jobId=${encodeURIComponent(jobId)}`);
        const j = await res.json().catch(() => null);
        if (stopped || !res.ok || !j?.data) return;
        const v = j.data as View;
        if (v.state === "running") return;
        const name = (st.p?.details.Project ?? st.p?.project) || "Claude Code";
        if (v.state === "done" && v.result) setSt({ s: "done", result: v.result, projectName: name, open: false });
        else if (v.state === "canceled") setSt({ s: "canceled", result: v.result, projectName: name });
        else setSt({ s: "stopped", message: v.message ?? "This execution failed.", candidates: [] });
      } catch { /* the next tick tries again; a network blip never ends the follow */ }
    };
    void tick();
    const id = setInterval(() => void tick(), TERMINAL_PROGRESS_MS);
    return () => { stopped = true; clearInterval(id); };
  }, [st, record.id]);
  if (record.decision.handler !== "claude_code") return null;
  // The founder may answer "which project?" with one tap: the server re-prepares with that choice (it still decides).
  const prepare = async (project?: string) => {
    setSt({ s: "preparing" });
    const r = await post<Prepared>("/api/command-center/execution/prepare", project ? { commandId: record.id, project } : { commandId: record.id });
    setSt(r.ok ? { s: "prepared", p: r.data } : { s: "stopped", message: r.message, candidates: project ? [] : r.candidates });
  };
  const approve = async (p: Prepared) => {
    setSt({ s: "starting", p });
    const r = await post<{ started: true; jobId: string; executionId: string }>("/api/command-center/execution/approve", { commandId: record.id, capability: p.capability, project: p.project, bindingHash: p.bindingHash });
    if (!r.ok) { setSt({ s: "stopped", message: r.message, candidates: [] }); return; }
    setSt({ s: "running", p, jobId: r.data.jobId, cancel: "ready" });
  };
  // One request per click: the button disables until the server answers, and the job's state is then followed.
  const cancel = async () => {
    if (st.s !== "running" || st.cancel !== "ready") return;
    const { jobId, p } = st;
    setSt({ s: "running", p, jobId, cancel: "requested" });
    const r = await post<{ cancelRequested: true }>("/api/command-center/execution/cancel", { jobId });
    if (!r.ok) setSt({ s: "running", p, jobId, cancel: "ready" });
  };
  if (st.s === "checking") return <div role="status" style={{ fontSize: 12 }}>Checking for a run already in progress…</div>;
  if (st.s === "idle") return <button type="button" data-testid="execution-start" style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={() => void prepare()}>Run with Claude Code</button>;
  if (st.s === "preparing") return <div role="status" style={{ fontSize: 12 }}>Preparing the exact request. Nothing runs until you approve.</div>;
  if (st.s === "prepared" || st.s === "starting") {
    const p = st.p;
    return <ExecutionApprovalCard sentence={p.sentence} details={p.details} busy={st.s === "starting"} onApprove={() => void approve(p)} onCancel={() => setSt({ s: "idle" })} />;
  }
  if (st.s === "running") {
    const name = st.p?.details.Project ?? st.p?.project ?? "the project";
    return (
      <div data-testid="execution-running" role="status" style={{ display: "grid", gap: 8, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--line, #1e1e1e)" }}>
        <div style={{ fontSize: 11, letterSpacing: 1, fontWeight: 700, color: "var(--accent, #00f0ff)" }}>CLAUDE CODE · RUNNING</div>
        <div style={{ fontSize: 14, color: "var(--t-hi, #fff)" }}>{st.cancel === "requested" ? "Stopping…" : `Working on ${name}. You can leave this open or come back to it.`}</div>
        <div>
          <button type="button" data-testid="execution-cancel" disabled={st.cancel !== "ready"} onClick={() => void cancel()}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: st.cancel === "ready" ? "pointer" : "default", opacity: st.cancel === "ready" ? 1 : 0.5, background: "rgba(255,255,255,0.04)", color: "var(--t-hi, #fff)", border: "1px solid var(--line, #1e1e1e)" }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
  if (st.s === "canceled") {
    return (
      <div data-testid="execution-canceled" role="status" style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>CANCELED · CLAUDE CODE</div>
        <div>{st.projectName}: stopped at your request. Anything it changed is in its worktree.</div>
      </div>
    );
  }
  if (st.s === "done") {
    const toggle = () => setSt({ ...st, open: !st.open });
    const r = st.result;
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <ExecutionResultCard result={r} projectName={st.projectName} onReview={toggle} onApproveNext={onOpenDetails} onDetails={toggle} />
        {st.open && (
          // The run's own evidence, right here: what changed, where, and the full log for anything deeper.
          <dl data-testid="execution-evidence" style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", margin: 0, fontSize: 12, overflowWrap: "anywhere" }}>
            <dt>Files</dt><dd style={{ margin: 0 }}>{r.filesChanged.length ? r.filesChanged.join(", ") : "none"}</dd>
            <dt>Branch</dt><dd style={{ margin: 0 }}>{r.branch ?? "removed (read-only run)"}</dd>
            <dt>Worktree</dt><dd style={{ margin: 0 }}>{r.worktree ?? "removed (read-only run)"}</dd>
            <dt>Checks</dt><dd style={{ margin: 0 }}>{r.checks.length ? r.checks.map((c) => `${c.ok ? "ok" : "failed"}: ${c.command}`).join("; ") : "none run"}</dd>
            <dt>Log</dt><dd style={{ margin: 0 }}>{r.evidence.logPath ?? "none"}</dd>
            <dt>Model</dt><dd style={{ margin: 0 }}>{r.evidence.modelReported ?? "unknown"}{r.evidence.turns !== null ? `, ${r.evidence.turns} turns` : ""}</dd>
          </dl>
        )}
      </div>
    );
  }
  return (
    <div data-testid="execution-stopped" role="alert" style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#ef4444" }}>STOPPED</div>
      <div style={{ fontSize: 13 }}>{st.message}</div>
      {st.candidates.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {st.candidates.map((c) => (
            <button key={c} type="button" style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, fontSize: 13, cursor: "pointer" }} onClick={() => void prepare(c)}>{c}</button>
          ))}
        </div>
      )}
    </div>
  );
}
