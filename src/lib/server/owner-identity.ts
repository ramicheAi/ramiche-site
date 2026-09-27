/**
 * CANONICAL authenticated-Ramon identity boundary (server-side only).
 *
 * Identity is established by EXACTLY TWO facts, both from the trusted side:
 *   1. A Firebase session cookie (`__session`) that verifies with
 *      checkRevoked=true via firebase-admin.
 *   2. The decoded uid exactly equals the immutable server-configured owner uid
 *      (`PARALLAX_OWNER_UID`).
 *
 * NOTHING else establishes identity. Not email, not display names, not PINs,
 * not hostname / x-forwarded-host / tailnet reachability, not request-supplied
 * uid/role/scope claims, not Telegram payload labels, not UI text, not model
 * output, not a machine shared secret. Host checks are ROUTING ONLY.
 *
 * Missing owner configuration DENIES. There is no fallback principal.
 *
 * Node runtime only (node:crypto). Do not import from Edge middleware.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "__session";
export const OWNER_UID_ENV = "PARALLAX_OWNER_UID";

/** Minimum plausible Firebase session cookie length (matches middleware). */
const MIN_SESSION_LEN = 20;

export type IdentityDenialReason =
  | "owner_not_configured"
  | "missing_session"
  | "invalid_session"
  | "not_owner";

export type IdentityResult =
  | { ok: true; uid: string; sessionCookie: string }
  | { ok: false; reason: IdentityDenialReason; status: 401 | 403 | 503 };

export type SessionVerifier = (
  sessionCookie: string
) => Promise<{ uid?: unknown } | null>;

export interface IdentityDeps {
  /** Injectable for tests. Default performs a lazy firebase-admin import. */
  verifySession?: SessionVerifier;
  env?: Record<string, string | undefined>;
}

/**
 * Lazy import keeps `firebase-admin/*` out of the module graph until an actual
 * verification is attempted (no import-time side effects in tests or in routes
 * that only ever deny).
 */
const defaultVerifier: SessionVerifier = async (sessionCookie) => {
  const mod = await import("@/lib/firebase-admin");
  // verifySessionCookie() calls verifySessionCookie(cookie, true) — revocation
  // checked — and returns null on malformed/expired/revoked/verifier failure.
  const verified = await mod.verifySessionCookie(sessionCookie);
  // Shared PIN/custom-token and anonymous identities are not canonical human
  // authentication. The provider comes ONLY from the verified Firebase claims.
  const providers = new Set(["password", "google.com", "apple.com", "microsoft.com", "github.com", "facebook.com", "twitter.com", "yahoo.com", "phone"]);
  return verified && providers.has(verified.signInProvider ?? "") ? verified : null;
};

function eq(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Immutable server-configured owner uid, or null when absent/malformed. */
export function configuredOwnerUid(
  env: Record<string, string | undefined> = process.env
): string | null {
  const raw = env[OWNER_UID_ENV];
  if (typeof raw !== "string") return null;
  const uid = raw.trim();
  if (!uid) return null;
  // Firebase uids are opaque; accept only a conservative charset so that
  // accidental JSON/whitespace/multi-value config is treated as ABSENT (deny),
  // never as a permissive wildcard.
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return null;
  return uid;
}

/** All `__session` values present on the request (duplicates are ambiguous). */
export function readSessionCookieValues(
  req: { headers: Headers },
  name: string = SESSION_COOKIE
): string[] {
  const raw = req.headers.get("cookie");
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx < 0) continue;
    if (part.slice(0, eqIdx).trim() !== name) continue;
    out.push(part.slice(eqIdx + 1).trim());
  }
  return out;
}

/**
 * The canonical guard. Reads ONLY the cookie header and server config.
 * Never reads Origin/Referer/host/authorization/custom identity headers.
 */
export async function requireOwnerIdentity(
  req: { headers: Headers },
  deps: IdentityDeps = {}
): Promise<IdentityResult> {
  const env = deps.env ?? process.env;

  const owner = configuredOwnerUid(env);
  if (!owner) {
    // Fail closed BEFORE any verifier work so a misconfigured deployment can
    // never authorize anything.
    return { ok: false, reason: "owner_not_configured", status: 503 };
  }

  const cookies = readSessionCookieValues(req);
  if (cookies.length === 0) return { ok: false, reason: "missing_session", status: 401 };
  if (cookies.length > 1) return { ok: false, reason: "invalid_session", status: 401 };

  const sessionCookie = cookies[0];
  if (!sessionCookie || sessionCookie.length < MIN_SESSION_LEN || sessionCookie.length > 8192 || !/^[A-Za-z0-9._-]+$/.test(sessionCookie)) {
    return { ok: false, reason: "invalid_session", status: 401 };
  }

  const verify = deps.verifySession ?? defaultVerifier;
  let decoded: { uid?: unknown } | null = null;
  try {
    decoded = await verify(sessionCookie);
  } catch {
    // Verifier failure (admin SDK uninitialised, network, clock, malformed key)
    // is a DENY, never a pass-through.
    return { ok: false, reason: "invalid_session", status: 401 };
  }

  const uid = decoded && typeof decoded.uid === "string" ? decoded.uid : "";
  if (!uid) return { ok: false, reason: "invalid_session", status: 401 };

  if (!eq(uid, owner)) {
    // Authenticated human, but NOT the owner. Email/display name are ignored
    // entirely — they are not identity.
    return { ok: false, reason: "not_owner", status: 403 };
  }

  return { ok: true, uid, sessionCookie };
}

/** Denial body carries a coarse reason code only — no uid, email, or config. */
export function denialResponse(status: number, reason: string): NextResponse {
  return new NextResponse(JSON.stringify({ ok: false, error: "denied", reason }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
