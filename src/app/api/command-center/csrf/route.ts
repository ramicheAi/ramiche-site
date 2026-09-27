/**
 * GET /api/command-center/csrf — mint session-bound CSRF evidence for the
 * authenticated owner. Read-only, no side effects, no CORS headers (so a
 * cross-origin page cannot read the response body).
 */
import { NextRequest, NextResponse } from "next/server";
import { guardPrivateRead } from "@/lib/server/protected-mutation";
import { CSRF_HEADER, issueCsrfToken } from "@/lib/server/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const guard = await guardPrivateRead(req);
  if (!guard.ok) return guard.response;

  const issued = issueCsrfToken(guard.sessionCookie);
  if (!issued.ok) {
    return NextResponse.json(
      { ok: false, error: "denied", reason: issued.reason },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  return NextResponse.json(
    { ok: true, header: CSRF_HEADER, token: issued.token, expiresAt: issued.expiresAt },
    { headers: { "cache-control": "no-store" } }
  );
}
