import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { run, verifySessionCookie } = vi.hoisted(() => ({ run: vi.fn(), verifySessionCookie: vi.fn() }));
vi.mock("@/lib/server/prospector-daily", () => ({ runProspectorDaily: run }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));

import * as daily from "./daily/route";
import * as cron from "./cron/route";

const SECRET = "cron-secret-for-test";
describe("prospector contract", () => {
  const saved = process.env.PROSPECTOR_CRON_SECRET;
  beforeEach(() => { run.mockReset().mockResolvedValue(new Response("{}")); process.env.PROSPECTOR_CRON_SECRET = SECRET; });
  afterEach(() => (saved === undefined ? delete process.env.PROSPECTOR_CRON_SECRET : (process.env.PROSPECTOR_CRON_SECRET = saved)));

  it("daily has no state-changing GET export (405) and POST is owner-only", async () => {
    expect((daily as Record<string, unknown>).GET).toBeUndefined();
    const res = await (daily.POST as (r: Request) => Promise<Response>)(new Request("http://localhost/api/command-center/prospector/daily", { method: "POST" }));
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(run).not.toHaveBeenCalled();
  });
  it("cron exports POST only", () => {
    expect(Object.keys(cron).filter((k) => ["GET", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([]);
  });
  it("cron requires the secret and fails closed when unset", async () => {
    const mk = (h: Record<string, string>) => cron.POST(new Request("http://localhost/x", { method: "POST", headers: h }));
    expect((await mk({})).status).toBe(401);
    expect((await mk({ "x-cron-secret": "wrong" })).status).toBe(401);
    expect((await mk({ cookie: "__session=owner" })).status).toBe(401);
    delete process.env.PROSPECTOR_CRON_SECRET;
    expect((await mk({ "x-cron-secret": "" })).status).toBe(401);
    expect((await mk({ "x-cron-secret": "anything" })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
    process.env.PROSPECTOR_CRON_SECRET = SECRET;
    expect((await mk({ "x-cron-secret": SECRET })).status).toBe(200);
    expect((await mk({ authorization: `Bearer ${SECRET}` })).status).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
