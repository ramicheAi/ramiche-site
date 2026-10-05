/** P06 M5: the Universal Command channel is never listed as a chat channel, so no one chats in it. */
import { describe, expect, it, vi } from "vitest";

const ops: [string, string, unknown[]][] = [];
vi.mock("@/lib/server/protected-mutation", () => ({ guardPrivateRead: async () => ({ ok: true, uid: "o", sessionCookie: "c" }) }));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      const api: Record<string, unknown> = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
          return (...args: unknown[]) => { ops.push([table, prop, args]); return api; };
        },
      });
      return api;
    },
  }),
}));

describe("chat bootstrap", () => {
  it("excludes the universal-command channel and nothing else", async () => {
    const { GET } = await import("@/app/api/command-center/chat/bootstrap/route");
    const res = await GET(new Request("https://cockpit.example/api/command-center/chat/bootstrap"));
    expect(res.status).toBe(200);
    const ch = ops.filter(([t]) => t === "channels");
    expect(ch.filter(([, op]) => ["neq", "eq", "not", "in", "filter", "or"].includes(op))).toEqual([["channels", "neq", ["slug", "universal-command"]]]);
  });
});
