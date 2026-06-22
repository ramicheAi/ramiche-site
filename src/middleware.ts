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

  // command.parallaxvinc.com (or any command.* host) root → Command Center.
  // The Cloudflare tunnel forwards the original host (sometimes via
  // x-forwarded-host); we rebuild the redirect on that host so the user stays
  // on their domain instead of bouncing to localhost.
  const fwdHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (pathname === "/" && fwdHost.startsWith("command.")) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    return NextResponse.redirect(new URL("/command-center", `${proto}://${fwdHost}`));
  }

  // SECURITY: the command center + its data APIs (leads, pipeline, financials) are
  // ONLY reachable via the command.* domain, localhost, or the tailnet — NEVER the
  // public *.vercel.app alias. Without this, anyone could GET the lead list publicly.
  if (pathname.startsWith("/command-center") || pathname.startsWith("/api/command-center")) {
    const trusted =
      fwdHost.startsWith("command.") ||
      fwdHost.startsWith("localhost") ||
      fwdHost.startsWith("127.0.0.1") ||
      fwdHost.endsWith(".ts.net");
    if (!trusted) return new NextResponse("Not found", { status: 404 });
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
  matcher: [
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
