/**
 * Protection inventory for EVERY API route, not just /api/command-center
 * (CC-SECURITY-RELEASE-READINESS-03). A new route.ts that is not listed here fails
 * this test, so nothing becomes reachable without someone deciding how it is protected.
 *
 * Classes:
 *  CC_OWNER        owner-only (ownerOnly / requireCommandCenterOwner); asserted in authorization-inventory.test.ts
 *  CC_MACHINE      own secret, listed in MACHINE_ROUTES
 *  CC_MACHINE_EXT  non-command-center machine route with its own secret (bridge POST, cron)
 *  SESSION         Firebase session/ID-token flow (auth endpoints, stripe connect)
 *  PROVIDER_SIG    third-party signature (Stripe webhook)
 *  PUBLIC          unauthenticated by product design (marketing forms, checkout, health)
 *  OPEN_FINDING    UNAUTHENTICATED today and not fixed here because it belongs to METTLE / another
 *                  product and a fix needs that owner's decision. Tracked in the readiness doc.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

type Cls = "CC_OWNER" | "CC_MACHINE_EXT" | "SESSION" | "PROVIDER_SIG" | "PUBLIC" | "OPEN_FINDING";

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
  "stripe/connect": "SESSION",
  "stripe/webhook": "PROVIDER_SIG",
  "meet-results/cron": "OPEN_FINDING", // fail-open when CRON_SECRET unset, plain !== compare, ?secret= accepted
  "health": "PUBLIC",
  "free-audit": "PUBLIC",
  "studio-inquiry": "PUBLIC",
  "stripe/checkout": "PUBLIC",
  "stripe/agents-checkout": "PUBLIC",
  "stripe/portal": "OPEN_FINDING", // IDOR: any customerId returns a billing-portal URL; return_url from Origin
  "power-challenge/checkout": "PUBLIC",
  "power-challenge/admin": "SESSION", // x-admin-pin
  "power-challenge/export": "SESSION", // admin credential
  "sentry-smoke": "PUBLIC", // token-gated no-op
  // Known unauthenticated, other-product surfaces. NOT fixed here; see readiness doc.
  "bff/athlete": "OPEN_FINDING",
  "bff/coach": "OPEN_FINDING",
  "bff/parent": "OPEN_FINDING",
  "meet-results": "OPEN_FINDING",
  "meet-schedule": "OPEN_FINDING",
  "notifications/send": "OPEN_FINDING",
  "power-challenge/registrations": "OPEN_FINDING",
  "push/send": "OPEN_FINDING", // called by apex-athlete coach page; needs METTLE auth design
  "push/subscribe": "OPEN_FINDING",
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
