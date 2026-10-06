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
const RESULT = { executionId: "x", executor: "claude_code", status: "succeeded", startedAt: "s", completedAt: "c", project: "mettle", repository: "ramicheAi/mettle", branch: "b", baseHead: "h", resultingHead: null, worktree: "/w", filesChanged: ["a.ts"], checks: [], summary: "Fixed the importer.", evidence: { logPath: null, turns: 3, modelReported: "m" }, usage: { inputTokens: 1, outputTokens: 1, billing: "subscription", reportedCostEstimateUsd: null }, warnings: [], nextStep: null, failure: null };

describe("execution flow", () => {
  it("one button, then the smallest approval, then the result; the client never sends a request object", async () => {
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(() => json(200, { data: { result: RESULT, mission: { suggest: false } }, error: null }));
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
    fetchSpy.mockImplementationOnce(() => json(200, { data: PREP, error: null })).mockImplementationOnce(() => json(200, { data: { result: { ...RESULT, checks: [{ command: "npx vitest run", ok: true }], evidence: { logPath: "/x.log.jsonl", turns: 3, modelReported: "m" } }, mission: { suggest: false } }, error: null }));
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
