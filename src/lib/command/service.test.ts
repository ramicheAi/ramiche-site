/**
 * P06 M5: the shadow-route service records a decision and does nothing else. Executors, providers, jobs and the
 * telemetry writer are mocked so any call to them fails the test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({ exec: vi.fn(), stream: vi.fn(), claw: vi.fn(), runJob: vi.fn(), record: vi.fn() }));
vi.mock("@/lib/provider-adapter", () => ({ executeCompletion: spies.exec, streamCompletion: spies.stream, executeOpenClaw: spies.claw }));
vi.mock("@/lib/jobs", () => ({ runJob: spies.runJob }));
vi.mock("@/lib/execution-events", () => ({ recordExecution: spies.record }));

import { getShadow, shadowRoute, type CommandCtx } from "./service";
import type { CommandRow, CommandStore } from "./store";
import { FOUNDER, type Principal } from "@/lib/missions/principal";
import type { MissionStore } from "@/lib/missions/store";
import { SHADOW_KIND } from "./types";

const TENANT = "11111111-1111-1111-1111-111111111111";
const MID = "00000000-0000-4000-8000-000000000001";

function fakeCommandStore() {
  const rows: (CommandRow & { tenant: string })[] = [];
  const calls: string[] = [];
  let n = 0;
  const store: CommandStore = {
    commandChannel: async (t) => { calls.push(`channel ${t}`); return { ok: true, data: "c0000000-0000-4000-8000-0000000000cc" }; },
    insertCommand: async (a) => {
      calls.push(`insert ${a.tenantId}`);
      const row = { id: `9e000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, channel_id: a.channelId, content: a.content, metadata: a.metadata, created_at: "2026-10-05T00:00:00Z", tenant: a.tenantId };
      rows.push(row); return { ok: true, data: row };
    },
    getCommand: async (t, id) => { calls.push(`get ${t}`); return { ok: true, data: rows.find((r) => r.id === id && r.tenant === t) ?? null }; },
    linkedMissions: async (t) => { calls.push(`linked ${t}`); return { ok: true, data: [] }; },
  };
  return { store, rows, calls };
}
const missionStore = (missions: Record<string, string>): MissionStore => ({
  getMission: async (tenantId: string, id: string) => ({ ok: true, data: missions[id] === tenantId ? { id, tenant_id: tenantId, state: "executing", ref: 7 } : null }),
  listLinks: async () => ({ ok: true, data: [] }),
  listEvents: async () => ({ ok: true, data: [] }),
}) as unknown as MissionStore;

let cs: ReturnType<typeof fakeCommandStore>;
const ctx = (principal: Principal = FOUNDER, missions: Record<string, string> = { [MID]: TENANT }): CommandCtx =>
  ({ store: cs.store, mission: { store: missionStore(missions), tenantId: TENANT, principal } });
beforeEach(() => { cs = fakeCommandStore(); for (const s of Object.values(spies)) s.mockReset(); });

describe("shadowRoute", () => {
  it("records the command and the decision as a shadow record, and executes nothing", async () => {
    const r = await shadowRoute(ctx(), { text: "  Claude Code, fix Mettle. Codex reviews. Don't merge without me.  " });
    expect(r.ok && r.status).toBe(201);
    if (!r.ok) return;
    expect(r.data).toMatchObject({ command: "Claude Code, fix Mettle. Codex reviews. Don't merge without me.", shadow: true, executed: false, missionContext: null, supersedes: null, routerVersion: "m5-rules-1", linkedMissions: [] });
    expect(r.data.decision).toMatchObject({ handler: "claude_code", reviewer: "codex_review", classifier: null });
    expect(cs.rows[0].metadata).toMatchObject({ kind: SHADOW_KIND, shadow: true, executed: false, decision: r.data.decision });
    expect(cs.calls).toEqual([`channel ${TENANT}`, `insert ${TENANT}`]);
    // no executor, provider, job, or telemetry: a deterministic route causes no model execution event
    for (const s of Object.values(spies)) expect(s).not.toHaveBeenCalled();
  });

  it("is founder only: any other principal is refused before anything is read or written", async () => {
    const others = [{ kind: "agent", actor: "triage", actorKind: "agent" }, { kind: "founder", actor: "nova", actorKind: "human" }, { kind: "agent", actor: "ramon", actorKind: "human" }] as unknown as Principal[];
    for (const p of others) {
      const r = await shadowRoute(ctx(p), { text: "Claude Code, fix Mettle" });
      expect(!r.ok && r.status).toBe(403);
      const g = await getShadow(ctx(p), "9e000000-0000-4000-8000-000000000001");
      expect(!g.ok && g.status).toBe(403);
    }
    expect(cs.calls).toEqual([]);
  });

  it("validates input and refuses unknown fields, including forged identity", async () => {
    const bad: [Record<string, unknown>, number][] = [
      [{}, 422], [{ text: "   " }, 422], [{ text: "x".repeat(2001) }, 422], [{ text: "go", handlerHint: "root" }, 422],
      [{ text: "go", handlerHint: "cockpit_agent" }, 422], [{ text: "go", supersedes: "nope" }, 422],
      [{ text: "check the old run", handlerHint: "existing_job" }, 422],     // no job id to route to
      [{ text: "go", actor: "ramon" }, 400], [{ text: "go", execute: true }, 400], [{ text: "go", agentId: "triage" }, 400],
    ];
    for (const [body, status] of bad) { const r = await shadowRoute(ctx(), body); expect(!r.ok && r.status, JSON.stringify(body)).toBe(status); }
    expect(cs.rows).toEqual([]);
  });

  it("a mission context must be a mission of this tenant; another tenant's mission does not exist", async () => {
    const other = "00000000-0000-4000-8000-000000000002";
    const r = await shadowRoute(ctx(FOUNDER, { [MID]: TENANT, [other]: "22222222-2222-2222-2222-222222222222" }), { text: "Claude Code, fix it", missionId: other });
    expect(!r.ok && r.status).toBe(404);
    const ok = await shadowRoute(ctx(), { text: "Claude Code, fix it", missionId: MID });
    expect(ok.ok && [ok.data.missionContext, ok.data.decision.attachRecommended, ok.data.decision.missionRecommended]).toEqual([MID, true, false]);
  });

  it("editing the routing writes a NEW record that supersedes the old one, and only an existing shadow record can be superseded", async () => {
    const first = await shadowRoute(ctx(), { text: "Mettle onboarding" });
    if (!first.ok) throw new Error("first");
    expect(first.data.decision.handler).toBeNull();
    const second = await shadowRoute(ctx(), { text: "Mettle onboarding", handlerHint: "claude_code", supersedes: first.data.id });
    expect(second.ok && [second.data.supersedes, second.data.decision.handler, second.data.decision.source]).toEqual([first.data.id, "claude_code", "explicit"]);
    expect(cs.rows.length).toBe(2);
    expect(cs.rows[0].metadata.decision).toEqual(first.data.decision);      // the original decision is kept as evidence
    const missing = await shadowRoute(ctx(), { text: "x", supersedes: "9e000000-0000-4000-8000-0000000000ff" });
    expect(!missing.ok && missing.status).toBe(404);
  });
});

describe("getShadow", () => {
  it("returns a recorded decision with its linked missions; anything else is not found", async () => {
    const r = await shadowRoute(ctx(), { text: "Research current competitor pricing" });
    if (!r.ok) throw new Error("route");
    const g = await getShadow(ctx(), r.data.id.toUpperCase());
    expect(g.ok && [g.data.id, g.data.decision.handler, g.data.executed]).toEqual([r.data.id, "perplexity", false]);
    expect((await getShadow(ctx(), "not-a-uuid")).ok).toBe(false);
    cs.rows.push({ id: "9e000000-0000-4000-8000-0000000000aa", channel_id: "c", content: "hello", metadata: {}, created_at: "", tenant: TENANT });
    const plain = await getShadow(ctx(), "9e000000-0000-4000-8000-0000000000aa");
    expect(!plain.ok && plain.status).toBe(404);                            // an ordinary chat message is not a command
  });
  it("storage failure is a failure, never an empty record", async () => {
    cs.store.getCommand = async () => ({ ok: false, error: { message: "boom" } });
    const g = await getShadow(ctx(), "9e000000-0000-4000-8000-000000000001");
    expect(!g.ok && g.status).toBe(502);
  });
});
