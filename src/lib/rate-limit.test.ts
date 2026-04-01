import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getClientIp, rateLimit, rateLimitResponse } from "./rate-limit";

describe("rate-limit", () => {
  describe("getClientIp", () => {
    it("uses first x-forwarded-for", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
      });
      expect(getClientIp(req)).toBe("1.1.1.1");
    });

    it("falls back to unknown", () => {
      expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
    });

    it("uses x-real-ip when no forwarded-for", () => {
      const req = new Request("http://localhost", {
        headers: { "x-real-ip": "9.9.9.9" },
      });
      expect(getClientIp(req)).toBe("9.9.9.9");
    });

    it("prefers x-forwarded-for over x-real-ip when both are set", () => {
      const req = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.1.1.1",
          "x-real-ip": "9.9.9.9",
        },
      });
      expect(getClientIp(req)).toBe("1.1.1.1");
    });

    it("trims whitespace on first forwarded-for segment", () => {
      const req = new Request("http://localhost", {
        headers: { "x-forwarded-for": "  3.3.3.3  , 4.4.4.4" },
      });
      expect(getClientIp(req)).toBe("3.3.3.3");
    });
  });

  describe("rateLimit", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("allows under cap", () => {
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z").getTime());
      const a = rateLimit("a", 3, 60_000);
      expect(a.allowed).toBe(true);
      expect(a.remaining).toBe(2);
    });

    it("blocks at cap", () => {
      const key = "b";
      const t = new Date("2020-01-01T00:00:00Z").getTime();
      vi.setSystemTime(t);
      rateLimit(key, 2, 60_000);
      rateLimit(key, 2, 60_000);
      const blocked = rateLimit(key, 2, 60_000);
      expect(blocked.allowed).toBe(false);
    });

    it("allows again after window elapses", () => {
      const key = `win-${Math.random()}`;
      vi.setSystemTime(new Date("2020-01-01T00:00:00Z").getTime());
      rateLimit(key, 2, 60_000);
      rateLimit(key, 2, 60_000);
      expect(rateLimit(key, 2, 60_000).allowed).toBe(false);
      vi.advanceTimersByTime(60_001);
      const again = rateLimit(key, 2, 60_000);
      expect(again.allowed).toBe(true);
    });
  });

  it("rateLimitResponse is 429", () => {
    const res = rateLimitResponse({
      allowed: false,
      remaining: 0,
      limit: 5,
      retryAfterMs: 3000,
    });
    expect(res.status).toBe(429);
  });

  it("rateLimitResponse sets Retry-After and limit headers", () => {
    const res = rateLimitResponse({
      allowed: false,
      remaining: 0,
      limit: 12,
      retryAfterMs: 4500,
    });
    expect(res.headers.get("Retry-After")).toBe("5");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("12");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});
