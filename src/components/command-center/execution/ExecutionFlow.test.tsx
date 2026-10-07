// @vitest-environment jsdom
/** P06 M6C: the in-palette execution flow sends only the command id, choices and the shown binding; nothing runs before Approve. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const fetchSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cockpit-fetch", () => ({ cockpitFetch: fetchSpy }));
import { routeCommand } from "@/lib/command/router";
import { ExecutionFlow } from "./ExecutionFlow";

afterEach(() => { cleanup(); fetchSpy.mockReset(); });
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const REC = { id: "9e000000-0000-4000-8000-000000000001", decision: routeCommand({ text: "Claude Code, fix the METTLE roster import" }) };
const PREP = { sentence: "Claude Code wants to modify METTLE locally.", bindingHash: "b".repeat(64), details: { Project: "METTLE", Repository: "ramicheAi/mettle" }, capability: "L2", project: "mettle" };
const JOB = "3b1f6c2e-8d4a-4f7b-9c1e-2a5d7e9f0b99";
const STARTED = () => json(202, { data: { started: true, jobId: JOB, executionId: "e1" }, error: null });
const STATUS = (view: unknown) => json(200, { data: view, error: null });
const RESULT = { executionId: "x", executor: "claude_code", status: "succeeded", startedAt: "s", completedAt: "c", project: "mettle", repository: "ramicheAi/mettle", branch: "b", baseHead: "h", resultingHead: null, worktree: "/w", filesChanged: ["a.ts"], checks: [], summary: "Fixed the importer.", evidence: { logPath: null, turns: 3, modelReported: "m" }, usage: { inputTokens: 1, outputTokens: 1, billing: "subscription", reportedCostEstimateUsd: null }, warnings: [], nextStep: null, failure: null };

describe("execution flow", () => {
  it("one button, then the smallest approval, then the result; the client never sends a request object", async () => {
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED).mockImplementationOnce(() => STATUS({ state: "done", executionId: "e1", result: RESULT, message: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    expect((await screen.findByTestId("execution-approval")).textContent).toContain("Claude Code wants to modify METTLE locally.");
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/command-center/execution/prepare");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({ commandId: REC.id });
    expect(fetchSpy).toHaveBeenCalledTimes(1);   // nothing ran yet
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByTestId("execution-result")).textContent).toMatch(/DONE · Claude Code[\s\S]*METTLE[\s\S]*Fixed the importer/);
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body)).toEqual({ commandId: REC.id, capability: "L2", project: "mettle", bindingHash: "b".repeat(64) });
    expect(fetchSpy.mock.calls[2][0]).toBe(`/api/command-center/execution/status?jobId=${JOB}`);
  });

  it("after approval the card follows the job: Running with a Cancel that posts the job id once; a canceled result is shown", async () => {
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED)
      .mockImplementationOnce(() => STATUS({ state: "running", executionId: "e1", result: null, message: null }))
      .mockImplementationOnce(() => json(202, { data: { cancelRequested: true }, error: null }))
      .mockImplementationOnce(() => STATUS({ state: "canceled", executionId: "e1", result: { ...RESULT, status: "canceled" }, message: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const cancel = await screen.findByTestId("execution-cancel");
    expect(screen.getByTestId("execution-running").textContent).toContain("CLAUDE CODE · RUNNING");
    fireEvent.click(cancel);
    fireEvent.click(cancel);   // a second click while the request is in flight must not send another cancel
    expect(fetchSpy.mock.calls.filter((c) => String(c[0]).endsWith("/cancel")).length).toBe(1);
    expect(JSON.parse(fetchSpy.mock.calls.find((c) => String(c[0]).endsWith("/cancel"))![1].body)).toEqual({ jobId: JOB });
    expect((await screen.findByTestId("execution-canceled")).textContent).toContain("stopped at your request");
  });

  it("a failed job with no recorded result says why (fail loud, never a silent empty state)", async () => {
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED)
      .mockImplementationOnce(() => STATUS({ state: "failed", executionId: "e1", result: null, message: "Abandoned: its process was reaped" }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByTestId("execution-stopped")).textContent).toContain("Abandoned: its process was reaped");
  });

  it("Cancel returns to the start without running; a refusal shows STOPPED with the server's smallest explanation", async () => {
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(() => json(403, { data: null, error: { code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." } }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Run with Claude Code" })).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    fetchSpy.mockImplementationOnce(() => json(403, { data: null, error: { code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." } }));
    expect((await screen.findByTestId("execution-stopped")).textContent).toMatch(/STOPPED[\s\S]*not enabled yet/);
  });

  it("is not offered for anything but Claude Code work", () => {
    render(<ExecutionFlow record={{ id: REC.id, decision: routeCommand({ text: "deploy this to production" }) }} onOpenDetails={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Run with Claude Code" })).toBeNull();
  });
});

describe("Codex review (PR #52): ask-rather-than-guess continues with one tap; review shows the run's own evidence", () => {
  it("an unresolved project offers the server's candidates; picking one re-prepares with that project", async () => {
    fetchSpy.mockImplementationOnce(() => json(422, { data: null, error: { code: "project_unresolved", message: "Which project is this for?", question: "Which project is this for?", candidates: ["mettle", "command-center"] } }))
      .mockImplementationOnce(() => json(200, { data: PREP, error: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    expect((await screen.findByTestId("execution-stopped")).textContent).toContain("Which project is this for?");
    fireEvent.click(screen.getByRole("button", { name: "mettle" }));
    expect((await screen.findByTestId("execution-approval")).textContent).toContain("Claude Code wants to modify METTLE locally.");
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body)).toEqual({ commandId: REC.id, project: "mettle" });
  });

  it("Review changes and Details show the run's files, branch, worktree, checks and log inline; they do not navigate away", async () => {
    const onOpenDetails = vi.fn();
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED).mockImplementationOnce(() => STATUS({ state: "done", executionId: "e1", result: { ...RESULT, checks: [{ command: "npx vitest run", ok: true }], evidence: { logPath: "/x.log.jsonl", turns: 3, modelReported: "m" } }, message: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={onOpenDetails} />);
    fireEvent.click(screen.getByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByTestId("execution-result");
    expect(screen.queryByTestId("execution-evidence")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    const ev = screen.getByTestId("execution-evidence").textContent!;
    expect(ev).toMatch(/a\.ts[\s\S]*\/w[\s\S]*ok: npx vitest run[\s\S]*\/x\.log\.jsonl/);
    expect(onOpenDetails).not.toHaveBeenCalled();
  });
});
