/* ══════════════════════════════════════════════════════════════
   Command Center owner sign-in: POST /api/auth/command-session

   Establishes the `__session` cookie ONLY for the exact configured owner.
   Unlike the shared METTLE endpoint (/api/auth/session, which mints a cookie
   for any valid Firebase identity and is intentionally left untouched), this
   endpoint:
     1. requires owner configuration (else 503, fail closed),
     2. rejects cross-site / ambiguous-origin requests (login CSRF),
     3. verifies the ID token with revocation check,
     4. requires a human sign-in provider (no anonymous/custom),
     5. requires uid === PARALLAX_OWNER_UID exactly,
     6. mints a SHORT-lived session cookie, then RE-VERIFIES the minted cookie
        as owner before setting it — success is never declared on the token alone.
   Denials return a coarse reason only; no uid/email/config value is echoed.
   ══════════════════════════════════════════════════════════════ */
import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, verifyIdTokenForOwnerLogin, verifySessionCookie } from "@/lib/firebase-admin";
import { SESSION_COOKIE, configuredOwnerUid, isHumanProvider, isOwnerUid } from "@/lib/server/command-center-auth";
import { checkBrowserMutation } from "@/lib/server/command-center-csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OWNER_SESSION_MS = 12 * 60 * 60 * 1000; // 12h; owner sessions are short-lived
const NO_STORE = { "cache-control": "no-store" } as const;

function deny(status: 400 | 401 | 403 | 500 | 503, reason: string) {
  return NextResponse.json({ ok: false, error: "denied", reason }, { status, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const owner = configuredOwnerUid();
  if (!owner) return deny(503, "owner_not_configured");

  // Login CSRF: always evaluated (this endpoint is a mutation by definition).
  const csrf = checkBrowserMutation("POST", req.headers);
  if (!csrf.ok) return deny(403, csrf.reason);

  let idToken: unknown;
  try {
    idToken = ((await req.json()) as { idToken?: unknown }).idToken;
  } catch {
    return deny(400, "bad_request");
  }
  if (typeof idToken !== "string" || idToken.length < 20 || idToken.length > 8192) {
    return deny(400, "bad_request");
  }

  const principal = await verifyIdTokenForOwnerLogin(idToken);
  if (!principal) return deny(401, "invalid_token");
  if (!isHumanProvider(principal.signInProvider)) return deny(401, "invalid_token");
  if (!isOwnerUid(principal.uid, owner)) return deny(403, "not_owner");

  const cookie = await createSessionCookie(idToken, OWNER_SESSION_MS);
  if (!cookie) return deny(500, "session_exchange_failed");

  // Never declare success on the token alone: the minted cookie must itself
  // verify (revocation-checked) as the exact owner.
  const minted = await verifySessionCookie(cookie);
  if (
    !minted ||
    !isHumanProvider(minted.signInProvider) ||
    !isOwnerUid(minted.uid, owner)
  ) {
    return deny(500, "session_exchange_failed");
  }

  const res = NextResponse.json({ ok: true, isOwner: true }, { headers: NO_STORE });
  res.cookies.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OWNER_SESSION_MS / 1000,
    path: "/",
  });
  return res;
}
