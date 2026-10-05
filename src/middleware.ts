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

const COMMAND_HOST = "command.parallaxvinc.com";

/**
 * The host the client asked for. Under `next start -H 127.0.0.1` (the launchd cockpit) Next builds nextUrl from the
 * bound address, so nextUrl.hostname is always 127.0.0.1 there; the Cloudflare tunnel forwards the real Host header.
 */
function requestHost(req: NextRequest): string {
  return (req.headers.get("host") ?? req.nextUrl.host).trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** The launchd cockpit release is built and run with NEXT_DIST_DIR=.next-cc (see next.config.ts); Vercel never sets it. */
const isCockpitDeployment = () => process.env.NEXT_DIST_DIR === ".next-cc";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Parallax OS never shows the public marketing homepage: on the command host, and anywhere on the cockpit
  // deployment, "/" goes straight into the owner flow. Host only selects the landing page; it never establishes
  // authority, which is the same full owner check as /command-login.
  if (pathname === '/' && (isCockpitDeployment() || requestHost(req) === COMMAND_HOST)) {
    const identity = await requireOwnerIdentity(req);
    const response = NextResponse.redirect(new URL(identity.ok ? '/command-center' : '/command-login', req.url));
    response.headers.set('cache-control', 'private, no-store');
    return response;
  }
  // An already-verified owner never needs the login form: the SAME full owner check as the
  // cockpit (verified session + exact PARALLAX_OWNER_UID) must pass before redirecting.
  // No/invalid/revoked/expired/wrong-owner sessions still get the login page.
  if (pathname === '/command-login') {
    const identity = await requireOwnerIdentity(req);
    const response = identity.ok ? NextResponse.redirect(new URL('/command-center', req.url)) : NextResponse.next();
    response.headers.set('cache-control', 'private, no-store');
    return response;
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
    "/command-login",
    "/command-center",
    "/command-center/:path*",
    "/api/command-center/:path*",
  ],
};
