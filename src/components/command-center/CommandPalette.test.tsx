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

  it("the existing Run as Job entry is unchanged and still first", () => {
    open("fix it");
    const items = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(items[0]).toContain("Run as Job");
    expect(items[1]).toContain("Shadow-route");
  });
});
