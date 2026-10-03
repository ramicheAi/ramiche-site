/**
 * P06 M2 against the REAL M1 schema (disposable PG17 built by supabase/tests/run-m2-local.sh). Skipped unless that
 * harness provides M2_PG_HOST. Two layers are exercised:
 *   service  the canonical Mission layer with the psql-backed store, as service_role, so every M1 trigger, grant and
 *            SECURITY DEFINER function participates exactly as in production;
 *   routes   the actual Next route handlers with the actual guards (owner session via a mocked Firebase verifier,
 *            exact Origin, session-bound CSRF, the missions machine credential), wired to the same database.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueCsrfToken } from "@/lib/server/csrf";
import { pgConnFromEnv, pgMissionStore, runSql, type PgConn } from "./pg-store.test-helper";
import { FOUNDER, type Principal } from "./principal";
import * as svc from "./service";
import type { MissionStore } from "./store";
import type { MissionRow } from "./types";
import { __setMissionStoreForTests } from "./http";

const { sessionVerifier } = vi.hoisted(() => ({ sessionVerifier: vi.fn() }));
vi.mock("@/lib/firebase-admin", async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));

const conn = pgConnFromEnv();
const TENANT = "11111111-1111-1111-1111-111111111111";
const JOB = "a0000000-0000-4000-8000-000000000001";
const OTHER_TENANT_JOB = "a0000000-0000-4000-8000-000000000002";
const CHANNEL = "b0000000-0000-4000-8000-000000000001";
const SYNTH = "c0000000-0000-4000-8000-000000000001";
const PLAIN_MSG = "c0000000-0000-4000-8000-000000000002";
const GATE = "d0000000-0000-4000-8000-000000000001";
const LEAD = "e0000000-0000-4000-8000-000000000001";
const OTHER_TENANT_MISSION = "f0000000-0000-4000-8000-000000000001";

const agent = (id: string): Principal => ({ kind: "agent", actor: id, actorKind: "agent" });
const CRIT = [{ id: "c1", text: "the report exists" }];

describe.skipIf(!conn)("M2 Mission layer on real M1", () => {
  const c = conn as PgConn;
  let store: MissionStore;
  const ctx = (principal: Principal) => ({ store, tenantId: TENANT, principal });
  beforeAll(() => { store = pgMissionStore(c); });

  async function mk(principal: Principal = FOUNDER, over: Record<string, unknown> = {}): Promise<MissionRow> {
    const r = await svc.createMission(ctx(principal), { objective: "ship the thing", owner: "ramon", ownerKind: "human", successCriteria: CRIT, ...over });
    if (!r.ok) throw new Error(`create failed: ${r.code} ${r.message}`);
    return r.data;
  }
  async function to(m: MissionRow, state: string, p: Principal = FOUNDER) {
    const r = await svc.transitionMission(ctx(p), m.id, { to: state });
    if (!r.ok) throw new Error(`${m.state}->${state}: ${r.code} ${r.message}`);
    return r.data;
  }
  async function toCompleted(m: MissionRow, exec: Principal = FOUNDER) {
    await to(m, "plan"); await to(m, "approved"); await to(m, "executing", exec); await to(m, "reviewing", exec);
    return to(m, "completed", exec);
  }

  // ── founder lifecycle and verification ──
  it("founder: create -> ... -> completed, evidence, verify via the verify path; events attribute ramon/human", async () => {
    const m = await mk();
    expect(m.created_by).toBe("ramon");
    expect(m.created_by_kind).toBe("human");
    await toCompleted(m);
    const ev = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" });
    expect(ev.ok && ev.data.resolution).toBe("resolved");
    const v = await svc.verifyMission(ctx(FOUNDER), m.id, { note: "checked" });
    expect(v.ok && v.data.state).toBe("verified");
    const d = await svc.getMission(ctx(FOUNDER), m.id);
    expect(d.ok).toBe(true);
    if (d.ok) {
      const last = d.data.events[d.data.events.length - 1];
      expect([last.kind, last.from_state, last.to_state, last.actor, last.actor_kind]).toEqual(["state_changed", "completed", "verified", "ramon", "human"]);
      expect(last.detail).toEqual({ note: "checked", authority: "founder_session" });
    }
  });

  it("the generic transition can never reach verified, not even for the founder", async () => {
    const m = await mk(); await toCompleted(m);
    await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" });
    const r = await svc.transitionMission(ctx(FOUNDER), m.id, { to: "verified" });
    expect(!r.ok && [r.status, r.code]).toEqual([403, "verify_route_only"]);
    const after = await store.getMission(TENANT, m.id);
    expect(after.ok && after.data?.state).toBe("completed");
  });

  it("an agent principal cannot verify through verifyMission (defense in depth behind the owner-only route)", async () => {
    const m = await mk(FOUNDER, { agentIds: ["nova"] }); await toCompleted(m);
    await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" });
    for (const p of [agent("nova"), agent("atlas")]) {
      const r = await svc.verifyMission(ctx(p), m.id, {});
      expect(!r.ok && [r.status, r.code]).toEqual([403, "founder_only"]);
    }
    const after = await store.getMission(TENANT, m.id);
    expect(after.ok && after.data?.state).toBe("completed");
  });

  it("verification still needs per-criterion evidence (M1 MI009 surfaces as 409)", async () => {
    const m = await mk(); await toCompleted(m);
    const r = await svc.verifyMission(ctx(FOUNDER), m.id, {});
    expect(!r.ok && [r.status, r.code]).toEqual([409, "MI009"]);
  });

  it("verify refuses anything not completed", async () => {
    const m = await mk(); await to(m, "plan");
    const r = await svc.verifyMission(ctx(FOUNDER), m.id, {});
    expect(!r.ok && [r.status, r.code]).toEqual([409, "MI006"]);
  });

  // ── agent policy ──
  it("agent: may create a mission it owns or the founder owns, never one led by another agent", async () => {
    expect((await svc.createMission(ctx(agent("nova")), { objective: "x", owner: "nova", ownerKind: "agent" })).ok).toBe(true);
    expect((await svc.createMission(ctx(agent("nova")), { objective: "x", owner: "ramon", ownerKind: "human" })).ok).toBe(true);
    const r = await svc.createMission(ctx(agent("nova")), { objective: "x", owner: "atlas", ownerKind: "agent" });
    expect(!r.ok && [r.status, r.code]).toEqual([403, "founder_only"]);
    const created = await svc.createMission(ctx(agent("nova")), { objective: "x", owner: "nova", ownerKind: "agent" });
    expect(created.ok && [created.data.created_by, created.data.created_by_kind]).toEqual(["nova", "agent"]);
  });

  it("agent participant runs the execution loop; approval, cancel and verify stay founder-only", async () => {
    const nova = agent("nova");
    const m = await mk(FOUNDER, { agentIds: ["nova"] });
    await to(m, "plan", nova);
    const approve = await svc.transitionMission(ctx(nova), m.id, { to: "approved" });
    expect(!approve.ok && [approve.status, approve.code]).toEqual([403, "founder_only"]);
    await to(m, "approved");
    await to(m, "executing", nova); await to(m, "reviewing", nova); await to(m, "executing", nova); await to(m, "reviewing", nova);
    const cancel = await svc.transitionMission(ctx(nova), m.id, { to: "cancelled" });
    expect(!cancel.ok && cancel.code).toBe("founder_only");
    await to(m, "completed", nova);
    const ev = await svc.addLink(ctx(nova), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" });
    expect(ev.ok).toBe(true);
    const d = await svc.getMission(ctx(nova), m.id);
    expect(d.ok && d.data.events.filter((e) => e.actor === "nova" && e.kind === "state_changed").length).toBe(6);
  });

  it("a non-participant agent can read but cannot transition or link", async () => {
    const m = await mk(FOUNDER, { agentIds: ["nova"] });
    const atlas = agent("atlas");
    expect((await svc.getMission(ctx(atlas), m.id)).ok).toBe(true);
    const t = await svc.transitionMission(ctx(atlas), m.id, { to: "plan" });
    expect(!t.ok && t.code).toBe("not_participant");
    const l = await svc.addLink(ctx(atlas), m.id, { targetType: "job", targetId: JOB, relation: "context" });
    expect(!l.ok && l.code).toBe("not_participant");
  });

  it("agents cannot reassign, remove links, or add approval links", async () => {
    const nova = agent("nova");
    const m = await mk(FOUNDER, { agentIds: ["nova"] });
    const ra = await svc.reassignMission(ctx(nova), m.id, { owner: "nova", ownerKind: "agent", agentIds: ["nova"] });
    expect(!ra.ok && ra.code).toBe("founder_only");
    const ap = await svc.addLink(ctx(nova), m.id, { targetType: "pipeline_gate", targetId: GATE, relation: "approval" });
    expect(!ap.ok && ap.code).toBe("founder_only");
    const l = await svc.addLink(ctx(nova), m.id, { targetType: "job", targetId: JOB, relation: "context" });
    expect(l.ok).toBe(true);
    const rm = await svc.removeLink(ctx(nova), m.id, l.ok ? l.data.link.id : "");
    expect(!rm.ok && rm.code).toBe("founder_only");
  });

  it("an agent removed from the team loses participant rights at once", async () => {
    const nova = agent("nova");
    const m = await mk(FOUNDER, { agentIds: ["nova"] });
    const ra = await svc.reassignMission(ctx(FOUNDER), m.id, { owner: "ramon", ownerKind: "human", agentIds: ["atlas"] });
    expect(ra.ok && ra.data.agent_ids).toEqual(["atlas"]);
    const t = await svc.transitionMission(ctx(nova), m.id, { to: "plan" });
    expect(!t.ok && t.code).toBe("not_participant");
  });

  it("reassign validates the registry and is audited (team_changed by ramon)", async () => {
    const m = await mk();
    const bad = await svc.reassignMission(ctx(FOUNDER), m.id, { owner: "ghost", ownerKind: "agent", agentIds: [] });
    expect(!bad.ok && bad.code).toBe("invalid_owner");
    const r = await svc.reassignMission(ctx(FOUNDER), m.id, { owner: "atlas", ownerKind: "agent", agentIds: ["atlas", "nova"] });
    expect(r.ok).toBe(true);
    const d = await svc.getMission(ctx(FOUNDER), m.id);
    const ev = d.ok ? d.data.events.find((e) => e.kind === "team_changed") : undefined;
    expect([ev?.actor, ev?.actor_kind]).toEqual(["ramon", "human"]);
  });

  // ── identity fields in bodies are never read ──
  it("body identity fields are rejected, never honored", async () => {
    const r1 = await svc.createMission(ctx(agent("nova")), { objective: "x", owner: "nova", ownerKind: "agent", createdBy: "ramon", createdByKind: "human" });
    expect(!r1.ok && r1.code).toBe("unknown_fields");
    const m = await mk();
    const r2 = await svc.transitionMission(ctx(agent("nova")), m.id, { to: "plan", actor: "ramon", actor_kind: "human" });
    expect(!r2.ok && r2.code).toBe("unknown_fields");
  });

  // ── tenant scope ──
  it("missions in another tenant do not exist for this layer", async () => {
    for (const r of [
      await svc.getMission(ctx(FOUNDER), OTHER_TENANT_MISSION),
      await svc.transitionMission(ctx(FOUNDER), OTHER_TENANT_MISSION, { to: "plan" }),
      await svc.addLink(ctx(FOUNDER), OTHER_TENANT_MISSION, { targetType: "job", targetId: JOB, relation: "context" }),
    ]) expect(!r.ok && [r.status, r.code]).toEqual([404, "MI004"]);
    const list = await svc.listMissions(ctx(FOUNDER), { limit: "100" });
    expect(list.ok && list.data.missions.some((x) => x.id === OTHER_TENANT_MISSION)).toBe(false);
    const other = await runSql(c, `select state from public.missions where id = '${OTHER_TENANT_MISSION}'`, "postgres");
    expect(other.ok && other.data).toBe("intent");
  });

  it("targets in another tenant do not resolve", async () => {
    const m = await mk();
    const r = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: OTHER_TENANT_JOB, relation: "context" });
    expect(!r.ok && [r.status, r.code]).toEqual([404, "target_not_found"]);
  });

  // ── target resolver ──
  it("resolves every database target type and refuses what does not exist", async () => {
    const m = await mk();
    const cases: [string, string, number | undefined, boolean][] = [
      ["job", JOB, undefined, true], ["chat_channel", CHANNEL, undefined, true], ["chat_message", PLAIN_MSG, undefined, true],
      ["synthesis", SYNTH, undefined, true], ["synthesis", PLAIN_MSG, undefined, false],
      ["synthesis_action", SYNTH, 1, true], ["synthesis_action", SYNTH, 2, false],
      ["pipeline_gate", GATE, undefined, true], ["pipeline_lead", LEAD, undefined, true],
      ["job", "a0000000-0000-4000-8000-0000000000ff", undefined, false],
    ];
    for (const [type, id, index, exists] of cases) {
      const r = await svc.addLink(ctx(FOUNDER), m.id, { targetType: type, targetId: id, ...(index !== undefined ? { targetIndex: index } : {}), relation: "context" });
      expect(r.ok, `${type} ${id} ${index}`).toBe(exists);
      if (!exists) expect(!r.ok && r.status, type).toBe(404);
    }
  });

  it("stores the canonical form: url query/fragment stripped, uuid lower-cased, sha lower-cased", async () => {
    const m = await mk();
    const u = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "url", targetId: "https://Docs.Example.com/report?token=abc&sig=1#frag", relation: "source" });
    expect(u.ok && u.data.link.target_id).toBe("https://docs.example.com/report");
    const j = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB.toUpperCase(), relation: "task" });
    expect(j.ok && j.data.link.target_id).toBe(JOB);
    const g = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "git_commit", targetId: "ABCDEF0123456789ABCDEF0123456789ABCDEF01", relation: "source" });
    expect(g.ok && [g.data.link.target_id, g.data.resolution]).toEqual(["abcdef0123456789abcdef0123456789abcdef01", "format_only"]);
  });

  it("url hygiene rejects credentials, private hosts and odd schemes", async () => {
    const m = await mk();
    for (const bad of ["https://user:pw@example.com/x", "http://localhost/x", "http://10.0.0.5/x", "http://100.118.84.5/x",
      "https://imac.tail59e3bd.ts.net/x", "ftp://example.com/x", "javascript:alert(1)", "https://example.com:8443/x", "http://[::1]/x"]) {
      const r = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "url", targetId: bad, relation: "source" });
      expect(r.ok, bad).toBe(false);
    }
  });

  it("evidence must name an existing criterion and a resolvable target type", async () => {
    const m = await mk();
    const noCrit = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence" });
    expect(!noCrit.ok && noCrit.code).toBe("invalid_criterion");
    const wrongCrit = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c9" });
    expect(!wrongCrit.ok && wrongCrit.code).toBe("MI024");
    const fmtOnly = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "git_commit", targetId: "a".repeat(40), relation: "evidence", criterionId: "c1" });
    expect(!fmtOnly.ok && fmtOnly.code).toBe("unverifiable_evidence");
  });

  it("duplicate live link is a 409; after tombstone it may be re-added", async () => {
    const m = await mk();
    const a = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "context" });
    const dup = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "context" });
    expect(!dup.ok && [dup.status, dup.code]).toEqual([409, "23505"]);
    const rm = await svc.removeLink(ctx(FOUNDER), m.id, a.ok ? a.data.link.id : "");
    expect(rm.ok && rm.data.removed_by).toBe("ramon");
    const again = await svc.removeLink(ctx(FOUNDER), m.id, a.ok ? a.data.link.id : "");
    expect(!again.ok && again.code).toBe("link_not_found");
    expect((await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "context" })).ok).toBe(true);
  });

  it("terminal missions freeze links (M1 MI022)", async () => {
    const m = await mk(); await to(m, "cancelled");
    const r = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "context" });
    expect(!r.ok && [r.status, r.code]).toEqual([409, "MI022"]);
  });

  // ── dependencies ──
  it("dependency: self, cycles of length 2 and 3, non-mission targets and missing missions are refused", async () => {
    const A = await mk(), B = await mk(), C = await mk();
    const dep = (from: MissionRow, target: string) => svc.addLink(ctx(FOUNDER), from.id, { targetType: "mission", targetId: target, relation: "dependency" });
    const self = await dep(A, A.id);
    expect(!self.ok && self.code).toBe("self_dependency");
    expect((await dep(A, B.id)).ok).toBe(true);
    const two = await dep(B, A.id);
    expect(!two.ok && [two.status, two.code]).toEqual([409, "dependency_cycle"]);
    expect((await dep(B, C.id)).ok).toBe(true);
    const three = await dep(C, A.id);
    expect(!three.ok && three.code).toBe("dependency_cycle");
    const missing = await dep(A, "f0000000-0000-4000-8000-0000000000aa");
    expect(!missing.ok && missing.status).toBe(404);
    const crossTenant = await dep(A, OTHER_TENANT_MISSION);
    expect(!crossTenant.ok && crossTenant.status).toBe(404);
    const nonMission = await svc.addLink(ctx(FOUNDER), A.id, { targetType: "job", targetId: JOB, relation: "dependency" });
    expect(!nonMission.ok && nonMission.code).toBe("invalid_dependency");
    // a removed edge no longer counts: tombstone A->B, then B->A is fine
    const links = await store.listLinks(A.id, false);
    const ab = links.ok ? links.data.find((l) => l.relation === "dependency") : undefined;
    expect((await svc.removeLink(ctx(FOUNDER), A.id, ab?.id)).ok).toBe(true);
    expect((await dep(B, A.id)).ok).toBe(true);
  });

  it("dependency race: A->B and B->A added at the same moment never leave a cycle", async () => {
    for (let round = 0; round < 3; round++) {
      const A = await mk(), B = await mk();
      // Force the worst interleaving: both pre-checks run before either insert.
      let waiting = 0; let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      let prechecks = 0;
      const racing: MissionStore = {
        ...store,
        async insertLink(row) {
          if (row.relation === "dependency" && prechecks < 2) { prechecks++; waiting++; if (waiting === 2) release(); await gate; }
          return store.insertLink(row);
        },
      };
      const rctx = { store: racing, tenantId: TENANT, principal: FOUNDER };
      const [x, y] = await Promise.all([
        svc.addLink(rctx, A.id, { targetType: "mission", targetId: B.id, relation: "dependency" }),
        svc.addLink(rctx, B.id, { targetType: "mission", targetId: A.id, relation: "dependency" }),
      ]);
      const live = await runSql(c, `select count(*) from public.mission_links where relation='dependency' and removed_at is null and mission_id in ('${A.id}','${B.id}')`, "postgres");
      expect(Number(live.ok ? live.data : "-1"), `round ${round}`).toBeLessThanOrEqual(1);
      expect([x.ok, y.ok].filter(Boolean).length).toBeLessThanOrEqual(1);
      const withdrawn = await runSql(c, `select count(*) from public.mission_links where relation='dependency' and removed_by='mission-guard' and mission_id in ('${A.id}','${B.id}')`, "postgres");
      expect(Number(withdrawn.ok ? withdrawn.data : "0")).toBeGreaterThanOrEqual(1);
    }
  });

  // ── list ──
  it("list filters by state and owner and pages by ref", async () => {
    const mine = await mk(agent("nova"), { owner: "nova", ownerKind: "agent" });
    const byOwner = await svc.listMissions(ctx(FOUNDER), { owner: "nova", limit: "100" });
    expect(byOwner.ok && byOwner.data.missions.every((x) => x.owner === "nova") && byOwner.data.missions.some((x) => x.id === mine.id)).toBe(true);
    const p1 = await svc.listMissions(ctx(FOUNDER), { limit: "2" });
    expect(p1.ok && p1.data.missions.length).toBe(2);
    const p2 = await svc.listMissions(ctx(FOUNDER), { limit: "2", before: String(p1.ok ? p1.data.nextBefore : "") });
    expect(p2.ok && p2.data.missions.every((x) => x.ref < (p1.ok ? p1.data.missions[1].ref : 0))).toBe(true);
    const bad = await svc.listMissions(ctx(FOUNDER), { state: "done" });
    expect(!bad.ok && bad.status).toBe(422);
  });
});

// ── the real route handlers, real guards, same database ──
describe.skipIf(!conn)("M2 routes on real M1 with real guards", () => {
  const OWNER = "owner_fixture_only";
  const COOKIE = "fixture-session-".repeat(5);
  const ORIGIN = "https://cockpit.example";
  const TOKEN = "fixture-missions-token-0123456789";
  beforeAll(() => __setMissionStoreForTests(pgMissionStore(conn as PgConn)));
  afterAll(() => __setMissionStoreForTests(null));
  beforeEach(() => {
    vi.stubEnv("PARALLAX_OWNER_UID", OWNER);
    vi.stubEnv("PARALLAX_TRUSTED_ORIGINS", ORIGIN);
    vi.stubEnv("PARALLAX_CSRF_SECRET", "fixture-not-a-real-secret-".repeat(3));
    vi.stubEnv("PARALLAX_MISSIONS_AGENT_TOKEN", TOKEN);
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  const founderHeaders = () => {
    const t = issueCsrfToken(COOKIE);
    return { origin: ORIGIN, "content-type": "application/json", cookie: `__session=${COOKIE}`, ...(t.ok ? { "x-parallax-csrf": t.token } : {}) };
  };
  const agentHeaders = (id: string) => ({ "content-type": "application/json", "x-parallax-missions-token": TOKEN, "x-parallax-agent": id });
  async function call(mod: string, method: string, path: string, headers: Record<string, string>, body?: unknown, params: Record<string, string> = {}) {
    const m = await import(`@/app/api/command-center/missions${mod}/route`);
    const req = new NextRequest(`${ORIGIN}/api/command-center/missions${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const res: Response = await m[method](req, { params: Promise.resolve(params) });
    return { status: res.status, json: await res.json() };
  }

  it("end to end: agent drives execution, founder verifies through the owner-only route", async () => {
    const created = await call("", "POST", "", agentHeaders("nova"), { objective: "route e2e", owner: "nova", ownerKind: "agent", successCriteria: CRIT });
    expect(created.status).toBe(201);
    const id = created.json.data.id as string;
    expect([created.json.data.created_by, created.json.data.created_by_kind]).toEqual(["nova", "agent"]);
    const step = (to: string, h: Record<string, string>) => call("/[id]/transition", "POST", `/${id}/transition`, h, { to }, { id });
    expect((await step("plan", agentHeaders("nova"))).status).toBe(200);
    expect((await step("approved", agentHeaders("nova"))).status).toBe(403);
    expect((await step("approved", founderHeaders())).status).toBe(200);
    for (const s of ["executing", "reviewing", "completed"]) expect((await step(s, agentHeaders("nova"))).status).toBe(200);
    const ev = await call("/[id]/links", "POST", `/${id}/links`, agentHeaders("nova"), { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" }, { id });
    expect(ev.status).toBe(201);

    // the agent cannot reach verified by any route
    const viaTransition = await step("verified", agentHeaders("nova"));
    expect([viaTransition.status, viaTransition.json.error.code]).toEqual([403, "verify_route_only"]);
    const viaVerifyWithToken = await call("/[id]/verify", "POST", `/${id}/verify`, agentHeaders("nova"), {}, { id });
    expect([401, 403]).toContain(viaVerifyWithToken.status);
    expect(viaVerifyWithToken.json.error).toBe("denied");
    // a forged body claiming to be Ramon changes nothing
    const forged = await call("/[id]/verify", "POST", `/${id}/verify`, { ...agentHeaders("nova"), "x-ramon-uid": OWNER }, { actor: "ramon", actor_kind: "human", uid: OWNER }, { id });
    expect([401, 403]).toContain(forged.status);
    // an authenticated human who is not the owner is refused
    sessionVerifier.mockResolvedValue({ uid: "someone_else", signInProvider: "password" });
    expect((await call("/[id]/verify", "POST", `/${id}/verify`, founderHeaders(), {}, { id })).status).toBe(403);
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    // owner session without CSRF, and with a foreign Origin, are refused
    const noCsrf = founderHeaders(); delete (noCsrf as Record<string, string>)["x-parallax-csrf"];
    expect((await call("/[id]/verify", "POST", `/${id}/verify`, noCsrf, {}, { id })).status).toBe(403);
    expect((await call("/[id]/verify", "POST", `/${id}/verify`, { ...founderHeaders(), origin: "https://evil.example" }, {}, { id })).status).toBe(403);
    // a shared-PIN custom-token session is not founder authority
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "custom" });
    expect((await call("/[id]/verify", "POST", `/${id}/verify`, founderHeaders(), {}, { id })).status).toBe(401);
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });

    const ok = await call("/[id]/verify", "POST", `/${id}/verify`, founderHeaders(), { note: "looked at it" }, { id });
    expect([ok.status, ok.json.data.state]).toEqual([200, "verified"]);
    const d = await call("/[id]", "GET", `/${id}`, agentHeaders("atlas"), undefined, { id });
    const last = d.json.data.events[d.json.data.events.length - 1];
    expect([last.to_state, last.actor, last.actor_kind]).toEqual(["verified", "ramon", "human"]);
  });

  it("the machine credential needs a registered active canonical agent name", async () => {
    for (const name of ["", "ramon", "Nova", "ghost", "dr-strange", "atlas,nova"]) {
      const r = await call("", "GET", "", { ...agentHeaders(name) });
      expect(r.status, JSON.stringify(name)).toBe(403);
    }
    expect((await call("", "GET", "", agentHeaders("nova"))).status).toBe(200);
  });

  it("founder-only routes have no machine path at all", async () => {
    const created = await call("", "POST", "", founderHeaders(), { objective: "x", owner: "ramon", ownerKind: "human" });
    const id = created.json.data.id as string;
    const link = await call("/[id]/links", "POST", `/${id}/links`, founderHeaders(), { targetType: "job", targetId: JOB, relation: "context" }, { id });
    const linkId = link.json.data.link.id as string;
    expect((await call("/[id]/reassign", "POST", `/${id}/reassign`, agentHeaders("nova"), { owner: "nova", ownerKind: "agent", agentIds: [] }, { id })).json.error).toBe("denied");
    expect((await call("/[id]/links/[linkId]", "DELETE", `/${id}/links/${linkId}`, agentHeaders("nova"), undefined, { id, linkId })).json.error).toBe("denied");
    const rm = await call("/[id]/links/[linkId]", "DELETE", `/${id}/links/${linkId}`, founderHeaders(), undefined, { id, linkId });
    expect([rm.status, rm.json.data.removed_by]).toEqual([200, "ramon"]);
  });

  it("resolve previews a target without writing", async () => {
    const before = await runSql(conn as PgConn, "select count(*) from public.mission_links", "postgres");
    const r = await call("/resolve", "GET", `/resolve?targetType=synthesis_action&targetId=${SYNTH}&targetIndex=1`, agentHeaders("nova"));
    expect([r.status, r.json.data.resolution]).toEqual([200, "resolved"]);
    const miss = await call("/resolve", "GET", `/resolve?targetType=job&targetId=${OTHER_TENANT_JOB}`, founderHeaders());
    expect(miss.status).toBe(404);
    const after = await runSql(conn as PgConn, "select count(*) from public.mission_links", "postgres");
    expect(after.ok && before.ok && after.data).toBe(before.ok ? before.data : "x");
  });
});
