/**
 * Command Center owner guard — the AUTHORITATIVE authorization check.
 *
 * Every human-facing `/api/command-center/*` handler runs this itself (via
 * `ownerOnly(...)` or a direct call). middleware.ts runs the same function
 * first for page redirects / early rejection, but no handler relies on
 * middleware having run: a matcher gap, refactor, or direct invocation still
 * cannot reach handler logic without passing this check.
 *
 * Order (all deny-by-default): owner configured (503) -> browser-session CSRF
 * evidence for mutating methods that carry a session cookie (403) -> session
 * cookie present (401) -> verifies with revocation check (401) -> human
 * provider (401) -> exact owner uid (403).
 */
import { NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { SESSION_COOKIE, configuredOwnerUid, isHumanProvider, isOwnerUid } from "./command-center-auth";
import { checkBrowserMutation } from "./command-center-csrf";

export type GuardResult =
  | { ok: true; uid: string }
  | { ok: false; status: 401 | 403 | 503; reason: string };

function readSessionCookie(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== SESSION_COOKIE) continue;
    return part.slice(i + 1).trim();
  }
  return null;
}

/** The canonical route-handler guard. Reads only the cookie header and server config. */
export async function requireCommandCenterOwner(req: Request): Promise<GuardResult> {
  const owner = configuredOwnerUid();
  if (!owner) {
    // Fail closed before any verifier work: a misconfigured deployment can
    // never authorize anything.
    return { ok: false, status: 503, reason: "owner_not_configured" };
  }

  const cookie = readSessionCookie(req);
  if (!cookie) return { ok: false, status: 401, reason: "missing_session" };

  // A browser-session mutation: reject cross-site / ambiguous-origin requests
  // BEFORE doing any verification work.
  const csrf = checkBrowserMutation(req.method, req.headers);
  if (!csrf.ok) return { ok: false, status: 403, reason: csrf.reason };

  let decoded: { uid: string; signInProvider?: string } | null = null;
  try {
    decoded = await verifySessionCookie(cookie);
  } catch {
    return { ok: false, status: 401, reason: "invalid_session" };
  }
  if (!decoded) return { ok: false, status: 401, reason: "invalid_session" };
  if (!isHumanProvider(decoded.signInProvider)) {
    return { ok: false, status: 401, reason: "invalid_session" };
  }
  if (!isOwnerUid(decoded.uid, owner)) {
    return { ok: false, status: 403, reason: "not_owner" };
  }
  return { ok: true, uid: decoded.uid };
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
