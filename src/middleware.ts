/* ══════════════════════════════════════════════════════════════
   METTLE — Middleware (Task 1a: Firebase session gate)

   Protected: /coach/*, /athlete/*, and METTLE /apex-athlete/coach|athlete.
   Unauthenticated → /portal (see next.config redirect → /apex-athlete/portal).
   Public: /portal, /api/auth, /_next, /favicon.ico (+ METTLE auth entry paths).

   Session verification calls GET /api/auth/session (Node + firebase-admin);
   middleware runs on Edge and cannot import firebase-admin directly.
   ══════════════════════════════════════════════════════════════ */

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

  try {
    const verifyUrl = new URL("/api/auth/session", req.url);
    const res = await fetch(verifyUrl, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { authenticated?: boolean };
    return body.authenticated === true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
  matcher: [
    "/coach",
    "/coach/:path*",
    "/athlete",
    "/athlete/:path*",
    "/apex-athlete/coach",
    "/apex-athlete/coach/:path*",
    "/apex-athlete/athlete",
    "/apex-athlete/athlete/:path*",
  ],
};
