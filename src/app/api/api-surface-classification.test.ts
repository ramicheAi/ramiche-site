/**
 * Protection inventory for EVERY API route, not just /api/command-center
 * (CC-SECURITY-RELEASE-READINESS-03). A new route.ts that is not listed here fails
 * this test, so nothing becomes reachable without someone deciding how it is protected.
 *
 * Classes:
 *  CC_OWNER        owner-only (ownerOnly / requireCommandCenterOwner); asserted in authorization-inventory.test.ts
 *  CC_MACHINE      own secret, listed in MACHINE_ROUTES
 *  CC_MACHINE_EXT  non-command-center machine route with its own secret (bridge POST, cron)
 *  SESSION         Firebase session/ID-token flow (auth endpoints)
 *  PROVIDER_SIG    third-party signature (Stripe webhook)
 *  PUBLIC          unauthenticated by product design (marketing forms, checkout, health)
 *  OPEN_FINDING    UNAUTHENTICATED today and not fixed here because it belongs to METTLE / another
 *                  product and a fix needs that owner's decision. Tracked in the readiness doc.
 *  DISABLED        intentionally returns 404 for every caller; not a gap, a deliberate kill of an
 *                  unused surface pending a trusted design (CC-CLOSURE-02)
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

type Cls = "CC_OWNER" | "CC_MACHINE_EXT" | "SESSION" | "PROVIDER_SIG" | "PUBLIC" | "OPEN_FINDING" | "DISABLED";

const SURFACE: Record<string, Cls> = {
  "atlas/chat": "CC_OWNER",
  "pipeline-tasks": "CC_OWNER",
  "test-supabase": "CC_OWNER",
  "bridge": "CC_MACHINE_EXT", // POST x-bridge-secret; GET/PATCH owner-only
  "bridge/chat": "CC_OWNER",
  "bridge/crons": "CC_OWNER",
  "bridge/tasks": "CC_OWNER",
  "auth/command-session": "SESSION",
  "auth/session": "SESSION",
  "meet-results/cron": "CC_MACHINE_EXT", // HOTFIX-SECURITY-001: bearer secret only, timing-safe, fails closed when unset
  "health": "PUBLIC",
  "free-audit": "PUBLIC",
  "studio-inquiry": "PUBLIC",
  "power-challenge/checkout": "PUBLIC",
  "power-challenge/admin": "CC_OWNER", // HOTFIX-SECURITY-001: ownerOnly; the published PIN is gone
  "power-challenge/export": "CC_OWNER", // HOTFIX-SECURITY-001: ownerOnly; the published PIN is gone
  "sentry-smoke": "PUBLIC", // token-gated no-op
  // CC-CLOSURE-02: .vercelignore excluded these from every deployment for months (unrelated to
  // this release — see .vercelignore's own comment), which collided with Next's output-file
  // tracing and broke `vercel deploy --prebuilt`. Disabled explicitly at the code layer instead,
  // so unreachability is an auditable decision, not an accidental side effect of a deploy-ignore
  // line, and .vercelignore no longer needs to exclude them. Observed production behavior
  // (404, confirmed live before this change) is unchanged. See CC-STRIPE-RECOVERY-01 for the
  // separately-queued functional restoration work.
  "stripe/checkout": "DISABLED",
  "stripe/agents-checkout": "DISABLED",
  "stripe/connect": "DISABLED",
  "stripe/portal": "DISABLED", // CC-CLOSURE-02: no trusted uid mapping exists yet and no caller anywhere; disabled (404) rather than shipped fallback-only
  "stripe/webhook": "DISABLED",
  "notifications/send": "DISABLED",
  "push/send": "DISABLED", // was OPEN_FINDING ("called by apex-athlete coach page"); already 404 in production before this change
  "push/subscribe": "DISABLED",
  // Known unauthenticated, other-product surfaces. NOT fixed here; see readiness doc.
  "bff/athlete": "OPEN_FINDING",
  "bff/coach": "OPEN_FINDING",
  "bff/parent": "OPEN_FINDING",
  "meet-results": "OPEN_FINDING",
  "meet-schedule": "OPEN_FINDING",
  "power-challenge/registrations": "OPEN_FINDING",
  "swimcloud": "OPEN_FINDING",
};

const API = join(__dirname);
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n === "route.ts" ? [p] : [];
  });
}
const routes = walk(API)
  .map((f) => relative(API, f).split(sep).slice(0, -1).join("/"))
  .filter((r) => r !== "command-center" && !r.startsWith("command-center/"))
  .sort();

describe("API surface outside /api/command-center is fully classified", () => {
  it("found the route set", () => expect(routes.length).toBeGreaterThan(20));
  it("every route is classified (an unclassified new route fails here)", () => {
    expect(routes.filter((r) => !(r in SURFACE))).toEqual([]);
  });
  it("no stale classification for a route that no longer exists", () => {
    expect(Object.keys(SURFACE).filter((k) => !routes.includes(k))).toEqual([]);
  });
});
