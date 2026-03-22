/* ══════════════════════════════════════════════════════════════
   METTLE — Middleware (Phase 5: Session Cookie Check)

   Non-blocking: if no session cookie exists, request passes through.
   This preserves backwards compatibility with localStorage auth.
   Once Phase 6 removes localStorage, this becomes the sole gate.
   ══════════════════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "mettle_session";

// Routes that will eventually require auth (Phase 6)
// For now, just attach user info if cookie exists
const PROTECTED_PREFIX = "/apex-athlete";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only inspect apex-athlete routes
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Skip API routes and static assets
  if (pathname.startsWith("/api/") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get(COOKIE_NAME)?.value;

  // Phase 5: Passthrough mode — attach header if cookie exists, don't block
  const res = NextResponse.next();
  if (sessionCookie) {
    res.headers.set("x-mettle-session", "active");
  }
  return res;
}

export const config = {
  matcher: ["/apex-athlete/:path*"],
};
