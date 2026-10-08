// @vitest-environment jsdom
/**
 * P06 M5: the palette's Universal Command entry records a SHADOW decision only. It never posts to the jobs route
 * (which executes), and inside a mission it sends that mission as context.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), path: "/command-center" }));
const fetchSpy = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }), usePathname: () => nav.path }));
vi.mock("@/lib/cockpit-fetch", () => ({ cockpitFetch: fetchSpy }));
vi.mock("@/hooks/useGlobalSearch", () => ({ useGlobalSearch: () => ({ results: [], loading: false, unavailable: false }) }));

import { CommandPalette } from "./CommandPalette";
import { routeCommand } from "@/lib/command/router";
import type { ShadowRecord } from "@/lib/command/types";

Element.prototype.scrollIntoView = function scrollIntoView() {};   // jsdom has no layout

afterEach(() => { cleanup(); fetchSpy.mockReset(); nav.push.mockReset(); nav.path = "/command-center"; });
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const ID = "9e000000-0000-4000-8000-000000000001";
const MID = "00000000-0000-4000-8000-0000000000ab";
/** The record the shadow route returns: the real router's decision for the text, persisted with an id. */
const rec = (text: string, id = ID): ShadowRecord => ({
  id, command: text, routedAt: "2026-10-05T14:00:00Z", routerVersion: "m5-rules-1", shadow: true, executed: false, supersedes: null, missionContext: null,
  decision: routeCommand({ text }), linkedMissions: [],
});
const ok = (text: string, id = ID) => json(201, { data: rec(text, id), error: null });
const okResponse = (text: string, id = ID) => new Response(JSON.stringify({ data: rec(text, id), error: null }), { status: 201 });

function open(text: string) {
  const onClose = vi.fn();
  render(<CommandPalette open onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: text } });
  return onClose;
}

describe("Universal Command entry in the command palette", () => {
  it("records a shadow route and shows the result in the palette; nothing navigates and the jobs route is never called", async () => {
    fetchSpy.mockImplementation(() => ok("Claude Code, fix Mettle. Codex reviews."));
    const onClose = open("Claude Code, fix Mettle. Codex reviews.");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await screen.findByTestId("shadow-result");
    expect(nav.push).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/command-center/command/shadow");
    expect(JSON.parse(init.body)).toEqual({ text: "Claude Code, fix Mettle. Codex reviews.", missionId: null });
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/jobs"))).toBe(false);
  });

  it("inside a mission, the mission travels as context", async () => {
    nav.path = `/command-center/missions/${MID}`;
    fetchSpy.mockImplementation(() => ok("Claude Code, fix it"));
    open("Claude Code, fix it");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).missionId).toBe(MID);
  });

  it("a failure is shown in the palette, which stays open; nothing navigates", async () => {
    fetchSpy.mockImplementation(() => json(403, { error: "denied" }));
    const onClose = open("fix it");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Shadow routing failed");
    expect(nav.push).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("after a failed shadow route, editing the command and pressing Enter retries the SHADOW route, never Run as Job", async () => {
    fetchSpy.mockImplementationOnce(() => json(502, { data: null, error: { code: "storage_error", message: "command storage call failed" } }))
      .mockImplementationOnce(() => ok("Claude Code, fix it"));
    open("fix it");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "Claude Code, fix it" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("shadow-result");
    expect(nav.push).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual(["/api/command-center/command/shadow", "/api/command-center/command/shadow"]);
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body).text).toBe("Claude Code, fix it");
  });

  it("while a shadow route is being recorded, Enter and clicks run nothing else", async () => {
    let release!: (v: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((r) => (release = r)));
    open("fix it");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: /run as job/i }));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    release(okResponse("fix it"));
    await screen.findByTestId("shadow-result");
    expect(nav.push).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/jobs"))).toBe(false);
  });

  it("closing the palette while the route is pending neither navigates nor shows the late result", async () => {
    let release!: (v: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((r) => (release = r)));
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "fix it" } });
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    rerender(<CommandPalette open={false} onClose={onClose} />);
    release(okResponse("fix it"));
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.push).not.toHaveBeenCalled();
    rerender(<CommandPalette open onClose={onClose} />);
    expect(screen.queryByTestId("shadow-result")).toBeNull();
  });

  it("a request still pending when the palette closes does not lock it after reopening", async () => {
    fetchSpy.mockImplementationOnce(() => new Promise<Response>(() => {}))                // never resolves
      .mockImplementationOnce(() => ok("fix it"));
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "fix it" } });
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    rerender(<CommandPalette open={false} onClose={onClose} />);
    rerender(<CommandPalette open onClose={onClose} />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await screen.findByTestId("shadow-result");
  });

  it("a result from an attempt abandoned by closing is never shown and never navigates, even after reopening", async () => {
    let releaseOld!: (v: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((r) => (releaseOld = r)));
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    rerender(<CommandPalette open={false} onClose={onClose} />);
    rerender(<CommandPalette open onClose={onClose} />);
    releaseOld(okResponse("first", "9e000000-0000-4000-8000-0000000000ff"));
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("shadow-result")).toBeNull();
  });

  it("with typed text, Shadow-route is row 0 and Run as Job row 1", () => {
    open("fix it");
    const items = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(items[0]).toContain("Shadow-route");
    expect(items[0]).toContain("↵ shadow");
    expect(items[1]).toContain("Run as Job");
    expect(items[1]).toContain("runs now");
  });

  it("a plain Enter on a typed command shadow-routes it and never calls /jobs", async () => {
    fetchSpy.mockImplementation(() => ok("Claude Code, fix Mettle"));
    open("Claude Code, fix Mettle");
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("shadow-result");
    expect(nav.push).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual(["/api/command-center/command/shadow"]);
  });

  it("Run as Job still works, but only by deliberate selection (arrow down + Enter, or a click)", async () => {
    fetchSpy.mockImplementation(() => json(201, { data: { id: "job-1" }, error: null }));
    const onClose = open("rebuild the index");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/command-center/jobs"));
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/command-center/jobs");
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toEqual({ title: "rebuild the index", kind: "generic", source: "command-bar" });
    expect(onClose).toHaveBeenCalled();
    cleanup(); fetchSpy.mockClear(); nav.push.mockClear();
    open("rebuild the index");
    fireEvent.click(screen.getByRole("button", { name: /run as job/i }));
    await waitFor(() => expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/command-center/jobs"));
  });

  it("hovering Run as Job does not select it, so Enter after a stray mouse move still shadow-routes", async () => {
    fetchSpy.mockImplementation(() => ok("fix it"));
    open("fix it");
    fireEvent.mouseEnter(screen.getByRole("button", { name: /run as job/i }));
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("shadow-result");
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual(["/api/command-center/command/shadow"]);
  });

  it("editing the text after arrowing to Run as Job moves the highlight back to Shadow-route", async () => {
    fetchSpy.mockImplementation(() => ok("first, edited"));
    open("first");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "first, edited" } });
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual(["/api/command-center/command/shadow"]);
  });
});

describe("Run as Job reads as an executing action (M5A)", () => {
  it("its tag and hint use the warning colour; the shadow row's do not", () => {
    open("fix it");
    const rows = screen.getAllByRole("button");
    const runTag = within(rows[1]).getByText("runs now");
    expect(runTag.style.color).toContain("--c-amber");
    expect(within(rows[1]).getByText(/Executes now/).style.color).toContain("--c-amber");
    expect(within(rows[0]).getByText(/Nothing is executed/).style.color).not.toContain("--c-amber");
  });
});

describe("Least effort: the shadow result stays in the palette (P06 M5C)", () => {
  const route = async (text: string) => {
    fetchSpy.mockImplementation(() => ok(text));
    const onClose = open(text);
    fireEvent.keyDown(window, { key: "Enter" });
    return { onClose, result: await screen.findByTestId("shadow-result") };
  };

  it("shows NOTHING EXECUTED, the would-route-to handler, rules only and founder involvement, without navigating", async () => {
    const { onClose, result } = await route("Claude Code, review the Mission UI spacing");
    expect(result.textContent).toContain("SHADOW · NOTHING EXECUTED");
    expect(result.textContent).toContain("Claude Code");
    expect(result.textContent).toContain("Rules only");
    expect(result.textContent).toContain("Founder approval required");   // the router requires it for Claude Code
    expect(nav.push).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual(["/api/command-center/command/shadow"]);   // no jobs, no model
  });

  it("founder approval is read from the recorded decision, never assumed (Codex P2, PR #45)", async () => {
    const research = await route("Research competitor pricing");
    expect(routeCommand({ text: "Research competitor pricing" }).founderApprovalRequired).toBe(false);
    expect(research.result.textContent).toContain("No founder approval required");
    cleanup(); fetchSpy.mockReset();
    const code = await route("Claude Code, review the Mission UI spacing");
    expect(routeCommand({ text: "Claude Code, review the Mission UI spacing" }).founderApprovalRequired).toBe(true);
    expect(code.result.textContent).not.toContain("No founder approval required");
  });

  it("Create Mission is not offered inside a mission or when the command is already linked; Details still is (Codex P2, PR #45)", async () => {
    for (const over of [{ missionContext: MID }, { linkedMissions: [{ id: MID, ref: 7, state: "intent", relation: "source" }] }]) {
      fetchSpy.mockImplementation(() => json(201, { data: { ...rec("Claude Code, fix it"), ...over }, error: null }));
      open("Claude Code, fix it");
      fireEvent.keyDown(window, { key: "Enter" });
      const result = await screen.findByTestId("shadow-result");
      expect(within(result).queryByRole("button", { name: "Create Mission" })).toBeNull();
      expect(within(result).getByRole("button", { name: "Details" })).toBeTruthy();
      cleanup(); fetchSpy.mockReset();
    }
  });

  it("a founder-authority command says a founder decision is required; an ambiguous one asks for a handler", async () => {
    expect((await route("deploy this to production")).result.textContent).toContain("Founder decision required");
    cleanup(); fetchSpy.mockReset();
    expect((await route("Mettle onboarding")).result.textContent).toMatch(/Undecided[\s\S]*Needs your choice of handler/);
  });

  it("the input is cleared for the next command; typing hides the result and Enter shadow-routes the new text", async () => {
    const { result } = await route("Claude Code, fix it");
    const input = screen.getByPlaceholderText(/type intent/i) as HTMLInputElement;
    expect(input.value).toBe("");
    expect(result.isConnected).toBe(true);
    fetchSpy.mockImplementation(() => ok("Research competitor pricing", "9e000000-0000-4000-8000-000000000002"));
    fireEvent.change(input, { target: { value: "Research competitor pricing" } });
    expect(screen.queryByTestId("shadow-result")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("shadow-result");
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body).text).toBe("Research competitor pricing");
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("Enter with the result shown and an empty input does nothing (no reflex page jump)", async () => {
    await route("Claude Code, fix it");
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(nav.push).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("Escape closes with no other work", async () => {
    const { onClose } = await route("Claude Code, fix it");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(nav.push).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("text typed while the route is pending is kept when the result arrives (M5C review)", async () => {
    let release!: (v: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((r) => (release = r)));
    open("Claude Code, fix it");
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByRole("status");
    const input = screen.getByPlaceholderText(/type intent/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Research pricing" } });
    release(okResponse("Claude Code, fix it"));
    await screen.findByTestId("shadow-result");
    expect(input.value).toBe("Research pricing");
  });

  it("a success response without a readable decision is shown as a failure, never a crash or a fake result", async () => {
    fetchSpy.mockImplementation(() => json(201, { data: { id: ID }, error: null }));
    open("Claude Code, fix it");
    fireEvent.keyDown(window, { key: "Enter" });
    expect((await screen.findByRole("alert")).textContent).toContain("Shadow routing failed");
    expect(screen.queryByTestId("shadow-result")).toBeNull();
  });

  it("Create Mission and Details are explicit and open the Missions flow only when clicked", async () => {
    const { onClose, result } = await route("Claude Code, fix it");
    fireEvent.click(within(result).getByRole("button", { name: "Create Mission" }));
    expect(nav.push).toHaveBeenCalledWith(`/command-center/missions?command=${ID}&create=1`);
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup(); nav.push.mockReset(); fetchSpy.mockReset();
    const second = await route("Claude Code, fix it");
    fireEvent.click(within(second.result).getByRole("button", { name: "Details" }));
    expect(nav.push).toHaveBeenCalledWith(`/command-center/missions?command=${ID}`);
    expect(fetchSpy).toHaveBeenCalledTimes(1);   // neither button writes anything
  });
});

describe("P06 M6C: execution in the palette stays off in production", () => {
  it("by default (the production gate) the shadow result offers no execution and makes no extra request", async () => {
    fetchSpy.mockImplementation(() => ok("Claude Code, fix the METTLE roster import"));
    open("Claude Code, fix the METTLE roster import");
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("shadow-result");
    expect(screen.queryByRole("button", { name: "Run with Claude Code" })).toBeNull();
    expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual(["/api/command-center/command/shadow"]);
  });
  it("when enabled (development), Claude Code work offers Run with Claude Code under the result", async () => {
    // The palette first asks whether a run already exists for this command (answer: none), then routes the command.
    fetchSpy.mockImplementation((url: string) => (String(url).includes("commandId=") ? Promise.resolve(new Response(JSON.stringify({ data: { jobId: null, state: "none" }, error: null }), { status: 200 })) : ok("Claude Code, fix the METTLE roster import")));
    render(<CommandPalette open onClose={vi.fn()} executionEnabled />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "Claude Code, fix the METTLE roster import" } });
    fireEvent.keyDown(window, { key: "Enter" });
    await screen.findByTestId("shadow-result");
    // Start is offered once the server has said no run is already in progress for this command.
    expect(await screen.findByRole("button", { name: "Run with Claude Code" })).toBeTruthy();
  });
});
