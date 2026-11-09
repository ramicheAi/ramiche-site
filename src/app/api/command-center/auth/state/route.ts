import { NextResponse } from "next/server";
import {
  FOUNDER_GUARD_ENFORCE_ENV,
  verifyFounderAuthority,
} from "@/lib/server/founder-authority";

export const dynamic = "force-dynamic";

/**
 * GET /api/command-center/auth/state
 *
 * Cheap, read-only truth about the founder session the browser is holding. The client
 * uses this to recover instead of guessing: `sessionStorage` can say "unlocked" while the
 * server-signed cookie has expired or been revoked, and every privileged call would then
 * 401 with no way back except a manual reload.
 *
 * 200 `{ authenticated: true, expiresAt, enforcement }`
 * 401 `{ authenticated: false, code, reason, enforcement }`
 *
 * It never mints, refreshes or extends a session, and it reveals nothing about the PIN.
 */
export async function GET(request: Request) {
  const enforcement = (() => {
    const raw = process.env[FOUNDER_GUARD_ENFORCE_ENV]?.trim().toLowerCase();
    if (!raw) return { on: false, routes: [] as string[] };
    const routes = raw.split(",").map((k) => k.trim()).filter(Boolean);
    return { on: routes.includes("all") || routes.length > 0, routes };
  })();

  const result = verifyFounderAuthority(request);
  if (result.authorized) {
    return NextResponse.json(
      { authenticated: true, expiresAt: result.expiresAt, issuedAt: result.issuedAt, enforcement },
      { headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    { authenticated: false, code: "founder_authority_required", reason: result.reason, enforcement },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}
