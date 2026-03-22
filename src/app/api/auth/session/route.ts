/* ══════════════════════════════════════════════════════════════
   METTLE — Session Cookie API (Phase 5)

   POST /api/auth/session   → Create session cookie from ID token
   DELETE /api/auth/session  → Revoke session + clear cookie
   GET /api/auth/session     → Verify current session
   ══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookie,
  verifySessionCookie,
  revokeSession,
} from "@/lib/firebase-admin";

const COOKIE_NAME = "mettle_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

// ── POST: Exchange ID token for session cookie ───────────────
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const cookie = await createSessionCookie(idToken, THIRTY_DAYS);
    if (!cookie) {
      return NextResponse.json(
        { error: "Session creation failed — check FIREBASE_SERVICE_ACCOUNT" },
        { status: 500 }
      );
    }

    const res = NextResponse.json({ status: "ok" });
    res.cookies.set(COOKIE_NAME, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: THIRTY_DAYS / 1000,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// ── GET: Verify session cookie ───────────────────────────────
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await verifySessionCookie(cookie);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, uid: user.uid, email: user.email });
}

// ── DELETE: Revoke session ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie) {
    const user = await verifySessionCookie(cookie);
    if (user) {
      await revokeSession(user.uid);
    }
  }

  const res = NextResponse.json({ status: "signed_out" });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
