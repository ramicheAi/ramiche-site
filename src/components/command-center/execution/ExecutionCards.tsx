"use client";
/**
 * P06 M6 founder surfaces for controlled execution: the smallest approval decision, and a concise result.
 * Raw logs and the full request stay behind Details. Not mounted on any production surface while
 * PRODUCTION_DISPATCH_ENABLED is false; these render from an ExecutionRequest / ExecutionResult only.
 */
import { Fragment, useState, type CSSProperties } from "react";
import { CAPABILITY_META, CONSEQUENTIAL_ACTIONS, type ExecutionRequest, type ExecutionResult } from "@/lib/execution/contract-core";

const card: CSSProperties = { display: "grid", gap: 8, padding: "14px 16px", borderRadius: 10, border: "1px solid var(--line, #1e1e1e)", background: "rgba(255,255,255,0.03)", overflowWrap: "anywhere" };
const eyebrow: CSSProperties = { fontSize: 11, letterSpacing: 1, fontWeight: 700 };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 };
const btn = (primary = false): CSSProperties => ({
  minHeight: 44, padding: "0 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  background: primary ? "var(--accent, #00f0ff)" : "rgba(255,255,255,0.04)", color: primary ? "#0e0e18" : "var(--t-hi, #fff)",
  border: primary ? "none" : "1px solid var(--line, #1e1e1e)",
});
const muted: CSSProperties = { color: "var(--t-mid, #9a9a9a)", fontSize: 12 };
const short = (sha: string) => sha.slice(0, 7);
const NOT_ALLOWED = CONSEQUENTIAL_ACTIONS.map((a) => a.replace(/_/g, " ")).join(", ");

/** "Claude Code wants to modify METTLE locally." */
export function approvalSentence(r: Pick<ExecutionRequest, "capability">, projectName: string): string {
  const local = r.capability === "L0" || r.capability === "L1" ? "" : " locally";
  return `Claude Code wants to ${CAPABILITY_META[r.capability].verb} ${projectName}${local}.`;
}

/** Details for a full request (server side or tests); the cockpit receives the same map from `prepare`. */
export function requestDetails(request: ExecutionRequest): Record<string, string> {
  return {
    Task: request.task.instruction,
    Repository: `${request.repository.origin} @ ${request.repository.branch} ${short(request.repository.head)}`,
    Allows: `${request.capability}: ${CAPABILITY_META[request.capability].label}, in an isolated worktree`,
    "Never allows": NOT_ALLOWED,
    Limits: `${Math.round(request.limits.timeoutMs / 60000)} min, ${request.limits.maxTurns} turns`,
  };
}

export function ExecutionApprovalCard({ sentence, details, busy = false, onApprove, onCancel }: {
  sentence: string; details: Record<string, string>; busy?: boolean; onApprove: () => void; onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="execution-approval" role="group" aria-label="Execution approval" style={card}>
      <div style={{ ...eyebrow, color: "var(--c-amber, #f59e0b)" }}>NEEDS YOUR APPROVAL</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t-hi, #fff)" }}>{sentence}</div>
      <div style={row}>
        <button type="button" style={btn(true)} disabled={busy} onClick={onApprove}>{busy ? "Working" : "Approve"}</button>
        <button type="button" style={btn()} disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" style={btn()} aria-expanded={open} onClick={() => setOpen((d) => !d)}>Details</button>
      </div>
      {open && (
        <dl data-testid="execution-approval-details" style={{ ...muted, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: "4px 12px", margin: 0 }}>
          {Object.entries(details).map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>))}
        </dl>
      )}
    </div>
  );
}

export function ExecutionResultCard({ result, projectName, onReview, onApproveNext, onDetails }: {
  result: ExecutionResult; projectName: string; onReview: () => void; onApproveNext: () => void; onDetails: () => void;
}) {
  const ok = result.status === "succeeded";
  const next = ok ? result.nextStep : null;
  const asksApproval = !!next && next.capability !== null;
  const passed = result.checks.filter((c) => c.ok).length;
  const head = !ok ? `STOPPED · Claude Code` : asksApproval ? "READY FOR APPROVAL" : "DONE · Claude Code";
  return (
    <div data-testid="execution-result" role="status" style={card}>
      <div style={{ ...eyebrow, color: ok ? (asksApproval ? "var(--c-amber, #f59e0b)" : "var(--accent, #00f0ff)") : "#ef4444" }}>{head}</div>
      <div style={{ color: "var(--t-hi, #fff)", fontWeight: 600 }}>{projectName}</div>
      <div style={{ color: "var(--t-hi, #fff)", fontSize: 14 }}>{ok ? result.summary : result.failure?.message}</div>
      {ok && (
        <div style={muted}>
          {result.checks.length > 0 && <span>{passed} of {result.checks.length} checks passed · </span>}
          <span>{result.filesChanged.length} {result.filesChanged.length === 1 ? "file" : "files"} changed</span>
        </div>
      )}
      {next && asksApproval && <div style={muted}>Next requested action: {next.action}</div>}
      {next && !asksApproval && <div style={muted}>Next: {next.action}. That needs separate authority and is not available here.</div>}
      <div style={row}>
        {asksApproval && <button type="button" style={btn(true)} onClick={onApproveNext}>Approve</button>}
        {!asksApproval && result.filesChanged.length > 0 && <button type="button" style={btn(true)} onClick={onReview}>Review changes</button>}
        <button type="button" style={btn()} onClick={onDetails}>Details</button>
      </div>
    </div>
  );
}
