/**
 * P06 M2 pure checks that run in every `npm test` (no database): the authorization matrix, registry validation,
 * URL hygiene, target id formats, and the founder-only verification invariant. The database-backed suite is
 * missions-db.test.ts (supabase/tests/run-m2-local.sh).
 */
import { describe, expect, it } from "vitest";
import { AGENT_CORE } from "@/lib/agent-registry";
import {
  agentPrincipalFrom, canAddLink, canCreate, canReassign, canRemoveLink, canTransition, FOUNDER, FOUNDER_ACTOR,
  registeredAgentId, type Principal,
} from "./principal";
import * as svc from "./service";
import type { MissionStore } from "./store";
import { resolveTarget } from "./targets";
import { MISSION_STATES, type MissionRow, type MissionState } from "./types";
import { cleanUrl, gitBranch, items, owner, team } from "./validate";

const agent = (id: string): Principal => ({ kind: "agent", actor: id, actorKind: "agent" });
const row = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: "00000000-0000-4000-8000-000000000001", ref: 1, tenant_id: "t", objective: "o", owner: "ramon", owner_kind: "human",
  agent_ids: ["nova"], success_criteria: [{ id: "c1", text: "t" }], deliverables: [], state: "intent",
  created_by: "ramon", created_by_kind: "human", created_at: "", updated_at: "", ...over,
});

describe("authorization matrix", () => {
  const LEGAL: [MissionState, MissionState][] = [
    ["intent", "plan"], ["plan", "approved"], ["approved", "executing"], ["executing", "reviewing"], ["reviewing", "completed"],
    ["completed", "verified"], ["reviewing", "executing"], ["intent", "cancelled"], ["plan", "cancelled"], ["approved", "cancelled"],
    ["executing", "cancelled"], ["reviewing", "cancelled"], ["completed", "cancelled"],
  ];
  const AGENT_OK = new Set(["intent>plan", "approved>executing", "executing>reviewing", "reviewing>executing", "reviewing>completed"]);

  it("no principal, founder included, can request verified through the generic transition", () => {
    for (const from of MISSION_STATES) {
      for (const p of [FOUNDER, agent("nova")]) {
        const d = canTransition(p, row({ state: from }), "verified");
        expect(!d.ok && d.code).toBe("verify_route_only");
      }
    }
  });

  it("agent participants get exactly the execution loop; everything else is founder-only", () => {
    for (const [from, to] of LEGAL) {
      if (to === "verified") continue;
      expect(canTransition(FOUNDER, row({ state: from }), to).ok).toBe(true);
      expect(canTransition(agent("nova"), row({ state: from }), to).ok, `${from}>${to}`).toBe(AGENT_OK.has(`${from}>${to}`));
      expect(canTransition(agent("atlas"), row({ state: from }), to).ok, `non-participant ${from}>${to}`).toBe(false);
    }
  });

  it("an agent owner counts as a participant; a human-owned mission's owner name does not make an agent one", () => {
    expect(canTransition(agent("atlas"), row({ owner: "atlas", owner_kind: "agent", agent_ids: [] }), "plan").ok).toBe(true);
    expect(canTransition(agent("atlas"), row({ owner: "atlas", owner_kind: "human", agent_ids: [] }), "plan").ok).toBe(false);
  });

  it("create / link / remove / reassign", () => {
    expect(canCreate(agent("nova"), "nova", "agent").ok).toBe(true);
    expect(canCreate(agent("nova"), FOUNDER_ACTOR, "human").ok).toBe(true);
    expect(canCreate(agent("nova"), "atlas", "agent").ok).toBe(false);
    expect(canAddLink(agent("nova"), row(), "evidence").ok).toBe(true);
    expect(canAddLink(agent("nova"), row(), "approval").ok).toBe(false);
    expect(canAddLink(agent("atlas"), row(), "context").ok).toBe(false);
    expect(canRemoveLink(agent("nova")).ok).toBe(false);
    expect(canReassign(agent("nova")).ok).toBe(false);
    for (const d of [canCreate(FOUNDER, "atlas", "agent"), canAddLink(FOUNDER, row(), "approval"), canRemoveLink(FOUNDER), canReassign(FOUNDER)]) expect(d.ok).toBe(true);
  });
});

describe("agent identity", () => {
  it("only canonical active registry ids; never the founder, an alias, a case variant or junk", () => {
    expect(registeredAgentId("nova")).toBe("nova");
    for (const bad of ["ramon", "Nova", "dr-strange", "ghost", "", " nova", "nova,atlas", 42, null]) expect(registeredAgentId(bad)).toBeNull();
    expect(registeredAgentId("drstrange")).toBe("drstrange");
  });
  it("no registered agent can ever be named like the founder", () => {
    for (const a of AGENT_CORE) {
      expect(a.id).not.toBe(FOUNDER_ACTOR);
      expect(a.aliases).not.toContain(FOUNDER_ACTOR);
    }
  });
  it("the agent principal is always kind agent and comes only from the header", () => {
    const p = agentPrincipalFrom(new Headers({ "x-parallax-agent": "nova" }));
    expect(p).toEqual({ kind: "agent", actor: "nova", actorKind: "agent" });
    expect(agentPrincipalFrom(new Headers({}))).toBeNull();
    expect(agentPrincipalFrom(new Headers({ "x-parallax-agent": "ramon" }))).toBeNull();
  });
});

describe("validation", () => {
  it("owner and team", () => {
    expect(owner("ramon", "human").ok).toBe(true);
    expect(owner("someone", "human").ok).toBe(false);
    expect(owner("ramon", "agent").ok).toBe(false);
    expect(owner("nova", "agent").ok).toBe(true);
    expect(owner("nova", "system").ok).toBe(false);
    expect(team(["nova", "atlas"]).ok).toBe(true);
    expect(team(["nova", "nova"]).ok).toBe(false);
    expect(team(["ghost"]).ok).toBe(false);
    expect(team(Array.from({ length: 25 }, () => "nova")).ok).toBe(false);
  });
  it("items match the M1 shape exactly", () => {
    expect(items([{ id: "c1", text: " ok " }], "x")).toEqual({ ok: true, value: [{ id: "c1", text: "ok" }] });
    for (const bad of [[{ id: "c1" }], [{ id: "C1", text: "t" }], [{ id: "c1", text: "t", extra: 1 }], [{ id: "c1", text: "t" }, { id: "c1", text: "u" }], [{ id: "c1", text: "x".repeat(501) }], "nope"]) {
      expect(items(bad, "x").ok, JSON.stringify(bad).slice(0, 40)).toBe(false);
    }
  });
  it("url hygiene", () => {
    expect(cleanUrl("https://example.com/a/b?x=1#y")).toEqual({ ok: true, value: "https://example.com/a/b" });
    expect(cleanUrl("https://example.com./a")).toEqual({ ok: true, value: "https://example.com/a" });
    for (const bad of ["https://u:p@example.com", "http://127.0.0.1/", "http://192.168.1.4/", "http://172.20.0.1/", "http://169.254.169.254/latest",
      "http://100.96.20.21/", "https://box.local/", "http://localhost./x", "http://imac/x", "http://c02yw21cjwf2/",
      "http://ramons-macbook-pro.tail59e3bd.ts.net./", "http://foo.ts.net./a", "http://router.lan/", "http://nas.home.arpa/",
      "http://198.18.0.1/", "http://224.0.0.1/", "http://203.0.113.5/", "http://0x7f.1/", "http://2130706433/", "http://127.0.0.1./", "https://x.internal/", "https://imac.tail59e3bd.ts.net/", "file:///etc/passwd", "https://example.com:444/", "notaurl"]) {
      expect(cleanUrl(bad).ok, bad).toBe(false);
    }
  });
  it("git branch names", () => {
    for (const ok of ["main", "p06/mission-m2", "feature/a.b_c"]) expect(gitBranch(ok), ok).toBe(true);
    for (const bad of ["", "/x", "x/", "a..b", "a//b", ".hidden", "x/.y", "x.lock", "-x", "x y", "x~1"]) expect(gitBranch(bad), bad).toBe(false);
  });
});

/** A store that fails loudly if anything is called: proves a refusal happened before any storage access. */
const untouchable: MissionStore = new Proxy({} as MissionStore, { get: (_t, k) => () => { throw new Error(`store.${String(k)} must not be called`); } });

describe("refusals happen before storage", () => {
  const ctx = (principal: Principal) => ({ store: untouchable, tenantId: "t", principal });
  it("agent verify is refused without touching storage", async () => {
    const r = await svc.verifyMission(ctx(agent("nova")), "00000000-0000-4000-8000-000000000001", {});
    expect(!r.ok && r.code).toBe("founder_only");
  });
  it("agent reassign / remove link are refused without touching storage", async () => {
    const a = await svc.reassignMission(ctx(agent("nova")), "00000000-0000-4000-8000-000000000001", { owner: "nova", ownerKind: "agent", agentIds: [] });
    expect(!a.ok && a.code).toBe("founder_only");
    const b = await svc.removeLink(ctx(agent("nova")), "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002");
    expect(!b.ok && b.code).toBe("founder_only");
  });
  it("unknown body fields and malformed ids are refused without touching storage", async () => {
    const r = await svc.createMission(ctx(FOUNDER), { objective: "x", owner: "ramon", ownerKind: "human", created_by: "nova" });
    expect(!r.ok && r.code).toBe("unknown_fields");
    const g = await svc.getMission(ctx(FOUNDER), "not-a-uuid");
    expect(!g.ok && g.status).toBe(404);
  });
});

describe("dependency withdrawal failure fails loud", () => {
  it("a cycle found after insert whose withdrawal keeps failing returns a distinct 502, after one retry", async () => {
    const M = "00000000-0000-4000-8000-000000000001", T = "00000000-0000-4000-8000-000000000002";
    let rechecks = 0, tombstones = 0;
    const store = {
      getMission: async () => ({ ok: true, data: row({ id: M }) }),
      lookupTarget: async () => ({ ok: true, data: { type: "mission", id: T } }),
      // first walk (pre-check) finds nothing; the post-insert walk finds T -> M
      dependencyEdges: async () => ({ ok: true, data: rechecks++ === 0 ? [] : [{ mission_id: T, target_id: M }] }),
      insertLink: async () => ({ ok: true, data: { id: "00000000-0000-4000-8000-0000000000aa" } }),
      tombstoneLink: async () => { tombstones++; return { ok: false, error: { code: "MI022", message: "frozen" } }; },
    } as unknown as MissionStore;
    const r = await svc.addLink({ store, tenantId: "t", principal: FOUNDER }, M, { targetType: "mission", targetId: T, relation: "dependency" });
    expect(!r.ok && [r.status, r.code]).toEqual([502, "dependency_cycle_unwithdrawn"]);
    expect(tombstones).toBe(2);
  });
});

describe("target formats (no database needed)", () => {
  const t = (type: Parameters<typeof resolveTarget>[2], id: unknown, index?: unknown) => resolveTarget(untouchable, "t", type, id, index);
  it("format-only targets are canonicalized or refused", async () => {
    expect(await t("pull_request", "ramicheAi/ramiche-site#37")).toMatchObject({ ok: true, target: { resolution: "format_only" } });
    expect((await t("pull_request", "#37")).ok).toBe(false);
    expect((await t("git_commit", "abc1234")).ok).toBe(false);
    expect((await t("yolo_build", "2026-10-03-nova-thing")).ok).toBe(true);
    expect((await t("yolo_build", "../etc")).ok).toBe(false);
    expect((await t("firestore_task", "a/b")).ok).toBe(false);
    expect((await t("project", "mettle")).ok).toBe(true);
    expect((await t("project", "nope")).ok).toBe(false);
  });
  it("database targets need a uuid before any lookup, and index only on synthesis_action", async () => {
    expect((await t("job", "1; drop table jobs")).ok).toBe(false);
    expect((await t("job", "00000000-0000-4000-8000-000000000001", 1)).ok).toBe(false);
  });
});
