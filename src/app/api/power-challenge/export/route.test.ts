import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { list } };
  },
}));

const call = (pin?: string) =>
  import("./route").then(({ GET }) =>
    GET(new Request(`http://localhost/api/power-challenge/export${pin !== undefined ? `?pin=${encodeURIComponent(pin)}` : ""}`)),
  );

describe("GET /api/power-challenge/export — no literal PIN, fails closed when unconfigured", () => {
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
    expect((await call("PIRANHAS2026")).status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it("denies a missing or wrong PIN when configured", async () => {
    process.env.POWER_CHALLENGE_ADMIN_PIN = "a-fresh-secret";
    expect((await call()).status).toBe(401);
    expect((await call("wrong")).status).toBe(401);
    expect((await call("PIRANHAS2026")).status).toBe(401);
  });

  it("accepts the configured PIN and returns a CSV", async () => {
    process.env.POWER_CHALLENGE_ADMIN_PIN = "a-fresh-secret";
    const res = await call("a-fresh-secret");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv");
  });
});
