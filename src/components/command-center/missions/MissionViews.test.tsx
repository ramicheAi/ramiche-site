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
import type { LinkRow, MissionRow, MissionState } from "@/lib/missions/types";
import { forwardSteps, canVerify, EVIDENCE_TARGETS, planPrefillHref, toWellFormed } from "@/lib/missions/ui";
import { EVIDENCE_TYPES } from "@/lib/missions/targets";
import { MISSION_STATES } from "@/lib/missions/types";

afterEach(cleanup);

const M_ID = "00000000-0000-4000-8000-000000000001";
const mission = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: M_ID, ref: 42, tenant_id: "t", objective: "Ship the onboarding flow", owner: "ramon", owner_kind: "human",
  agent_ids: ["nova"], success_criteria: [{ id: "c1", text: "Onboarding under 5 minutes" }], deliverables: [{ id: "d1", text: "Flow live" }],
  state: "intent", created_by: "ramon", created_by_kind: "human", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...over,
});
const evidenceLink = (over: Partial<LinkRow> = {}): LinkRow => ({
  id: "00000000-0000-4000-8000-0000000000aa", mission_id: M_ID, target_type: "job", target_id: "00000000-0000-4000-8000-0000000000bb",
  target_index: null, relation: "evidence", criterion_id: "c1", created_by: "ramon", created_by_kind: "human",
  created_at: new Date().toISOString(), removed_at: null, removed_by: null, removed_by_kind: null, ...over,
});

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
  it("an action's reload that lands after a newer read cannot overwrite it", async () => {
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

  it("the Decisions shortcut builds its link with planPrefillHref", () => {
    const src = readFileSync(join(process.cwd(), "src/app/command-center/decisions/page.tsx"), "utf8");
    expect(src).toContain("href={planPrefillHref(d.synthesisId, d.plan.decision)}");
    expect(src).not.toMatch(/encodeURIComponent\(\[\.\.\.d\.plan/);
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
