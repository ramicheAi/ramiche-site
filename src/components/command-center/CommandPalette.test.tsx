// @vitest-environment jsdom
/**
 * P06 M5: the palette's Universal Command entry records a SHADOW decision only. It never posts to the jobs route
 * (which executes), and inside a mission it sends that mission as context.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const nav = vi.hoisted(() => ({ push: vi.fn(), path: "/command-center" }));
const fetchSpy = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push, replace: vi.fn() }), usePathname: () => nav.path }));
vi.mock("@/lib/cockpit-fetch", () => ({ cockpitFetch: fetchSpy }));
vi.mock("@/hooks/useGlobalSearch", () => ({ useGlobalSearch: () => ({ results: [], loading: false, unavailable: false }) }));

import { CommandPalette } from "./CommandPalette";

Element.prototype.scrollIntoView = function scrollIntoView() {};   // jsdom has no layout

afterEach(() => { cleanup(); fetchSpy.mockReset(); nav.push.mockReset(); nav.path = "/command-center"; });
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const ID = "9e000000-0000-4000-8000-000000000001";
const MID = "00000000-0000-4000-8000-0000000000ab";

function open(text: string) {
  const onClose = vi.fn();
  render(<CommandPalette open onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: text } });
  return onClose;
}

describe("Universal Command entry in the command palette", () => {
  it("records a shadow route and opens it on the Missions page; the jobs route is never called", async () => {
    fetchSpy.mockImplementation(() => json(201, { data: { id: ID }, error: null }));
    const onClose = open("Claude Code, fix Mettle. Codex reviews.");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(`/command-center/missions?command=${ID}`));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/command-center/command/shadow");
    expect(JSON.parse(init.body)).toEqual({ text: "Claude Code, fix Mettle. Codex reviews.", missionId: null });
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/jobs"))).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });

  it("inside a mission, the mission travels as context", async () => {
    nav.path = `/command-center/missions/${MID}`;
    fetchSpy.mockImplementation(() => json(201, { data: { id: ID }, error: null }));
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
      .mockImplementationOnce(() => json(201, { data: { id: ID }, error: null }));
    open("fix it");
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "Claude Code, fix it" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(`/command-center/missions?command=${ID}`));
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
    release(new Response(JSON.stringify({ data: { id: ID }, error: null }), { status: 201 }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/jobs"))).toBe(false);
  });

  it("closing the palette while the route is pending does not navigate afterwards", async () => {
    let release!: (v: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((r) => (release = r)));
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "fix it" } });
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    rerender(<CommandPalette open={false} onClose={onClose} />);
    release(new Response(JSON.stringify({ data: { id: ID }, error: null }), { status: 201 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("a request still pending when the palette closes does not lock it after reopening", async () => {
    fetchSpy.mockImplementationOnce(() => new Promise<Response>(() => {}))                // never resolves
      .mockImplementationOnce(() => json(201, { data: { id: ID }, error: null }));
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "fix it" } });
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    rerender(<CommandPalette open={false} onClose={onClose} />);
    rerender(<CommandPalette open onClose={onClose} />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(`/command-center/missions?command=${ID}`));
  });

  it("a result from an attempt abandoned by closing never navigates, even after reopening", async () => {
    let releaseOld!: (v: Response) => void;
    fetchSpy.mockImplementationOnce(() => new Promise<Response>((r) => (releaseOld = r)));
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open onClose={onClose} />);
    fireEvent.change(screen.getByPlaceholderText(/type intent/i), { target: { value: "first" } });
    fireEvent.click(screen.getByRole("button", { name: /shadow-route/i }));
    rerender(<CommandPalette open={false} onClose={onClose} />);
    rerender(<CommandPalette open onClose={onClose} />);
    releaseOld(new Response(JSON.stringify({ data: { id: "9e000000-0000-4000-8000-0000000000ff" }, error: null }), { status: 201 }));
    await new Promise((r) => setTimeout(r, 20));
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the existing Run as Job entry is unchanged and still first", () => {
    open("fix it");
    const items = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(items[0]).toContain("Run as Job");
    expect(items[1]).toContain("Shadow-route");
  });
});
