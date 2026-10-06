// @vitest-environment jsdom
/** P06 M6: the founder sees the smallest decision and a concise result; logs and the full request stay behind Details. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ExecutionRequest, ExecutionResult } from "@/lib/execution/contract";
import { approvalSentence, ExecutionApprovalCard, ExecutionResultCard, requestDetails } from "./ExecutionCards";

afterEach(cleanup);

const request: ExecutionRequest = {
  executionId: "00000000-0000-4000-8000-000000000001", commandId: null, missionId: null, founder: { uid: "o" }, executor: "claude_code",
  project: { slug: "mettle" }, repository: { origin: "ramicheAi/mettle", branch: "main", head: "abcdef1234".padEnd(40, "0") },
  task: { instruction: "Fix athlete import validation.", contextRefs: [] }, capability: "L2",
  limits: { timeoutMs: 600_000, maxTurns: 40, maxBudgetUsd: null }, idempotencyKey: "k-1-L2", createdAt: "2026-10-05T15:00:00Z",
};
const result = (over: Partial<ExecutionResult> = {}): ExecutionResult => ({
  executionId: request.executionId, executor: "claude_code", status: "succeeded", startedAt: "s", completedAt: "c", project: "mettle", repository: "ramicheAi/mettle",
  branch: "parallax-exec/x", baseHead: request.repository.head, resultingHead: null, worktree: "/w", filesChanged: ["a.ts", "b.ts"],
  checks: [{ command: "npx vitest run", ok: true }], summary: "Fixed athlete import validation.",
  evidence: { logPath: "/w.log.jsonl", turns: 4, modelReported: "m" }, usage: { inputTokens: 1, outputTokens: 1, billing: "subscription", reportedCostEstimateUsd: null },
  warnings: [], nextStep: null, failure: null, ...over,
});

describe("execution approval", () => {
  it("is one sentence with Approve and Cancel; the technical request is only under Details", () => {
    const onApprove = vi.fn(), onCancel = vi.fn();
    render(<ExecutionApprovalCard sentence={approvalSentence(request, "METTLE")} details={requestDetails(request)} onApprove={onApprove} onCancel={onCancel} />);
    const card = screen.getByTestId("execution-approval");
    expect(card.textContent).toContain("Claude Code wants to modify METTLE locally.");
    expect(card.textContent).not.toContain("ramicheAi/mettle");
    expect(screen.queryByTestId("execution-approval-details")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const d = screen.getByTestId("execution-approval-details").textContent!;
    expect(d).toContain("ramicheAi/mettle @ main abcdef1");
    expect(d).toMatch(/Never allows.*push.*merge.*deploy/);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect([onApprove.mock.calls.length, onCancel.mock.calls.length]).toEqual([1, 1]);
  });

  it("says what each capability allows in plain words", () => {
    expect(["L0", "L1", "L2", "L3", "L4"].map((c) => approvalSentence({ capability: c as ExecutionRequest["capability"] }, "METTLE"))).toEqual([
      "Claude Code wants to inspect METTLE.", "Claude Code wants to analyze METTLE.", "Claude Code wants to modify METTLE locally.",
      "Claude Code wants to modify and test METTLE locally.", "Claude Code wants to commit to METTLE locally.",
    ]);
  });
});

describe("execution result", () => {
  const handlers = () => ({ onReview: vi.fn(), onApproveNext: vi.fn(), onDetails: vi.fn() });

  it("DONE shows the project, the summary, checks and files, with Review changes; no raw log", () => {
    const h = handlers();
    render(<ExecutionResultCard result={result()} projectName="METTLE" {...h} />);
    const t = screen.getByTestId("execution-result").textContent!;
    expect(t).toMatch(/DONE · Claude Code[\s\S]*METTLE[\s\S]*Fixed athlete import validation\.[\s\S]*1 of 1 checks passed[\s\S]*2 files changed/);
    expect(t).not.toContain("log.jsonl");
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    expect(h.onReview).toHaveBeenCalledTimes(1);
  });

  it("READY FOR APPROVAL names the next action and asks only for that", () => {
    const h = handlers();
    render(<ExecutionResultCard result={result({ nextStep: { action: "Create commit", capability: "L4", consequential: null } })} projectName="METTLE" {...h} />);
    const t = screen.getByTestId("execution-result").textContent!;
    expect(t).toContain("READY FOR APPROVAL");
    expect(t).toContain("Next requested action: Create commit");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(h.onApproveNext).toHaveBeenCalledTimes(1);
  });

  it("a consequential next step is never approvable here", () => {
    render(<ExecutionResultCard result={result({ nextStep: { action: "Open a pull request", capability: null, consequential: "pull_request" } })} projectName="METTLE" {...handlers()} />);
    expect(screen.getByTestId("execution-result").textContent).toContain("needs separate authority");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("a stopped run shows the smallest explanation, not the summary", () => {
    render(<ExecutionResultCard result={result({ status: "boundary_violation", failure: { code: "boundary_violation", message: "Stopped: the run acted outside L2." } })} projectName="METTLE" {...handlers()} />);
    const t = screen.getByTestId("execution-result").textContent!;
    expect(t).toContain("STOPPED · Claude Code");
    expect(t).toContain("Stopped: the run acted outside L2.");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});
