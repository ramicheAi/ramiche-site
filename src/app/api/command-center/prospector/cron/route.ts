import { NextResponse } from "next/server";

import { runProspectorDaily } from "@/lib/server/prospector-daily";
import { bearerToken, timingSafeSecretEqual } from "@/lib/server/command-center-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Scheduler contract for the daily prospector (launchd/cron). Machine route:
 * no cookie, no CSRF, authenticated ONLY by PROSPECTOR_CRON_SECRET, sent as
 * `x-cron-secret` or `Authorization: Bearer`. Fails closed when the secret is unset.
 * POST only (state-changing).
 */
export async function POST(req: Request) {
  const expected = process.env.PROSPECTOR_CRON_SECRET?.trim() ?? "";
  const presented = req.headers.get("x-cron-secret") ?? bearerToken(req.headers);
  if (!timingSafeSecretEqual(presented, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return runProspectorDaily();
}
