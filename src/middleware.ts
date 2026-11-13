/* ══════════════════════════════════════════════════════════════
   METTLE — Middleware (Task 1a: Firebase session gate)

   Protected: /coach/*, /athlete/*, and METTLE /apex-athlete/coach|athlete.
   Unauthenticated → /portal (see next.config redirect → /apex-athlete/portal).
   Public: /portal, /api/auth, /_next, /favicon.ico (+ METTLE auth entry paths).

   Session verification calls GET /api/auth/session (Node + firebase-admin);
   middleware runs on Edge and cannot import firebase-admin directly.

   Command Center (CC-P06-SECURITY-RECONCILIATION-01 / -02): `/command-center*`
   and `/api/command-center/*` require exact owner authorization via
   requireCommandCenterOwner (src/lib/server/command-center-guard.ts), run
   DIRECTLY in this middleware (Node runtime, like the deployed p06 line) —
   no internal self-fetch, so nothing depends on how the request URL resolves
   behind Cloudflare Tunnel / Vercel Preview protection. Every handler re-runs
   the same check itself; this layer only adds early rejection + login
   redirects. Host headers are used for ROUTING ONLY, never authorization.
   ══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";
import { requireCommandCenterOwner } from "@/lib/server/command-center-guard";
import { isMachineRoutePath, isDeviceRoutePath } from "@/lib/server/command-center-routes";
import { safeCommandCenterNext } from "@/lib/command-center-next";

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

/**
 * Next's middleware adapter requires an ABSOLUTE Location (a relative one 500s,
 * verified against a production build). Build it from the Host header the browser
 * actually used plus x-forwarded-proto (the tunnel/CDN terminates TLS), never from
 * x-forwarded-host. This is a redirect target for the requester themselves, not an
 * authorization input; `next` is validated by safeCommandCenterNext.
 */
function loginRedirect(req: NextRequest, next: string): NextResponse {
  // A `cc_device` cookie present at all (valid or not — the unlock page's
  // own preflight tells the owner which, and links to Firebase sign-in if
  // it's no longer trusted) means this browser was previously enrolled, so
  // send it to the low-friction PIN unlock instead of straight to Firebase
  // email/password (founder Priority 1 decision: "no second PIN prompt
  // after successful unlock" implies PIN-first on a known device, not
  // Firebase-first). A device with no such cookie has never been enrolled
  // and goes to Firebase sign-in as before.
  const hasDeviceCookie = !!req.cookies.get("cc_device")?.value;
  const path = hasDeviceCookie
    ? `/command-center/unlock?next=${encodeURIComponent(next)}`
    : `/command-login?next=${encodeURIComponent(next)}`;
  let target: URL;
  try {
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https"
        ? "https"
        : req.nextUrl.protocol.replace(":", "");
    const host = req.headers.get("host") || req.nextUrl.host;
    target = new URL(path, `${proto}://${host}`);
  } catch {
    target = new URL(path, req.nextUrl.origin);
  }
  return NextResponse.redirect(target, { status: 307, headers: { "cache-control": "no-store" } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // command.parallaxvinc.com (or any command.* host) root → Command Center.
  // The Cloudflare tunnel forwards the original host (sometimes via
  // x-forwarded-host); we rebuild the redirect on that host so the user stays
  // on their domain instead of bouncing to localhost. ROUTING ONLY — the real
  // authorization decision happens below, independent of this value.
  const fwdHost = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  if (pathname === "/" && fwdHost.startsWith("command.")) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const r = NextResponse.redirect(new URL("/command-center", `${proto}://${fwdHost}`));
    r.headers.set("Cache-Control", "no-store"); // host-derived: never cacheable
    return r;
  }

  if (pathname.startsWith("/command-center") || pathname.startsWith("/api/command-center")) {
    // Machine routes authenticate themselves with their own secret (listed in
    // command-center-routes.ts; each verifies on every method). Exact-match only.
    if (isMachineRoutePath(pathname)) {
      return NextResponse.next();
    }
    // Device routes (the PIN-unlock API) and the unlock page itself are
    // exempt from the Firebase owner gate on purpose — that gate is exactly
    // what they exist to let an already-enrolled device skip. The route
    // itself (verifyDeviceCookie) still fails closed on a missing/invalid
    // device credential; see command-center-device-trust.ts.
    if (isDeviceRoutePath(pathname) || pathname === "/command-center/unlock") {
      return NextResponse.next();
    }

    const isApi = pathname.startsWith("/api/command-center");
    const guard = await requireCommandCenterOwner(req);
    if (!guard.ok) {
      if (isApi) {
        return NextResponse.json(
          { ok: false, error: "denied", reason: guard.reason },
          { status: guard.status, headers: { "cache-control": "no-store" } }
        );
      }
      // Misconfiguration or a blocked browser mutation must not bounce to the
      // login page (that would loop / hide the problem): answer directly.
      if (guard.status === 503 || (guard.status === 403 && guard.reason !== "not_owner")) {
        return new NextResponse(guard.status === 503 ? "Service unavailable" : "Forbidden", {
          status: guard.status,
          headers: { "cache-control": "no-store" },
        });
      }
      return loginRedirect(req, safeCommandCenterNext(pathname + req.nextUrl.search));
    }

    const response = NextResponse.next();
    response.headers.set("cache-control", "private, no-store");
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
  // Node runtime so owner verification (firebase-admin) runs directly here.
  runtime: "nodejs",
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
