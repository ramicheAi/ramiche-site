/**
 * P06 M2: the production Supabase adapter issues exactly the scoped calls the Mission layer relies on. The SQL
 * semantics are proven against real M1 in missions-db.test.ts; this proves the adapter keeps the tenant filter,
 * calls the M1 functions for state, and only ever tombstones links.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COST_ID_CHUNK, EDGE_PAGE, ID_CHUNK, supabaseMissionStore } from "./store";

type Call = { table?: string; rpc?: string; ops: [string, unknown[]][] };
let rpcData: unknown = { id: "m" };
function recorder() {
  const calls: Call[] = [];
  const chain = (call: Call) => {
    const api: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
        return (...args: unknown[]) => {
          call.ops.push([prop, args]);
          if (prop === "single" || prop === "maybeSingle") return Promise.resolve({ data: null, error: null });
          return api;
        };
      },
    });
    return api;
  };
  const client = {
    from: (table: string) => { const c: Call = { table, ops: [] }; calls.push(c); return chain(c); },
    rpc: (name: string, args: unknown) => {
      const call: Call = { rpc: name, ops: [["args", [args]]] };
      calls.push(call);
      return { single: () => { call.ops.push(["single", []]); return Promise.resolve({ data: rpcData, error: null }); } };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const hasEq = (c: Call, col: string, val: unknown) => c.ops.some(([op, a]) => op === "eq" && a[0] === col && a[1] === val);

describe("supabaseMissionStore", () => {
  it("scopes every mission read and every tenant-bearing target lookup to the tenant", async () => {
    const { client, calls } = recorder();
    const s = supabaseMissionStore(client);
    await s.getMission("T", "id1");
    await s.listMissions({ tenantId: "T", limit: 5 });
    for (const type of ["job", "synthesis", "pipeline_lead", "chat_channel", "chat_message", "mission"] as const) await s.lookupTarget("T", type, "x");
    for (const c of calls) expect(hasEq(c, "tenant_id", "T"), c.table).toBe(true);
    expect(calls.map((c) => c.table)).toEqual(["missions", "missions", "jobs", "messages", "pipeline_leads", "channels", "messages", "missions"]);
  });

  it("changes state only through the M1 SECURITY DEFINER functions", async () => {
    const { client, calls } = recorder();
    const s = supabaseMissionStore(client);
    await s.transition({ id: "m", to: "plan", actor: "ramon", actorKind: "human", detail: {}, expectedFrom: "intent" });
    await s.reassign({ id: "m", owner: "ramon", ownerKind: "human", agentIds: [], actor: "ramon", actorKind: "human" });
    expect(calls.map((c) => c.rpc)).toEqual(["mission_transition", "mission_reassign"]);
    expect(calls.every((c) => c.ops.some(([op]) => op === "single"))).toBe(true);
    expect(calls[0].ops[0][1][0]).toMatchObject({ p_mission_id: "m", p_to_state: "plan", p_actor: "ramon", p_actor_kind: "human", p_expected_from: "intent" });
  });

  it("removes a link only by tombstoning the one live link of that mission", async () => {
    const { client, calls } = recorder();
    const s = supabaseMissionStore(client);
    await s.tombstoneLink({ missionId: "m", linkId: "l", by: "ramon", byKind: "human" });
    const c = calls[0];
    expect(c.table).toBe("mission_links");
    expect(c.ops.map(([op]) => op)).not.toContain("delete");
    const upd = c.ops.find(([op]) => op === "update");
    expect(Object.keys(upd?.[1][0] as object).sort()).toEqual(["removed_at", "removed_by", "removed_by_kind"]);
    expect(hasEq(c, "id", "l") && hasEq(c, "mission_id", "m")).toBe(true);
    expect(c.ops.some(([op, a]) => op === "is" && a[0] === "removed_at" && a[1] === null)).toBe(true);
  });

  /** A fake PostgREST over a sorted edge table: honours gt("id"), order, limit and a server row cap. */
  function pagedClient(serverCap: number, ids: string[], log: (string | null)[], onPage?: (n: number, table: string[]) => void) {
    const table = [...ids].sort();
    return {
      from: () => {
        let gt: string | null = null;
        let page = 0;
        const api: Record<string, unknown> = new Proxy({}, {
          get(_t, prop: string) {
            if (prop === "gt") return (_c: string, v: string) => { gt = v; return api; };
            if (prop === "range") return () => { throw new Error("offset paging must not be used"); };
            if (prop === "limit") return (n: number) => {
              log.push(gt);
              onPage?.(page++, table);
              const rows = table.filter((id) => gt === null || id > gt).slice(0, Math.min(n, serverCap));
              return Promise.resolve({ data: rows.map((id) => ({ id, mission_id: "a", target_id: `t-${id}` })), error: null });
            };
            return () => api;
          },
        });
        return api;
      },
    } as unknown as SupabaseClient;
  }
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `id${String(i).padStart(7, "0")}`);

  it("reads dependency edges to completion by id cursor (a truncated edge set could hide a cycle)", async () => {
    const log: (string | null)[] = [];
    const all = ids(EDGE_PAGE * 2 + 3);
    const r = await supabaseMissionStore(pagedClient(1000, all, log)).dependencyEdges(["a"]);
    expect(r.ok && r.data.map((e) => e.target_id)).toEqual(all.map((id) => `t-${id}`));
    expect(log[0]).toBeNull();
    expect(log[1]).toBe(all[EDGE_PAGE - 1]);
    expect(EDGE_PAGE).toBeLessThanOrEqual(1000);
  });

  it("a server row cap smaller than the page size cannot end the read early", async () => {
    const all = ids(40);
    const r = await supabaseMissionStore(pagedClient(7, all, [])).dependencyEdges(["a"]);
    expect(r.ok && r.data.length).toBe(40);
  });

  it("a row tombstoned between pages cannot make a later live edge disappear", async () => {
    const all = ids(EDGE_PAGE + 10);
    const target = all[EDGE_PAGE + 5];
    // after the first page is read, an earlier row leaves the live set (a concurrent tombstone)
    const r = await supabaseMissionStore(pagedClient(1000, all, [], (n, table) => { if (n === 1) table.splice(3, 1); })).dependencyEdges(["a"]);
    expect(r.ok && r.data.some((e) => e.target_id === `t-${target}`)).toBe(true);
  });

  it("running out of the page budget fails closed instead of returning a partial set", async () => {
    const r = await supabaseMissionStore(pagedClient(1, ids(1000), [])).dependencyEdges(["a"]);
    expect(r.ok).toBe(false);
  });

  it("mission detail links are read to completion by id cursor, then returned in creation order", async () => {
    const all = Array.from({ length: EDGE_PAGE + 7 }, (_, i) => ({ id: `l${String(i).padStart(6, "0")}`, created_at: `2026-10-03T00:00:${String(59 - (i % 60)).padStart(2, "0")}Z` }));
    const seen: (string | null)[] = [];
    const client = {
      from: () => {
        let gt: string | null = null;
        const api: Record<string, unknown> = new Proxy({}, {
          get(_t, prop: string) {
            if (prop === "gt") return (_c: string, v: string) => { gt = v; return api; };
            if (prop === "limit") return (n: number) => {
              seen.push(gt);
              // a server cap of 100, below the requested page size
              return Promise.resolve({ data: all.filter((r) => gt === null || r.id > gt).slice(0, Math.min(n, 100)), error: null });
            };
            return () => api;
          },
        });
        return api;
      },
    } as unknown as SupabaseClient;
    const r = await supabaseMissionStore(client).listLinks("m", true);
    expect(r.ok && r.data.length).toBe(all.length);
    expect(r.ok && r.data.every((x, i, arr) => i === 0 || arr[i - 1].created_at <= x.created_at)).toBe(true);
    expect(seen[0]).toBeNull();
  });

  it("M1 function results are returned as the row itself whether PostgREST sends an object or a one-row array", async () => {
    const args = { id: "m", to: "plan" as const, actor: "ramon", actorKind: "human" as const, detail: {}, expectedFrom: null };
    for (const [shape, expected] of [[{ id: "m" }, true], [[{ id: "m" }], true], [[], false], [[{ id: "a" }, { id: "b" }], false], [null, false], ["x", false]] as const) {
      rpcData = shape;
      const r = await supabaseMissionStore(recorder().client).transition(args);
      expect(r.ok, JSON.stringify(shape)).toBe(expected);
      if (r.ok) expect(r.data).toEqual({ id: "m" });
    }
    rpcData = { id: "m" };
  });

  it("liveMissionIds is tenant-scoped, excludes terminal states and chunks its ids", async () => {
    const { client, calls } = recorder();
    const ids = Array.from({ length: ID_CHUNK + 5 }, (_, i) => `m${i}`);
    await supabaseMissionStore(client).liveMissionIds("T", ids);
    expect(calls.length).toBe(2);
    for (const c of calls) {
      expect(c.table).toBe("missions");
      expect(hasEq(c, "tenant_id", "T")).toBe(true);
      expect(c.ops.some(([op, a]) => op === "not" && a[0] === "state" && a[1] === "in" && a[2] === "(verified,cancelled)")).toBe(true);
      const inIds = c.ops.find(([op]) => op === "in")?.[1][1] as string[];
      expect(inIds.length).toBeLessThanOrEqual(ID_CHUNK);
    }
  });
});

describe("supabaseMissionStore cost reads (M3)", () => {
  it("refuses anything that is not a UUID before querying: no free-text or wildcard pattern can reach ILIKE", async () => {
    for (const bad of ["%", "abcdef12-3456-4abc-8def-0123456789a_", "*", "x", "abcdef12-3456-4abc-8def-0123456789ab,correlation_id.ilike.*"]) {
      const { client, queries } = viewClient([]);
      const r = await supabaseMissionStore(client).eventsForCorrelation("lead", [bad]);
      expect(r.ok, bad).toBe(false);
      expect(queries.length, bad).toBe(0);
    }
  });

  /** Records every query against a fake view and answers with id-cursor pages of the given rows. */
  function viewClient(rows: { id: string }[], cap = 1000) {
    const queries: { table: string; ops: [string, unknown[]][] }[] = [];
    const client = {
      from: (table: string) => {
        const q = { table, ops: [] as [string, unknown[]][] };
        queries.push(q);
        let gt: string | null = null;
        const api: Record<string, unknown> = new Proxy({}, {
          get(_t, prop: string) {
            return (...args: unknown[]) => {
              q.ops.push([prop, args]);
              if (prop === "gt") gt = args[1] as string;
              if (prop === "limit") return Promise.resolve({ data: rows.filter((r) => gt === null || r.id > gt).slice(0, Math.min(args[0] as number, cap)), error: null });
              return api;
            };
          },
        });
        return api;
      },
    } as unknown as SupabaseClient;
    return { client, queries };
  }

  it("reads only the existing shadow-cost view, by exact mission id or exact correlation pair, never writing", async () => {
    const { client, queries } = viewClient([]);
    const s = supabaseMissionStore(client);
    await s.eventsForMission("m1");
    const A = "abcdef12-3456-4abc-8def-0123456789ab", B = "00000000-0000-4000-8000-0000000000ff";
    expect((await s.eventsForCorrelation("lead", [A.toUpperCase(), B])).ok).toBe(true);
    expect(queries.map((q) => q.table)).toEqual(["execution_events_with_shadow_cost", "execution_events_with_shadow_cost"]);
    const opsOf = (i: number) => queries[i].ops.map(([op]) => op);
    for (const i of [0, 1]) for (const w of ["insert", "update", "upsert", "delete", "rpc"]) expect(opsOf(i)).not.toContain(w);
    expect(queries[0].ops).toContainEqual(["eq", ["mission_id", "m1"]]);
    expect(queries[1].ops).toContainEqual(["eq", ["correlation_type", "lead"]]);
    // case-insensitive equality on exactly these UUIDs (lower-cased, validated, no wildcard), never an exact-string in()
    expect(queries[1].ops).toContainEqual(["or", [`correlation_id.ilike.${A},correlation_id.ilike.${B}`]]);
    expect(opsOf(1)).not.toContain("in");
    expect(opsOf(1)).not.toContain("like");
  });

  it("pages to completion by id cursor under a server cap, chunks ids, and fails closed past the page budget", async () => {
    const rows = Array.from({ length: EDGE_PAGE + 9 }, (_, i) => ({ id: `e${String(i).padStart(6, "0")}` }));
    const r = await supabaseMissionStore(viewClient(rows, 100).client).eventsForMission("m");
    expect(r.ok && r.data.length).toBe(rows.length);
    const { client, queries } = viewClient([]);
    const uuids = Array.from({ length: COST_ID_CHUNK * 2 + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    await supabaseMissionStore(client).eventsForCorrelation("job", uuids);
    expect(queries.length).toBe(3);
    expect(ID_CHUNK).toBeGreaterThan(0);
    const many = Array.from({ length: 2000 }, (_, i) => ({ id: `e${String(i).padStart(6, "0")}` }));
    expect((await supabaseMissionStore(viewClient(many, 1).client).eventsForMission("m")).ok).toBe(false);
  });
});

describe("command records are never evidence (M5 audit)", () => {
  it("marks a message in the command channel, or with the shadow kind, and the command channel itself, as notEvidence", async () => {
    const { commandChannelId } = await import("@/lib/command/channel");
    const CH = commandChannelId("T");
    const answer = (data: unknown) => ({
      from: () => {
        const api: Record<string, unknown> = new Proxy({}, { get(_t, prop: string) { return prop === "maybeSingle" ? () => Promise.resolve({ data, error: null }) : () => api; } });
        return api;
      },
    }) as unknown as SupabaseClient;
    const look = (data: unknown, type: "chat_message" | "chat_channel", id = "m1") => supabaseMissionStore(answer(data)).lookupTarget("T", type, id);
    expect(await look({ id: "m1", channel_id: CH, metadata: {} }, "chat_message")).toEqual({ ok: true, data: { type: "chat_message", id: "m1", notEvidence: true } });
    expect(await look({ id: "m1", channel_id: "other", metadata: { kind: "universal_command_shadow" } }, "chat_message")).toEqual({ ok: true, data: { type: "chat_message", id: "m1", notEvidence: true } });
    expect(await look({ id: "m1", channel_id: "other", metadata: { kind: "synthesis" } }, "chat_message")).toEqual({ ok: true, data: { type: "chat_message", id: "m1", notEvidence: false } });
    expect(await look({ id: CH }, "chat_channel", CH)).toEqual({ ok: true, data: { type: "chat_channel", id: CH, notEvidence: true } });
    expect(await look({ id: "c2" }, "chat_channel", "c2")).toEqual({ ok: true, data: { type: "chat_channel", id: "c2", notEvidence: false } });
  });
});
