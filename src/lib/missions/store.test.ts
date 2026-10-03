/**
 * P06 M2: the production Supabase adapter issues exactly the scoped calls the Mission layer relies on. The SQL
 * semantics are proven against real M1 in missions-db.test.ts; this proves the adapter keeps the tenant filter,
 * calls the M1 functions for state, and only ever tombstones links.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EDGE_PAGE, supabaseMissionStore } from "./store";

type Call = { table?: string; rpc?: string; ops: [string, unknown[]][] };
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
    rpc: (name: string, args: unknown) => { calls.push({ rpc: name, ops: [["args", [args]]] }); return Promise.resolve({ data: {}, error: null }); },
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

  it("reads dependency edges to completion across pages (a truncated edge set could hide a cycle)", async () => {
    const ranges: [number, number][] = [];
    const page = (n: number, off: number) => Array.from({ length: n }, (_, i) => ({ mission_id: "a", target_id: `t${off + i}` }));
    const client = {
      from: () => {
        const api: Record<string, unknown> = new Proxy({}, {
          get(_t, prop: string) {
            if (prop === "range") return (from: number, to: number) => {
              ranges.push([from, to]);
              const n = ranges.length === 1 ? EDGE_PAGE : ranges.length === 2 ? EDGE_PAGE : 3;
              return Promise.resolve({ data: page(n, from), error: null });
            };
            return () => api;
          },
        });
        return api;
      },
    } as unknown as SupabaseClient;
    const r = await supabaseMissionStore(client).dependencyEdges(["a"]);
    expect(r.ok && r.data.length).toBe(EDGE_PAGE * 2 + 3);
    expect(ranges).toEqual([[0, EDGE_PAGE - 1], [EDGE_PAGE, 2 * EDGE_PAGE - 1], [2 * EDGE_PAGE, 3 * EDGE_PAGE - 1]]);
    expect(EDGE_PAGE).toBeLessThanOrEqual(1000);
  });
});
