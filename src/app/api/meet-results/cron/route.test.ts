import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "cron-secret-for-test";
const call = (headers: Record<string, string> = {}) =>
  import("./route").then(({ GET }) => GET(new Request("http://localhost/api/meet-results/cron", { headers })));

describe("GET /api/meet-results/cron — fails closed, never via query string", () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ documents: [] }))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    saved === undefined ? delete process.env.CRON_SECRET : (process.env.CRON_SECRET = saved);
  });

  it("denies every request when CRON_SECRET is unset (no 'skip if not configured')", async () => {
    delete process.env.CRON_SECRET;
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: "Bearer anything" })).status).toBe(401);
  });

  it("denies a missing, wrong or query-string secret when configured", async () => {
    process.env.CRON_SECRET = SECRET;
    expect((await call()).status).toBe(401);
    expect((await call({ authorization: "Bearer wrong" })).status).toBe(401);
    const { GET } = await import("./route");
    const res = await GET(new Request(`http://localhost/api/meet-results/cron?secret=${SECRET}`));
    expect(res.status).toBe(401);
  });

  it("the correct bearer secret is accepted", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).not.toBe(401);
  });
});

describe("real Vercel Cron invocation contract (vercel.json: GET /api/meet-results/cron, no body)", () => {
  const saved = process.env.CRON_SECRET;
  afterEach(() => (saved === undefined ? delete process.env.CRON_SECRET : (process.env.CRON_SECRET = saved)));

  it("accepts exactly what Vercel's own cron invocation sends: GET, 'Authorization: Bearer <CRON_SECRET>', no query string, no body", async () => {
    process.env.CRON_SECRET = SECRET;
    const res = await call({ authorization: `Bearer ${SECRET}` });
    expect(res.status).not.toBe(401);
  });

  it("downstream /api/meet-results persists nothing itself — only this route's own fsPatch calls write Firestore, and those are now behind the same gate", async () => {
    // Documents the actual mutation surface (CC-STAGED-RELEASE-CLOSURE-07 item 1):
    // POST /api/meet-results has no Firestore write of its own (grep confirms this file has
    // none), so a direct unauthenticated call to it cannot persist anything; the only writes
    // (meet-schedules, meet-results) happen inside THIS route, which this test file's other
    // cases prove is fail-closed.
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../route.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/adminDb|\.collection\(|fsPatch|firestore\.googleapis\.com.*PATCH/);
  });
});
