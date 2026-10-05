/**
 * P06 M5: Universal Command records are not chat. The command channel is never listed, and its rows never appear in
 * chat search, the pulse (recent / pinned / unread) or the Decisions candidate scan.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { commandChannelId } from "./channel";

const ops: [string, string, unknown[]][] = [];
function recorder() {
  return {
    from: (table: string) => {
      const api: Record<string, unknown> = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [], error: null, count: 0 });
          return (...args: unknown[]) => { ops.push([table, prop, args]); return api; };
        },
      });
      return api;
    },
  };
}
vi.mock("@/lib/server/protected-mutation", () => ({ guardPrivateRead: async () => ({ ok: true, uid: "o", sessionCookie: "c" }) }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => recorder() }));
vi.mock("@supabase/supabase-js", async (orig) => ({ ...(await orig<object>()), createClient: () => recorder() }));

const TENANT = "11111111-1111-1111-1111-111111111111";
const CMD = commandChannelId(TENANT);
beforeEach(() => {
  ops.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-role");
});
const req = (path: string) => new NextRequest(`https://cockpit.example${path}`) as never;
const messageQueries = () => {
  // group recorded ops into one entry per from("messages") query
  const out: [string, unknown[]][][] = [];
  for (const [table, op, args] of ops) { if (table !== "messages") continue; if (op === "select") out.push([]); out[out.length - 1]?.push([op, args]); }
  return out;
};

describe("Universal Command records stay out of chat", () => {
  it("the command channel id is a deterministic RFC 4122 v5 UUID per tenant", () => {
    expect(CMD).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(commandChannelId(TENANT)).toBe(CMD);
    expect(commandChannelId("22222222-2222-2222-2222-222222222222")).not.toBe(CMD);
  });

  it("chat bootstrap does not list the command channel", async () => {
    const { GET } = await import("@/app/api/command-center/chat/bootstrap/route");
    expect((await GET(req("/api/command-center/chat/bootstrap"))).status).toBe(200);
    expect(ops.filter(([t, op]) => t === "channels" && ["neq", "eq", "not", "in", "filter", "or"].includes(op))).toEqual([["channels", "neq", ["slug", "universal-command"]]]);
  });

  it("chat search excludes command records", async () => {
    const { GET } = await import("@/app/api/command-center/chat/search/route");
    await GET(req("/api/command-center/chat/search?q=mettle"));
    const qs = messageQueries();
    expect(qs.length).toBe(1);
    expect(qs[0]).toContainEqual(["neq", ["channel_id", CMD]]);
  });

  it("pulse excludes command records from recent, pinned and unread", async () => {
    const { GET } = await import("@/app/api/command-center/chat/pulse/route");
    await GET(req("/api/command-center/chat/pulse?since=2026-10-01T00:00:00Z"));
    const qs = messageQueries();
    expect(qs.length).toBe(3);
    for (const q of qs) expect(q).toContainEqual(["neq", ["channel_id", CMD]]);
  });

  it("the chat health sample and the gallery scan exclude command records", async () => {
    const health = await import("@/app/api/command-center/chat/health/route");
    await health.GET(req("/api/command-center/chat/health"));
    expect(messageQueries().some((q) => q.some(([op, a]) => op === "limit" && a[0] === 5) && q.some(([op, a]) => op === "neq" && a[0] === "channel_id" && a[1] === CMD))).toBe(true);
    ops.length = 0;
    const gallery = await import("@/app/api/command-center/gallery/outputs/route");
    await gallery.GET(req("/api/command-center/gallery/outputs"));
    expect(messageQueries()[0]).toContainEqual(["neq", ["channel_id", CMD]]);
  });

  it("the Decisions scan excludes command records, so they cannot crowd out syntheses", async () => {
    const { GET } = await import("@/app/api/command-center/chat/decisions/route");
    await GET(req("/api/command-center/chat/decisions"));
    const qs = messageQueries();
    expect(qs[0]).toContainEqual(["neq", ["channel_id", CMD]]);
  });
});
