/* ══════════════════════════════════════════════════════════════
   METTLE — Middleware (Task 1a: Firebase session gate)

   Protected: /coach/*, /athlete/*, and METTLE /apex-athlete/coach|athlete.
   Unauthenticated → /portal (see next.config redirect → /apex-athlete/portal).
   Public: /portal, /api/auth, /_next, /favicon.ico (+ METTLE auth entry paths).

   Session verification calls GET /api/auth/session (Node + firebase-admin);
   middleware runs on Edge and cannot import firebase-admin directly.

   Command Center (CC-P06-SECURITY-RECONCILIATION-01): `/command-center*` and
   `/api/command-center/*` require the SAME session check PLUS exact owner
   authorization (`isOwner`, computed server-side in /api/auth/session — see
   src/lib/server/command-center-auth.ts). The previous gate here was a
   host-header string allowlist (`command.*` / `localhost` / `127.0.0.1` /
   `*.ts.net`) used as the ONLY check — a forgeable-header, zero-identity
   control. Host is now used for ROUTING ONLY (which domain "/" redirects to);
   it is never, by itself, authorization.
   ══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "__session";

const PROTECTED_PREFIXES = [
  "/coach",
  "/athlete",
  "/apex-athlete/coach",
  "/apex-athlete/athlete",
] as const;

/**
 * Command Center routes that authenticate their own caller with a static
 * bearer secret (OpenClaw gateway / external agent push), never a user
 * session cookie. The owner-session gate and the CSRF check below are both
 * cookie/session-specific and do not apply to them — see their own
 * `authOk`/`authorize` checks in each route handler.
 */
const BEARER_AUTH_CC_PATHS = ["/api/command-center/chat/webhook", "/api/command-center/push"] as const;

function isBearerAuthenticatedCCPath(pathname: string): boolean {
  return BEARER_AUTH_CC_PATHS.some((p) => pathname === p);
}

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

/** The Command Center owner gate: authenticated AND the exact configured owner. */
async function commandCenterAuthorized(req: NextRequest): Promise<boolean> {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  if (!raw || raw.length < 20) return false;

  try {
    const verifyUrl = new URL("/api/auth/session", req.url);
    const res = await fetch(verifyUrl, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { authenticated?: boolean; isOwner?: boolean };
    return body.authenticated === true && body.isOwner === true;
  } catch {
    return false;
  }
}

function isMutatingMethod(method: string): boolean {
  return method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * CSRF guard for cookie-authenticated mutations: a cross-site POST/PUT/
 * PATCH/DELETE is rejected even if the browser still sends the session
 * cookie. `Sec-Fetch-Site` is authoritative when present (all modern
 * browsers); `Origin` is the fallback. Neither header existing (a non-browser
 * client) is NOT treated as cross-site — those callers don't carry the
 * `__session` cookie either, so the owner-session check below already
 * denies them.
 */
function isCrossSiteMutation(req: NextRequest, requestHost: string): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") return true;

  const originHost = hostOf(req.headers.get("origin"));
  if (originHost && requestHost && originHost !== requestHost) return true;

  return false;
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
    return NextResponse.redirect(new URL("/command-center", `${proto}://${fwdHost}`));
  }

  if (pathname.startsWith("/command-center") || pathname.startsWith("/api/command-center")) {
    if (isBearerAuthenticatedCCPath(pathname)) {
      return NextResponse.next();
    }

    const isApi = pathname.startsWith("/api/command-center");

    if (isMutatingMethod(req.method) && isCrossSiteMutation(req, fwdHost)) {
      return isApi
        ? NextResponse.json({ ok: false, error: "denied", reason: "cross_site" }, { status: 403 })
        : new NextResponse("Forbidden", { status: 403 });
    }

    const authorized = await commandCenterAuthorized(req);
    if (!authorized) {
      if (isApi) {
        return NextResponse.json({ ok: false, error: "denied", reason: "not_authorized" }, { status: 401 });
      }
      const login = new URL("/command-login", req.url);
      login.searchParams.set("next", pathname + req.nextUrl.search);
      return NextResponse.redirect(login);
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
