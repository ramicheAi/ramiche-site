/**
 * Session-bound, stateless CSRF evidence.
 *
 * token = "v1.<expEpochSeconds>.<base64url(HMAC-SHA256(secret, "v1\n<exp>\n<sha256(sessionCookie)>"))>"
 *
 * Properties:
 *  - Cannot be forged without PARALLAX_CSRF_SECRET.
 *  - Bound to ONE session cookie value: a token minted for session A fails
 *    under session B (cross-session replay denial) and after re-login.
 *  - Bounded lifetime: expired tokens deny.
 *
 * Explicitly NOT provided: same-session token reuse prevention, action
 * idempotency, or any distributed replay guarantee. Those require the durable
 * claim ledger (see durable-claim-contract.ts), which is DISABLED in P03.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const CSRF_HEADER = "x-parallax-csrf";
export const CSRF_SECRET_ENV = "PARALLAX_CSRF_SECRET";
export const CSRF_MIN_SECRET_LEN = 32;
export const CSRF_DEFAULT_TTL_SECONDS = 2 * 60 * 60;
const CSRF_MAX_TTL_SECONDS = 24 * 60 * 60;
const TOKEN_VERSION = "v1";

export type CsrfDenialReason =
  | "csrf_not_configured"
  | "csrf_missing"
  | "csrf_duplicate"
  | "csrf_malformed"
  | "csrf_expired"
  | "csrf_mismatch";

export interface CsrfOpts {
  env?: Record<string, string | undefined>;
  nowMs?: number;
  ttlSeconds?: number;
}

function secretOf(env: Record<string, string | undefined>): string | null {
  const raw = env[CSRF_SECRET_ENV];
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length < CSRF_MIN_SECRET_LEN) return null; // too-weak config == absent
  return s;
}

function mac(secret: string, exp: number, sessionCookie: string): string {
  const fingerprint = createHash("sha256").update(sessionCookie, "utf8").digest("hex");
  return createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}\n${exp}\n${fingerprint}`, "utf8")
    .digest("base64url");
}

export function issueCsrfToken(
  sessionCookie: string,
  opts: CsrfOpts = {}
):
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; reason: "csrf_not_configured" | "csrf_missing" } {
  const secret = secretOf(opts.env ?? process.env);
  if (!secret) return { ok: false, reason: "csrf_not_configured" };
  if (!sessionCookie) return { ok: false, reason: "csrf_missing" };

  const ttl = Math.min(
    Math.max(Math.floor(opts.ttlSeconds ?? CSRF_DEFAULT_TTL_SECONDS), 60),
    CSRF_MAX_TTL_SECONDS
  );
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  const exp = nowSec + ttl;
  return {
    ok: true,
    token: `${TOKEN_VERSION}.${exp}.${mac(secret, exp, sessionCookie)}`,
    expiresAt: exp * 1000,
  };
}

export function verifyCsrfToken(
  rawHeader: string | null,
  sessionCookie: string,
  opts: CsrfOpts = {}
):
  | { ok: true; expiresAt: number }
  | { ok: false; reason: CsrfDenialReason; status: 403 | 503 } {
  const secret = secretOf(opts.env ?? process.env);
  if (!secret) return { ok: false, reason: "csrf_not_configured", status: 503 };
  if (!sessionCookie) return { ok: false, reason: "csrf_mismatch", status: 403 };

  if (rawHeader === null) return { ok: false, reason: "csrf_missing", status: 403 };
  const value = rawHeader.trim();
  if (!value) return { ok: false, reason: "csrf_missing", status: 403 };
  if (value.includes(",")) return { ok: false, reason: "csrf_duplicate", status: 403 };

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !/^[1-9][0-9]{0,11}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) {
    return { ok: false, reason: "csrf_malformed", status: 403 };
  }
  const exp = Number(parts[1]);
  if (!Number.isInteger(exp) || exp <= 0) {
    return { ok: false, reason: "csrf_malformed", status: 403 };
  }
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (nowSec >= exp) return { ok: false, reason: "csrf_expired", status: 403 };

  const expected = Buffer.from(mac(secret, exp, sessionCookie), "utf8");
  const presented = Buffer.from(parts[2], "utf8");
  if (
    presented.length !== expected.length ||
    !timingSafeEqual(presented, expected)
  ) {
    return { ok: false, reason: "csrf_mismatch", status: 403 };
  }
  return { ok: true, expiresAt: exp * 1000 };
}
