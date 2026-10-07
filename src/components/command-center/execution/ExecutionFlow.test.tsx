// @vitest-environment jsdom
/** P06 M6C: the in-palette execution flow sends only the command id, choices and the shown binding; nothing runs before Approve. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const fetchSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cockpit-fetch", () => ({ cockpitFetch: fetchSpy }));
import { routeCommand } from "@/lib/command/router";
import { ExecutionFlow } from "./ExecutionFlow";

// The palette asks the server once per mount whether a run is in progress for this command (answer: none), so the
// queued responses below are for the calls under test; the lookup is dispatched separately and not counted.
const queued: (() => Promise<Response>)[] = [];
const fq = { mockImplementationOnce(f: () => Promise<Response>) { queued.push(f); return fq; } };
const callsOf = () => fetchSpy.mock.calls.filter((c) => !String(c[0]).includes("commandId="));
beforeEach(() => {
  fetchSpy.mockImplementation((url: string) => {
    if (String(url).includes("commandId=")) return json(200, { data: { jobId: null, state: "none" }, error: null });
    const f = queued.shift();
    if (!f) throw new Error(`unexpected fetch ${url}`);
    return f();
  });
});
afterEach(() => { cleanup(); fetchSpy.mockReset(); queued.length = 0; });
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const REC = { id: "9e000000-0000-4000-8000-000000000001", decision: routeCommand({ text: "Claude Code, fix the METTLE roster import" }) };
const PREP = { sentence: "Claude Code wants to modify METTLE locally.", bindingHash: "b".repeat(64), details: { Project: "METTLE", Repository: "ramicheAi/mettle" }, capability: "L2", project: "mettle" };
const JOB = "3b1f6c2e-8d4a-4f7b-9c1e-2a5d7e9f0b99";
const STARTED = () => json(202, { data: { started: true, jobId: JOB, executionId: "e1" }, error: null });
const STATUS = (view: unknown) => json(200, { data: view, error: null });
const RESULT = { executionId: "x", executor: "claude_code", status: "succeeded", startedAt: "s", completedAt: "c", project: "mettle", repository: "ramicheAi/mettle", branch: "b", baseHead: "h", resultingHead: null, worktree: "/w", filesChanged: ["a.ts"], checks: [], summary: "Fixed the importer.", evidence: { logPath: null, turns: 3, modelReported: "m" }, usage: { inputTokens: 1, outputTokens: 1, billing: "subscription", reportedCostEstimateUsd: null }, warnings: [], nextStep: null, failure: null };

describe("execution flow", () => {
  it("one button, then the smallest approval, then the result; the client never sends a request object", async () => {
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED).mockImplementationOnce(() => STATUS({ state: "done", executionId: "e1", result: RESULT, message: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    expect(callsOf()).toHaveLength(0);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    expect((await screen.findByTestId("execution-approval")).textContent).toContain("Claude Code wants to modify METTLE locally.");
    expect(callsOf()[0][0]).toBe("/api/command-center/execution/prepare");
    expect(JSON.parse(callsOf()[0][1].body)).toEqual({ commandId: REC.id });
    expect(callsOf()).toHaveLength(1);   // nothing ran yet
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByTestId("execution-result")).textContent).toMatch(/DONE · Claude Code[\s\S]*METTLE[\s\S]*Fixed the importer/);
    expect(JSON.parse(callsOf()[1][1].body)).toEqual({ commandId: REC.id, capability: "L2", project: "mettle", bindingHash: "b".repeat(64) });
    expect(callsOf()[2][0]).toBe(`/api/command-center/execution/status?jobId=${JOB}`);
  });

  it("after approval the card follows the job: Running with a Cancel that posts the job id once; a canceled result is shown", async () => {
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED)
      .mockImplementationOnce(() => STATUS({ state: "running", executionId: "e1", result: null, message: null }))
      .mockImplementationOnce(() => json(202, { data: { cancelRequested: true }, error: null }))
      .mockImplementationOnce(() => STATUS({ state: "canceled", executionId: "e1", result: { ...RESULT, status: "canceled", failure: { code: "canceled", message: "Canceled. Anything it changed is in its worktree." } }, message: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    const cancel = await screen.findByTestId("execution-cancel");
    expect(screen.getByTestId("execution-running").textContent).toContain("CLAUDE CODE · RUNNING");
    fireEvent.click(cancel);
    fireEvent.click(cancel);   // a second click while the request is in flight must not send another cancel
    expect(callsOf().filter((c) => String(c[0]).endsWith("/cancel")).length).toBe(1);
    expect(JSON.parse(callsOf().find((c) => String(c[0]).endsWith("/cancel"))![1].body)).toEqual({ jobId: JOB });
    expect((await screen.findByTestId("execution-result")).textContent).toContain("STOPPED");
  });

  it("a failed job with no recorded result says why (fail loud, never a silent empty state)", async () => {
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED)
      .mockImplementationOnce(() => STATUS({ state: "failed", executionId: "e1", result: null, message: "Abandoned: its process was reaped" }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByTestId("execution-stopped")).textContent).toContain("Abandoned: its process was reaped");
  });

  it("Cancel returns to the start without running; a refusal shows STOPPED with the server's smallest explanation", async () => {
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(() => json(403, { data: null, error: { code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." } }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Run with Claude Code" })).toBeTruthy();
    expect(callsOf()).toHaveLength(1);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    fq.mockImplementationOnce(() => json(403, { data: null, error: { code: "production_dispatch_disabled", message: "Execution from Universal Command is not enabled yet. Nothing was run." } }));
    expect((await screen.findByTestId("execution-stopped")).textContent).toMatch(/STOPPED[\s\S]*not enabled yet/);
  });

  it("is not offered for anything but Claude Code work", () => {
    render(<ExecutionFlow record={{ id: REC.id, decision: routeCommand({ text: "deploy this to production" }) }} onOpenDetails={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Run with Claude Code" })).toBeNull();
  });
});

describe("Codex review (PR #52): ask-rather-than-guess continues with one tap; review shows the run's own evidence", () => {
  it("an unresolved project offers the server's candidates; picking one re-prepares with that project", async () => {
    fq.mockImplementationOnce(() => json(422, { data: null, error: { code: "project_unresolved", message: "Which project is this for?", question: "Which project is this for?", candidates: ["mettle", "command-center"] } }))
      .mockImplementationOnce(() => json(200, { data: PREP, error: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    expect((await screen.findByTestId("execution-stopped")).textContent).toContain("Which project is this for?");
    fireEvent.click(screen.getByRole("button", { name: "mettle" }));
    expect((await screen.findByTestId("execution-approval")).textContent).toContain("Claude Code wants to modify METTLE locally.");
    expect(JSON.parse(callsOf()[1][1].body)).toEqual({ commandId: REC.id, project: "mettle" });
  });

  it("Review changes and Details show the run's files, branch, worktree, checks and log inline; they do not navigate away", async () => {
    const onOpenDetails = vi.fn();
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED).mockImplementationOnce(() => STATUS({ state: "done", executionId: "e1", result: { ...RESULT, checks: [{ command: "npx vitest run", ok: true }], evidence: { logPath: "/x.log.jsonl", turns: 3, modelReported: "m" } }, message: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={onOpenDetails} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
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

describe("PR #57 Codex: no Start while the resume lookup is pending", () => {
  it("while a run may already exist, Run with Claude Code is not offered; once the lookup settles it is", async () => {
    let answer!: (r: Response) => void;
    fetchSpy.mockImplementation((url: string) => {
      if (String(url).includes("commandId=")) return new Promise<Response>((res) => { answer = res; });
      throw new Error("unexpected " + url);
    });
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Run with Claude Code" })).toBeNull();
    answer(new Response(JSON.stringify({ data: { jobId: null, state: "none" }, error: null }), { status: 200 }));
    expect(await screen.findByRole("button", { name: "Run with Claude Code" })).toBeTruthy();
  });
  it("a run that is already in progress is followed instead of offering a second one", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (String(url).includes("commandId=")) return json(200, { data: { jobId: JOB, state: "running", executionId: "e1", result: null, message: null }, error: null });
      return json(200, { data: { jobId: JOB, state: "running", executionId: "e1", result: null, message: null }, error: null });
    });
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    expect(await screen.findByTestId("execution-cancel")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Run with Claude Code" })).toBeNull();
  });
});

describe("PR #57 Codex on a4f0f30", () => {
  it("a failed resume check does not offer Start; the founder retries the check", async () => {
    let n = 0;
    fetchSpy.mockImplementation((url: string) => {
      if (String(url).includes("commandId=")) return n++ === 0 ? json(500, { data: null, error: { code: "store_error", message: "down" } }) : json(200, { data: { jobId: null, state: "none" }, error: null });
      throw new Error("unexpected " + url);
    });
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Check again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Run with Claude Code" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByRole("button", { name: "Run with Claude Code" })).toBeTruthy();
  });
  it("a cancel that raced a completion is reset when another tab's retry (a new attempt) is running", async () => {
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null }))
      .mockImplementationOnce(() => json(202, { data: { started: true, jobId: JOB, executionId: "e1" }, error: null }))
      .mockImplementationOnce(() => json(200, { data: { jobId: JOB, state: "running", executionId: "e1", result: null, message: null }, error: null }))
      .mockImplementationOnce(() => json(202, { data: { cancelRequested: true }, error: null }))
      .mockImplementationOnce(() => json(200, { data: { jobId: JOB, state: "running", executionId: "e2", result: null, message: null }, error: null }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(await screen.findByTestId("execution-cancel"));
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeTruthy();
    expect((screen.getByTestId("execution-cancel") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("PR #57 Codex on 5a625f7", () => {
  it("a failed run keeps its result: the founder can review the log, checks and files of a stopped run", async () => {
    const FAILED = { ...RESULT, status: "failed", filesChanged: ["x.ts"], failure: { code: "timed_out", message: "Stopped after 900 seconds." }, summary: "Stopped after 900 seconds." };
    fq.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(STARTED)
      .mockImplementationOnce(() => STATUS({ state: "failed", executionId: "e1", result: FAILED, message: "Stopped after 900 seconds." }));
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Run with Claude Code" }));
    await screen.findByTestId("execution-approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect((await screen.findByTestId("execution-result")).textContent).toContain("Stopped after 900 seconds.");
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByTestId("execution-evidence").textContent).toMatch(/x\.ts/);
  });
  it("a resumed run names its project from the result, not the executor", async () => {
    fetchSpy.mockImplementation((url: string) => {
      if (String(url).includes("commandId=")) return json(200, { data: { jobId: JOB, state: "running", executionId: "e1", result: null, message: null }, error: null });
      return json(200, { data: { jobId: JOB, state: "done", executionId: "e1", result: RESULT, message: null }, error: null });
    });
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    const card = await screen.findByTestId("execution-result");
    expect(card.textContent).toContain("mettle");
  });
  it("status copy uses no ellipses", () => {
    const src = readFileSync(join(process.cwd(), "src/components/command-center/execution/ExecutionFlow.tsx"), "utf8");
    expect(src).not.toMatch(/…/);
  });
});

describe("PR #57 Codex on d46d75a: a run that finishes during the resume lookup", () => {
  it("the lookup accepts a finished run and shows its result, not a 'Check again'", async () => {
    const DONE = { ...RESULT, project: "mettle" };
    fetchSpy.mockImplementation((url: string) => {
      if (String(url).includes("commandId=")) return json(200, { data: { jobId: JOB, state: "done", executionId: "e1", result: DONE, message: null }, error: null });
      throw new Error("unexpected " + url);
    });
    render(<ExecutionFlow record={REC} onOpenDetails={vi.fn()} />);
    expect((await screen.findByTestId("execution-result")).textContent).toContain("Fixed the importer.");
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull();
  });
});
