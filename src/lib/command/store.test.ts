/** P06 M5: the command store adapter issues only tenant-scoped reads/writes on existing tables. */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseCommandStore } from "./store";

type Call = { table: string; ops: [string, unknown[]][] };
function recorder(answers: Record<string, unknown[]> = {}) {
  const calls: Call[] = [];
  const client = {
    from: (table: string) => {
      const c: Call = { table, ops: [] }; calls.push(c);
      const next = () => (answers[table]?.shift() ?? { data: null, error: null });
      const api: Record<string, unknown> = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(next());
          return (...args: unknown[]) => {
            c.ops.push([prop, args]);
            if (prop === "single" || prop === "maybeSingle") return Promise.resolve(next());
            return api;
          };
        },
      });
      return api;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}
const has = (c: Call, op: string, ...args: unknown[]) => c.ops.some(([o, a]) => o === op && JSON.stringify(a.slice(0, args.length)) === JSON.stringify(args));

describe("supabaseCommandStore", () => {
  it("finds the tenant's command channel by slug, creating it once as a private channel; a concurrent create re-reads", async () => {
    const { client, calls } = recorder({ channels: [{ data: null, error: null }, { data: null, error: { code: "23505", message: "dup" } }, { data: { id: "ch1" }, error: null }] });
    const r = await supabaseCommandStore(client).commandChannel("T");
    expect(r).toEqual({ ok: true, data: "ch1" });
    expect(calls.map((c) => c.table)).toEqual(["channels", "channels", "channels"]);
    expect(has(calls[0], "eq", "tenant_id", "T") && has(calls[0], "eq", "slug", "universal-command")).toBe(true);
    const ins = calls[1].ops.find(([o]) => o === "insert")?.[1][0] as Record<string, unknown>;
    expect(ins).toMatchObject({ tenant_id: "T", slug: "universal-command", type: "channel", is_private: true });
    const other = recorder({ channels: [{ data: null, error: null }, { data: null, error: { code: "42501", message: "denied" } }] });
    expect((await supabaseCommandStore(other.client).commandChannel("T")).ok).toBe(false);
  });

  it("stores a command as a founder (user) message in the tenant, and reads it back only within the tenant", async () => {
    const { client, calls } = recorder({ messages: [{ data: { id: "m1" }, error: null }, { data: null, error: null }] });
    const s = supabaseCommandStore(client);
    await s.insertCommand({ tenantId: "T", channelId: "ch1", content: "fix it", metadata: { kind: "universal_command_shadow" } });
    const ins = calls[0].ops.find(([o]) => o === "insert")?.[1][0] as Record<string, unknown>;
    expect(ins).toEqual({ tenant_id: "T", channel_id: "ch1", content: "fix it", sender_type: "user", sender_user_id: "00000000-0000-0000-0000-000000000001", status: "sent", metadata: { kind: "universal_command_shadow" } });
    await s.getCommand("T", "m1");
    expect(has(calls[1], "eq", "tenant_id", "T") && has(calls[1], "eq", "id", "m1")).toBe(true);
    for (const c of calls) expect(c.ops.map(([o]) => o)).not.toContain("update");
    for (const c of calls) expect(c.ops.map(([o]) => o)).not.toContain("delete");
  });

  it("linked missions: live chat_message links to this command, missions filtered to the tenant", async () => {
    const { client, calls } = recorder({
      mission_links: [{ data: [{ mission_id: "a", relation: "source" }, { mission_id: "b", relation: "context" }], error: null }],
      missions: [{ data: [{ id: "a", ref: 3, state: "intent" }], error: null }],
    });
    const r = await supabaseCommandStore(client).linkedMissions("T", "m1");
    expect(r).toEqual({ ok: true, data: [{ id: "a", ref: 3, state: "intent", relation: "source" }] });   // b is not in this tenant
    expect(has(calls[0], "eq", "target_type", "chat_message") && has(calls[0], "eq", "target_id", "m1") && has(calls[0], "is", "removed_at", null)).toBe(true);
    expect(has(calls[1], "eq", "tenant_id", "T")).toBe(true);
  });
});
