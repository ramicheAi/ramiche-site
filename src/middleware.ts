/* ══════════════════════════════════════════════════════════════
   METTLE — Middleware (Task 1a: Firebase session gate)

   Protected: /coach/*, /athlete/*, and METTLE /apex-athlete/coach|athlete.
   Unauthenticated → /portal (see next.config redirect → /apex-athlete/portal).
   Public: /portal, /api/auth, /_next, /favicon.ico (+ METTLE auth entry paths).

   Session verification uses firebase-admin;
   middleware uses the Node runtime and verifies sessions directly.
   ══════════════════════════════════════════════════════════════ */

import { requireOwnerIdentity, denialResponse } from "@/lib/server/owner-identity";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "__session";

const PROTECTED_PREFIXES = [
  "/coach",
  "/athlete",
  "/apex-athlete/coach",
  "/apex-athlete/athlete",
] as const;

/** Paths that skip auth (exact or prefix). Spec + METTLE login/selector flows. */
function isPublicPath(pathname: string): boolean {
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/apex-athlete/portal" || pathname.startsWith("/apex-athlete/portal/")) return true;
  if (pathname.startsWith("/apex-athlete/login")) return true;
  if (pathname.startsWith("/apex-athlete/join")) return true;
  if (pathname.startsWith("/apex-athlete/onboard")) return true;
  if (pathname.startsWith("/apex-athlete/landing")) return true;
  if (pathname.startsWith("/apex-athlete/guide")) return true;
  if (pathname.startsWith("/apex-athlete/billing")) return true;
  return false;
}

function isProtectedPath(pathname: string): boolean {
  if (isPublicPath(pathname)) return false;
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

async function firebaseSessionValid(req: NextRequest): Promise<boolean> {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw || raw.length < 20) return false;

  try { return (await verifySessionCookie(raw)) !== null; }
  catch { return false; }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Hostname only selects a landing page; it never establishes authority.
  if (pathname === '/' && req.nextUrl.hostname === 'command.parallaxvinc.com') {
    return NextResponse.redirect(new URL('/command-center', req.url));
  }
  if (pathname === '/command-center' || pathname.startsWith('/command-center/') || pathname === '/status.json') {
    const identity = await requireOwnerIdentity(req);
    if (!identity.ok) {
      if (pathname === '/status.json') return denialResponse(identity.status, identity.reason);
      return NextResponse.redirect(new URL('/command-login', req.url));
    }
    const response = NextResponse.next();
    response.headers.set('cache-control', 'private, no-store');
    return response;
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const ok = await firebaseSessionValid(req);
  if (ok) {
    return NextResponse.next();
  }

  const portal = new URL("/portal", req.url);
  portal.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(portal);
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/status.json",
    "/",
    "/coach",
    "/coach/:path*",
    "/athlete",
    "/athlete/:path*",
    "/apex-athlete/coach",
    "/apex-athlete/coach/:path*",
    "/apex-athlete/athlete",
    "/apex-athlete/athlete/:path*",
    "/command-center",
    "/command-center/:path*",
    "/api/command-center/:path*",
  ],
};
