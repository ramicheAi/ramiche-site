// @vitest-environment jsdom
/**
 * P06 M4A founder Mission surface. The views talk only to an injected MissionApi, so these tests pin exactly which
 * M2 call each control makes (and that nothing else is sent). Server-side authority is covered by the M2 suites
 * (route coverage + missions-db); here we prove the UI never offers what the server forbids.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => <a href={href} {...rest}>{children}</a>,
}));

import { CreateMissionForm, MissionDetailView, MissionListView } from "./MissionViews";
import type { MissionApi, MissionDetail } from "@/lib/missions/client";
import type { MissionCosts } from "@/lib/missions/costs";
import type { LinkRow, MissionRow, MissionState } from "@/lib/missions/types";
import {
  actualCostText, attentionCue, canVerify, coverageText, decisionText, EVIDENCE_TARGETS, forwardSteps, GROUP_OF, GROUP_ORDER, groupMissions,
  listHint, planMissionShortcut, planPrefillHref, toWellFormed,
} from "@/lib/missions/ui";
import { EVIDENCE_TYPES } from "@/lib/missions/targets";
import { MISSION_STATES } from "@/lib/missions/types";

afterEach(cleanup);

const M_ID = "00000000-0000-4000-8000-000000000001";
const mission = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: M_ID, ref: 42, tenant_id: "t", objective: "Ship the onboarding flow", owner: "ramon", owner_kind: "human",
  agent_ids: ["nova"], success_criteria: [{ id: "c1", text: "Onboarding under 5 minutes" }], deliverables: [{ id: "d1", text: "Flow live" }],
  state: "intent", created_by: "ramon", created_by_kind: "human", created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-01T00:00:00.000Z", ...over,
});
const evidenceLink = (over: Partial<LinkRow> = {}): LinkRow => ({
  id: "00000000-0000-4000-8000-0000000000aa", mission_id: M_ID, target_type: "job", target_id: "00000000-0000-4000-8000-0000000000bb",
  target_index: null, relation: "evidence", criterion_id: "c1", created_by: "ramon", created_by_kind: "human",
  created_at: new Date().toISOString(), removed_at: null, removed_by: null, removed_by_kind: null, ...over,
});

const noCosts: MissionCosts = {
  missionId: M_ID, events: { total: 0, direct: 0, linked: 0, both: 0 },
  usage: { input: { sum: null, knownEvents: 0, unknownEvents: 0 }, output: { sum: null, knownEvents: 0, unknownEvents: 0 }, total: { sum: null, knownEvents: 0, unknownEvents: 0 }, byQuality: {} },
  actualCost: { status: "no_events", knownUsd: null, knownEvents: 0, unknownEvents: 0, notApplicableEvents: 0 },
  shadowCost: { label: "list_price_equivalent_not_actual_spend", basis: null, usd: null, pricedEvents: 0, unpricedEvents: 0 },
  breakdown: [], attribution: [],
};

function fakeApi(over: Partial<MissionApi> = {}, detail?: Partial<MissionDetail>): MissionApi & { calls: string[] } {
  const calls: string[] = [];
  const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });
  const d: MissionDetail = { mission: mission(), links: [], events: [], eventsTruncated: false, ...detail };
  const api: MissionApi = {
    list: vi.fn(() => { calls.push("list"); return ok({ missions: [] as MissionRow[], nextBefore: null }); }),
    get: vi.fn(() => { calls.push("get"); return ok(d); }),
    create: vi.fn((b) => { calls.push(`create ${JSON.stringify(b)}`); return ok(mission({ objective: String(b.objective) })); }),
    transition: vi.fn((_id, to, from) => { calls.push(`transition ${from}>${to}`); return ok(mission({ state: to })); }),
    verify: vi.fn(() => { calls.push("verify"); return ok(mission({ state: "verified" })); }),
    reassign: vi.fn((_id, b) => { calls.push(`reassign ${JSON.stringify(b)}`); return ok(mission()); }),
    addLink: vi.fn((_id, b) => { calls.push(`addLink ${JSON.stringify(b)}`); return ok({ link: evidenceLink(), resolution: "resolved" }); }),
    removeLink: vi.fn((_id, l) => { calls.push(`removeLink ${l}`); return ok(evidenceLink({ removed_at: new Date().toISOString() })); }),
    costs: vi.fn(() => ok(noCosts)),
    ...over,
  };
  return Object.assign(api, { calls });
}

describe("mission list", () => {
  it("zero missions shows a clear empty state and a New Mission action", async () => {
    render(<MissionListView api={fakeApi()} />);
    expect(await screen.findByText("No missions yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: /new mission/i })).toBeTruthy();
  });

  it("renders ref, objective, state, owner and team for each mission", async () => {
    const api = fakeApi({ list: vi.fn(() => Promise.resolve({ ok: true as const, data: { missions: [mission({ state: "executing", owner: "atlas", owner_kind: "agent", agent_ids: ["nova", "triage"] })], nextBefore: null } })) });
    render(<MissionListView api={api} />);
    const card = await screen.findByTestId("mission-card");
    expect(card.getAttribute("href")).toBe(`/command-center/missions/${M_ID}`);
    const t = card.textContent ?? "";
    for (const s of ["M-42", "Ship the onboarding flow", "Executing", "Owner Atlas", "Nova", "Triage"]) expect(t).toContain(s);
  });

  it("a founder auth failure is shown, not swallowed", async () => {
    render(<MissionListView api={fakeApi({ list: vi.fn(() => Promise.resolve({ ok: false as const, status: 401, message: "Your session is not authorized. Sign in again." })) })} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/sign in again/i);
  });
});

describe("create mission", () => {
  it("sends exactly the M2 body: no identity fields, generated criterion ids, owner kind derived", async () => {
    const api = fakeApi();
    const created = vi.fn();
    render(<CreateMissionForm api={api} onCreated={created} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "  Launch Mettle v2  " } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Nova" }));
    const areas = screen.getAllByRole("textbox");
    fireEvent.change(areas[1], { target: { value: "Coaches can sign up\n\n  Parents get the invite " } });
    fireEvent.change(areas[2], { target: { value: "Release notes" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    expect(api.create).toHaveBeenCalledWith({
      objective: "Launch Mettle v2", owner: "atlas", ownerKind: "agent", agentIds: ["nova"],
      successCriteria: [{ id: "c1", text: "Coaches can sign up" }, { id: "c2", text: "Parents get the invite" }],
      deliverables: [{ id: "d1", text: "Release notes" }],
    });
    const body = (api.create as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    for (const k of ["actor", "actor_kind", "created_by", "createdBy", "verified_by", "tenant_id", "uid", "role"]) expect(k in body).toBe(false);
  });

  it("validation stops an empty objective before any request", async () => {
    const api = fakeApi();
    render(<CreateMissionForm api={api} onCreated={() => {}} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    const alerts = (await screen.findAllByRole("alert")).map((x) => x.textContent ?? "");
    expect(alerts.some((t) => /what this mission is for/i.test(t))).toBe(true);
    expect(alerts.some((t) => /at least one success criterion/i.test(t))).toBe(true);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("a server refusal is shown", async () => {
    const api = fakeApi({ create: vi.fn(() => Promise.resolve({ ok: false as const, status: 422, message: "owner is not a registered active agent" })) });
    render(<CreateMissionForm api={api} onCreated={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "x" } });
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "done means done" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("registered active agent");
  });

  it("from a plan: objective prefilled, and the plan is linked as the mission's source after creation", async () => {
    const api = fakeApi();
    render(<CreateMissionForm api={api} onCreated={() => {}} onCancel={() => {}} initialObjective="Decision text" fromSynthesis="00000000-0000-4000-8000-0000000000cc" />);
    expect((screen.getByPlaceholderText(/what outcome/i) as HTMLTextAreaElement).value).toBe("Decision text");
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Plan executed" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(api.addLink).toHaveBeenCalledWith(M_ID, { targetType: "synthesis", targetId: "00000000-0000-4000-8000-0000000000cc", relation: "source" }));
  });

  it("from a plan: if linking the plan fails, the form stays open, says so, and offers the created mission", async () => {
    const api = fakeApi({ addLink: vi.fn(() => Promise.resolve({ ok: false as const, status: 404, message: "synthesis not found" })) });
    const created = vi.fn();
    render(<CreateMissionForm api={api} onCreated={created} onCancel={() => {}} initialObjective="Decision" fromSynthesis="00000000-0000-4000-8000-0000000000cc" />);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Plan executed" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/M-42 was created, but linking the plan failed: synthesis not found/);
    expect(created).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /open M-42/i }).getAttribute("href")).toBe(`/command-center/missions/${M_ID}`);
    expect(screen.queryByRole("button", { name: /create mission/i })).toBeNull(); // no accidental second create
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("at least one success criterion is required, since criteria cannot be added later", async () => {
    const api = fakeApi();
    render(<CreateMissionForm api={api} onCreated={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/at least one success criterion/i);
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe("lifecycle controls", () => {
  it("helpers never offer verified as a generic transition, from any state", () => {
    for (const s of MISSION_STATES) for (const n of [0, 1]) expect(forwardSteps(s, n).map((x) => x.to)).not.toContain("verified");
    expect(forwardSteps("plan", 0)).toEqual([]);
    expect(MISSION_STATES.filter(canVerify)).toEqual(["completed"]);
  });

  const EXPECT: Record<MissionState, { steps: string[]; cancel: boolean; verify: boolean }> = {
    intent: { steps: ["Move to plan"], cancel: true, verify: false },
    plan: { steps: ["Approve"], cancel: true, verify: false },
    approved: { steps: ["Start execution"], cancel: true, verify: false },
    executing: { steps: ["Send to review"], cancel: true, verify: false },
    reviewing: { steps: ["Mark completed", "Send back for rework"], cancel: true, verify: false },
    completed: { steps: [], cancel: true, verify: true },
    verified: { steps: [], cancel: false, verify: false },
    cancelled: { steps: [], cancel: false, verify: false },
  };
  for (const state of MISSION_STATES) {
    it(`state ${state}: offers exactly the legal founder actions`, async () => {
      render(<MissionDetailView id={M_ID} api={fakeApi({}, { mission: mission({ state }) })} />);
      const box = await screen.findByTestId("lifecycle-actions");
      const labels = within(box).queryAllByRole("button").map((b) => b.textContent);
      expect(labels.filter((l) => l !== "Cancel mission" && l !== "Verify")).toEqual(EXPECT[state].steps);
      expect(labels.includes("Cancel mission")).toBe(EXPECT[state].cancel);
      expect(labels.includes("Verify")).toBe(EXPECT[state].verify);
    });
  }

  it("each step calls the generic transition with the state it was read from", async () => {
    const api = fakeApi({}, { mission: mission({ state: "reviewing" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Send back for rework" }));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith(M_ID, "executing", "reviewing"));
  });

  it("Verify uses the dedicated verify call (never transition) and is gated on evidence for every criterion", async () => {
    const noEvidence = fakeApi({}, { mission: mission({ state: "completed" }) });
    render(<MissionDetailView id={M_ID} api={noEvidence} />);
    const v1 = await screen.findByRole("button", { name: "Verify mission" });
    expect((v1 as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("next-hint").textContent).toContain("c1");
    cleanup();
    const api = fakeApi({}, { mission: mission({ state: "completed" }), links: [evidenceLink()] });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Verify mission" }));
    await waitFor(() => expect(api.verify).toHaveBeenCalledWith(M_ID));
    expect(api.transition).not.toHaveBeenCalled();
  });

  it("cancel needs a confirmation, then calls transition to cancelled", async () => {
    const api = fakeApi({}, { mission: mission({ state: "plan" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel mission" }));
    expect(api.transition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancel" }));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith(M_ID, "cancelled", "plan"));
  });

  it("a refused action shows the server's reason", async () => {
    const api = fakeApi({ transition: vi.fn(() => Promise.resolve({ ok: false as const, status: 409, message: "mission state changed since it was read" })) },
      { mission: mission({ state: "plan" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect((await screen.findByRole("alert")).textContent).toContain("state changed since it was read");
  });

  it("a mission with no criteria is never offered Approve, and the hint says how to get out", async () => {
    render(<MissionDetailView id={M_ID} api={fakeApi({}, { mission: mission({ state: "plan", success_criteria: [] }) })} />);
    const box = await screen.findByTestId("lifecycle-actions");
    expect(within(box).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByTestId("next-hint").textContent).toMatch(/cannot be approved.*create a new one with criteria/i);
  });

  it("a failed reassign keeps the panel open with the founder's edits", async () => {
    const api = fakeApi({ reassign: vi.fn(() => Promise.resolve({ ok: false as const, status: 422, message: "invalid owner or team" })) }, { mission: mission({ state: "executing" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: /change owner or team/i }));
    fireEvent.change(screen.getByLabelText("New owner"), { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("invalid owner or team");
    expect((screen.getByLabelText("New owner") as HTMLSelectElement).value).toBe("atlas");
  });

  it("reassign is offered before completed and sends the whole new team", async () => {
    const api = fakeApi({}, { mission: mission({ state: "executing" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: /change owner or team/i }));
    fireEvent.change(screen.getByLabelText("New owner"), { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.reassign).toHaveBeenCalledWith(M_ID, { owner: "atlas", ownerKind: "agent", agentIds: ["nova"] }));
    cleanup();
    render(<MissionDetailView id={M_ID} api={fakeApi({}, { mission: mission({ state: "completed" }) })} />);
    await screen.findByTestId("lifecycle-actions");
    expect(screen.queryByRole("button", { name: /change owner or team/i })).toBeNull();
  });
});

describe("stale detail reads", () => {
  // Defense in depth: the UI now disables the toggle during an action (see "final pass" tests), but the read-ordering
  // guard must still hold if a newer read is ever started (jsdom lets this click through a disabled checkbox).
  it("read-ordering guard: an action's reload that lands after a newer read cannot overwrite it", async () => {
    let releaseActionReload!: (v: unknown) => void;
    const base = { mission: mission({ state: "intent" }), links: [], events: [], eventsTruncated: false };
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: base })                                                   // mount
      .mockImplementationOnce(() => new Promise((r) => (releaseActionReload = r)))                       // reload after the action, held
      .mockResolvedValueOnce({ ok: true, data: { ...base, mission: mission({ state: "plan", objective: "newest read" }) } }); // toggle read
    render(<MissionDetailView id={M_ID} api={fakeApi({ get })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to plan" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByText("newest read")).toBeTruthy();
    releaseActionReload({ ok: true, data: { ...base, mission: mission({ state: "plan", objective: "older reload" }) } });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("newest read")).toBeTruthy();
    expect(screen.queryByText("older reload")).toBeNull();
  });

  it("a slow read that lands after an action's reload cannot revert the view", async () => {
    let releaseToggleRead!: (v: unknown) => void;
    const before = { mission: mission({ state: "intent" }), links: [], events: [], eventsTruncated: false };
    const after = { ...before, mission: mission({ state: "plan" }) };
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: before })                          // mount
      .mockImplementationOnce(() => new Promise((r) => (releaseToggleRead = r)))  // "show removed" toggle, held
      .mockResolvedValueOnce({ ok: true, data: after });                          // reload after the action
    render(<MissionDetailView id={M_ID} api={fakeApi({ get })} />);
    await screen.findByRole("button", { name: "Move to plan" });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Move to plan" }));
    await screen.findByRole("button", { name: "Approve" });
    releaseToggleRead({ ok: true, data: before });                                // stale pre-action state
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: "Move to plan" })).toBeNull();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });
});

describe("detail action and read state", () => {
  it("controls stay disabled until the refreshed mission arrives after an action", async () => {
    let releaseReload!: (v: unknown) => void;
    const base = { mission: mission({ state: "intent" }), links: [], events: [], eventsTruncated: false };
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: base })
      .mockImplementationOnce(() => new Promise((r) => (releaseReload = r)));
    const api = fakeApi({ get });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to plan" }));
    await waitFor(() => expect(api.transition).toHaveBeenCalledTimes(1));
    expect((screen.getByRole("button", { name: "Move to plan" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Move to plan" }));
    expect(api.transition).toHaveBeenCalledTimes(1);                       // no resubmission against the stale snapshot
    releaseReload({ ok: true, data: { ...base, mission: mission({ state: "plan" }) } });
    expect(await screen.findByRole("button", { name: "Approve" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a failed read's error clears once a later read succeeds; an action's error survives its reload", async () => {
    const base = { mission: mission({ state: "intent" }), links: [], events: [], eventsTruncated: false };
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: base })
      .mockResolvedValueOnce({ ok: false, status: 502, message: "mission storage call failed" })   // toggle on: fails
      .mockResolvedValueOnce({ ok: true, data: base });                                            // toggle off: fine
    render(<MissionDetailView id={M_ID} api={fakeApi({ get })} />);
    await screen.findByTestId("lifecycle-actions");
    fireEvent.click(screen.getByRole("checkbox"));
    expect((await screen.findByRole("alert")).textContent).toContain("mission storage call failed");
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});

describe("links", () => {
  it("adds a link through the M2 call and removes one by tombstone call", async () => {
    const api = fakeApi({}, { mission: mission({ state: "executing" }), links: [evidenceLink()] });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.change(await screen.findByLabelText("Link target"), { target: { value: "https://docs.example.com/report" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    await waitFor(() => expect(api.addLink).toHaveBeenCalledWith(M_ID, { targetType: "url", targetId: "https://docs.example.com/report", relation: "context" }));
    fireEvent.click(screen.getByRole("button", { name: `Remove link ${evidenceLink().id}` }));
    await waitFor(() => expect(api.removeLink).toHaveBeenCalledWith(M_ID, evidenceLink().id));
  });

  it("a refused link keeps what the founder typed; an accepted one clears the field", async () => {
    const addLink = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 422, message: "url host must be public" })
      .mockResolvedValueOnce({ ok: true, data: { link: evidenceLink(), resolution: "format_only" } });
    render(<MissionDetailView id={M_ID} api={fakeApi({ addLink }, { mission: mission({ state: "executing" }) })} />);
    const input = (await screen.findByLabelText("Link target")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "http://imac/report" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect((await screen.findByRole("alert")).textContent).toContain("url host must be public");
    expect((screen.getByLabelText("Link target") as HTMLInputElement).value).toBe("http://imac/report");
    fireEvent.change(screen.getByLabelText("Link target"), { target: { value: "https://docs.example.com/report" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    await waitFor(() => expect((screen.getByLabelText("Link target") as HTMLInputElement).value).toBe(""));
  });

  it("evidence is offered only for database-resolved targets, and names a criterion", async () => {
    const api = fakeApi({}, { mission: mission({ state: "executing" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    const relation = await screen.findByLabelText("Relation");
    expect([...(relation as HTMLSelectElement).options].map((o) => o.value)).not.toContain("evidence"); // url
    fireEvent.change(screen.getByLabelText("Link type"), { target: { value: "job" } });
    fireEvent.change(screen.getByLabelText("Relation"), { target: { value: "evidence" } });
    fireEvent.change(screen.getByLabelText("Link target"), { target: { value: "00000000-0000-4000-8000-0000000000bb" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    await waitFor(() => expect(api.addLink).toHaveBeenCalledWith(M_ID, { targetType: "job", targetId: "00000000-0000-4000-8000-0000000000bb", relation: "evidence", criterionId: "c1" }));
  });

  it("evidence is not offered when the mission has no criteria", async () => {
    render(<MissionDetailView id={M_ID} api={fakeApi({}, { mission: mission({ state: "executing", success_criteria: [] }) })} />);
    fireEvent.change(await screen.findByLabelText("Link type"), { target: { value: "job" } });
    expect([...(screen.getByLabelText("Relation") as HTMLSelectElement).options].map((o) => o.value)).not.toContain("evidence");
  });

  it("the UI's evidence set is exactly the server's", () => {
    expect([...EVIDENCE_TARGETS].sort()).toEqual([...EVIDENCE_TYPES].sort());
  });

  it("links are frozen on a closed mission", async () => {
    render(<MissionDetailView id={M_ID} api={fakeApi({}, { mission: mission({ state: "verified" }), links: [evidenceLink()] })} />);
    expect(await screen.findByText(/links are frozen/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /remove link/i })).toBeNull();
  });
});

describe("transport and authority", () => {
  it("the browser client sends no identity: no agent header, no token, no actor fields", async () => {
    const cockpit = vi.fn(async () => new Response(JSON.stringify({ data: { missions: [], nextBefore: null }, error: null }), { status: 200 }));
    vi.doMock("@/lib/cockpit-fetch", () => ({ cockpitFetch: cockpit }));
    vi.resetModules();
    const { httpMissionApi } = await import("@/lib/missions/client");
    await httpMissionApi.list();
    await httpMissionApi.verify(M_ID);
    await httpMissionApi.transition(M_ID, "plan", "intent");
    for (const [path, init] of cockpit.mock.calls as unknown as [string, RequestInit | undefined][]) {
      expect(path.startsWith("/api/command-center/missions")).toBe(true);
      const headers = new Headers(init?.headers);
      expect(headers.has("x-parallax-agent")).toBe(false);
      expect(headers.has("x-parallax-missions-token")).toBe(false);
      expect(String(init?.body ?? "")).not.toMatch(/actor|created_by|verified_by|uid/);
    }
    expect(cockpit.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual([
      "/api/command-center/missions?limit=100", `/api/command-center/missions/${M_ID}/verify`, `/api/command-center/missions/${M_ID}/transition`,
    ]);
    vi.doUnmock("@/lib/cockpit-fetch");
  });

  it("no Mission UI code references a machine credential or agent identity header", () => {
    for (const f of ["src/lib/missions/client.ts", "src/lib/missions/ui.ts", "src/components/command-center/missions/MissionViews.tsx",
      "src/app/command-center/missions/page.tsx", "src/app/command-center/missions/[id]/page.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s, f).not.toMatch(/x-parallax-agent|PARALLAX_MISSIONS_AGENT_TOKEN|x-parallax-missions-token|guardOwnerOrService/);
    }
  });
});

describe("navigation", () => {
  const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
  it("legacy project progress is preserved at /command-center/projects/progress and every old entry point follows it", () => {
    expect(existsSync(join(process.cwd(), "src/app/command-center/projects/progress/page.tsx"))).toBe(true);
    const progress = read("src/app/command-center/projects/progress/page.tsx");
    expect(progress).toContain('/api/bridge?type=projects');
    expect(progress).toContain('title="Project Progress"');
    expect(read("src/app/command-center/legacy/page.tsx")).toContain('href: "/command-center/projects/progress"');
    const palette = read("src/components/command-center/CommandPalette.tsx");
    expect(palette).toContain('href: "/command-center/projects/progress"');
    expect(palette).toContain('href: "/command-center/missions"');
    const sidebar = read("src/components/command-center/Sidebar.tsx");
    expect(sidebar).toContain("href: '/command-center/missions', label: 'Missions'");
    expect(sidebar).toContain("href: '/command-center/projects', label: 'Projects'");
  });
  it("/command-center/missions now renders the canonical Mission surface", () => {
    expect(read("src/app/command-center/missions/page.tsx")).toContain("MissionListView");
  });
});

describe("mobile", () => {
  it("primary actions are touch-sized and every layout wraps instead of overflowing", async () => {
    render(<MissionDetailView id={M_ID} api={fakeApi({}, { mission: mission({ state: "reviewing" }) })} />);
    const box = await screen.findByTestId("lifecycle-actions");
    expect(box.style.flexWrap).toBe("wrap");
    for (const b of within(box).getAllByRole("button")) expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    const src = readFileSync(join(process.cwd(), "src/components/command-center/missions/MissionViews.tsx"), "utf8");
    expect(src).not.toMatch(/minmax\(\d+px/); // every grid column is minmax(min(100%, Npx), 1fr)
    expect(src).not.toMatch(/width: \d{3,}(px)?[,}]/);
  });
});

describe("pagination", () => {
  const page = (refs: number[]) => refs.map((ref) => mission({ id: `00000000-0000-4000-8000-${String(ref).padStart(12, "0")}`, ref, objective: `Mission ${ref}` }));
  const shown = () => screen.getAllByTestId("mission-card").map((c) => c.querySelector("span")?.textContent);

  it("loads the next page through nextBefore, appends without duplicates, keeps newest first, then hides Load more", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([105, 104, 103]), nextBefore: 103 } })
      .mockResolvedValueOnce({ ok: true, data: { missions: page([103, 102, 101]), nextBefore: null } });
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    expect(list).toHaveBeenNthCalledWith(1);
    expect(shown()).toEqual(["M-105", "M-104", "M-103"]);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(shown()).toEqual(["M-105", "M-104", "M-103", "M-102", "M-101"]));
    expect(list).toHaveBeenNthCalledWith(2, 103);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("no Load more when the first page has no cursor", async () => {
    render(<MissionListView api={fakeApi({ list: vi.fn().mockResolvedValue({ ok: true, data: { missions: page([2, 1]), nextBefore: null } }) })} />);
    await screen.findAllByTestId("mission-card");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("a failed page keeps every mission already loaded and lets you try again", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([5, 4]), nextBefore: 4 } })
      .mockResolvedValueOnce({ ok: false, status: 502, message: "mission storage call failed" })
      .mockResolvedValueOnce({ ok: true, data: { missions: page([3]), nextBefore: null } });
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect((await screen.findByRole("alert")).textContent).toContain("mission storage call failed");
    expect(shown()).toEqual(["M-5", "M-4"]);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(shown()).toEqual(["M-5", "M-4", "M-3"]));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an older page that arrives after the list was reloaded (a create) is dropped, so no mission is skipped", async () => {
    let releaseStale!: (v: unknown) => void;
    const stale = new Promise((r) => (releaseStale = r));
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([200, 199]), nextBefore: 199 } })      // first page
      .mockImplementationOnce(() => stale)                                                            // Load more, held
      .mockResolvedValueOnce({ ok: true, data: { missions: page([201, 200]), nextBefore: 200 } });    // reload after create
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    fireEvent.click(screen.getByRole("button", { name: /new mission/i }));
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "new one" } });
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(shown()).toEqual(["M-201", "M-200"]));
    releaseStale({ ok: true, data: { missions: page([198, 197]), nextBefore: null } });
    await new Promise((r) => setTimeout(r, 20));
    expect(shown()).toEqual(["M-201", "M-200"]);                                  // stale page not merged
    expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();       // cursor still 200, nothing lost
  });

  it("a slow mount load that lands after a create reload cannot overwrite the newer list", async () => {
    let releaseMount!: (v: unknown) => void;
    const list = vi.fn()
      .mockImplementationOnce(() => new Promise((r) => (releaseMount = r)))                         // mount load, held
      .mockResolvedValueOnce({ ok: true, data: { missions: page([11, 10]), nextBefore: null } });  // reload after create
    render(<MissionListView api={fakeApi({ list })} />);
    fireEvent.click(screen.getByRole("button", { name: /new mission/i }));
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "new" } });
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(shown()).toEqual(["M-11", "M-10"]));
    releaseMount({ ok: true, data: { missions: page([10]), nextBefore: null } });                // pre-create snapshot
    await new Promise((r) => setTimeout(r, 20));
    expect(shown()).toEqual(["M-11", "M-10"]);
  });

  it("two creates in a row: the first reload landing last cannot overwrite the second", async () => {
    let releaseFirstReload!: (v: unknown) => void;
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([10]), nextBefore: null } })             // mount
      .mockImplementationOnce(() => new Promise((r) => (releaseFirstReload = r)))                       // reload after create #1, held
      .mockResolvedValueOnce({ ok: true, data: { missions: page([12, 11, 10]), nextBefore: null } });   // reload after create #2
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    for (const objective of ["first", "second"]) {
      fireEvent.click(screen.getByRole("button", { name: /new mission/i }));
      fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: objective } });
      fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "c" } });
      fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
      await waitFor(() => expect(screen.queryByPlaceholderText(/what outcome/i)).toBeNull());
    }
    await waitFor(() => expect(shown()).toEqual(["M-12", "M-11", "M-10"]));
    releaseFirstReload({ ok: true, data: { missions: page([11, 10]), nextBefore: null } });
    await new Promise((r) => setTimeout(r, 20));
    expect(shown()).toEqual(["M-12", "M-11", "M-10"]);
  });

  it("a stalled older page never keeps Load more disabled after a reload, and its late arrival changes nothing", async () => {
    let releaseStale!: (v: unknown) => void;
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([20, 19]), nextBefore: 19 } })            // mount
      .mockImplementationOnce(() => new Promise((r) => (releaseStale = r)))                              // Load more, stalls
      .mockResolvedValueOnce({ ok: true, data: { missions: page([21, 20]), nextBefore: 20 } })            // reload after create
      .mockResolvedValueOnce({ ok: true, data: { missions: page([19, 18]), nextBefore: null } });         // Load more on the new list
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    fireEvent.click(screen.getByRole("button", { name: /new mission/i }));
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "new" } });
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(shown()).toEqual(["M-21", "M-20"]));
    const more = screen.getByRole("button", { name: "Load more" }) as HTMLButtonElement;
    expect(more.disabled).toBe(false);                                                    // not held hostage by the stale request
    fireEvent.click(more);
    await waitFor(() => expect(shown()).toEqual(["M-21", "M-20", "M-19", "M-18"]));
    expect(list).toHaveBeenLastCalledWith(20);
    releaseStale({ ok: true, data: { missions: page([18, 17]), nextBefore: 17 } });
    await new Promise((r) => setTimeout(r, 20));
    expect(shown()).toEqual(["M-21", "M-20", "M-19", "M-18"]);                            // stale page dropped
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();               // cursor not resurrected
  });

  it("a stale older page finishing during a newer Load more does not clear the newer one's loading state", async () => {
    let releaseStale!: (v: unknown) => void; let releaseNew!: (v: unknown) => void;
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([20, 19]), nextBefore: 19 } })
      .mockImplementationOnce(() => new Promise((r) => (releaseStale = r)))
      .mockResolvedValueOnce({ ok: true, data: { missions: page([21, 20]), nextBefore: 20 } })
      .mockImplementationOnce(() => new Promise((r) => (releaseNew = r)));
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    fireEvent.click(screen.getByRole("button", { name: /new mission/i }));
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "new" } });
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(shown()).toEqual(["M-21", "M-20"]));
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("button", { name: "Loading…" })).toBeTruthy();
    releaseStale({ ok: true, data: { missions: page([18]), nextBefore: null } });
    await new Promise((r) => setTimeout(r, 20));
    expect((screen.getByRole("button", { name: "Loading…" }) as HTMLButtonElement).disabled).toBe(true); // still the newer one's
    releaseNew({ ok: true, data: { missions: page([19, 18]), nextBefore: null } });
    await waitFor(() => expect(shown()).toEqual(["M-21", "M-20", "M-19", "M-18"]));
  });

  it("Load more is disabled while a reload is pending, so it cannot start against a list about to be replaced", async () => {
    let releaseReload!: (v: unknown) => void;
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([9, 8]), nextBefore: 8 } })
      .mockImplementationOnce(() => new Promise((r) => (releaseReload = r)));
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    fireEvent.click(screen.getByRole("button", { name: /new mission/i }));
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "new" } });
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Load more" }) as HTMLButtonElement).disabled).toBe(true));
    releaseReload({ ok: true, data: { missions: page([10, 9]), nextBefore: 9 } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Load more" }) as HTMLButtonElement).disabled).toBe(false));
    expect(shown()).toEqual(["M-10", "M-9"]);
  });

  it("a double click requests the next page once", async () => {
    let release!: (v: unknown) => void;
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { missions: page([5, 4]), nextBefore: 4 } })
      .mockImplementationOnce(() => new Promise((r) => (release = r)));
    render(<MissionListView api={fakeApi({ list })} />);
    await screen.findAllByTestId("mission-card");
    const more = screen.getByRole("button", { name: "Load more" });
    fireEvent.click(more); fireEvent.click(more);
    expect(list).toHaveBeenCalledTimes(2);
    release({ ok: true, data: { missions: page([3]), nextBefore: null } });
    await waitFor(() => expect(shown()).toEqual(["M-5", "M-4", "M-3"]));
  });

  it("the client sends the cursor as before=", async () => {
    const cockpit = vi.fn(async () => new Response(JSON.stringify({ data: { missions: [], nextBefore: null }, error: null }), { status: 200 }));
    vi.doMock("@/lib/cockpit-fetch", () => ({ cockpitFetch: cockpit }));
    vi.resetModules();
    const { httpMissionApi } = await import("@/lib/missions/client");
    await httpMissionApi.list();
    await httpMissionApi.list(103);
    expect(cockpit.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual(["/api/command-center/missions?limit=100", "/api/command-center/missions?limit=100&before=103"]);
    vi.doUnmock("@/lib/cockpit-fetch");
  });
});

describe("cancelling a plan prefill", () => {
  it("Cancel clears the prefill query through the same path as a successful create", async () => {
    const replace = vi.fn();
    vi.resetModules();
    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ replace }),
      useSearchParams: () => new URLSearchParams("fromSynthesis=00000000-0000-4000-8000-0000000000cc&objective=Plan%20text"),
    }));
    vi.doMock("@/lib/missions/client", async (orig) => ({ ...(await orig<object>()), httpMissionApi: fakeApi() }));
    const { default: MissionsPage } = await import("@/app/command-center/missions/page");
    render(<MissionsPage />);
    expect(((await screen.findByPlaceholderText(/what outcome/i)) as HTMLTextAreaElement).value).toBe("Plan text");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(replace).toHaveBeenCalledWith("/command-center/missions");
    expect(screen.queryByPlaceholderText(/what outcome/i)).toBeNull();
    vi.doUnmock("next/navigation");
    vi.doUnmock("@/lib/missions/client");
  });

  it("with the query gone (refresh or New Mission again) the form starts closed and clean", async () => {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams("") }));
    vi.doMock("@/lib/missions/client", async (orig) => ({ ...(await orig<object>()), httpMissionApi: fakeApi() }));
    const { default: MissionsPage } = await import("@/app/command-center/missions/page");
    render(<MissionsPage />);
    expect(screen.queryByPlaceholderText(/what outcome/i)).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /new mission/i }));
    expect((screen.getByPlaceholderText(/what outcome/i) as HTMLTextAreaElement).value).toBe("");
    vi.doUnmock("next/navigation");
    vi.doUnmock("@/lib/missions/client");
  });

  it("MissionListView reports the prefill as done on cancel and on create", async () => {
    const done = vi.fn();
    render(<MissionListView api={fakeApi()} initialObjective="x" onPrefillDone={done} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe("plan text with surrogates", () => {
  const cases: [string, string][] = [
    ["ordinary text", "Ship the onboarding flow"],
    ["valid emoji pair", "Launch 🚀 this week"],
    ["lone high surrogate", "broken \uD83D end"],
    ["lone low surrogate", "broken \uDE80 end"],
  ];
  for (const [name, text] of cases) {
    it(`${name}: the prefill link builds without throwing and decodes to well-formed text`, () => {
      let href = "";
      expect(() => { href = planPrefillHref("00000000-0000-4000-8000-0000000000cc", text); }).not.toThrow();
      const objective = new URL(href, "https://x.test").searchParams.get("objective") ?? "";
      expect(objective).toBe(toWellFormed(text));
      expect(() => encodeURIComponent(objective)).not.toThrow();
    });
  }
  it("valid pairs survive untouched; lone halves become U+FFFD", () => {
    expect(toWellFormed("a🚀b")).toBe("a🚀b");
    expect(toWellFormed("a\uD83Db")).toBe("a\uFFFDb");
    expect(toWellFormed("a\uDE80b")).toBe("a\uFFFDb");
    expect(toWellFormed("\uDE80\uD83D")).toBe("\uFFFD\uFFFD"); // reversed order is two lone halves
  });
  it("truncation still never splits a valid pair", () => {
    const href = planPrefillHref("x", "a".repeat(1999) + "😀" + "tail");
    expect(new URL(href, "https://x.test").searchParams.get("objective")).toBe("a".repeat(1999) + "😀");
  });
  it("a Decisions card with a lone surrogate renders without crashing", () => {
    render(<a href={planPrefillHref("00000000-0000-4000-8000-0000000000cc", "plan \uD800 text")}>Create Mission from this plan</a>);
    expect(screen.getByText("Create Mission from this plan").getAttribute("href")).toContain("objective=plan%20%EF%BF%BD%20text");
  });
});

describe("final pass: no stale actionability", () => {
  const base = { mission: mission({ state: "intent" }), links: [evidenceLink({ relation: "context", criterion_id: null })], events: [], eventsTruncated: false };
  const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement).disabled;

  it("mutation succeeds, refresh fails: controls stay locked until Retry refresh applies fresh data; the mutation is not repeated", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: base })                                                        // mount
      .mockResolvedValueOnce({ ok: false, status: 502, message: "mission storage call failed" })              // post-action refresh fails
      .mockResolvedValueOnce({ ok: false, status: 502, message: "mission storage call failed" })              // first retry fails
      .mockResolvedValueOnce({ ok: true, data: { ...base, mission: mission({ state: "plan" }) } });           // second retry succeeds
    const api = fakeApi({ get });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to plan" }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/change was saved, but refreshing the mission failed/i);
    expect(screen.getAllByRole("alert").some((a) => /mission storage call failed/.test(a.textContent ?? ""))).toBe(true);
    // the stale snapshot still says "intent", and every control acting on it is locked
    for (const el of [screen.getByRole("button", { name: "Move to plan" }), screen.getByRole("button", { name: "Cancel mission" }),
      screen.getByRole("button", { name: /remove link/i }), screen.getByLabelText("Link target"), screen.getByLabelText("Link type"),
      screen.getByRole("checkbox"), screen.getByRole("button", { name: /change owner or team/i })]) {
      if ((el as HTMLButtonElement).textContent === "Change owner or team") continue; // opens a panel only; its Save is locked below
      expect(isDisabled(el), el.textContent || el.getAttribute("aria-label") || "control").toBe(true);
    }
    fireEvent.click(screen.getByRole("button", { name: /change owner or team/i }));
    expect(isDisabled(screen.getByRole("button", { name: "Save" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("status")).toBeTruthy();                                       // still locked after a failed retry
    expect(isDisabled(screen.getByRole("button", { name: "Move to plan" }))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    const approve = await screen.findByRole("button", { name: "Approve" });              // fresh data applied
    expect(isDisabled(approve)).toBe(false);                                              // unlocked only now
    expect(screen.queryByRole("status")).toBeNull();
    expect(api.transition).toHaveBeenCalledTimes(1);                                      // never repeated
  });

  it("link fields are disabled for the whole add; success clears the submitted value", async () => {
    let releaseAdd!: (v: unknown) => void;
    const addLink = vi.fn(() => new Promise((r) => (releaseAdd = r)));
    render(<MissionDetailView id={M_ID} api={fakeApi({ addLink: addLink as unknown as MissionApi["addLink"] }, { ...base, mission: mission({ state: "executing" }) })} />);
    fireEvent.change(await screen.findByLabelText("Link target"), { target: { value: "https://docs.example.com/a" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    await waitFor(() => expect(addLink).toHaveBeenCalledTimes(1));
    for (const label of ["Link target", "Link type", "Relation"]) expect(isDisabled(screen.getByLabelText(label)), label).toBe(true);
    expect(isDisabled(screen.getByRole("button", { name: "Add link" }))).toBe(true);
    expect(isDisabled(screen.getByRole("checkbox"))).toBe(true);
    releaseAdd({ ok: true, data: { link: evidenceLink(), resolution: "format_only" } });
    await waitFor(() => expect((screen.getByLabelText("Link target") as HTMLInputElement).value).toBe(""));
    expect(isDisabled(screen.getByLabelText("Link target"))).toBe(false);
  });

  it("a refused add keeps the submitted value and re-enables the fields", async () => {
    let releaseAdd!: (v: unknown) => void;
    const addLink = vi.fn(() => new Promise((r) => (releaseAdd = r)));
    render(<MissionDetailView id={M_ID} api={fakeApi({ addLink: addLink as unknown as MissionApi["addLink"] }, { ...base, mission: mission({ state: "executing" }) })} />);
    fireEvent.change(await screen.findByLabelText("Link target"), { target: { value: "http://imac/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    await waitFor(() => expect(isDisabled(screen.getByLabelText("Link target"))).toBe(true));
    releaseAdd({ ok: false, status: 422, message: "url host must be public" });
    await waitFor(() => expect(isDisabled(screen.getByLabelText("Link target"))).toBe(false));
    expect((screen.getByLabelText("Link target") as HTMLInputElement).value).toBe("http://imac/x");
  });

  it("the Show removed toggle is disabled through an action and its refresh, then usable again", async () => {
    let releaseRefresh!: (v: unknown) => void;
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: base })
      .mockImplementationOnce(() => new Promise((r) => (releaseRefresh = r)));
    let releaseAction!: (v: unknown) => void;
    const transition = vi.fn(() => new Promise((r) => (releaseAction = r)));
    render(<MissionDetailView id={M_ID} api={fakeApi({ get, transition: transition as unknown as MissionApi["transition"] })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to plan" }));
    expect(isDisabled(screen.getByRole("checkbox"))).toBe(true);                 // during the mutation
    releaseAction({ ok: true, data: mission({ state: "plan" }) });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(isDisabled(screen.getByRole("checkbox"))).toBe(true);                 // during the refresh
    releaseRefresh({ ok: true, data: { ...base, mission: mission({ state: "plan" }) } });
    await screen.findByRole("button", { name: "Approve" });
    expect(isDisabled(screen.getByRole("checkbox"))).toBe(false);                // usable again
    expect(get.mock.calls[1]).toEqual([M_ID, false]);                            // the reload used the state shown
  });
});

describe("reassignment editor while saving", () => {
  const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement | HTMLSelectElement).disabled;
  const base = { mission: mission({ state: "executing", owner: "ramon", owner_kind: "human", agent_ids: ["nova"] }), links: [], events: [], eventsTruncated: false };

  it("locks owner and team during save and refresh, closes only after fresh data, and keeps the selection on failure", async () => {
    // success path
    let releaseSave!: (v: unknown) => void; let releaseRefresh!: (v: unknown) => void;
    const reassign = vi.fn(() => new Promise((r) => (releaseSave = r)));
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: base })
      .mockImplementationOnce(() => new Promise((r) => (releaseRefresh = r)));
    const api = fakeApi({ get, reassign: reassign as unknown as MissionApi["reassign"] });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: /change owner or team/i }));
    fireEvent.change(screen.getByLabelText("New owner"), { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const chips = () => screen.getAllByRole("button", { pressed: true }).concat(screen.getAllByRole("button", { pressed: false }));
    for (const phase of ["request", "refresh"]) {
      expect(isDisabled(screen.getByLabelText("New owner")), `owner during ${phase}`).toBe(true);
      expect(chips().every(isDisabled), `team chips during ${phase}`).toBe(true);
      expect(isDisabled(screen.getByRole("button", { name: "Save" })), `save during ${phase}`).toBe(true);
      expect(screen.getByRole("heading", { name: "Owner and team" })).toBeTruthy();         // editor stays open and stable
      if (phase === "request") { releaseSave({ ok: true, data: mission({ owner: "atlas", owner_kind: "agent" }) }); await waitFor(() => expect(get).toHaveBeenCalledTimes(2)); }
    }
    expect(reassign).toHaveBeenCalledWith(M_ID, { owner: "atlas", ownerKind: "agent", agentIds: ["nova"] });
    releaseRefresh({ ok: true, data: { ...base, mission: mission({ state: "executing", owner: "atlas", owner_kind: "agent", agent_ids: ["nova"] }) } });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Owner and team" })).toBeNull()); // closed after fresh data
    cleanup();

    // failure path: the server refuses; the panel stays open with the chosen owner/team, editable again
    const refused = fakeApi({ get: vi.fn().mockResolvedValue({ ok: true, data: base }),
      reassign: vi.fn(() => Promise.resolve({ ok: false as const, status: 422, message: "invalid owner or team" })) });
    render(<MissionDetailView id={M_ID} api={refused} />);
    fireEvent.click(await screen.findByRole("button", { name: /change owner or team/i }));
    fireEvent.change(screen.getByLabelText("New owner"), { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Triage" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("invalid owner or team");
    await waitFor(() => expect(isDisabled(screen.getByLabelText("New owner"))).toBe(false));
    expect((screen.getByLabelText("New owner") as HTMLSelectElement).value).toBe("atlas");
    expect(screen.getByRole("button", { name: "Triage" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Nova" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("a save whose refresh fails keeps the panel open (locked) instead of closing on stale data", async () => {
    const api = fakeApi({ get: vi.fn().mockResolvedValueOnce({ ok: true, data: base }).mockResolvedValue({ ok: false, status: 502, message: "mission storage call failed" }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: /change owner or team/i }));
    fireEvent.change(screen.getByLabelText("New owner"), { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("status");
    expect(screen.getByRole("heading", { name: "Owner and team" })).toBeTruthy();
    expect((screen.getByLabelText("New owner") as HTMLSelectElement).value).toBe("atlas");
  });
});

describe("New Mission form while submitting", () => {
  const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
  const editable = () => [
    screen.getByPlaceholderText(/what outcome/i), screen.getAllByRole("combobox")[0],
    ...screen.getAllByRole("button", { pressed: true }), ...screen.getAllByRole("button", { pressed: false }),
    screen.getAllByRole("textbox")[1], screen.getAllByRole("textbox")[2],
  ];
  function fill() {
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "Launch v2" } });
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "atlas" } });
    fireEvent.click(screen.getByRole("button", { name: "Nova" }));
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Coaches sign up" } });
    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "Release notes" } });
  }

  it("locks every field during the create and the plan link, submits exactly what was shown, then closes on success", async () => {
    let releaseCreate!: (v: unknown) => void; let releaseLink!: (v: unknown) => void;
    const create = vi.fn(() => new Promise((r) => (releaseCreate = r)));
    const addLink = vi.fn(() => new Promise((r) => (releaseLink = r)));
    const created = vi.fn();
    render(<CreateMissionForm api={fakeApi({ create: create as unknown as MissionApi["create"], addLink: addLink as unknown as MissionApi["addLink"] })}
      onCreated={created} onCancel={() => {}} fromSynthesis="00000000-0000-4000-8000-0000000000cc" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    // during the create request
    for (const el of editable()) expect(isDisabled(el), el.getAttribute("aria-label") ?? el.textContent ?? "field").toBe(true);
    expect(isDisabled(screen.getByRole("button", { name: /creating/i }))).toBe(true);
    expect(isDisabled(screen.getByRole("button", { name: "Cancel" }))).toBe(true);
    releaseCreate({ ok: true, data: mission() });
    await waitFor(() => expect(addLink).toHaveBeenCalledTimes(1));
    // during the follow-up plan link
    for (const el of editable()) expect(isDisabled(el)).toBe(true);
    expect(create).toHaveBeenCalledWith({ objective: "Launch v2", owner: "atlas", ownerKind: "agent", agentIds: ["nova"],
      successCriteria: [{ id: "c1", text: "Coaches sign up" }], deliverables: [{ id: "d1", text: "Release notes" }] });
    releaseLink({ ok: true, data: { link: evidenceLink(), resolution: "resolved" } });
    await waitFor(() => expect(created).toHaveBeenCalledTimes(1));                      // existing close path
  });

  it("a failed create unlocks the form with the values exactly as entered", async () => {
    let releaseCreate!: (v: unknown) => void;
    const create = vi.fn(() => new Promise((r) => (releaseCreate = r)));
    const created = vi.fn();
    render(<CreateMissionForm api={fakeApi({ create: create as unknown as MissionApi["create"] })} onCreated={created} onCancel={() => {}} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    expect(isDisabled(screen.getByPlaceholderText(/what outcome/i))).toBe(true);
    releaseCreate({ ok: false, status: 422, message: "owner is not a registered active agent" });
    expect((await screen.findByRole("alert")).textContent).toContain("registered active agent");
    for (const el of editable()) expect(isDisabled(el)).toBe(false);
    expect((screen.getByPlaceholderText(/what outcome/i) as HTMLTextAreaElement).value).toBe("Launch v2");
    expect((screen.getAllByRole("combobox")[0] as HTMLSelectElement).value).toBe("atlas");
    expect(screen.getByRole("button", { name: "Nova" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getAllByRole("textbox")[1] as HTMLTextAreaElement).value).toBe("Coaches sign up");
    expect((screen.getAllByRole("textbox")[2] as HTMLTextAreaElement).value).toBe("Release notes");
    expect(created).not.toHaveBeenCalled();
  });

  it("partial success (created, plan link failed) keeps the entered values visible and read-only, with the existing Open/Done path", async () => {
    const created = vi.fn();
    render(<CreateMissionForm api={fakeApi({ addLink: vi.fn(() => Promise.resolve({ ok: false as const, status: 404, message: "synthesis not found" })) })}
      onCreated={created} onCancel={() => {}} fromSynthesis="00000000-0000-4000-8000-0000000000cc" />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/was created, but linking the plan failed/);
    for (const el of editable()) expect(isDisabled(el)).toBe(true);
    expect((screen.getByPlaceholderText(/what outcome/i) as HTMLTextAreaElement).value).toBe("Launch v2");
    expect(screen.getByRole("link", { name: /open M-42/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(created).toHaveBeenCalledTimes(1);
  });
});

describe("plan conversion is offered only before legacy approval", () => {
  const SYN = "00000000-0000-4000-8000-0000000000cc";
  it("unapproved plan: shortcut shown; approved plan: absent; no plan: absent", () => {
    expect(planMissionShortcut({ synthesisId: SYN, approvedAt: null, plan: { decision: "Do the thing" } })).toBe(planPrefillHref(SYN, "Do the thing"));
    expect(planMissionShortcut({ synthesisId: SYN, approvedAt: "2026-10-04T00:00:00Z", plan: { decision: "Do the thing" } })).toBeNull();
    expect(planMissionShortcut({ synthesisId: SYN, approvedAt: null, plan: null })).toBeNull();
    expect(planMissionShortcut({ synthesisId: SYN, approvedAt: "2026-10-04T00:00:00Z", plan: null })).toBeNull();
  });
  it("Decisions renders the shortcut only through planMissionShortcut", () => {
    const src = readFileSync(join(process.cwd(), "src/app/command-center/decisions/page.tsx"), "utf8");
    expect(src).toContain("{planMissionShortcut(d) && (");
    expect(src).not.toContain("planPrefillHref(");
  });
});

describe("the plan prefill is consumed the moment a mission exists", () => {
  const SYN = "00000000-0000-4000-8000-0000000000cc";
  let search = "";
  const order: string[] = [];
  const replace = vi.fn((url: string) => { order.push(`replace ${url}`); search = ""; });

  async function renderPage(apiOver: Partial<MissionApi>) {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams(search) }));
    const api = fakeApi(apiOver);
    vi.doMock("@/lib/missions/client", async (orig) => ({ ...(await orig<object>()), httpMissionApi: api }));
    const { default: MissionsPage } = await import("@/app/command-center/missions/page");
    const view = render(<MissionsPage />);
    return { api, MissionsPage, view };
  }
  async function submitPrefilled() {
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "Plan executed" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
  }
  afterEach(() => { vi.doUnmock("next/navigation"); vi.doUnmock("@/lib/missions/client"); order.length = 0; replace.mockClear(); });

  it("create + link succeed: the query is consumed right after create, before the link, then the normal close", async () => {
    search = `fromSynthesis=${SYN}&objective=Plan%20text`;
    const { api } = await renderPage({
      addLink: vi.fn((_id, b) => { order.push("addLink"); return Promise.resolve({ ok: true as const, data: { link: evidenceLink(), resolution: "resolved" } }); }) as unknown as MissionApi["addLink"],
    });
    await screen.findByPlaceholderText(/what outcome/i);
    await submitPrefilled();
    await waitFor(() => expect(screen.queryByPlaceholderText(/what outcome/i)).toBeNull());
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(order[0]).toBe("replace /command-center/missions");
    expect(order.indexOf("addLink")).toBeGreaterThan(order.indexOf("replace /command-center/missions"));
  });

  it("create succeeds, link fails: query consumed, recovery screen survives the re-render, and refresh/Back cannot rebuild the form", async () => {
    search = `fromSynthesis=${SYN}&objective=Plan%20text`;
    const { api, MissionsPage, view } = await renderPage({ addLink: vi.fn(() => Promise.resolve({ ok: false as const, status: 404, message: "synthesis not found" })) });
    await screen.findByPlaceholderText(/what outcome/i);
    await submitPrefilled();
    expect((await screen.findByRole("alert")).textContent).toMatch(/M-42 was created, but linking the plan failed/);
    expect(replace).toHaveBeenCalledWith("/command-center/missions");
    expect(search).toBe("");                                                          // URL no longer carries the prefill
    view.rerender(<MissionsPage />);                                                  // the page re-renders with the cleared query
    expect(screen.getByRole("link", { name: /open M-42/i }).getAttribute("href")).toBe(`/command-center/missions/${M_ID}`);
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();                // recovery UI preserved
    expect(api.create).toHaveBeenCalledTimes(1);                                      // never retried
    cleanup();
    // refresh / Back to the (replaced) history entry: no prefill, no form, no automatic create
    await renderPage({});
    expect(await screen.findByRole("button", { name: /new mission/i })).toBeTruthy();
    expect(screen.queryByPlaceholderText(/what outcome/i)).toBeNull();
  });

  it("a failed create does NOT consume the prefill (no mission exists)", async () => {
    search = `fromSynthesis=${SYN}&objective=Plan%20text`;
    await renderPage({ create: vi.fn(() => Promise.resolve({ ok: false as const, status: 422, message: "owner is not a registered active agent" })) });
    await screen.findByPlaceholderText(/what outcome/i);
    await submitPrefilled();
    expect((await screen.findByRole("alert")).textContent).toContain("registered active agent");
    expect(replace).not.toHaveBeenCalled();
    expect(search).toContain("fromSynthesis");
  });
});

describe("cost & usage (M3)", () => {
  const withCosts = (over: Partial<MissionCosts>): MissionCosts => ({ ...noCosts, ...over });
  const cs = (sum: number | null, known: number, unknown: number) => ({ sum, knownEvents: known, unknownEvents: unknown });

  it("all-null actual cost reads 'No actual marginal cost recorded', never $0.00", async () => {
    const c = withCosts({
      events: { total: 2, direct: 2, linked: 0, both: 0 },
      actualCost: { status: "none_recorded", knownUsd: null, knownEvents: 0, unknownEvents: 0, notApplicableEvents: 2 },
      usage: { input: cs(null, 0, 2), output: cs(null, 0, 2), total: cs(null, 0, 2), byQuality: { ambiguous_proxy_zero: 2 } },
      shadowCost: { ...noCosts.shadowCost, unpricedEvents: 2 },
      breakdown: [{ provider: "claude-max", modelRequested: "claude-opus-4-6", modelReported: "claude-opus-4", billingMode: "subscription", events: 2,
        inputTokens: cs(null, 0, 2), outputTokens: cs(null, 0, 2), actualKnownUsd: null, shadowUsd: null }],
    });
    render(<MissionDetailView id={M_ID} api={fakeApi({ costs: vi.fn(() => Promise.resolve({ ok: true as const, data: c })) })} />);
    const panel = await screen.findByTestId("actual-cost");
    expect(panel.textContent).toContain("No actual marginal cost recorded");
    const all = screen.getByTestId("costs").textContent ?? "";
    expect(all).not.toMatch(/\$0(\.0+)?\b/);
    expect(screen.getByTestId("usage").textContent).toContain("unknown (2 calls)");
    expect(screen.getByTestId("shadow-cost").textContent).toContain("NOT actual spend");
    expect(screen.getByTestId("cost-breakdown").textContent).toContain("actual not recorded");
  });

  it("mixed known and unknown shows the known total marked partial; shadow is separate and labelled", async () => {
    const c = withCosts({
      events: { total: 3, direct: 1, linked: 3, both: 1 },
      actualCost: { status: "partial", knownUsd: "0.01230001", knownEvents: 1, unknownEvents: 1, notApplicableEvents: 1 },
      usage: { input: cs(1100, 2, 1), output: cs(550, 2, 1), total: cs(150, 1, 2), byQuality: {} },
      shadowCost: { label: "list_price_equivalent_not_actual_spend", basis: "list_price_equivalent_lower_bound_excludes_cache_tokens", usd: "0.01050000", pricedEvents: 1, unpricedEvents: 2 },
    });
    render(<MissionDetailView id={M_ID} api={fakeApi({ costs: vi.fn(() => Promise.resolve({ ok: true as const, data: c })) })} />);
    const actual = (await screen.findByTestId("actual-cost")).textContent ?? "";
    expect(actual).toContain("$0.01230001");
    expect(actual).toContain("Partial: cost unknown for 1 call");
    expect(actual).not.toContain("0.0105");
    expect(screen.getByTestId("shadow-cost").textContent).toContain("$0.0105 (lower bound, 1 of 3 calls priced)");
    expect(screen.getByTestId("usage").textContent).toContain("1,100 known, unknown for 1 call");
    expect(screen.getByTestId("event-counts").textContent).toContain("1 reached both ways, counted once");
  });

  it("a mission with no telemetry says so plainly", async () => {
    render(<MissionDetailView id={M_ID} api={fakeApi()} />);
    expect((await screen.findByTestId("actual-cost")).textContent).toContain("No usage attributed to this mission yet.");
    expect(screen.queryByTestId("shadow-cost")).toBeNull();
  });

  it("a failed cost read is shown as a failure, never as zero, and the rest of the page still works", async () => {
    render(<MissionDetailView id={M_ID} api={fakeApi({ costs: vi.fn(() => Promise.resolve({ ok: false as const, status: 502, message: "mission storage call failed" })) })} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Cost & usage could not be loaded");
    expect(screen.queryByTestId("actual-cost")).toBeNull();
    expect(screen.getByTestId("lifecycle-actions")).toBeTruthy();
  });

  it("after an action, earlier numbers are never shown while the new read is pending or once it fails", async () => {
    const partial = withCosts({ events: { total: 1, direct: 0, linked: 1, both: 0 },
      actualCost: { status: "complete", knownUsd: "1.23000000", knownEvents: 1, unknownEvents: 0, notApplicableEvents: 0 } });
    let fail!: (v: unknown) => void;
    const costs = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: partial })
      .mockImplementationOnce(() => new Promise((r) => (fail = r)));
    const api = fakeApi({ costs }, { mission: mission({ state: "executing" }), links: [evidenceLink()] });
    render(<MissionDetailView id={M_ID} api={api} />);
    expect((await screen.findByTestId("actual-cost")).textContent).toContain("$1.23");
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(costs).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("actual-cost")).toBeNull();                 // pending: no stale figures
    fail({ ok: false, status: 502, message: "mission storage call failed" });
    expect((await screen.findByText(/Cost & usage could not be loaded/)).textContent).toContain("mission storage call failed");
    expect(screen.getByTestId("costs").textContent).not.toContain("$1.23");
  });

  it("costs are re-read after an action (a link can change attribution)", async () => {
    const api = fakeApi({}, { mission: mission({ state: "executing" }), links: [evidenceLink()] });
    render(<MissionDetailView id={M_ID} api={api} />);
    await screen.findByTestId("actual-cost");
    const before = (api.costs as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect((api.costs as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(before));
  });
});

/* ── M4B: founder triage ─────────────────────────────────────────────────────────────────────────────── */

describe("M4B grouping", () => {
  const at = (ref: number, state: MissionState, updated: string) =>
    mission({ id: `00000000-0000-4000-8000-${String(ref).padStart(12, "0")}`, ref, state, updated_at: updated, objective: `Mission ${ref}` });

  it("every mission state belongs to exactly one group, as specified", () => {
    expect(Object.keys(GROUP_OF).sort()).toEqual([...MISSION_STATES].sort());
    expect(GROUP_OF).toEqual({
      reviewing: "needs_you", completed: "needs_you", executing: "active", approved: "active", plan: "active",
      intent: "early", verified: "done", cancelled: "done",
    });
    expect(GROUP_ORDER).toEqual(["needs_you", "active", "early", "done"]);
    for (const st of MISSION_STATES) {
      const g = groupMissions([at(1, st, "2026-10-01T00:00:00Z")]);
      expect(g.filter((x) => x.missions.length === 1).map((x) => x.group)).toEqual([GROUP_OF[st]]);
    }
  });

  it("order inside a group is most recently updated first, ties and unreadable dates by newest ref, whatever the input order", () => {
    const rows = [
      at(1, "executing", "2026-10-03T00:00:00Z"), at(2, "plan", "2026-10-05T00:00:00Z"), at(3, "approved", "2026-10-03T00:00:00Z"),
      at(4, "executing", "not a date"), at(5, "executing", "not a date"),
    ];
    const order = (xs: MissionRow[]) => groupMissions(xs).find((g) => g.group === "active")!.missions.map((m) => m.ref);
    expect(order(rows)).toEqual([2, 3, 1, 5, 4]);
    expect(order([...rows].reverse())).toEqual([2, 3, 1, 5, 4]);
    expect(rows.map((m) => m.ref)).toEqual([1, 2, 3, 4, 5]);            // the input is not mutated
  });

  it("the list renders the four groups in order with their missions; verified and cancelled sit in Done", async () => {
    const missions = [
      at(8, "verified", "2026-10-08T00:00:00Z"), at(7, "cancelled", "2026-10-07T00:00:00Z"), at(6, "intent", "2026-10-06T00:00:00Z"),
      at(5, "plan", "2026-10-05T00:00:00Z"), at(4, "approved", "2026-10-04T00:00:00Z"), at(3, "executing", "2026-10-03T00:00:00Z"),
      at(2, "completed", "2026-10-02T00:00:00Z"), at(1, "reviewing", "2026-10-01T00:00:00Z"),
    ];
    render(<MissionListView api={fakeApi({ list: vi.fn(() => Promise.resolve({ ok: true as const, data: { missions, nextBefore: null } })) })} />);
    await screen.findAllByTestId("mission-card");
    const refs = (g: string) => within(screen.getByTestId(`group-${g}`)).queryAllByTestId("mission-card").map((c) => c.querySelector("span")?.textContent);
    expect(refs("needs_you")).toEqual(["M-2", "M-1"]);
    expect(refs("active")).toEqual(["M-5", "M-4", "M-3"]);
    expect(refs("early")).toEqual(["M-6"]);
    expect(refs("done")).toEqual(["M-8", "M-7"]);
    const order = ["needs_you", "active", "early", "done"].map((g) => screen.getByTestId(`group-${g}`));
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("triage-summary").textContent).toBe("2 needs you · 3 active · 1 inbox / early · 2 done");
    // Completed and Verified are different cards in different groups with different labels.
    const completed = within(screen.getByTestId("group-needs_you")).getAllByTestId("mission-card")[0].textContent ?? "";
    expect(completed).toContain("Needs verification");
    expect(completed).toContain("Completed, not yet verified");
    const verified = within(screen.getByTestId("group-done")).getAllByTestId("mission-card")[0];
    expect(within(verified).getByTestId("state-badge").textContent).toBe("Verified");
    expect(within(verified).queryByTestId("cue")).toBeNull();          // done rows stay quiet
    expect(within(verified).queryByTestId("card-next")).toBeNull();
  });

  it("an empty group says so; nothing waiting reads as nothing waiting", async () => {
    render(<MissionListView api={fakeApi({ list: vi.fn(() => Promise.resolve({ ok: true as const, data: { missions: [at(1, "intent", "2026-10-01T00:00:00Z")], nextBefore: null } })) })} />);
    await screen.findAllByTestId("mission-card");
    expect(screen.getByTestId("group-needs_you").textContent).toContain("Nothing is waiting on you.");
    expect(screen.getByTestId("group-done").textContent).toContain("None.");
  });

  it("when older missions are not loaded, the summary says its counts are partial", async () => {
    render(<MissionListView api={fakeApi({ list: vi.fn(() => Promise.resolve({ ok: true as const, data: { missions: [at(9, "executing", "2026-10-01T00:00:00Z")], nextBefore: 9 } })) })} />);
    await screen.findAllByTestId("mission-card");
    expect(screen.getByTestId("triage-summary").textContent).toContain("older missions are not loaded yet");
  });

  it("the list makes one list request and no per-row detail or cost requests", async () => {
    const api = fakeApi({ list: vi.fn(() => Promise.resolve({ ok: true as const, data: { missions: [at(2, "completed", "2026-10-02T00:00:00Z"), at(1, "executing", "2026-10-01T00:00:00Z")], nextBefore: null } })) });
    render(<MissionListView api={api} />);
    await screen.findAllByTestId("mission-card");
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
    expect(api.costs).not.toHaveBeenCalled();
  });
});

describe("M4B cues", () => {
  const cue = (state: MissionState, ev?: { criterion_id: string | null }[], criteria = [{ id: "c1", text: "a" }, { id: "c2", text: "b" }]) =>
    attentionCue({ state, success_criteria: criteria }, ev).label;
  it("each state has one fixed cue; completed depends only on evidence coverage", () => {
    expect(cue("reviewing")).toBe("Needs review");
    expect(cue("approved")).toBe("Ready to start");
    expect(cue("executing")).toBe("Active");
    expect(cue("plan")).toBe("Planning");
    expect(cue("intent")).toBe("New");
    expect(cue("intent", undefined, [])).toBe("No criteria");
    expect(cue("verified")).toBe("Verified");
    expect(cue("cancelled")).toBe("Cancelled");
    expect(cue("completed", [{ criterion_id: "c1" }, { criterion_id: "c2" }])).toBe("Verify");
    expect(cue("completed", [{ criterion_id: "c1" }])).toBe("Evidence missing");
    expect(cue("completed", [])).toBe("Evidence missing");
    expect(cue("completed")).toBe("Needs verification");               // links not loaded: say only what is known
    for (const st of MISSION_STATES) expect(attentionCue({ state: st, success_criteria: [] }).label).not.toMatch(/blocked|urgent|priority/i);
  });
  it("only reviewing and completed are attention cues", () => {
    expect(MISSION_STATES.filter((st) => attentionCue({ state: st, success_criteria: [{ id: "c1", text: "a" }] }).tone === "attention").sort()).toEqual(["completed", "reviewing"]);
  });
  it("coverage and decision text keep Completed and Verified distinct", () => {
    const crit = [{ id: "c1", text: "a" }, { id: "c2", text: "b" }];
    expect(coverageText(crit, [{ criterion_id: "c1" }])).toBe("1 of 2 criteria have evidence");
    expect(coverageText([crit[0]], [{ criterion_id: "c1" }])).toBe("1 of 1 criterion has evidence");
    expect(coverageText([], [])).toBeNull();
    const full = decisionText({ state: "completed", success_criteria: crit }, [{ criterion_id: "c1" }, { criterion_id: "c2" }])!;
    const part = decisionText({ state: "completed", success_criteria: crit }, [{ criterion_id: "c1" }])!;
    const ver = decisionText({ state: "verified", success_criteria: crit }, [])!;
    expect(full).toContain("NOT yet verified");
    expect(part).toContain("no evidence yet");
    expect(ver).toMatch(/^Verified:/);
    expect(ver).not.toContain("Completed");
    expect(decisionText({ state: "reviewing", success_criteria: crit }, [])).toContain("Your review is the current decision point");
    for (const st of ["intent", "plan", "approved", "executing", "cancelled"] as const) expect(decisionText({ state: st, success_criteria: crit }, [])).toBeNull();
    expect(listHint({ state: "completed", success_criteria: crit })).toContain("not yet verified");
  });
});

describe("M4B detail", () => {
  const crit2 = [{ id: "c1", text: "First" }, { id: "c2", text: "Second" }];
  const detail = (state: MissionState, links: LinkRow[]) => fakeApi({}, { mission: mission({ state, success_criteria: crit2 }), links });

  it("completed with full evidence: Verify cue, prominent not-yet-verified notice, verify enabled", async () => {
    render(<MissionDetailView id={M_ID} api={detail("completed", [evidenceLink(), evidenceLink({ id: "00000000-0000-4000-8000-0000000000ab", criterion_id: "c2" })])} />);
    expect((await screen.findByTestId("cue")).textContent).toBe("Verify");
    expect(screen.getByTestId("decision").textContent).toContain("Completed, NOT yet verified");
    expect(screen.getByTestId("state-badge").textContent).toBe("Completed");
    expect(screen.getByTestId("coverage").textContent).toBe("2 of 2 criteria have evidence");
    expect((screen.getByRole("button", { name: "Verify mission" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("completed with missing evidence: Evidence missing cue, and verify stays disabled", async () => {
    render(<MissionDetailView id={M_ID} api={detail("completed", [evidenceLink()])} />);
    expect((await screen.findByTestId("cue")).textContent).toBe("Evidence missing");
    expect(screen.getByTestId("decision").textContent).toContain("some success criteria have no evidence yet");
    expect(screen.getByTestId("coverage").textContent).toBe("1 of 2 criteria have evidence");
    expect((screen.getByRole("button", { name: "Verify mission" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("verified reads as verified, never as completed; reviewing names the founder decision", async () => {
    const { unmount } = render(<MissionDetailView id={M_ID} api={detail("verified", [evidenceLink()])} />);
    expect((await screen.findByTestId("decision")).textContent).toMatch(/^Verified:/);
    expect(screen.getByTestId("state-badge").textContent).toBe("Verified");
    expect(screen.queryByRole("button", { name: "Verify mission" })).toBeNull();
    unmount();
    render(<MissionDetailView id={M_ID} api={detail("reviewing", [])} />);
    expect((await screen.findByTestId("cue")).textContent).toBe("Needs review");
    expect(screen.getByTestId("decision").textContent).toContain("Your review is the current decision point");
  });

  it("states without a founder decision show no decision notice", async () => {
    render(<MissionDetailView id={M_ID} api={detail("executing", [])} />);
    expect((await screen.findByTestId("cue")).textContent).toBe("Active");
    expect(screen.queryByTestId("decision")).toBeNull();
  });

  it("sections come in the founder's order: actions, criteria, owner/team, cost, links, history", async () => {
    render(<MissionDetailView id={M_ID} api={detail("executing", [])} />);
    await screen.findByTestId("actual-cost");
    const marks = [screen.getByTestId("lifecycle-actions"), screen.getByText("Success criteria"), screen.getByRole("button", { name: "Change owner or team" }),
      screen.getByTestId("costs"), screen.getByText("Links and evidence"), screen.getByTestId("history")];
    for (let i = 1; i < marks.length; i++) expect(marks[i - 1].compareDocumentPosition(marks[i]) & Node.DOCUMENT_POSITION_FOLLOWING, String(i)).toBeTruthy();
  });

  it("a mission that fails to load shows the failure and a retry, never a blank or fake mission", async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, message: "mission storage call failed" })
      .mockResolvedValueOnce({ ok: true, data: { mission: mission({ state: "plan" }), links: [], events: [], eventsTruncated: false } });
    render(<MissionDetailView id={M_ID} api={fakeApi({ get })} />);
    expect((await screen.findByRole("alert")).textContent).toContain("This mission could not be loaded");
    expect(screen.queryByTestId("lifecycle-actions")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("lifecycle-actions")).toBeTruthy();
  });
});

describe("M4B list failure and recovery", () => {
  it("a failed first load shows the error and a retry: no groups, no empty state, no cards", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, message: "mission storage call failed" })
      .mockResolvedValueOnce({ ok: true, data: { missions: [mission({ state: "reviewing" })], nextBefore: null } });
    render(<MissionListView api={fakeApi({ list })} />);
    expect((await screen.findByRole("alert")).textContent).toContain("mission storage call failed");
    expect(screen.queryByTestId("mission-card")).toBeNull();
    expect(screen.queryByTestId("group-needs_you")).toBeNull();
    expect(screen.queryByText("No missions yet")).toBeNull();
    expect(screen.queryByTestId("triage-summary")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("mission-card")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("M4B mobile and authority", () => {
  const src = readFileSync(join(process.cwd(), "src/components/command-center/missions/MissionViews.tsx"), "utf8");
  it("cards and retry controls are touch-sized and grids never force horizontal scroll", async () => {
    render(<MissionListView api={fakeApi({ list: vi.fn(() => Promise.resolve({ ok: true as const, data: { missions: [mission({ state: "reviewing" })], nextBefore: null } })) })} />);
    const card = await screen.findByTestId("mission-card");
    expect(parseInt(card.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(card.querySelector("p")?.style.overflowWrap).toBe("anywhere");
    expect((card.parentElement as HTMLElement).style.gridTemplateColumns).toContain("min(100%, 340px)");
    expect(parseInt(screen.getByRole("button", { name: /new mission/i }).style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(src).not.toMatch(/minmax\(\d+px/);
    expect(src).not.toMatch(/width: \d{3,}(px)?[,}]/);
    expect(src).not.toMatch(/overflow-?x|overflowX/i);
    expect(src).not.toMatch(/<table/);
  });
  it("the surface adds no identity, agent authority, polling or new endpoint", () => {
    const client = readFileSync(join(process.cwd(), "src/lib/missions/client.ts"), "utf8");
    const ui = readFileSync(join(process.cwd(), "src/lib/missions/ui.ts"), "utf8");
    for (const text of [src, client, ui]) {
      expect(text).not.toMatch(/x-parallax-agent|PARALLAX_MISSIONS_AGENT_TOKEN|actor_kind|actorKind|verified_by|x-ramon-uid/);
      expect(text).not.toMatch(/setInterval|priorityScore|priority_score/);
    }
    expect([...client.matchAll(/call\(/g)].length).toBe(9);             // the 9 existing M2/M3 calls: no new route
  });
});

describe("M4B cost wording", () => {
  const a = (over: Partial<MissionCosts["actualCost"]>) => actualCostText({ status: "complete", knownUsd: null, knownEvents: 0, unknownEvents: 0, notApplicableEvents: 0, ...over });
  it("unknown is never zero; partial is marked as known + unknown", () => {
    expect(a({ status: "complete", knownUsd: "1.42000000", knownEvents: 3 })).toBe("$1.42 recorded across 3 calls.");
    expect(a({ status: "partial", knownUsd: "1.42000000", knownEvents: 3, unknownEvents: 2 })).toBe("$1.42 + unknown. Recorded across 3 calls. Partial: cost unknown for 2 calls.");
    for (const st of ["no_events", "none_recorded", "unknown"] as const) {
      const text = a({ status: st, unknownEvents: st === "unknown" ? 2 : 0 });
      expect(text).not.toMatch(/\$\s?0|\b0\.00\b/);
      if (st !== "no_events") expect(text).toContain("No actual marginal cost recorded");
    }
    expect(a({ status: "complete", knownUsd: "0.00000000", knownEvents: 1 })).toBe("$0.00 recorded across 1 call.");   // a recorded zero is real
  });
  it("the panel labels actual and shadow separately, and shadow as not actual spend", async () => {
    const c: MissionCosts = { ...noCosts, events: { total: 2, direct: 2, linked: 0, both: 0 },
      actualCost: { status: "partial", knownUsd: "1.42000000", knownEvents: 1, unknownEvents: 1, notApplicableEvents: 0 },
      shadowCost: { label: "list_price_equivalent_not_actual_spend", basis: "b", usd: "8.75000000", pricedEvents: 1, unpricedEvents: 1 } };
    render(<MissionDetailView id={M_ID} api={fakeApi({ costs: vi.fn(() => Promise.resolve({ ok: true as const, data: c })) })} />);
    const actual = (await screen.findByTestId("actual-cost")).textContent ?? "";
    expect(actual).toContain("Actual marginal cost:");
    expect(actual).toContain("$1.42 + unknown");
    expect(actual).not.toContain("8.75");
    const shadow = screen.getByTestId("shadow-cost").textContent ?? "";
    expect(shadow).toContain("NOT actual spend");
    expect(shadow).toContain("$8.75");
    expect(shadow).not.toContain("1.42");
  });
});
