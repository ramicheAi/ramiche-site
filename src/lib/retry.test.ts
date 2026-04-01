import { describe, it, expect } from "vitest";
import { withRetry, withModelFallback } from "./retry";

describe("retry", () => {
  it("withRetry returns data on first success", async () => {
    const r = await withRetry(async () => 42, {
      maxAttempts: 3,
      baseDelayMs: 0,
      maxDelayMs: 0,
      jitterFactor: 0,
    });
    expect(r.data).toBe(42);
    expect(r.error).toBeNull();
    expect(r.attempts).toBe(1);
  });

  it("withRetry exhausts attempts on repeated failure", async () => {
    const err = new Error("fail");
    const r = await withRetry(
      async () => {
        throw err;
      },
      { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 }
    );
    expect(r.data).toBeNull();
    expect(r.error).toBe(err);
    expect(r.attempts).toBe(2);
  });

  it("withModelFallback uses fallback when primary never succeeds", async () => {
    const fast = { baseDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 as const };
    const r = await withModelFallback(
      async () => {
        throw new Error("primary");
      },
      async () => "ok",
      fast
    );
    expect(r.data).toBe("ok");
  });

  it("withRetry succeeds after transient failure", async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n += 1;
        if (n < 2) throw new Error("transient");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 }
    );
    expect(r.data).toBe("ok");
    expect(r.attempts).toBe(2);
    expect(r.error).toBeNull();
  });

  it("withModelFallback returns primary when it succeeds", async () => {
    const fast = { baseDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 as const };
    const r = await withModelFallback(
      async () => "primary",
      async () => "fallback",
      fast
    );
    expect(r.data).toBe("primary");
  });

  it("withRetry skips backoff when shouldRetry is false", async () => {
    const start = Date.now();
    const r = await withRetry(
      async () => {
        throw new Error("fail");
      },
      {
        maxAttempts: 2,
        baseDelayMs: 5000,
        maxDelayMs: 5000,
        jitterFactor: 0,
        shouldRetry: () => false,
      }
    );
    expect(r.data).toBeNull();
    expect(Date.now() - start).toBeLessThan(200);
  });

  it("withModelFallback aggregates attempts from primary and fallback", async () => {
    const fast = { baseDelayMs: 0, maxDelayMs: 0, jitterFactor: 0 as const };
    const r = await withModelFallback(
      async () => {
        throw new Error("primary");
      },
      async () => "fallback-ok",
      fast
    );
    expect(r.data).toBe("fallback-ok");
    expect(r.attempts).toBe(3);
  });
});
