import { afterEach, describe, expect, it } from "vitest";
import {
  PIN_BASE_LOCKOUT_MS,
  PIN_GLOBAL_MAX_FAILURES,
  PIN_MAX_FAILURES,
  PIN_MAX_LOCKOUT_MS,
  checkPinRateLimit,
  pinClientKey,
  recordPinFailure,
  recordPinSuccess,
  resetPinRateLimits,
} from "./pin-rate-limit";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://command.parallaxvinc.com/api/command-center/auth/pin", {
    method: "POST",
    headers,
  });
}

afterEach(() => resetPinRateLimits());

describe("client key", () => {
  it("uses the leftmost forwarded address, then x-real-ip, then a shared bucket", () => {
    expect(pinClientKey(request({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(pinClientKey(request({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(pinClientKey(request())).toBe("unknown-client");
  });

  it("CC-SECURITY-REMEDIATION-05 item 4: prefers Vercel's own x-vercel-forwarded-for over the client-influenceable x-forwarded-for chain", () => {
    expect(
      pinClientKey(
        request({
          "x-vercel-forwarded-for": "203.0.113.9",
          "x-forwarded-for": "9.9.9.9, 10.0.0.1",
        }),
      ),
    ).toBe("203.0.113.9");
  });

  it("falls back to x-forwarded-for when x-vercel-forwarded-for is absent", () => {
    expect(pinClientKey(request({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
  });
});

describe("per-client brute-force protection", () => {
  it("allows attempts until the limit, then locks with a Retry-After", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < PIN_MAX_FAILURES - 1; i += 1) {
      expect(checkPinRateLimit("a", now).allowed).toBe(true);
      recordPinFailure("a", now);
    }
    expect(checkPinRateLimit("a", now).allowed).toBe(true);
    recordPinFailure("a", now);
    const blocked = checkPinRateLimit("a", now + 1);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe("client");
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(PIN_BASE_LOCKOUT_MS / 1000);
    }
  });

  it("unlocks after the lockout elapses", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < PIN_MAX_FAILURES; i += 1) recordPinFailure("b", now);
    expect(checkPinRateLimit("b", now + PIN_BASE_LOCKOUT_MS + 1).allowed).toBe(true);
  });

  it("escalates the lockout on repeat offending and caps it", () => {
    let now = 1_700_000_000_000;
    const observed: number[] = [];
    for (let round = 0; round < 6; round += 1) {
      for (let i = 0; i < PIN_MAX_FAILURES; i += 1) recordPinFailure("c", now);
      const blocked = checkPinRateLimit("c", now + 1);
      if (!blocked.allowed) observed.push(blocked.retryAfterSec);
      now += PIN_MAX_LOCKOUT_MS + 1;
    }
    expect(observed[0]).toBeGreaterThanOrEqual(PIN_BASE_LOCKOUT_MS / 1000);
    expect(observed[observed.length - 1]).toBeLessThanOrEqual(PIN_MAX_LOCKOUT_MS / 1000);
    expect(new Set(observed).size).toBeGreaterThan(1);
  });

  it("forgets failures after a success", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < PIN_MAX_FAILURES - 1; i += 1) recordPinFailure("d", now);
    recordPinSuccess("d");
    for (let i = 0; i < PIN_MAX_FAILURES - 1; i += 1) recordPinFailure("d", now);
    expect(checkPinRateLimit("d", now).allowed).toBe(true);
  });

  it("keeps clients independent", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < PIN_MAX_FAILURES; i += 1) recordPinFailure("e", now);
    expect(checkPinRateLimit("e", now + 1).allowed).toBe(false);
    expect(checkPinRateLimit("f", now + 1).allowed).toBe(true);
  });

  it("expires a stale failure window instead of accumulating forever", () => {
    const now = 1_700_000_000_000;
    const window = 15 * 60 * 1000;
    for (let i = 0; i < PIN_MAX_FAILURES - 1; i += 1) recordPinFailure("g", now);
    for (let i = 0; i < PIN_MAX_FAILURES - 1; i += 1) recordPinFailure("g", now + window + 1);
    expect(checkPinRateLimit("g", now + window + 2).allowed).toBe(true);
  });
});

describe("global circuit breaker", () => {
  it("locks every client once the aggregate failure count is reached", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < PIN_GLOBAL_MAX_FAILURES; i += 1) recordPinFailure(`client-${i}`, now);
    const blocked = checkPinRateLimit("brand-new-client", now + 1);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.scope).toBe("global");
    expect(checkPinRateLimit("brand-new-client", now + 10 * 60 * 1000 + 1).allowed).toBe(true);
  });

  it("is not cleared by a single successful PIN", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < PIN_GLOBAL_MAX_FAILURES; i += 1) recordPinFailure(`client-${i}`, now);
    recordPinSuccess("client-0");
    expect(checkPinRateLimit("client-0", now + 1).allowed).toBe(false);
  });
});
