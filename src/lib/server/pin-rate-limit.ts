/**
 * PIN brute-force protection (CC-SECURITY-COMPLETION-02, requirement 2).
 *
 * Two layers, both keyed on the client address as reported by the proxy:
 *
 *   1. Per-client: 5 failed PINs inside 15 minutes locks that client out for 15 minutes.
 *      Each further lockout doubles (15m, 30m, 60m, 120m, capped), so a slow guesser is
 *      punished more than a fat-fingered founder.
 *   2. Global circuit breaker: 50 failures in 10 minutes from any mix of clients locks
 *      ALL PIN verification for 10 minutes. This is the answer to "distribute the guesses
 *      across a thousand addresses"; five wrong PINs per address never adds up to a
 *      useful search space, and the global cap stops the aggregate.
 *
 * A successful PIN clears that client's bucket. There is no unbounded memory growth: buckets
 * are pruned on every write and the map is hard-capped.
 *
 * HONEST LIMITATION: this state is per server instance. On Vercel each warm lambda has its
 * own map, so the real ceiling is (instances x 5) guesses per window, not 5. That is still a
 * massive reduction from unlimited, and the secret is a PIN the founder controls. A shared
 * store (Redis/Upstash, or a Supabase table the middleware writes) is the correct next step
 * if the founder wants an exact global count; it is deliberately not invented here because
 * it adds a write path and a failure mode to the unlock screen. Documented in
 * docs/CC-FOUNDER-AUTHORITY-GUARD-01.md, not silently assumed away.
 */

export const PIN_MAX_FAILURES = 5;
export const PIN_WINDOW_MS = 15 * 60 * 1000;
export const PIN_BASE_LOCKOUT_MS = 15 * 60 * 1000;
export const PIN_MAX_LOCKOUT_MS = 2 * 60 * 60 * 1000;

export const PIN_GLOBAL_MAX_FAILURES = 50;
export const PIN_GLOBAL_WINDOW_MS = 10 * 60 * 1000;
export const PIN_GLOBAL_LOCKOUT_MS = 10 * 60 * 1000;

const MAX_TRACKED_CLIENTS = 10_000;
const GLOBAL_KEY = "__global__";

type Bucket = {
  failures: number;
  windowStart: number;
  lockedUntil: number;
  lockLevel: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; scope: "client" | "global" };

function bucketFor(key: string, now: number): Bucket {
  const existing = buckets.get(key);
  if (existing) return existing;
  const fresh: Bucket = { failures: 0, windowStart: now, lockedUntil: 0, lockLevel: 0 };
  buckets.set(key, fresh);
  return fresh;
}

function prune(now: number): void {
  if (buckets.size <= MAX_TRACKED_CLIENTS) return;
  for (const [key, bucket] of buckets) {
    if (key === GLOBAL_KEY) continue;
    if (bucket.lockedUntil <= now && now - bucket.windowStart > PIN_WINDOW_MS) buckets.delete(key);
  }
}

function retryAfter(bucket: Bucket, now: number): number {
  return Math.max(1, Math.ceil((bucket.lockedUntil - now) / 1000));
}

function lockDuration(baseMs: number, maxMs: number, level: number): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, level - 1));
}

/**
 * Client key for rate limiting. Uses the leftmost `x-forwarded-for` entry (the client, as
 * set by the platform proxy), then `x-real-ip`, then a single shared bucket. The fallback is
 * deliberately shared rather than unique: an address we cannot see must not get a fresh
 * allowance per request.
 */
export function pinClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown-client";
}

/** True when the caller may attempt a PIN right now. Does not consume an attempt. */
export function checkPinRateLimit(key: string, now: number = Date.now()): RateLimitDecision {
  const global = buckets.get(GLOBAL_KEY);
  if (global && global.lockedUntil > now) {
    return { allowed: false, retryAfterSec: retryAfter(global, now), scope: "global" };
  }
  const bucket = buckets.get(key);
  if (bucket && bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSec: retryAfter(bucket, now), scope: "client" };
  }
  return { allowed: true };
}

/** Records one failed attempt. Called only after the PIN comparison fails. */
export function recordPinFailure(key: string, now: number = Date.now()): void {
  const bucket = bucketFor(key, now);
  if (now - bucket.windowStart > PIN_WINDOW_MS) {
    bucket.failures = 0;
    bucket.windowStart = now;
  }
  bucket.failures += 1;
  if (bucket.failures >= PIN_MAX_FAILURES) {
    bucket.lockLevel += 1;
    bucket.lockedUntil = now + lockDuration(PIN_BASE_LOCKOUT_MS, PIN_MAX_LOCKOUT_MS, bucket.lockLevel);
    bucket.failures = 0;
    bucket.windowStart = now;
  }

  const global = bucketFor(GLOBAL_KEY, now);
  if (now - global.windowStart > PIN_GLOBAL_WINDOW_MS) {
    global.failures = 0;
    global.windowStart = now;
  }
  global.failures += 1;
  if (global.failures >= PIN_GLOBAL_MAX_FAILURES) {
    global.lockedUntil = now + PIN_GLOBAL_LOCKOUT_MS;
    global.failures = 0;
    global.windowStart = now;
  }
  prune(now);
}

/** Records a correct PIN: clears this client's failures. The global breaker is untouched. */
export function recordPinSuccess(key: string): void {
  buckets.delete(key);
}

/** Test hook. Never called by production code. */
export function resetPinRateLimits(): void {
  buckets.clear();
}
