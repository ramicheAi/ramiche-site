/**
 * Command Center owner guard — the AUTHORITATIVE authorization check.
 *
 * Every human-facing `/api/command-center/*` handler runs this itself (via
 * `ownerOnly(...)` or a direct call). middleware.ts runs the same function
 * first for page redirects / early rejection, but no handler relies on
 * middleware having run: a matcher gap, refactor, or direct invocation still
 * cannot reach handler logic without passing this check.
 *
 * Two credential paths, both deny-by-default, only one of which can ever
 * ESTABLISH ownership:
 *
 *   A. Firebase session (`__session`): verifies with revocation check,
 *      requires a human sign-in provider, enforces its own 12h max age, and
 *      requires the decoded uid to exactly equal the configured owner uid.
 *      This is the only path that can enroll a new trusted device.
 *   B. Trusted-device PIN unlock (`cc_unlock` + `cc_device`): only ever
 *      accepted if BOTH cookies verify — the unlock cookie's own HMAC
 *      signature and 12h freshness, AND a live re-check that the device row
 *      it names is still enrolled, non-revoked, non-expired, and owned by
 *      the LIVE configured owner uid (command-center-device-trust.ts).
 *      Revoking a device invalidates every unlock session minted from it
 *      immediately, not just future enrollments.
 *
 * Order (all deny-by-default): owner configured (503) -> CSRF evidence for
 * mutating methods that carry either credential cookie (403) -> try path A,
 * then path B -> if neither succeeds, the most informative failure.
 */
import { NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { SESSION_COOKIE, configuredOwnerUid, isHumanProvider, isOwnerUid } from "./command-center-auth";
import { checkBrowserMutation } from "./command-center-csrf";
import { DEVICE_COOKIE, UNLOCK_COOKIE, verifyDeviceCookie, verifyUnlockCookie } from "./command-center-device-trust";

/** Max age of a session cookie the owner boundary accepts. */
export const OWNER_SESSION_MAX_AGE_S = 12 * 60 * 60;

export type GuardResult =
  | { ok: true; uid: string }
  | { ok: false; status: 401 | 403 | 503; reason: string };

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    return part.slice(i + 1).trim();
  }
  return null;
}

export async function tryFirebaseSession(req: Request, owner: string): Promise<GuardResult> {
  const cookie = readCookie(req, SESSION_COOKIE);
  if (!cookie) return { ok: false, status: 401, reason: "missing_session" };

  let decoded: { uid: string; signInProvider?: string; issuedAt?: number } | null = null;
  try {
    decoded = await verifySessionCookie(cookie);
  } catch {
    return { ok: false, status: 401, reason: "invalid_session" };
  }
  if (!decoded) return { ok: false, status: 401, reason: "invalid_session" };
  if (!isHumanProvider(decoded.signInProvider)) {
    return { ok: false, status: 401, reason: "invalid_session" };
  }
  // Owner sessions are short-lived (12h). The shared /api/auth/session still mints
  // 30-day cookies for METTLE, so the owner boundary enforces its own max age.
  if (typeof decoded.issuedAt === "number" && Date.now() / 1000 - decoded.issuedAt > OWNER_SESSION_MAX_AGE_S) {
    return { ok: false, status: 401, reason: "session_expired" };
  }
  if (!isOwnerUid(decoded.uid, owner)) {
    return { ok: false, status: 403, reason: "not_owner" };
  }
  return { ok: true, uid: decoded.uid };
}

async function tryTrustedDeviceUnlock(req: Request, owner: string): Promise<GuardResult> {
  const unlockRaw = readCookie(req, UNLOCK_COOKIE);
  if (!unlockRaw) return { ok: false, status: 401, reason: "missing_unlock" };

  const unlock = verifyUnlockCookie(unlockRaw);
  if (!unlock.ok) {
    return { ok: false, status: unlock.reason === "not_configured" ? 503 : 401, reason: `unlock_${unlock.reason}` };
  }

  // The unlock cookie alone is never sufficient — re-verify the device row
  // itself is still live (not revoked, not expired, still the configured
  // owner) on EVERY request, not only at the moment of unlock.
  const deviceRaw = readCookie(req, DEVICE_COOKIE);
  const device = await verifyDeviceCookie(deviceRaw, owner);
  if (!device.ok) return { ok: false, status: 401, reason: `device_${device.reason}` };
  if (device.deviceId !== unlock.deviceId) return { ok: false, status: 401, reason: "device_mismatch" };

  return { ok: true, uid: owner };
}

/** The canonical route-handler guard. Reads only the cookie header and server config. */
export async function requireCommandCenterOwner(req: Request): Promise<GuardResult> {
  const owner = configuredOwnerUid();
  if (!owner) {
    // Fail closed before any verifier work: a misconfigured deployment can
    // never authorize anything.
    return { ok: false, status: 503, reason: "owner_not_configured" };
  }

  const firebaseCookiePresent = !!readCookie(req, SESSION_COOKIE);
  const unlockCookiePresent = !!readCookie(req, UNLOCK_COOKIE);

  // Neither credential offered at all: the exact pre-existing behavior
  // ("missing_session"), unchanged — this is still the overwhelmingly
  // common case (an anonymous request) and every existing caller/test
  // depends on this exact reason string.
  if (!firebaseCookiePresent && !unlockCookiePresent) {
    return { ok: false, status: 401, reason: "missing_session" };
  }

  // A browser-session mutation under EITHER credential: reject cross-site
  // / ambiguous-origin requests BEFORE doing any verification work.
  const csrf = checkBrowserMutation(req.method, req.headers);
  if (!csrf.ok) return { ok: false, status: 403, reason: csrf.reason };

  const viaFirebase = await tryFirebaseSession(req, owner);
  if (viaFirebase.ok) return viaFirebase;

  if (unlockCookiePresent) {
    const viaUnlock = await tryTrustedDeviceUnlock(req, owner);
    if (viaUnlock.ok) return viaUnlock;
    // Both were attempted and both failed. Report the credential that was
    // actually presented for THIS request — a caller who sent a Firebase
    // cookie gets the Firebase-side reason, not an "unlock" reason for a
    // cookie they never sent.
    return firebaseCookiePresent ? viaFirebase : viaUnlock;
  }

  // Only a Firebase cookie was present, and it failed.
  return viaFirebase;
}

/**
 * The STRONG-ONLY path: Firebase session required, a trusted-device unlock
 * session is never accepted. Use this for anything that itself grants or
 * revokes trust — device enrollment and device revocation (founder
 * Priority 1 decision points 1 and 1's "high-risk recovery" clause) — so a
 * PIN-unlocked session can never mint or destroy device trust on its own.
 */
export async function requireFreshFirebaseOwnerSession(req: Request): Promise<GuardResult> {
  const owner = configuredOwnerUid();
  if (!owner) return { ok: false, status: 503, reason: "owner_not_configured" };

  if (readCookie(req, SESSION_COOKIE)) {
    const csrf = checkBrowserMutation(req.method, req.headers);
    if (!csrf.ok) return { ok: false, status: 403, reason: csrf.reason };
  }

  return tryFirebaseSession(req, owner);
}

/** Denial body carries a coarse reason code only — never a uid, email, or config value. */
export function ownerDenialResponse(result: Extract<GuardResult, { ok: false }>): NextResponse {
  return NextResponse.json(
    { ok: false, error: "denied", reason: result.reason },
    { status: result.status, headers: { "cache-control": "no-store" } }
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (req: any, ...rest: any[]) => Response | Promise<Response>;

/**
 * Wrap a route handler so it can only run for the exact owner. Preserves the
 * handler's type so Next's route-signature validation is unaffected.
 */
export function ownerOnly<H extends RouteHandler>(handler: H): H {
  const wrapped = async (req: Request, ...rest: unknown[]) => {
    const guard = await requireCommandCenterOwner(req);
    if (!guard.ok) return ownerDenialResponse(guard);
    return handler(req, ...rest);
  };
  return wrapped as unknown as H;
}
