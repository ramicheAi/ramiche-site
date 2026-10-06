"use client";
/**
 * P06 M6C: execution from a shadow-routed command, inside the command palette. Least effort: one button when the
 * decision is Claude Code work, then the smallest approval ("Claude Code wants to modify METTLE locally."), then the
 * result. The client only ever sends the command id, the founder's narrowing choices and the binding hash it was shown;
 * the server derives and checks everything else. Rendered only when execution is enabled (it is not in production).
 */
import { useState } from "react";
import { cockpitFetch } from "@/lib/cockpit-fetch";
import type { ExecutionResult } from "@/lib/execution/contract";
import type { ShadowRecord } from "@/lib/command/types";
import { ExecutionApprovalCard, ExecutionResultCard } from "./ExecutionCards";

type Prepared = { sentence: string; bindingHash: string; details: Record<string, string>; capability: string; project: string };
type State =
  | { s: "idle" } | { s: "preparing" } | { s: "prepared"; p: Prepared } | { s: "running"; p: Prepared }
  | { s: "done"; result: ExecutionResult; projectName: string } | { s: "stopped"; message: string };

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await cockpitFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (res.ok && j?.data) return { ok: true, data: j.data as T };
    return { ok: false, message: j?.error?.question ?? j?.error?.message ?? `Request failed (${res.status}).` };
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Network error." }; }
}

export function ExecutionFlow({ record, onOpenDetails }: { record: Pick<ShadowRecord, "id" | "decision">; onOpenDetails: () => void }) {
  const [st, setSt] = useState<State>({ s: "idle" });
  if (record.decision.handler !== "claude_code") return null;
  const prepare = async () => {
    setSt({ s: "preparing" });
    const r = await post<Prepared>("/api/command-center/execution/prepare", { commandId: record.id });
    setSt(r.ok ? { s: "prepared", p: r.data } : { s: "stopped", message: r.message });
  };
  const approve = async (p: Prepared) => {
    setSt({ s: "running", p });
    const r = await post<{ result: ExecutionResult }>("/api/command-center/execution/approve", { commandId: record.id, capability: p.capability, project: p.project, bindingHash: p.bindingHash });
    setSt(r.ok ? { s: "done", result: r.data.result, projectName: p.details.Project ?? p.project } : { s: "stopped", message: r.message });
  };
  if (st.s === "idle") return <button type="button" data-testid="execution-start" style={{ minHeight: 44, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={prepare}>Run with Claude Code</button>;
  if (st.s === "preparing") return <div role="status" style={{ fontSize: 12 }}>Preparing the exact request. Nothing runs until you approve.</div>;
  if (st.s === "prepared" || st.s === "running") {
    const p = st.p;
    return <ExecutionApprovalCard sentence={p.sentence} details={p.details} busy={st.s === "running"} onApprove={() => void approve(p)} onCancel={() => setSt({ s: "idle" })} />;
  }
  if (st.s === "done") return <ExecutionResultCard result={st.result} projectName={st.projectName} onReview={onOpenDetails} onApproveNext={onOpenDetails} onDetails={onOpenDetails} />;
  return (
    <div data-testid="execution-stopped" role="alert" style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#ef4444" }}>STOPPED</div>
      <div style={{ fontSize: 13 }}>{st.message}</div>
    </div>
  );
}
