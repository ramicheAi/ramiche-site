// ── Retry Strategy — Exponential Jitter Backoff ──────────────────
// ByteByteGo #49: Best pattern for distributed systems
// Use for: API calls, Firestore operations, sub-agent spawning
// Pattern: base * 2^attempt + random jitter (prevents synchronized retries)

interface RetryOptions {
  maxAttempts?: number;       // default: 3
  baseDelayMs?: number;       // default: 1000 (1s)
  maxDelayMs?: number;        // default: 30000 (30s)
  jitterFactor?: number;      // default: 0.5 (0-1, how much randomness)
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

interface RetryResult<T> {
  data: T | null;
  error: unknown;
  attempts: number;
  totalTimeMs: number;
}

function computeDelay(attempt: number, baseMs: number, maxMs: number, jitter: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  const jitterAmount = capped * jitter * Math.random();
  return capped + jitterAmount;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry an async function with exponential jitter backoff */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
    jitterFactor = 0.5,
    shouldRetry = () => true,
  } = options;

  const startTime = Date.now();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await fn();
      return {
        data,
        error: null,
        attempts: attempt + 1,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1 && shouldRetry(err, attempt)) {
        const delay = computeDelay(attempt, baseDelayMs, maxDelayMs, jitterFactor);
        await sleep(delay);
      }
    }
  }

  return {
    data: null,
    error: lastError,
    attempts: maxAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/** Retry with model fallback — try primary, fall back to secondary on failure */
export async function withModelFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  // Try primary with retry
  const primaryResult = await withRetry(primary, { ...options, maxAttempts: 2 });
  if (primaryResult.data !== null) return primaryResult;

  // Fall back to secondary
  const fallbackResult = await withRetry(fallback, { ...options, maxAttempts: 2 });
  return {
    ...fallbackResult,
    attempts: primaryResult.attempts + fallbackResult.attempts,
    totalTimeMs: primaryResult.totalTimeMs + fallbackResult.totalTimeMs,
  };
}
