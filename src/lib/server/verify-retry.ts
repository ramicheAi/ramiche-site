/**
 * Session-verification retry policy (P05-B4).
 *
 * Firebase session verification with revocation checking calls Google on every
 * request. A genuine rejection (expired, revoked, malformed, disabled user, bad
 * argument) must deny immediately. An indeterminate infrastructure failure
 * (network, timeout, upstream 5xx/internal) gets exactly ONE bounded retry; if
 * verification still cannot be established the caller fails closed.
 *
 * There is no grace period: an unverified session is never treated as valid.
 * Any error that is not positively recognized as transient is treated as a
 * rejection (fail closed, no retry).
 */

/** Firebase Admin / Node network codes that mean "could not verify", not "invalid". */
const TRANSIENT_CODES = new Set([
  "app/network-error",
  "app/network-timeout",
  "auth/internal-error",
  "auth/network-request-failed",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export const VERIFY_RETRY_DELAY_MS = 250;

function codeOf(e: unknown): string {
  if (!e || typeof e !== "object") return "";
  const o = e as { code?: unknown; errorInfo?: { code?: unknown }; cause?: { code?: unknown } };
  for (const c of [o.code, o.errorInfo?.code, o.cause?.code]) if (typeof c === "string" && c) return c;
  return "";
}

/** True only for errors positively recognized as indeterminate infrastructure failures. */
export function isTransientVerifyError(e: unknown): boolean {
  const code = codeOf(e);
  if (code) return TRANSIENT_CODES.has(code);
  // Code-less low-level fetch failures (undici "fetch failed", socket hang up).
  const msg = e instanceof Error ? e.message : "";
  return /^fetch failed$|socket hang up/i.test(msg);
}

/**
 * Runs `verify`. On a recognized transient failure, waits once and retries once.
 * Returns the verified value, or null (deny) for any rejection or a second failure.
 */
export async function verifyWithOneRetry<T>(
  verify: () => Promise<T>,
  opts: { retryDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T | null> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  try {
    return await verify();
  } catch (first) {
    if (!isTransientVerifyError(first)) return null; // genuine rejection: deny now
  }
  await sleep(opts.retryDelayMs ?? VERIFY_RETRY_DELAY_MS);
  try {
    return await verify();
  } catch {
    return null; // still unverifiable: fail closed
  }
}
