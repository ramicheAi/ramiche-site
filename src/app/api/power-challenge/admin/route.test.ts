import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { list } };
  },
}));

const call = (headers: Record<string, string> = {}) =>
  import("./route").then(({ GET }) => GET(new Request("http://localhost/api/power-challenge/admin", { headers })));

describe("GET /api/power-challenge/admin — no literal PIN, fails closed when unconfigured", () => {
  const saved = process.env.POWER_CHALLENGE_ADMIN_PIN;
  beforeEach(() => {
    vi.resetModules();
    list.mockReset().mockResolvedValue({ data: [], has_more: false });
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.POWER_CHALLENGE_ADMIN_PIN;
    else process.env.POWER_CHALLENGE_ADMIN_PIN = saved;
  });

  it("denies every request, including the formerly-published literal, when the env var is unset", async () => {
    delete process.env.POWER_CHALLENGE_ADMIN_PIN;
    expect((await call()).status).toBe(401);
    expect((await call({ "x-admin-pin": "PIRANHAS2026" })).status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("denies a missing or wrong PIN when configured", async () => {
    process.env.POWER_CHALLENGE_ADMIN_PIN = "a-fresh-secret";
    expect((await call()).status).toBe(401);
    expect((await call({ "x-admin-pin": "wrong" })).status).toBe(401);
    expect((await call({ "x-admin-pin": "PIRANHAS2026" })).status).toBe(401);
  });

  it("accepts the configured PIN", async () => {
    process.env.POWER_CHALLENGE_ADMIN_PIN = "a-fresh-secret";
    const res = await call({ "x-admin-pin": "a-fresh-secret" });
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalled();
  });
});
