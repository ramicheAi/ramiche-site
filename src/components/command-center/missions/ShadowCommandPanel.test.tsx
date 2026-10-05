// @vitest-environment jsdom
/**
 * P06 M5: the founder view of a shadow decision. It is labelled SHADOW, never claims anything is running, and offers
 * only founder actions over the existing M2 API.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ShadowCommandPanel } from "./ShadowCommandPanel";
import type { CommandApi } from "@/lib/command/client";
import type { ShadowRecord } from "@/lib/command/types";
import type { MissionApi } from "@/lib/missions/client";
import type { MissionRow } from "@/lib/missions/types";
import { routeCommand } from "@/lib/command/router";

afterEach(cleanup);
const CMD = "9e000000-0000-4000-8000-000000000001";
const MID = "00000000-0000-4000-8000-000000000001";
const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
const record = (over: Partial<ShadowRecord> = {}, text = "Claude Code, fix Mettle. Codex reviews. Don't merge without me."): ShadowRecord => ({
  id: CMD, command: text, routedAt: "2026-10-05T00:00:00Z", routerVersion: "m5-rules-1", shadow: true, executed: false,
  missionContext: null, supersedes: null, decision: routeCommand({ text, missionId: over.missionContext ?? null }), linkedMissions: [], ...over,
});
const mission = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: MID, ref: 7, tenant_id: "t", objective: "Fix Mettle", owner: "ramon", owner_kind: "human", agent_ids: [], success_criteria: [], deliverables: [],
  state: "executing", created_by: "ramon", created_by_kind: "human", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", ...over,
});
function apis(rec: ShadowRecord, missions: MissionRow[] = [mission()]) {
  const command: CommandApi = { get: vi.fn(() => ok(rec)), route: vi.fn((b) => ok({ ...rec, id: "9e000000-0000-4000-8000-000000000002", supersedes: rec.id, decision: routeCommand({ text: b.text, handlerHint: b.handlerHint }) })) };
  const m = {
    list: vi.fn(() => ok({ missions, nextBefore: null })),
    create: vi.fn((b) => ok(mission({ id: "00000000-0000-4000-8000-0000000000ee", ref: 8, state: "intent", objective: String(b.objective) }))),
    addLink: vi.fn(() => ok({ link: {}, resolution: "resolved" })),
    transition: vi.fn(), verify: vi.fn(), reassign: vi.fn(), get: vi.fn(), removeLink: vi.fn(), costs: vi.fn(),
  } as unknown as MissionApi;
  return { command, m };
}
const handlers = () => ({ onReroute: vi.fn(), onDismiss: vi.fn(), onCreated: vi.fn() });

describe("Universal Command shadow panel", () => {
  it("shows the SHADOW label, the route, founder merge authority, and nothing that claims to be running", async () => {
    const { command, m } = apis(record());
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    expect((await screen.findByTestId("shadow-label")).textContent).toBe("SHADOW: NOTHING HAS BEEN EXECUTED");
    expect(screen.getByTestId("shadow-badge").textContent).toBe("SHADOW");
    const route = screen.getByTestId("shadow-route").textContent ?? "";
    for (const s of ["Would route toClaude Code", "ReviewCodex review", "Merge authorityFounder", "MissionRecommended", "Model usedNone (rules only)", "Explicit: you named the handler"]) expect(route).toContain(s);
    expect(screen.getByTestId("shadow-command").textContent).not.toMatch(/\b(running|executing|in progress|started|dispatched|working on)\b/i);
  });

  it("Create Mission uses the M2 create (Intent) then links the command as its source; nothing is approved or started", async () => {
    const { command, m } = apis(record());
    const h = handlers();
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...h} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create Mission" }));
    expect((screen.getByLabelText(/objective/i) as HTMLTextAreaElement).value).toBe("Claude Code, fix Mettle. Codex reviews. Don't merge without me.");
    fireEvent.change(screen.getByLabelText(/success criteria/i), { target: { value: "Mettle onboarding works" } });
    fireEvent.click(screen.getByRole("button", { name: /^create mission$/i }));
    await waitFor(() => expect(h.onCreated).toHaveBeenCalled());
    expect(m.create).toHaveBeenCalledTimes(1);
    const body = (m.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(["agentIds", "deliverables", "objective", "owner", "ownerKind", "successCriteria"]);
    expect(m.addLink).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000ee", { targetType: "chat_message", targetId: CMD, relation: "source" });
    for (const f of ["transition", "verify", "reassign"] as const) expect(m[f]).not.toHaveBeenCalled();
    expect(command.route).not.toHaveBeenCalled();
  });

  it("after a create whose source link failed, the panel never offers Create again (M5 audit)", async () => {
    const { command, m } = apis(record());
    (m.addLink as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 502, message: "link failed" });
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create Mission" }));
    fireEvent.change(screen.getByLabelText(/success criteria/i), { target: { value: "works" } });
    fireEvent.click(screen.getByRole("button", { name: /^create mission$/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("linking the command failed");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect((await screen.findByTestId("created-unlinked")).textContent).toContain("M-8 was created from this command but is not linked to it yet");
    expect(screen.queryByRole("button", { name: "Create Mission" })).toBeNull();
    expect(m.create).toHaveBeenCalledTimes(1);
  });

  it("issued inside a mission: attach to that mission is the default, and no duplicate mission is offered by default", async () => {
    const { command, m } = apis(record({ missionContext: MID }));
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    expect(screen.queryByRole("button", { name: "Create Mission" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create a separate mission instead" })).toBeTruthy();
    expect(screen.getByTestId("shadow-route").textContent).toContain("Attach to the mission you issued it from");
    await waitFor(() => expect((screen.getByLabelText("Mission to attach to") as HTMLSelectElement).value).toBe(MID));
    fireEvent.click(screen.getByRole("button", { name: "Attach to Mission" }));
    await waitFor(() => expect(m.addLink).toHaveBeenCalledWith(MID, { targetType: "chat_message", targetId: CMD, relation: "context" }));
    expect(m.create).not.toHaveBeenCalled();
    expect(m.transition).not.toHaveBeenCalled();
  });

  it("a command already linked to a mission does not offer Create by default", async () => {
    const { command, m } = apis(record({ linkedMissions: [{ id: MID, ref: 7, state: "intent", relation: "source" }] }));
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    expect((await screen.findByTestId("shadow-linked")).textContent).toContain("M-7 (source)");
    expect(screen.queryByRole("button", { name: "Create Mission" })).toBeNull();
  });

  it("a terminal context mission is never the attach default, so Attach is not offered against it (Codex P2, PR #42)", async () => {
    const done = mission({ id: MID, state: "verified" });
    const { command, m } = apis(record({ missionContext: MID }), [done]);
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    await waitFor(() => expect((screen.getByLabelText("Mission to attach to") as HTMLSelectElement).disabled).toBe(false));
    expect((screen.getByLabelText("Mission to attach to") as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Attach to Mission" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("the attach picker follows the list cursor, so an older open mission is offered (Codex P2, PR #42)", async () => {
    const old = mission({ id: "00000000-0000-4000-8000-000000000003", ref: 3, objective: "Old open work" });
    const { command, m } = apis(record());
    (m.list as ReturnType<typeof vi.fn>).mockReset()
      .mockResolvedValueOnce({ ok: true, data: { missions: [mission()], nextBefore: 7 } })
      .mockResolvedValueOnce({ ok: true, data: { missions: [old], nextBefore: null } });
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await waitFor(() => expect(within(screen.getByLabelText("Mission to attach to")).getAllByRole("option").map((o) => o.textContent)).toContain("M-3 · Old open work"));
    expect(m.list).toHaveBeenNthCalledWith(2, 7);
  });

  it("overlapping pages do not duplicate a mission in the picker", async () => {
    const { command, m } = apis(record());
    (m.list as ReturnType<typeof vi.fn>).mockReset()
      .mockResolvedValueOnce({ ok: true, data: { missions: [mission()], nextBefore: 7 } })
      .mockResolvedValueOnce({ ok: true, data: { missions: [mission()], nextBefore: null } });
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await waitFor(() => expect(m.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(screen.getByLabelText("Mission to attach to")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Attach to a mission…", "M-7 · Fix Mettle"]));
  });

  it("the picker is bounded and says so when more missions exist than it lists", async () => {
    const { command, m } = apis(record());
    let n = 100;
    (m.list as ReturnType<typeof vi.fn>).mockReset().mockImplementation(() => { n -= 1; return Promise.resolve({ ok: true, data: { missions: [mission({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, ref: n })], nextBefore: n } }); });
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    expect(await screen.findByText(/Only the newest 10 missions are listed for attaching/)).toBeTruthy();
    expect(m.list).toHaveBeenCalledTimes(10);
  });

  it("Edit routing never offers the identifier-bound handlers", async () => {
    const { command, m } = apis(record());
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    const opts = [...(screen.getByLabelText("Edit routing") as HTMLSelectElement).options].map((o) => o.value);
    expect(opts).not.toContain("existing_job");
    expect(opts).not.toContain("cockpit_agent");
  });

  it("terminal missions are not offered for attach", async () => {
    const { command, m } = apis(record(), [mission(), mission({ id: "00000000-0000-4000-8000-000000000009", ref: 9, state: "verified" })]);
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    await waitFor(() => expect(within(screen.getByLabelText("Mission to attach to")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Attach to a mission…", "M-7 · Fix Mettle"]));
  });

  it("Edit routing re-routes by hand as a new record that supersedes this one", async () => {
    const { command, m } = apis(record({}, "Mettle onboarding"));
    const h = handlers();
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...h} />);
    expect((await screen.findByTestId("shadow-question")).textContent).toMatch(/Who should take this/);
    expect(screen.getByTestId("shadow-route").textContent).toContain("Would route toUndecided");
    fireEvent.change(screen.getByLabelText("Edit routing"), { target: { value: "perplexity" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit routing" }));
    await waitFor(() => expect(h.onReroute).toHaveBeenCalledWith("9e000000-0000-4000-8000-000000000002"));
    expect(command.route).toHaveBeenCalledWith({ text: "Mettle onboarding", missionId: null, handlerHint: "perplexity", supersedes: CMD });
    expect([...(screen.getByLabelText("Edit routing") as HTMLSelectElement).options].map((o) => o.value)).not.toContain("cockpit_agent");
  });

  it("a founder-authority command shows the founder as the route", async () => {
    const { command, m } = apis(record({}, "Approve this"));
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    expect((await screen.findByTestId("shadow-route")).textContent).toContain("Would route toFounder");
  });

  it("dismiss leaves; a failed load shows the failure and a retry, never a fake decision", async () => {
    const command: CommandApi = { get: vi.fn().mockResolvedValueOnce({ ok: false, status: 404, message: "no such command" }).mockResolvedValueOnce({ ok: true, data: record() }), route: vi.fn() };
    const { m } = apis(record());
    const h = handlers();
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...h} />);
    expect((await screen.findByRole("alert")).textContent).toContain("This command could not be loaded");
    expect(screen.queryByTestId("shadow-route")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("shadow-route")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(h.onDismiss).toHaveBeenCalled();
  });

  it("controls are touch-sized and the layout wraps", async () => {
    const { command, m } = apis(record());
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    for (const b of screen.getAllByRole("button")) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    for (const s of screen.getAllByRole("combobox")) expect(parseInt((s as HTMLElement).style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId("shadow-route").style.gridTemplateColumns).toBe("auto minmax(0, 1fr)");   // the value column can shrink: no horizontal scroll
  });
});

describe("M5A browser-acceptance fixes", () => {
  it("completed missions are not offered as attach targets, and a completed context mission is not the default", async () => {
    const done = mission({ id: MID, state: "completed" });
    const open = mission({ id: "00000000-0000-4000-8000-000000000005", ref: 5, state: "executing", objective: "Open work" });
    const { command, m } = apis(record({ missionContext: MID }), [done, open]);
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    await waitFor(() => expect(within(screen.getByLabelText("Mission to attach to")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Attach to a mission…", "M-5 · Open work"]));
    expect((screen.getByLabelText("Mission to attach to") as HTMLSelectElement).value).toBe("");
  });

  it("on a phone the panel content and its pickers can never be wider than the screen", async () => {
    const { command, m } = apis(record());
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...handlers()} />);
    await screen.findByTestId("shadow-label");
    expect(screen.getByTestId("shadow-command").style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    for (const s of screen.getAllByRole("combobox")) expect([(s as HTMLElement).style.minWidth, (s as HTMLElement).style.maxWidth]).toEqual(["0px", "100%"]);
  });

  it("Create Mission chosen in the palette (startCreating) opens the form, and submitting it creates the mission in Intent with the command as source (M5C)", async () => {
    const { command, m } = apis(record());
    const h = handlers();
    render(<ShadowCommandPanel id={CMD} api={command} missions={m} {...h} startCreating />);
    expect((await screen.findByLabelText(/objective/i) as HTMLTextAreaElement).value).toBe("Claude Code, fix Mettle. Codex reviews. Don't merge without me.");
    expect(m.create).not.toHaveBeenCalled();   // opening the form creates nothing
    fireEvent.change(screen.getByLabelText(/success criteria/i), { target: { value: "Mettle onboarding works" } });
    fireEvent.click(screen.getByRole("button", { name: /^create mission$/i }));
    await waitFor(() => expect(h.onCreated).toHaveBeenCalled());
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.addLink).toHaveBeenCalledWith("00000000-0000-4000-8000-0000000000ee", { targetType: "chat_message", targetId: CMD, relation: "source" });
    for (const f of ["transition", "verify", "reassign"] as const) expect(m[f]).not.toHaveBeenCalled();
    expect(command.route).not.toHaveBeenCalled();
  });

  it("without startCreating the form stays closed; with it, a command already linked or issued inside a mission still does not open it (M5C)", async () => {
    const plain = apis(record());
    render(<ShadowCommandPanel id={CMD} api={plain.command} missions={plain.m} {...handlers()} />);
    await screen.findByRole("button", { name: "Create Mission" });
    expect(screen.queryByLabelText(/objective/i)).toBeNull();
    cleanup();
    const linked = apis(record({ linkedMissions: [{ id: MID, ref: 7, state: "intent", relation: "source" }] }));
    render(<ShadowCommandPanel id={CMD} api={linked.command} missions={linked.m} {...handlers()} startCreating />);
    await screen.findByTestId("shadow-linked");
    expect(screen.queryByLabelText(/objective/i)).toBeNull();
    cleanup();
    const inside = apis(record({ missionContext: MID }));
    render(<ShadowCommandPanel id={CMD} api={inside.command} missions={inside.m} {...handlers()} startCreating />);
    await screen.findByRole("button", { name: /attach/i });
    expect(screen.queryByLabelText(/objective/i)).toBeNull();
  });
});
