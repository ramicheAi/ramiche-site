/* ── Sentry Auto-Fix Loop Smoke Test ─────────────────────────────
   Throwaway endpoint that intentionally throws, to verify the full
   Sentry → webhook listener → Atlas → GitHub issue → coding agent
   pipeline end-to-end. Hit it ONCE; the resulting Sentry "New Issue"
   alert fires the auto-fix loop.

   GATING: query param `?token=` must match SMOKE_TOKEN below.
   Without the token (e.g. crawlers, random hits) the route returns
   a benign 200 — no Sentry event, no loop spin.

   AFTER SMOKE: once the loop is verified, either delete this file
   or leave it. Sentry groups by exception location, so subsequent
   hits to the same throw site won't refire "New Issue" alerts
   until the original issue is resolved in the Sentry dashboard.
   ─────────────────────────────────────────────────────────────── */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Rotate or replace if anyone ever sees this in git history. For a
// throwaway endpoint on a single-developer site this is fine.
const SMOKE_TOKEN = "4e3a91-sentry-smoke-from-ramon-2026-05";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (token !== SMOKE_TOKEN) {
    // Silent no-op for anyone without the token — crawlers, scanners,
    // random clicks. No Sentry event generated.
    return NextResponse.json({ ok: true, msg: "nothing to see here" });
  }

  // Tag the event so it's obvious in Sentry that this was deliberate.
  Sentry.setTag("smoke_test", "true");
  Sentry.setTag("smoke_run_id", Date.now().toString());
  Sentry.setContext("smoke_test", {
    source: "ramon",
    purpose: "verify Sentry → Atlas → GitHub auto-fix loop",
    endpoint: "/api/sentry-smoke",
  });

  // Use a Date.now()-suffixed class name so every fire creates a NEW
  // Sentry issue (and therefore triggers "Atlas Auto-Fix: New Error" each
  // time). Avoids the need for release-tracked regression detection on a
  // smoke endpoint that we just want to exercise on demand.
  const stamp = Date.now();
  const errName = `SentryE2ESmokeError_${stamp}`;
  const ErrClass = class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = errName;
    }
  };

  throw new ErrClass(
    `[E2E SMOKE FROM RAMON @${stamp}] Intentional throw to verify auto-fix loop. Safe to ignore + close.`,
  );
}
