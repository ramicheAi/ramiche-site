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

  // Each fire must be a NEW Sentry issue so the "Atlas Auto-Fix: New Error"
  // alert rule re-triggers. Earlier attempts varied the error class name,
  // but Sentry's default grouping is by stack location + exception type
  // (not message or class name), so all fires collapsed onto one issue.
  //
  // The correct lever is scope.setFingerprint() — that overrides grouping
  // entirely. A per-fire fingerprint guarantees a fresh issue every time.
  const stamp = Date.now();
  Sentry.withScope((scope) => {
    scope.setFingerprint([`sentry-smoke-${stamp}`]);
    scope.setTag("smoke_test", "true");
    scope.setTag("smoke_run_id", stamp.toString());
    scope.setContext("smoke_test", {
      source: "ramon",
      purpose: "verify Sentry → Atlas → GitHub auto-fix loop",
      endpoint: "/api/sentry-smoke",
      stamp,
    });
    Sentry.captureException(
      new Error(
        `[E2E SMOKE FROM RAMON @${stamp}] Intentional capture to verify auto-fix loop. Safe to ignore + close.`,
      ),
    );
  });

  // Flush before responding so the event actually reaches Sentry on
  // Vercel's short-lived serverless runtime. Without flush() the function
  // can return before the network call completes.
  await Sentry.flush(2000);

  // Return 500 directly instead of throwing. A throw would be caught by
  // Sentry's onRequestError instrumentation and create a SECOND (grouped)
  // issue under the route-handler stack — we only want the one fingerprinted
  // event captured above.
  return new NextResponse(
    JSON.stringify({
      ok: false,
      smoke: true,
      stamp,
      msg: "intentional smoke fire — event captured to Sentry with unique fingerprint",
    }),
    { status: 500, headers: { "content-type": "application/json" } },
  );
}
