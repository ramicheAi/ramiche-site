/**
 * P06 M2 pure checks that run in every `npm test` (no database): founder-only authority, registry validation,
 * URL hygiene, target id formats, and the founder-only verification invariant. The database-backed suite is
 * missions-db.test.ts (supabase/tests/run-m2-local.sh).
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { AGENT_CORE } from "@/lib/agent-registry";
import { canTransition, FOUNDER, FOUNDER_ACTOR, isFounder, registeredAgentId, type Principal } from "./principal";
import * as svc from "./service";
import type { MissionStore } from "./store";
import { resolveTarget } from "./targets";
import { MISSION_STATES, type MissionRow } from "./types";
import { cleanUrl, gitBranch, items, owner, pathDelimiterFree, team, text } from "./validate";

const row = (over: Partial<MissionRow> = {}): MissionRow => ({
  id: "00000000-0000-4000-8000-000000000001", ref: 1, tenant_id: "t", objective: "o", owner: "ramon", owner_kind: "human",
  agent_ids: ["nova"], success_criteria: [{ id: "c1", text: "t" }], deliverables: [], state: "intent",
  created_by: "ramon", created_by_kind: "human", created_at: "", updated_at: "", ...over,
});

/** Shapes a buggy or hostile caller might build. None is the founder; every operation must refuse all of them. */
const NOT_FOUNDER = [
  { kind: "agent", actor: "triage", actorKind: "agent" },
  { kind: "agent", actor: "ramon", actorKind: "human" },
  { kind: "founder", actor: "triage", actorKind: "human" },
  { kind: "founder", actor: "ramon", actorKind: "agent" },
  { kind: "service", actor: "service:missions", actorKind: "system" },
  null,
] as unknown as Principal[];

describe("authority: founder only", () => {
  it("isFounder accepts exactly the founder principal", () => {
    expect(isFounder(FOUNDER)).toBe(true);
    for (const p of NOT_FOUNDER) expect(isFounder(p), JSON.stringify(p)).toBe(false);
  });

  it("the generic transition can never reach verified, for anyone, from any state", () => {
    const d = canTransition("verified");
    expect(!d.ok && d.code).toBe("verify_route_only");
    for (const to of MISSION_STATES) if (to !== "verified") expect(canTransition(to).ok, to).toBe(true);
  });
});

describe("agent registry validation (for owner/team the founder assigns)", () => {
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
});

describe("validation", () => {
  it("character limits count code points, like Postgres length()", () => {
    expect(text("😀".repeat(500), "x", 500).ok).toBe(true);
    expect(text("😀".repeat(501), "x", 500).ok).toBe(false);
    expect(items([{ id: "c1", text: "😀".repeat(300) }], "successCriteria").ok).toBe(true);
    expect(text("界".repeat(2000), "objective", 2000).ok).toBe(true);
  });
  it("free text refuses lone surrogates but keeps real emoji", () => {
    expect(text("ok \ud83d\ude00", "note", 500).ok).toBe(true);
    for (const bad of ["\ud800", "x\udc00", "\ud83d", "a\ud83db"]) expect(text(bad, "note", 500).ok, JSON.stringify(bad)).toBe(false);
  });
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
      "http://198.18.0.1/", "http://localhost.localdomain/", "http://foo.test/", "http://x.example/", "http://x.invalid/",
      "http://abc.onion/", "http://foo.beta.tailscale.net/", "http://192.88.99.1/", "https://example.com/x;token=abc", "https://example.com/x%3Bjsessionid=secret", "https://example.com/x%3bjsessionid=secret",
      "https://example.com/x%3Ftoken=1", "https://example.com/x%23frag", "https://example.com/x%253Bjsessionid=s", "https://example.com/x%25253bs", "https://example.com/x%25%33%42jsessionid=secret",
      "https://example.com/x%25%33%46t=1", "https://example.com/x%25%32%33f", "https://example.com/x%2525%33%42s", "http://224.0.0.1/", "http://203.0.113.5/", "http://0x7f.1/", "http://2130706433/", "http://127.0.0.1./", "https://x.internal/", "https://imac.tail59e3bd.ts.net/", "file:///etc/passwd", "https://example.com:444/", "notaurl"]) {
      expect(cleanUrl(bad).ok, bad).toBe(false);
    }
  });
  it("git branch names are never looser than git itself (differential against git check-ref-format --branch)", () => {
    const corpus = ["main", "HEAD", "head", "HEAD/x", "x/HEAD", "@", "a@b", "@{1}", "x@{u}", "-x", "x-", "a.b", ".a", "a.", "a..b",
      "a/b", "/a", "a/", "a//b", "a/.b", "a/b.", "x.lock", "x.lock/y", "y/x.lock", "a.lock.b", "lock", "a b", "a~b", "a^b", "a:b",
      "a?b", "a*b", "a[b", "a\\b", "feature/A_b-1.2", "p06/mission-m2", "1", "-", "--", "x/-y", "FETCH_HEAD", "ORIG_HEAD", "refs/heads/x"];
    const git = (name: string) => spawnSync("git", ["check-ref-format", "--branch", name], { encoding: "utf8" });
    if (git("main").error) return; // git unavailable in this environment: the explicit cases below still run
    for (const name of corpus) {
      if (gitBranch(name)) expect(git(name).status, `validator accepts "${name}" but git refuses it`).toBe(0);
    }
  });
  it("path delimiter check decodes rather than pattern-matches", () => {
    expect(pathDelimiterFree("/report%2520final")).toBe(true);
    expect(pathDelimiterFree("/a%2Fb/c")).toBe(true);
    // a malformed escape does not switch the check off: the well-formed escapes around it are still decoded
    for (const hidden of ["/a%3Bjsessionid=SECRET%ZZ", "/a%3Ftoken=SECRET/%C0", "/%ZZ%25%33%42x"]) expect(pathDelimiterFree(hidden), hidden).toBe(false);
    // and honest paths with stray or legacy escapes are not refused
    for (const honest of ["/sale-50%25-off", "/caf%E9", "/caf%C3%A9", "/a%20b", "/a%2Fb", "/a%zz", "/bad%E0%A4%A", "/x%", "/100%", "/VOIL%C0", "/%C1rbol", "/%FCber", "/%C0", "/caf%25C3%25A9", "/%E2%82%AC5"]) expect(pathDelimiterFree(honest), honest).toBe(true);
    // lookalikes that normalize to ASCII delimiters, IIS %u escapes, overlong UTF-8
    for (const exotic of [new URL("https://e.x/a\u037Ejsessionid=S").pathname, new URL("https://e.x/a\uFF1Bx").pathname, new URL("https://e.x/a\uFE54x").pathname,
      new URL("https://e.x/a\uFF1Fx").pathname, new URL("https://e.x/a\uFF03x").pathname, "/a%u003Bx", "/a%u%30%30%33%42x", "/a%C0%BBx", "/a%E0%80%BBx", "/a%25C0%25BBx",
      "/a%EF%BC%9B%ZZ", "/caf%E9%EF%BC%9Bjsessionid=S", "/a%EF%BC%9Bx%E9", "/a%F8%80%80%80%BBx", "/a%FC%80%80%80%80%BBx",
      "/a%EF%BC%259B", "/a%EF%25BC%9B", "/a%25EF%BC%9B", "/a%EF%BC%25%39B", "/a%C0%25BB", "/a%25C0%BB", "/a%25EF%25BC%259B", "/a%F0%80%80%BBx"]) {
      expect(pathDelimiterFree(exotic), exotic).toBe(false);
    }
    for (const bad of ["/x;y", "/x%3By", "/x%253By", "/x%25%33%42y", "/x%2525%33%42y", "/x%25%32%33", "/x%25%33%46"]) {
      expect(pathDelimiterFree(bad), bad).toBe(false);
    }
    // a path that keeps decoding past the pass budget is refused
    expect(pathDelimiterFree("/x%" + "25".repeat(8) + "41")).toBe(false);
    expect(pathDelimiterFree("/x%" + "25".repeat(2) + "41")).toBe(true);
  });
  it("git branch names", () => {
    for (const ok of ["main", "p06/mission-m2", "feature/a.b_c"]) expect(gitBranch(ok), ok).toBe(true);
    for (const bad of ["", "/x", "x/", "a..b", "a//b", ".hidden", "x/.y", "x.lock", "foo.lock/bar", "a/b.lock/c", "-x", "x y", "x~1", "x@{1}", "HEAD"]) expect(gitBranch(bad), bad).toBe(false);
  });
});

/** A store that fails loudly if anything is called: proves a refusal happened before any storage access. */
const untouchable: MissionStore = new Proxy({} as MissionStore, { get: (_t, k) => () => { throw new Error(`store.${String(k)} must not be called`); } });

describe("every operation refuses a non-founder before storage", () => {
  const M = "00000000-0000-4000-8000-000000000001", L = "00000000-0000-4000-8000-000000000002";
  const ops: [string, (ctx: svc.Ctx) => Promise<{ ok: boolean; code?: string; status?: number }>][] = [
    ["list", (c) => svc.listMissions(c, {})],
    ["get", (c) => svc.getMission(c, M)],
    ["resolve", (c) => svc.previewTarget(c, { targetType: "job", targetId: M })],
    ["create", (c) => svc.createMission(c, { objective: "x", owner: "ramon", ownerKind: "human" })],
    ["transition", (c) => svc.transitionMission(c, M, { to: "plan" })],
    ["approve", (c) => svc.transitionMission(c, M, { to: "approved" })],
    ["cancel", (c) => svc.transitionMission(c, M, { to: "cancelled" })],
    ["verify", (c) => svc.verifyMission(c, M, {})],
    ["reassign", (c) => svc.reassignMission(c, M, { owner: "ramon", ownerKind: "human", agentIds: [] })],
    ["add link", (c) => svc.addLink(c, M, { targetType: "job", targetId: L, relation: "context" })],
    ["remove link", (c) => svc.removeLink(c, M, L)],
  ];
  for (const [name, op] of ops) {
    it(`${name}`, async () => {
      for (const p of NOT_FOUNDER) {
        const r = await op({ store: untouchable, tenantId: "t", principal: p });
        expect([r.ok, r.status, r.code], `${name} ${JSON.stringify(p)}`).toEqual([false, 403, "founder_only"]);
      }
    });
  }
  it("unknown body fields and malformed ids are refused without touching storage, even for the founder", async () => {
    const ctx = { store: untouchable, tenantId: "t", principal: FOUNDER };
    const r = await svc.createMission(ctx, { objective: "x", owner: "ramon", ownerKind: "human", created_by: "nova" });
    expect(!r.ok && r.code).toBe("unknown_fields");
    const g = await svc.getMission(ctx, "not-a-uuid");
    expect(!g.ok && g.status).toBe(404);
  });
});

describe("input bounds that M1 would otherwise reject late", () => {
  const ctx = { store: untouchable, tenantId: "t", principal: FOUNDER };
  const M = "00000000-0000-4000-8000-000000000001";
  it("reassign without agentIds is refused, never read as an empty team", async () => {
    const r = await svc.reassignMission(ctx, M, { owner: "ramon", ownerKind: "human" });
    expect(!r.ok && [r.status, r.code]).toEqual([422, "invalid_team"]);
  });
  it("an ASCII note up to M1's 1000-byte bound is accepted, 1001 is not", async () => {
    const store = { getMission: async () => ({ ok: false, error: { message: "stop here" } }) } as unknown as MissionStore;
    const c = { store, tenantId: "t", principal: FOUNDER };
    const ok = await svc.transitionMission(c, M, { to: "plan", note: "a".repeat(1000) });
    expect(!ok.ok && ok.code).toBe("storage_error"); // passed validation, reached storage
    const big = await svc.transitionMission(c, M, { to: "plan", note: "a".repeat(1001) });
    expect(!big.ok && big.code).toBe("invalid_note");
  });
  it("a note over 1000 UTF-8 bytes is refused before storage even when under 500 characters", async () => {
    for (const note of ["界".repeat(400), "😀".repeat(251)]) {
      const r = await svc.transitionMission(ctx, M, { to: "plan", note });
      expect(!r.ok && [r.status, r.code], `${note.length} chars`).toEqual([422, "invalid_note"]);
      const v = await svc.verifyMission(ctx, M, { note });
      expect(!v.ok && v.code).toBe("invalid_note");
    }
  });
});

describe("dependency withdrawal failure", () => {
  const M = "00000000-0000-4000-8000-000000000001", T = "00000000-0000-4000-8000-000000000002";
  /** Pre-check sees no edges; every later walk sees T -> M. `liveAfterInsert` decides whether M is still live. */
  function racingStore(tombstoneCode: string, liveAfterInsert: boolean) {
    let edgeReads = 0, inserted = false;
    const calls = { tombstones: 0 };
    const store = {
      getMission: async () => ({ ok: true, data: row({ id: M }) }),
      lookupTarget: async () => ({ ok: true, data: { type: "mission", id: T } }),
      liveMissionIds: async (_t: string, ids: string[]) => ({ ok: true, data: ids.filter((id) => id !== M || !inserted || liveAfterInsert) }),
      dependencyEdges: async (ids: string[]) => ({ ok: true, data: edgeReads++ === 0 || !ids.includes(T) ? [] : [{ mission_id: T, target_id: M }] }),
      insertLink: async () => { inserted = true; return { ok: true, data: { id: "00000000-0000-4000-8000-0000000000aa" } }; },
      tombstoneLink: async () => { calls.tombstones++; return { ok: false, error: { code: tombstoneCode, message: "nope" } }; },
    } as unknown as MissionStore;
    return { store, calls };
  }
  const add = (store: MissionStore) => svc.addLink({ store, tenantId: "t", principal: FOUNDER }, M, { targetType: "mission", targetId: T, relation: "dependency" });

  it("a withdrawal that keeps failing for an unknown reason returns a distinct 502, after one retry", async () => {
    const { store, calls } = racingStore("XX000", true);
    const r = await add(store);
    expect(!r.ok && [r.status, r.code]).toEqual([502, "dependency_cycle_unwithdrawn"]);
    expect(calls.tombstones).toBe(2);
  });

  it("if the mission turned terminal (MI022) the frozen edge is inert: no live cycle remains, request refused with 409", async () => {
    const { store } = racingStore("MI022", false);
    const r = await add(store);
    expect(!r.ok && [r.status, r.code]).toEqual([409, "dependency_cycle"]);
  });

  it("MI022 while a live cycle somehow remains still fails loud", async () => {
    const { store } = racingStore("MI022", true);
    const r = await add(store);
    expect(!r.ok && [r.status, r.code]).toEqual([502, "dependency_cycle_unwithdrawn"]);
  });
});

describe("target formats (no database needed)", () => {
  const t = (type: Parameters<typeof resolveTarget>[2], id: unknown, index?: unknown) => resolveTarget(untouchable, "t", type, id, index);
  it("format-only targets are canonicalized or refused", async () => {
    expect(await t("pull_request", "ramicheAi/ramiche-site#37")).toMatchObject({ ok: true, target: { resolution: "format_only" } });
    expect((await t("pull_request", "#37")).ok).toBe(false);
    for (const bad of ["-owner/repo#1", "owner-/repo#1", "owner--name/repo#1", "a".repeat(40) + "/r#1", "owner/./#1", "owner/..#1", "owner/r#0", "owner/r#01", "o/r"]) {
      expect((await t("pull_request", bad)).ok, bad).toBe(false);
    }
    for (const good of ["a/r#1", "ramicheAi/ramiche-site#38", "a-b-c/x.y_z#123", "a".repeat(39) + "/r#1"]) {
      expect((await t("pull_request", good)).ok, good).toBe(true);
    }
    expect((await t("git_commit", "abc1234")).ok).toBe(false);
    expect((await t("yolo_build", "2026-10-03-nova-thing")).ok).toBe(true);
    expect((await t("yolo_build", "../etc")).ok).toBe(false);
    expect((await t("firestore_task", "a/b")).ok).toBe(false);
    for (const reserved of ["__task__", "____", "__x__"]) expect((await t("firestore_task", reserved)).ok, reserved).toBe(false);
    for (const okId of ["abc", "_x_", "__x", "x__", "a__b__c"]) expect((await t("firestore_task", okId)).ok, okId).toBe(true);
    const a = await t("pull_request", "RamicheAi/Ramiche-Site#37"), b = await t("pull_request", "ramicheai/ramiche-site#37");
    expect(a.ok && b.ok && a.target.targetId === b.target.targetId && a.target.targetId === "ramicheai/ramiche-site#37").toBe(true);
    expect((await t("project", "mettle")).ok).toBe(true);
    expect((await t("project", "nope")).ok).toBe(false);
  });
  it("database targets need a uuid before any lookup, and index only on synthesis_action", async () => {
    expect((await t("job", "1; drop table jobs")).ok).toBe(false);
    expect((await t("job", "00000000-0000-4000-8000-000000000001", 1)).ok).toBe(false);
  });
});

describe("missionContext", () => {
  it("only an owner-guard success with a uid becomes the founder; anything else is denied", async () => {
    const { missionContext, __setMissionStoreForTests } = await import("./http");
    __setMissionStoreForTests(untouchable);
    try {
      for (const bad of [null, undefined, {}, { ok: false, uid: "u" }, { ok: true }, { ok: true, uid: "" }, { ok: true, uid: 7 }]) {
        const r = missionContext(bad as never);
        expect(r.ok, JSON.stringify(bad)).toBe(false);
        if (!r.ok) expect(r.response.status).toBe(403);
      }
      const good = missionContext({ ok: true, uid: "owner" });
      expect(good.ok && good.ctx.principal).toEqual(FOUNDER);
    } finally {
      __setMissionStoreForTests(null);
    }
  });
});

describe("missionCosts failure handling (M3)", () => {
  const MID = "00000000-0000-4000-8000-000000000001";
  const base = (over: Partial<MissionStore>) => ({
    getMission: async () => ({ ok: true, data: { id: MID, tenant_id: "t", state: "executing" } }),
    listLinks: async () => ({ ok: true, data: [] }),
    eventsForMission: async () => ({ ok: true, data: [] }),
    eventsForCorrelation: async () => ({ ok: true, data: [] }),
    ...over,
  }) as unknown as MissionStore;
  const run = (store: MissionStore) => svc.missionCosts({ store, tenantId: "t", principal: FOUNDER }, MID);

  it("a cost value the exact parser cannot read is a structured failure, never a guessed total", async () => {
    const bad = { id: "e", mission_id: MID, correlation_type: null, correlation_id: null, provider: "openrouter", model_requested: null, model_reported: null,
      outcome: "ok", usage_quality: "not_reported", input_tokens: null, output_tokens: null, total_tokens: null, direct_cost_usd: "1e-3",
      billing_mode: "unknown", shadow_cost_usd: null, shadow_cost_basis: null };
    const r = await run(base({ eventsForMission: async () => ({ ok: true, data: [bad] }) } as Partial<MissionStore>));
    expect(!r.ok && [r.status, r.code]).toEqual([502, "cost_data_unreadable"]);
  });

  it("any telemetry read failure fails the whole request; no partial total is returned", async () => {
    const link = { id: "l", mission_id: MID, target_type: "job", target_id: "00000000-0000-4000-8000-0000000000aa", removed_at: null };
    const r = await run(base({
      listLinks: async () => ({ ok: true, data: [link] }),
      eventsForCorrelation: async () => ({ ok: false, error: { message: "boom" } }),
    } as unknown as Partial<MissionStore>));
    expect(!r.ok && r.status).toBe(502);
    const r2 = await run(base({ eventsForMission: async () => ({ ok: false, error: { message: "boom" } }) } as unknown as Partial<MissionStore>));
    expect(!r2.ok && r2.status).toBe(502);
  });

  it("linked ids are queried in both canonical spellings", async () => {
    const seen: string[][] = [];
    const link = { id: "l", mission_id: MID, target_type: "pipeline_lead", target_id: "0000000a-0000-4000-8000-0000000000aa", removed_at: null };
    await run(base({
      listLinks: async () => ({ ok: true, data: [link] }),
      eventsForCorrelation: async (_t: string, ids: string[]) => { seen.push(ids); return { ok: true, data: [] }; },
    } as unknown as Partial<MissionStore>));
    expect(seen).toEqual([["0000000a-0000-4000-8000-0000000000aa", "0000000A-0000-4000-8000-0000000000AA"]]);
  });
});
