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
import { forwardSteps, canVerify, EVIDENCE_TARGETS } from "@/lib/missions/ui";
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
    expect((await screen.findByRole("alert")).textContent).toMatch(/what this mission is for/i);
    expect(api.create).not.toHaveBeenCalled();
  });

  it("a server refusal is shown", async () => {
    const api = fakeApi({ create: vi.fn(() => Promise.resolve({ ok: false as const, status: 422, message: "owner is not a registered active agent" })) });
    render(<CreateMissionForm api={api} onCreated={() => {}} onCancel={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/what outcome/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("registered active agent");
  });

  it("from a plan: objective prefilled, and the plan is linked as the mission's source after creation", async () => {
    const api = fakeApi();
    render(<CreateMissionForm api={api} onCreated={() => {}} onCancel={() => {}} initialObjective="Decision text" fromSynthesis="00000000-0000-4000-8000-0000000000cc" />);
    expect((screen.getByPlaceholderText(/what outcome/i) as HTMLTextAreaElement).value).toBe("Decision text");
    fireEvent.click(screen.getByRole("button", { name: /create mission/i }));
    await waitFor(() => expect(api.addLink).toHaveBeenCalledWith(M_ID, { targetType: "synthesis", targetId: "00000000-0000-4000-8000-0000000000cc", relation: "source" }));
  });
});

describe("lifecycle controls", () => {
  it("helpers never offer verified as a generic transition, from any state", () => {
    for (const s of MISSION_STATES) expect(forwardSteps(s).map((x) => x.to)).not.toContain("verified");
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
    const api = fakeApi({ transition: vi.fn(() => Promise.resolve({ ok: false as const, status: 422, message: "at least one success criterion is required before approval" })) },
      { mission: mission({ state: "plan", success_criteria: [] }) });
    render(<MissionDetailView id={M_ID} api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect((await screen.findByRole("alert")).textContent).toContain("success criterion");
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
