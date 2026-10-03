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

/** Principals a mis-wired caller could construct. None is the founder; the layer must refuse every one of them. */
const NOT_FOUNDER = [
  { kind: "agent", actor: "triage", actorKind: "agent" },
  { kind: "agent", actor: "archivist", actorKind: "agent" },
  { kind: "founder", actor: "nova", actorKind: "human" },
  { kind: "agent", actor: "ramon", actorKind: "human" },
] as unknown as Principal[];
const CRIT = [{ id: "c1", text: "the report exists" }];

describe.skipIf(!conn)("M2 Mission layer on real M1", () => {
  const c = conn as PgConn;
  let store: MissionStore;
  const ctx = (principal: Principal) => ({ store, tenantId: TENANT, principal });
  beforeAll(() => { store = pgMissionStore(c); });

  async function mk(over: Record<string, unknown> = {}): Promise<MissionRow> {
    const r = await svc.createMission(ctx(FOUNDER), { objective: "ship the thing", owner: "ramon", ownerKind: "human", successCriteria: CRIT, ...over });
    if (!r.ok) throw new Error(`create failed: ${r.code} ${r.message}`);
    return r.data;
  }
  async function to(m: MissionRow, state: string) {
    const r = await svc.transitionMission(ctx(FOUNDER), m.id, { to: state });
    if (!r.ok) throw new Error(`${m.state}->${state}: ${r.code} ${r.message}`);
    return r.data;
  }
  async function toCompleted(m: MissionRow) {
    await to(m, "plan"); await to(m, "approved"); await to(m, "executing"); await to(m, "reviewing");
    return to(m, "completed");
  }
  const count = async (sql: string) => { const r = await runSql(c, sql, "postgres"); return r.ok ? r.data : `ERR ${r.error.message}`; };

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

  it("no non-founder principal can do anything, verify included, and nothing is written (defense in depth)", async () => {
    const m = await mk({ agentIds: ["nova", "triage"] }); await toCompleted(m);
    await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" });
    const before = await count(`select (select count(*) from public.missions)||'/'||(select count(*) from public.mission_links)||'/'||(select count(*) from public.mission_events)`);
    for (const p of NOT_FOUNDER) {
      const results = [
        await svc.verifyMission(ctx(p), m.id, {}),
        await svc.getMission(ctx(p), m.id),
        await svc.listMissions(ctx(p), {}),
        await svc.createMission(ctx(p), { objective: "x", owner: "ramon", ownerKind: "human" }),
        await svc.transitionMission(ctx(p), m.id, { to: "cancelled" }),
        await svc.addLink(ctx(p), m.id, { targetType: "job", targetId: JOB, relation: "context" }),
        await svc.reassignMission(ctx(p), m.id, { owner: "ramon", ownerKind: "human", agentIds: [] }),
      ];
      for (const r of results) expect(!r.ok && [r.status, r.code], JSON.stringify(p)).toEqual([403, "founder_only"]);
    }
    expect(await count(`select (select count(*) from public.missions)||'/'||(select count(*) from public.mission_links)||'/'||(select count(*) from public.mission_events)`)).toBe(before);
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

  // ── founder capabilities ──
  it("founder assigns canonical active agents at creation; aliases, unknown and duplicate ids are refused", async () => {
    const m = await mk({ owner: "atlas", ownerKind: "agent", agentIds: ["triage", "nova"] });
    expect([m.owner, m.owner_kind, m.agent_ids, m.created_by, m.created_by_kind]).toEqual(["atlas", "agent", ["triage", "nova"], "ramon", "human"]);
    for (const agentIds of [["dr-strange"], ["Nova"], ["ghost"], ["nova", "nova"], ["ramon"]]) {
      const r = await svc.createMission(ctx(FOUNDER), { objective: "x", owner: "ramon", ownerKind: "human", agentIds });
      expect(!r.ok && r.code, JSON.stringify(agentIds)).toBe("invalid_team");
    }
  });

  it("founder approves, cancels, and drives every legal transition; events attribute ramon/human", async () => {
    const m = await mk();
    await to(m, "plan"); await to(m, "approved"); await to(m, "executing"); await to(m, "reviewing"); await to(m, "executing");
    await to(m, "reviewing"); await to(m, "cancelled");
    const d = await svc.getMission(ctx(FOUNDER), m.id);
    const steps = d.ok ? d.data.events.filter((e) => e.kind === "state_changed") : [];
    expect(steps.map((e) => e.to_state)).toEqual(["plan", "approved", "executing", "reviewing", "executing", "reviewing", "cancelled"]);
    expect(steps.every((e) => e.actor === "ramon" && e.actor_kind === "human")).toBe(true);
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
  it("forged authority fields in bodies are rejected, never honored", async () => {
    const forged = { actor: "ramon", actor_kind: "human", actorKind: "human", created_by: "ramon", createdBy: "ramon", verified_by: "ramon", verifiedBy: "ramon", uid: "x", role: "owner", tenant_id: "x" };
    for (const [k, v] of Object.entries(forged)) {
      const r1 = await svc.createMission(ctx(FOUNDER), { objective: "x", owner: "ramon", ownerKind: "human", [k]: v });
      expect(!r1.ok && r1.code, `create ${k}`).toBe("unknown_fields");
    }
    const m = await mk(); await toCompleted(m);
    await svc.addLink(ctx(FOUNDER), m.id, { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" });
    for (const k of [...Object.keys(forged), "owner", "ownerKind", "agentIds", "to"]) {
      const t = await svc.transitionMission(ctx(FOUNDER), m.id, { to: "cancelled", [k === "to" ? "expected_from" : k]: "ramon" });
      expect(!t.ok && t.code, `transition ${k}`).toBe("unknown_fields");
      const v = await svc.verifyMission(ctx(FOUNDER), m.id, { [k]: "ramon" });
      expect(!v.ok && v.code, `verify ${k}`).toBe("unknown_fields");
    }
    const after = await store.getMission(TENANT, m.id);
    expect(after.ok && after.data?.state).toBe("completed");
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
    const u = await svc.addLink(ctx(FOUNDER), m.id, { targetType: "url", targetId: "https://Docs.Acme-Corp.com/report?token=abc&sig=1#frag", relation: "source" });
    expect(u.ok && [u.data.link.target_id, u.data.resolution]).toEqual(["https://docs.acme-corp.com/report", "format_only"]);
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
    // Unfetched URLs and static project slugs are not evidence either, however they are spelled.
    for (const [targetType, targetId] of [["url", "https://github.com/ramicheAi/ramiche-site/pull/37"], ["project", "mettle"],
      ["pull_request", "ramicheAi/ramiche-site#37"], ["git_branch", "main"], ["yolo_build", "2026-10-03-nova-thing"], ["firestore_task", "abc"]]) {
      const r = await svc.addLink(ctx(FOUNDER), m.id, { targetType, targetId, relation: "evidence", criterionId: "c1" });
      expect(!r.ok && [r.status, r.code], targetType).toEqual([422, "unverifiable_evidence"]);
      const asContext = await svc.addLink(ctx(FOUNDER), m.id, { targetType, targetId, relation: "context" });
      expect(asContext.ok, `${targetType} as context`).toBe(true);
    }
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

  it("mission detail returns the latest event window and says when older events exist", async () => {
    const m = await mk(); await to(m, "plan"); await to(m, "approved"); await to(m, "executing");
    const small = await svc.getMission(ctx(FOUNDER), m.id);
    expect(small.ok && [small.data.events.length, small.data.eventsTruncated]).toEqual([4, false]);
    for (let i = 0; i < 100; i++) { await to(m, "reviewing"); await to(m, "executing"); }
    const total = await count(`select count(*) from public.mission_events where mission_id = '${m.id}'`);
    expect(Number(total)).toBe(204);
    const big = await svc.getMission(ctx(FOUNDER), m.id);
    expect(big.ok && [big.data.events.length, big.data.eventsTruncated]).toEqual([svc.EVENT_WINDOW, true]);
    if (big.ok) {
      const seqs = big.data.events.map((e) => Number(e.seq));
      expect(seqs.every((x, i) => i === 0 || seqs[i - 1] < x)).toBe(true);
      const maxSeq = await count(`select max(seq) from public.mission_events where mission_id = '${m.id}'`);
      expect(seqs[seqs.length - 1]).toBe(Number(maxSeq));
    }
  }, 60_000);

  // ── list ──
  it("list filters by state and owner and pages by ref", async () => {
    const mine = await mk({ owner: "nova", ownerKind: "agent" });
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
  // Every fleet credential that exists, configured with a VALID value, plus a would-be missions token. M2 must give
  // none of them any Mission authority.
  const FLEET: Record<string, [string, string, string]> = {
    "openclaw-webhook": ["OPENCLAW_CC_WEBHOOK_TOKEN", "authorization", "Bearer fixture-openclaw-bearer-0123456789"],
    push: ["CC_PUSH_SECRET", "x-cc-push-secret", "fixture-push-svc-xxxxxxxxxxxxxxxx"],
    bridge: ["BRIDGE_API_SECRET", "x-bridge-secret", "fixture-bridge-secret-0123456789"],
    cron: ["PARALLAX_CRON_TOKEN", "authorization", "Bearer fixture-cron-bearer-0123456789"],
    vapi: ["PARALLAX_VAPI_WEBHOOK_SECRET", "x-vapi-secret", "fixture-vapi-secret-0123456789"],
    "missions-token": ["PARALLAX_MISSIONS_AGENT_TOKEN", "x-parallax-missions-token", "fixture-missions-token-0123456789"],
  };
  // Several VALID canonical active registry agents, plus no header at all.
  const AGENT_NAMES = ["triage", "archivist", "nova", "atlas", "themis", null] as const;

  beforeAll(() => __setMissionStoreForTests(pgMissionStore(conn as PgConn)));
  afterAll(() => __setMissionStoreForTests(null));
  beforeEach(() => {
    vi.stubEnv("PARALLAX_OWNER_UID", OWNER);
    vi.stubEnv("PARALLAX_TRUSTED_ORIGINS", ORIGIN);
    vi.stubEnv("PARALLAX_CSRF_SECRET", "fixture-not-a-real-secret-".repeat(3));
    for (const [env, , value] of Object.values(FLEET)) vi.stubEnv(env, value.replace(/^Bearer /, ""));
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

  const founderHeaders = (): Record<string, string> => {
    const t = issueCsrfToken(COOKIE);
    return { origin: ORIGIN, "content-type": "application/json", cookie: `__session=${COOKIE}`, ...(t.ok ? { "x-parallax-csrf": t.token } : {}) };
  };
  const machineHeaders = (cred: string, agentName: string | null): Record<string, string> => {
    const [, header, value] = FLEET[cred];
    return { "content-type": "application/json", [header]: value, ...(agentName ? { "x-parallax-agent": agentName } : {}) };
  };
  async function call(mod: string, method: string, path: string, headers: Record<string, string>, body?: unknown, params: Record<string, string> = {}) {
    const m = await import(`@/app/api/command-center/missions${mod}/route`);
    const req = new NextRequest(`${ORIGIN}/api/command-center/missions${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const res: Response = await m[method](req, { params: Promise.resolve(params) });
    return { status: res.status, json: await res.json(), cache: res.headers.get("cache-control") };
  }
  const create = async (body: Record<string, unknown>) => {
    const r = await call("", "POST", "", founderHeaders(), body);
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    return r.json.data as MissionRow;
  };
  const step = (id: string, to: string, h = founderHeaders()) => call("/[id]/transition", "POST", `/${id}/transition`, h, { to }, { id });
  const snapshot = () => runSql(conn as PgConn, `select md5(coalesce((select string_agg(m::text, '|' order by id) from public.missions m), '')
    || coalesce((select string_agg(l::text, '|' order by id) from public.mission_links l), '')
    || coalesce((select string_agg(e::text, '|' order by seq) from public.mission_events e), ''))`, "postgres");

  it("founder holds every approved capability through the real routes", async () => {
    const list = await call("", "GET", "?limit=5", founderHeaders());
    expect(list.status).toBe(200);
    const m = await create({ objective: "route founder", owner: "atlas", ownerKind: "agent", agentIds: ["triage", "nova"], successCriteria: CRIT });
    expect([m.created_by, m.created_by_kind, m.agent_ids]).toEqual(["ramon", "human", ["triage", "nova"]]);
    expect((await call("/[id]", "GET", `/${m.id}`, founderHeaders(), undefined, { id: m.id })).status).toBe(200);
    expect((await call("/resolve", "GET", `/resolve?targetType=synthesis_action&targetId=${SYNTH}&targetIndex=1`, founderHeaders())).json.data.resolution).toBe("resolved");
    for (const s of ["plan", "approved", "executing", "reviewing", "completed"]) expect((await step(m.id, s)).status, s).toBe(200);
    const ctxLink = await call("/[id]/links", "POST", `/${m.id}/links`, founderHeaders(), { targetType: "chat_channel", targetId: CHANNEL, relation: "context" }, { id: m.id });
    expect(ctxLink.status).toBe(201);
    const linkId = ctxLink.json.data.link.id as string;
    const rm = await call("/[id]/links/[linkId]", "DELETE", `/${m.id}/links/${linkId}`, founderHeaders(), undefined, { id: m.id, linkId });
    expect([rm.status, rm.json.data.removed_by]).toEqual([200, "ramon"]);
    expect((await call("/[id]/links", "POST", `/${m.id}/links`, founderHeaders(), { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" }, { id: m.id })).status).toBe(201);
    const generic = await step(m.id, "verified");
    expect([generic.status, generic.json.error.code]).toEqual([403, "verify_route_only"]);
    const v = await call("/[id]/verify", "POST", `/${m.id}/verify`, founderHeaders(), { note: "looked at it" }, { id: m.id });
    expect([v.status, v.json.data.state]).toEqual([200, "verified"]);
    const d = await call("/[id]", "GET", `/${m.id}`, founderHeaders(), undefined, { id: m.id });
    const last = d.json.data.events[d.json.data.events.length - 1];
    expect([last.to_state, last.actor, last.actor_kind, last.detail.authority]).toEqual(["verified", "ramon", "human", "founder_session"]);

    const r = await create({ objective: "reassign + cancel", owner: "ramon", ownerKind: "human" });
    const ra = await call("/[id]/reassign", "POST", `/${r.id}/reassign`, founderHeaders(), { owner: "nova", ownerKind: "agent", agentIds: ["nova", "archivist"] }, { id: r.id });
    expect([ra.status, ra.json.data.owner, ra.json.data.agent_ids]).toEqual([200, "nova", ["nova", "archivist"]]);
    expect((await step(r.id, "cancelled")).json.data.state).toBe("cancelled");
  });

  it("a valid fleet credential with any claimed agent identity gets NO Mission authority, and the name never changes the result", async () => {
    const plan = await create({ objective: "machine target", owner: "ramon", ownerKind: "human", agentIds: ["triage", "archivist", "nova", "atlas", "themis"], successCriteria: CRIT });
    await step(plan.id, "plan");
    const done = await create({ objective: "machine verify target", owner: "triage", ownerKind: "agent", agentIds: ["triage", "archivist", "nova", "atlas", "themis"], successCriteria: CRIT });
    for (const s of ["plan", "approved", "executing", "reviewing", "completed"]) await step(done.id, s);
    const ev = await call("/[id]/links", "POST", `/${done.id}/links`, founderHeaders(), { targetType: "job", targetId: JOB, relation: "context" }, { id: done.id });
    await call("/[id]/links", "POST", `/${done.id}/links`, founderHeaders(), { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" }, { id: done.id });
    const linkId = ev.json.data.link.id as string;

    const ENDPOINTS: [string, string, string, string, unknown, Record<string, string>][] = [
      ["global list", "", "GET", "", undefined, {}],
      ["read by claimed identity", "/[id]", "GET", `/${plan.id}`, undefined, { id: plan.id }],
      ["resolve", "/resolve", "GET", `/resolve?targetType=job&targetId=${JOB}`, undefined, {}],
      ["create", "", "POST", "", { objective: "x", owner: "triage", ownerKind: "agent", agentIds: ["triage"] }, {}],
      ["transition", "/[id]/transition", "POST", `/${done.id}/transition`, { to: "cancelled" }, { id: done.id }],
      ["approve", "/[id]/transition", "POST", `/${plan.id}/transition`, { to: "approved" }, { id: plan.id }],
      ["cancel", "/[id]/transition", "POST", `/${plan.id}/transition`, { to: "cancelled" }, { id: plan.id }],
      ["add link", "/[id]/links", "POST", `/${plan.id}/links`, { targetType: "job", targetId: JOB, relation: "context" }, { id: plan.id }],
      ["remove link", "/[id]/links/[linkId]", "DELETE", `/${done.id}/links/${linkId}`, undefined, { id: done.id, linkId }],
      ["reassign", "/[id]/reassign", "POST", `/${plan.id}/reassign`, { owner: "triage", ownerKind: "agent", agentIds: ["triage"] }, { id: plan.id }],
      ["verify", "/[id]/verify", "POST", `/${done.id}/verify`, {}, { id: done.id }],
      ["verify with forged founder body", "/[id]/verify", "POST", `/${done.id}/verify`, { actor: "ramon", actor_kind: "human", verified_by: "ramon", uid: OWNER, role: "owner" }, { id: done.id }],
    ];

    const before = await snapshot();
    let calls = 0;
    for (const [name, mod, method, path, body, params] of ENDPOINTS) {
      for (const cred of Object.keys(FLEET)) {
        const outcomes = new Set<string>();
        for (const agentName of AGENT_NAMES) {
          const h = { ...machineHeaders(cred, agentName), "x-ramon-uid": OWNER, "x-forwarded-host": "command.parallaxvinc.com" };
          const r = await call(mod, method, path, h, body, params);
          calls++;
          expect([401, 403], `${name} via ${cred} as ${agentName}`).toContain(r.status);
          expect(r.json, `${name} via ${cred} as ${agentName}`).toMatchObject({ error: "denied" });
          expect(r.cache).toBe("no-store");
          outcomes.add(`${r.status} ${JSON.stringify(r.json)}`);
        }
        // Changing the claimed agent (or dropping the header) never changes the authorization result.
        expect(outcomes.size, `${name} via ${cred}: ${[...outcomes].join(" | ")}`).toBe(1);
      }
    }
    expect(calls).toBe(ENDPOINTS.length * Object.keys(FLEET).length * AGENT_NAMES.length);
    // Nothing anywhere changed: no mission, link or event was created, altered or removed.
    expect(await snapshot()).toEqual(before);
    const states = await runSql(conn as PgConn, `select string_agg(state, ',' order by ref) from public.missions where id in ('${plan.id}','${done.id}')`, "postgres");
    expect(states.ok && states.data).toBe("plan,completed");
  });

  it("the owner boundary holds on every mutation route and on reads", async () => {
    const m = await create({ objective: "owner negatives", owner: "ramon", ownerKind: "human", successCriteria: CRIT });
    for (const s of ["plan", "approved", "executing", "reviewing", "completed"]) await step(m.id, s);
    await call("/[id]/links", "POST", `/${m.id}/links`, founderHeaders(), { targetType: "job", targetId: JOB, relation: "evidence", criterionId: "c1" }, { id: m.id });
    const before = await snapshot();
    const verify = (h: Record<string, string>, body: unknown = {}) => call("/[id]/verify", "POST", `/${m.id}/verify`, h, body, { id: m.id });
    const cases: [string, () => Record<string, string>, number[], () => void][] = [
      ["missing auth", () => { const h = founderHeaders(); delete h.cookie; return h; }, [401], () => {}],
      ["wrong uid / non-owner human", founderHeaders, [403], () => sessionVerifier.mockResolvedValue({ uid: "someone_else", signInProvider: "password" })],
      ["revoked or expired session", founderHeaders, [401], () => sessionVerifier.mockResolvedValue(null)],
      ["shared-PIN custom token session", founderHeaders, [401], () => sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "custom" })],
      ["anonymous session", founderHeaders, [401], () => sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "anonymous" })],
      ["missing CSRF", () => { const h = founderHeaders(); delete h["x-parallax-csrf"]; return h; }, [403], () => {}],
      ["invalid CSRF", () => ({ ...founderHeaders(), "x-parallax-csrf": "forged.token.value" }), [403], () => {}],
      ["CSRF from another session", () => { const t = issueCsrfToken("another-session-".repeat(4)); return { ...founderHeaders(), "x-parallax-csrf": t.ok ? t.token : "x" }; }, [403], () => {}],
      ["foreign Origin", () => ({ ...founderHeaders(), origin: "https://cockpit.example.evil" }), [403], () => {}],
      ["missing Origin", () => { const h = founderHeaders(); delete h.origin; return h; }, [403], () => {}],
    ];
    for (const [name, headers, statuses, arrange] of cases) {
      sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
      arrange();
      const r = await verify(headers(), { actor: "ramon", actor_kind: "human", verified_by: "ramon" });
      expect(statuses, `verify: ${name}`).toContain(r.status);
      expect(r.json, name).toMatchObject({ error: "denied" });
      // the same boundary on another founder-only mutation and on a read
      const t = await step(m.id, "cancelled", headers());
      expect([401, 403], `transition: ${name}`).toContain(t.status);
      if (!["missing CSRF", "invalid CSRF", "CSRF from another session", "foreign Origin", "missing Origin"].includes(name)) {
        const g = await call("/[id]", "GET", `/${m.id}`, headers(), undefined, { id: m.id });
        expect([401, 403], `read: ${name}`).toContain(g.status);
      }
    }
    sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    expect(await snapshot()).toEqual(before);
    // Fully authenticated founder + forged identity body: refused as unknown fields, still nothing written.
    const forged = await verify(founderHeaders(), { actor: "triage", actor_kind: "agent", verified_by: "triage", owner: "triage" });
    expect([forged.status, forged.json.error.code]).toEqual([400, "unknown_fields"]);
    expect(await snapshot()).toEqual(before);
    const ok = await verify(founderHeaders(), {});
    expect([ok.status, ok.json.data.state]).toEqual([200, "verified"]);
  });

  it("resolve previews a target without writing", async () => {
    const before = await snapshot();
    const r = await call("/resolve", "GET", `/resolve?targetType=synthesis_action&targetId=${SYNTH}&targetIndex=1`, founderHeaders());
    expect([r.status, r.json.data.resolution]).toEqual([200, "resolved"]);
    const miss = await call("/resolve", "GET", `/resolve?targetType=job&targetId=${OTHER_TENANT_JOB}`, founderHeaders());
    expect(miss.status).toBe(404);
    expect(await snapshot()).toEqual(before);
  });
});
