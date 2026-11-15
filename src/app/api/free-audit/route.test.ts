import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ updates: [] as unknown[], existing: null as unknown }));
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (t: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: calls.existing }), single: async () => ({ data: { id: "new" } }) }) }),
      update: (v: unknown) => { calls.updates.push({ t, v }); return { eq: async () => ({}) }; },
      insert: () => Object.assign(Promise.resolve({}), { select: () => ({ single: async () => ({ data: { id: "new" }, error: null }) }) }),
    }),
  }),
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/free-audit", { method: "POST", body: JSON.stringify(body) }));

describe("free-audit never clobbers an existing lead", () => {
  beforeEach(() => { calls.updates.length = 0; });
  it("keeps company, name and opt-out/DNC/call history; only records the request", async () => {
    calls.existing = { id: "L1", meta: { optOut: true, dnc: true, lastCallAt: "2026-11-01", consent: { toCall: false } } };
    const res = await post({ email: "victim@example.com", business: "Attacker Co", name: "x" });
    expect(res.status).toBeLessThan(500);
    const upd = (calls.updates as Array<{ t: string; v: Record<string, unknown> }>).find((u) => u.t === "pipeline_leads")!;
    expect(upd.v).not.toHaveProperty("company");
    expect(upd.v).not.toHaveProperty("name");
    expect(upd.v.meta).toMatchObject({ optOut: true, dnc: true, lastCallAt: "2026-11-01", consent: { toCall: false }, requestedAudit: true });
  });
});
