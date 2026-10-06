/**
 * P06 M6C: the execution routes through the REAL owner guards. While PRODUCTION_DISPATCH_ENABLED is false the founder
 * gets production_dispatch_disabled before any read, and every fleet credential or claimed agent identity is denied.
 * Nothing reaches git, the store or the CLI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueCsrfToken } from "@/lib/server/csrf";

const { sessionVerifier, spies } = vi.hoisted(() => ({ sessionVerifier: vi.fn(), spies: { git: vi.fn(), tip: vi.fn(), run: vi.fn(), shadow: vi.fn() } }));
vi.mock("@/lib/firebase-admin", async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));
vi.mock("@/lib/execution/git", async (orig) => ({ ...(await orig<object>()), git: spies.git, remoteBranchTip: spies.tip }));
vi.mock("@/lib/execution/executor", async (orig) => ({ ...(await orig<object>()), runExecution: spies.run }));
vi.mock("@/lib/command/service", async (orig) => ({ ...(await orig<object>()), getShadow: spies.shadow }));

const OWNER = "owner_fixture_only";
const COOKIE = "fixture-session-".repeat(5);
const ORIGIN = "https://cockpit.example";

beforeEach(() => {
  vi.stubEnv("PARALLAX_OWNER_UID", OWNER);
  vi.stubEnv("PARALLAX_TRUSTED_ORIGINS", ORIGIN);
  vi.stubEnv("PARALLAX_CSRF_SECRET", "fixture-not-a-real-secret-".repeat(3));
  vi.stubEnv("OPENCLAW_CC_WEBHOOK_TOKEN", "fixture-openclaw-bearer-0123456789");
  vi.stubEnv("BRIDGE_API_SECRET", "fixture-bridge-secret-0123456789");
  vi.stubEnv("PARALLAX_MISSIONS_AGENT_TOKEN", "fixture-missions-token-0123456789");
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const founder = (): Record<string, string> => {
  const t = issueCsrfToken(COOKIE);
  return { origin: ORIGIN, "content-type": "application/json", cookie: `__session=${COOKIE}`, ...(t.ok ? { "x-parallax-csrf": t.token } : {}) };
};
async function post(route: "prepare" | "approve", headers: Record<string, string>, body: unknown) {
  const m = await import(`@/app/api/command-center/execution/${route}/route`);
  const res: Response = await m.POST(new NextRequest(`${ORIGIN}/api/command-center/execution/${route}`, { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}
const BODY = { commandId: "9e000000-0000-4000-8000-000000000001", capability: "L2", project: "mettle", bindingHash: "a".repeat(64) };
const nothingTouched = () => { for (const s of Object.values(spies)) expect(s).not.toHaveBeenCalled(); };

describe("execution routes while production dispatch is off", () => {
  it("the founder gets production_dispatch_disabled from both routes, before any read, git call or run", async () => {
    for (const r of ["prepare", "approve"] as const) {
      const out = await post(r, founder(), BODY);
      expect(out.status).toBe(403);
      expect(out.json.error.code).toBe("production_dispatch_disabled");
    }
    nothingTouched();
  });

  it("fleet credentials and claimed agent identities are denied by the owner guard (direct API bypass, machine caller)", async () => {
    const attempts: Record<string, string>[] = [
      { origin: ORIGIN, "content-type": "application/json", authorization: "Bearer fixture-openclaw-bearer-0123456789", "x-parallax-agent": "atlas" },
      { origin: ORIGIN, "content-type": "application/json", "x-bridge-secret": "fixture-bridge-secret-0123456789", "x-parallax-agent": "triage" },
      { origin: ORIGIN, "content-type": "application/json", "x-parallax-missions-token": "fixture-missions-token-0123456789" },
      { "content-type": "application/json", cookie: `__session=${COOKIE}` },   // founder cookie, no origin/CSRF
    ];
    for (const h of attempts) for (const r of ["prepare", "approve"] as const) {
      const out = await post(r, h, BODY);
      expect([401, 403]).toContain(out.status);
      expect(out.json.error.code).not.toBe("production_dispatch_disabled");   // stopped by the guard, before the gate
    }
    nothingTouched();
  });

  it("a session that is not the owner is denied", async () => {
    sessionVerifier.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    for (const r of ["prepare", "approve"] as const) expect([401, 403]).toContain((await post(r, founder(), BODY)).status);
    nothingTouched();
  });
});
