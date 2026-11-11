/**
 * Defense-in-depth Command Center owner guard for route handlers.
 *
 * middleware.ts already denies unauthorized `/command-center*` and
 * `/api/command-center/*` traffic (see commandCenterAuthorized there). This
 * guard is the SAME check re-run inside the route handler itself, so a
 * middleware bug/matcher gap/future refactor cannot silently turn into an
 * unauthenticated data read. Call it at the top of any route handler that
 * returns sensitive data (financials, leads, settings) or performs an
 * owner-only action.
 *
 * Not wired into every Command Center route in this change — see the
 * reconciliation PR's residual-risk section for the routes that still rely on
 * middleware alone.
 */
import { NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { configuredOwnerUid, isHumanProvider, isOwnerUid } from "./command-center-auth";

const SESSION_COOKIE = "__session";

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
