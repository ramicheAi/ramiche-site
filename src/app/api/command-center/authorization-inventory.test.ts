/**
 * CC-SECURITY-RECONCILIATION-02 — Command Center authorization inventory.
 *
 * Proves, per route file and per exported HTTP method, that:
 *  - every route is classified (HUMAN owner-only, or MACHINE with its own secret),
 *  - a HUMAN handler denies at the handler itself (middleware NOT involved),
 *    for: no session, invalid session, non-owner, anonymous/custom provider,
 *    unconfigured owner — and never runs its own logic,
 *  - every MACHINE handler rejects missing/wrong/unset secrets on EVERY method.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
// Backs the DEVICE-route deny-at-handler block below — the pin route's own
// device-trust check reads this table via getSupabaseAdmin.
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));
// The scheduler route would otherwise run the real prospector (network + DB) on a valid secret.
vi.mock("@/lib/server/prospector-daily", () => ({ runProspectorDaily: async () => new Response("{}", { status: 200 }) }));

import { MACHINE_ROUTES, DEVICE_ROUTES } from "@/lib/server/command-center-routes";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const ROOT = __dirname;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    // any route.* extension, so a route.js / route.tsx cannot go unclassified
    return statSync(p).isDirectory() ? walk(p) : /^route\.(ts|tsx|js|jsx|mjs)$/.test(n) ? [p] : [];
  });
}
// Routes OUTSIDE /api/command-center that read or write Command Center data (independent
// review B1/B2). Owner-only for the listed methods; bridge POST is a secret-gated machine sync.
const API_ROOT = join(__dirname, "..");
const EXTRA_HUMAN: Array<[string, string[]]> = [
  ["bridge/route.ts", ["GET", "PATCH"]],
  ["bridge/tasks/route.ts", ["GET", "POST"]],
  ["bridge/chat/route.ts", ["GET", "POST"]],
  ["bridge/crons/route.ts", ["GET", "POST"]],
  ["atlas/chat/route.ts", ["GET", "POST"]],
  ["pipeline-tasks/route.ts", ["GET"]],
  ["test-supabase/route.ts", ["GET"]],
];
const files = walk(ROOT).sort();
const routePath = (f: string) => "/api/command-center/" + relative(ROOT, f).split(sep).slice(0, -1).join("/");
const isMachine = (f: string) => routePath(f) in MACHINE_ROUTES;
const isDevice = (f: string) => routePath(f) in DEVICE_ROUTES;

const OWNER = "the-real-owner-uid";
const ctx = { params: Promise.resolve({ id: "x", path: ["a"] }) };
const mk = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost" + "/api/command-center/x", { method: method === "HEAD" ? "GET" : method, headers });

describe("route classification", () => {
  it("finds the full route set (guard against the glob silently matching nothing)", () => {
    expect(files.length).toBeGreaterThanOrEqual(60);
  });

  it("every machine route listed actually exists", () => {
    const existing = new Set(files.map(routePath));
    for (const p of Object.keys(MACHINE_ROUTES)) expect(existing.has(p), p).toBe(true);
  });

  it.each(files.filter((f) => !isMachine(f) && !isDevice(f)).map((f) => [routePath(f), f]))(
    "HUMAN %s: every exported method is owner-guarded in the file itself",
    (_p, f) => {
      const src = readFileSync(f as string, "utf8");
      const GUARD_CALL = /requireCommandCenterOwner\(|requireFreshFirebaseOwnerSession\(/;
      const reexport = /^export \{[^}]*\} from "([^"]+)"/m.exec(src);
      if (reexport) {
        const target = join((f as string).replace(/route\.ts$/, ""), reexport[1] + ".ts");
        expect(readFileSync(target, "utf8")).toMatch(new RegExp(`${GUARD_CALL.source}|ownerOnly\\(`));
        return;
      }
      const plain = METHODS.filter((m) => new RegExp(`^export (async )?function ${m}\\b`, "m").test(src));
      expect(plain, "unwrapped exported handler (must use ownerOnly or an in-handler guard)").toSatisfy((arr: string[]) =>
        arr.every(() => GUARD_CALL.test(src))
      );
      for (const m of METHODS) {
        if (new RegExp(`^export const ${m} = `, "m").test(src)) {
          expect(src).toMatch(new RegExp(`^export const ${m} = ownerOnly\\(`, "m"));
        }
      }
      expect(plain.length === 0 ? /ownerOnly\(/.test(src) : GUARD_CALL.test(src)).toBe(true);
    }
  );

  it("every device route listed actually exists", () => {
    const existing = new Set(files.map(routePath));
    for (const p of Object.keys(DEVICE_ROUTES)) expect(existing.has(p), p).toBe(true);
  });

  it.each(files.filter(isDevice).map((f) => [routePath(f), f]))(
    "DEVICE %s: every exported method verifies the device-trust credential in the file itself",
    (_p, f) => {
      const src = readFileSync(f as string, "utf8");
      // Three distinct DEVICE credential shapes now exist (pin's device
      // cookie, bootstrap's static secret, redeem's one-time code) — any
      // one of these verification calls counts, per founder correction
      // CC-PRODUCTION-OWNER-RECOVERY-01 follow-up.
      expect(src).toMatch(/verifyDeviceCookie\(|bootstrapEnrollDevice\(|redeemEnrollmentApprovalCode\(/);
    }
  );
});

describe("HUMAN routes deny at the handler (no middleware involved)", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    verifySessionCookie.mockReset();
    verifySessionCookie.mockResolvedValue(null);
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  const human = files.filter((f) => !isMachine(f) && !isDevice(f));

  it.each(human.map((f) => [routePath(f), f]))("%s", async (_p, f) => {
    const mod = (await import(/* @vite-ignore */ f as string)) as Record<string, unknown>;
    const handlers = METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length).toBeGreaterThan(0);

    for (const m of handlers) {
      const fn = mod[m] as (r: Request, c: unknown) => Promise<Response>;

      // 1. no session
      let res = await fn(mk(m), ctx);
      expect(res.status, `${m} no-session`).toBe(401);

      // 2. cookie present but fails verification (expired / revoked / forged)
      res = await fn(mk(m, { cookie: "__session=forged-or-revoked-cookie-value", "sec-fetch-site": "same-origin" }), ctx);
      expect(res.status, `${m} invalid-session`).toBe(401);

      // 3. valid human, not the owner
      verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
      res = await fn(mk(m, { cookie: "__session=valid-nonowner", "sec-fetch-site": "same-origin" }), ctx);
      expect(res.status, `${m} non-owner`).toBe(403);

      // 4. owner uid but anonymous/custom provider
      for (const p of ["anonymous", "custom"]) {
        verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: p });
        res = await fn(mk(m, { cookie: "__session=anon", "sec-fetch-site": "same-origin" }), ctx);
        expect(res.status, `${m} ${p}`).toBe(401);
      }

      // 5. forged identity/host headers only
      verifySessionCookie.mockResolvedValue(null);
      res = await fn(
        mk(m, { "x-forwarded-host": "command.parallaxvinc.com", host: "command.parallaxvinc.com", "x-user-id": OWNER, authorization: `Bearer ${OWNER}` }),
        ctx
      );
      expect(res.status, `${m} forged-headers`).toBe(401);

      // 6. owner not configured -> fail closed even with a "valid" session
      delete process.env[OWNER_UID_ENV];
      verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
      res = await fn(mk(m, { cookie: "__session=valid", "sec-fetch-site": "same-origin" }), ctx);
      expect(res.status, `${m} owner-unconfigured`).toBe(503);
      process.env[OWNER_UID_ENV] = OWNER;
      verifySessionCookie.mockResolvedValue(null);
    }
  });

  it("a cross-site cookie-bearing mutation is rejected at the handler even for the real owner", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
    const mod = (await import("./leads/send/route")) as { POST: (r: Request) => Promise<Response> };
    const res = await mod.POST(
      new Request("http://localhost/api/command-center/leads/send", {
        method: "POST",
        headers: { cookie: "__session=owner", "sec-fetch-site": "cross-site", "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(res.status).toBe(403);
  });
});

describe("DEVICE routes deny at the handler without a valid device-trust credential", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    getSupabaseAdmin.mockReset();
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  // Scoped to the pin route specifically: bootstrap (static secret) and
  // redeem (one-time code) are also DEVICE-classified but use a different
  // credential shape than a `cc_device` cookie, and have their own
  // dedicated tests (command-center-device-trust.test.ts /
  // device-bootstrap-and-redeem.test.ts) rather than this generic loop.
  const device = files.filter(isDevice).filter((f) => routePath(f) === "/api/command-center/auth/pin");

  it.each(device.map((f) => [routePath(f), f]))("%s", async (_p, f) => {
    const mod = (await import(/* @vite-ignore */ f as string)) as Record<string, unknown>;
    const handlers = METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length).toBeGreaterThan(0);

    for (const m of handlers) {
      const fn = mod[m] as (r: Request) => Promise<Response>;
      // No DB configured at all: GET must still answer (preflight, no secrets,
      // reports deviceTrusted:false); POST (a mutation gated on device trust)
      // must deny.
      getSupabaseAdmin.mockReturnValue(null);
      const res = await fn(mk(m, { "sec-fetch-site": "same-origin" }));
      if (m === "GET" || m === "HEAD") {
        expect(res.status, `${m} no-device-no-db`).toBe(200);
      } else {
        expect(res.status, `${m} no-device-no-db`).not.toBe(200);
      }

      // A device cookie that doesn't match anything in the table: denied,
      // never treated as trusted.
      const query: Record<string, unknown> = { data: null, error: null };
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.maybeSingle = vi.fn(() => query);
      getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => query) });
      const resBadDevice = await fn(
        mk(m, { "sec-fetch-site": "same-origin", cookie: `cc_device=11111111-1111-1111-1111-111111111111.${"a".repeat(64)}` })
      );
      if (m === "GET" || m === "HEAD") {
        const body = await resBadDevice.clone().json().catch(() => null);
        expect((body as { deviceTrusted?: boolean } | null)?.deviceTrusted, `${m} bad-device deviceTrusted`).toBe(false);
      } else {
        expect(resBadDevice.status, `${m} bad-device`).not.toBe(200);
      }
    }
  });
});

describe("Command Center data routes outside /api/command-center are owner-only too", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    verifySessionCookie.mockReset();
    verifySessionCookie.mockResolvedValue(null);
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  it.each(EXTRA_HUMAN)("%s", async (rel, methods) => {
    const mod = (await import(/* @vite-ignore */ join(API_ROOT, rel))) as Record<string, unknown>;
    for (const m of methods) {
      const fn = mod[m] as (r: Request, c: unknown) => Promise<Response>;
      expect((await fn(mk(m), ctx)).status, `${m} no-session`).toBe(401);
      verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
      expect((await fn(mk(m, { cookie: "__session=x", "sec-fetch-site": "same-origin" }), ctx)).status, `${m} non-owner`).toBe(403);
      verifySessionCookie.mockResolvedValue(null);
    }
  });
});

describe("the owner is actually let through (no wrapper drops params / locks the owner out)", () => {
  const original = process.env[OWNER_UID_ENV];
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    verifySessionCookie.mockReset();
    verifySessionCookie.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = original;
  });

  // Only the routes that depend on route context (params) are exercised as the owner:
  // running every handler would execute real side effects (shell, fs, outbound calls).
  // Generic context forwarding is unit-tested in command-center-guard.test.ts.
  it.each(["jobs/[id]/route.ts", "yolo-builds/preview/[...path]/route.ts"])("%s forwards route context for the owner", async (rel) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    const mod = (await import(/* @vite-ignore */ join(ROOT, rel))) as Record<string, unknown>;
    for (const m of METHODS.filter((x) => typeof mod[x] === "function")) {
      const fn = mod[m] as (r: Request, c: unknown) => Promise<Response>;
      try {
        const res = await fn(mk(m, { cookie: "__session=owner", "sec-fetch-site": "same-origin" }), ctx);
        const body = await res.clone().json().catch(() => null);
        expect(body && (body as { error?: string }).error === "denied", `${m} owner denied`).toBeFalsy();
      } catch {
        /* handler logic threw after passing the guard */
      }
    }
    vi.unstubAllGlobals();
  });
});

describe("MACHINE routes verify their own secret on EVERY exported method", () => {
  const envKeys = ["OPENCLAW_CC_WEBHOOK_TOKEN", "OPENCLAW_GATEWAY_TOKEN", "CC_PUSH_SECRET", "TELEGRAM_WEBHOOK_SECRET", "VAPI_WEBHOOK_SECRET", "PROSPECTOR_CRON_SECRET"];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => envKeys.forEach((k) => (saved[k] = process.env[k])));
  afterEach(() => envKeys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]))));

  const machine = files.filter(isMachine);

  const SECRET = "s3cret-value-for-test";
  const carriers: Record<string, (s: string) => Record<string, string>> = {
    "/api/command-center/chat/webhook": (s) => ({ authorization: `Bearer ${s}` }),
    "/api/command-center/push": (s) => ({ "x-cc-push-secret": s }),
    "/api/command-center/telegram/webhook": (s) => ({ "X-Telegram-Bot-Api-Secret-Token": s }),
    "/api/command-center/voice/call/webhook": (s) => ({ "x-vapi-secret": s }),
    "/api/command-center/prospector/cron": (s) => ({ "x-cron-secret": s }),
  };
  const envFor: Record<string, string> = {
    "/api/command-center/chat/webhook": "OPENCLAW_CC_WEBHOOK_TOKEN",
    "/api/command-center/push": "CC_PUSH_SECRET",
    "/api/command-center/telegram/webhook": "TELEGRAM_WEBHOOK_SECRET",
    "/api/command-center/voice/call/webhook": "VAPI_WEBHOOK_SECRET",
    "/api/command-center/prospector/cron": "PROSPECTOR_CRON_SECRET",
  };

  it.each(machine.map((f) => [routePath(f), f]))("%s", async (p, f) => {
    const mod = (await import(/* @vite-ignore */ f as string)) as Record<string, unknown>;
    const handlers = METHODS.filter((m) => typeof mod[m] === "function");
    expect(handlers.length).toBeGreaterThan(0);
    const carrier = carriers[p as string];
    const env = envFor[p as string];

    for (const m of handlers) {
      const fn = mod[m] as (r: Request) => Promise<Response>;
      const body = m === "GET" ? undefined : "{}";
      const call = (headers: Record<string, string>) =>
        fn(new Request("http://localhost" + p, { method: m, headers: { "content-type": "application/json", ...headers }, body }) as never);

      // secret configured: missing / wrong / wrong-length / same-prefix all denied
      for (const k of envKeys) delete process.env[k];
      process.env[env] = SECRET;
      expect((await call({})).status, `${m} missing`).toBe(401);
      expect((await call(carrier("wrong"))).status, `${m} wrong`).toBe(401);
      expect((await call(carrier(SECRET + "x"))).status, `${m} longer`).toBe(401);
      expect((await call(carrier(SECRET.slice(0, -1)))).status, `${m} prefix`).toBe(401);
      expect((await call({ authorization: "Bearer " })).status, `${m} empty bearer`).toBe(401);

      // secret UNSET: fails closed even if the caller sends an empty / any value
      delete process.env[env];
      for (const k of ["OPENCLAW_GATEWAY_TOKEN"]) delete process.env[k];
      expect((await call({})).status, `${m} unset+none`).toBe(401);
      expect((await call(carrier(""))).status, `${m} unset+empty`).toBe(401);
      expect((await call(carrier("anything"))).status, `${m} unset+any`).toBe(401);

      // a session cookie is NOT a substitute for the machine secret
      process.env[env] = SECRET;
      expect((await call({ cookie: "__session=owner" })).status, `${m} cookie`).toBe(401);
    }
  });

  it("the correct secret is accepted (not 401) on the authenticated methods", async () => {
    for (const f of machine) {
      const p = routePath(f);
      const mod = (await import(/* @vite-ignore */ f)) as Record<string, unknown>;
      process.env[envFor[p]] = SECRET;
      const m = mod.POST ? "POST" : "GET";
      const res = await (mod[m] as (r: Request) => Promise<Response>)(
        new Request("http://localhost" + p, { method: m, headers: { "content-type": "application/json", ...carriers[p](SECRET) }, body: "{}" }) as never
      );
      expect(res.status, p).not.toBe(401);
      delete process.env[envFor[p]];
    }
  });
});
