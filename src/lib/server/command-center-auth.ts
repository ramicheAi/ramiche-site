/**
 * Command Center owner-identity primitives (Node runtime only — uses node:crypto).
 *
 * This is the "exact owner authorization" boundary for CC-STAGE0-AUTH-ORIGIN-01's
 * reconciliation: the same concept that was live in the unmerged p06 production
 * line's `owner-identity.ts` (Firebase session uid === a single configured owner
 * uid, fail-closed, timing-safe), ported deliberately rather than copied — the
 * production file imported `firebase-admin` directly inside Edge middleware,
 * which `main`'s middleware explicitly cannot do (see src/middleware.ts). Here
 * the uid comparison lives in Node-only call sites (API routes); the check never
 * runs in Edge middleware.
 *
 * Identity is established by exactly two facts:
 *   1. A Firebase session cookie that verifies (checkRevoked=true, see
 *      firebase-admin.ts) and whose sign-in provider is a real human provider —
 *      never "anonymous" or "custom" token identities.
 *   2. The decoded uid exactly equals the immutable server-configured owner uid.
 *
 * Nothing else establishes ownership: not email, not display name, not a PIN,
 * not hostname/x-forwarded-host/tailnet reachability, not a caller-supplied
 * uid/role header. Host/path checks elsewhere stay routing-only.
 *
 * Missing owner configuration denies. There is no fallback principal.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const OWNER_UID_ENV = "PARALLAX_OWNER_UID";

/** Session cookie shared with METTLE (see /api/auth/session). */
export const SESSION_COOKIE = "__session";

/**
 * Sign-in providers that count as a real, canonical human identity for owner
 * purposes. Anonymous and custom-token sessions (used elsewhere in this app for
 * athlete PIN flows, see src/app/apex-athlete/lib/firebase-auth.ts) are excluded
 * on purpose — the owner boundary must never be satisfiable by those flows.
 */
const HUMAN_PROVIDERS = new Set([
  "password",
  "google.com",
  "apple.com",
  "microsoft.com",
  "github.com",
  "facebook.com",
  "twitter.com",
  "yahoo.com",
  "phone",
]);

export function isHumanProvider(provider: string | undefined): boolean {
  return !!provider && HUMAN_PROVIDERS.has(provider);
}

/** Immutable server-configured owner uid, or null when absent/malformed. */
export function configuredOwnerUid(
  env: Record<string, string | undefined> = process.env
): string | null {
  const raw = env[OWNER_UID_ENV];
  if (typeof raw !== "string") return null;
  const uid = raw.trim();
  if (!uid) return null;
  // Firebase uids are opaque; accept only a conservative charset so that an
  // accidental multi-value/whitespace/JSON config is treated as ABSENT (deny),
  // never as a permissive wildcard.
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return null;
  return uid;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True iff `uid` exactly matches the configured owner uid (timing-safe). */
export function isOwnerUid(
  uid: string,
  configuredUid: string
): boolean {
  if (!uid || !configuredUid) return false;
  return timingSafeStringEqual(uid, configuredUid);
}

/**
 * Timing-safe comparison of a caller-supplied secret against the configured one.
 * Both sides are SHA-256 hashed first so the comparison is constant-time AND
 * length-independent. An empty/absent expected secret NEVER matches (fail closed).
 */
export function timingSafeSecretEqual(supplied: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(supplied, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Extract a secret from `Authorization: Bearer <x>` (case-insensitive scheme). */
export function bearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return m ? m[1].trim() : null;
}
