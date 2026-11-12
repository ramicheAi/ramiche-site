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
