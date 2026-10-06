/**
 * P06 M6F: the cancel and health routes through the REAL owner guards. Cancel works while dispatch is off (stopping
 * work must survive a rollback) and only records a request; health is a founder-only read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { issueCsrfToken } from "@/lib/server/csrf";
import { memoryJobsDb } from "./__fixtures__/memory-jobs-db";
import { EXECUTOR_SOURCE } from "./store";

const { sessionVerifier, mem } = vi.hoisted(() => ({ sessionVerifier: vi.fn(), mem: { db: null as unknown } }));
vi.mock("@/lib/firebase-admin", async (orig) => ({ ...(await orig<object>()), verifySessionCookie: sessionVerifier }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: () => (mem.db ? { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ gte: async () => ({ count: 0, error: null }) }) }) }) }) } : null) }));
vi.mock("./supabase-jobs-db", () => ({ supabaseJobsDb: () => mem.db }));

const OWNER = "owner_fixture_only";
const COOKIE = "fixture-session-".repeat(5);
const ORIGIN = "https://cockpit.example";
const JOB = "3b1f6c2e-8d4a-4f7b-9c1e-2a5d7e9f0b99";
let m: ReturnType<typeof memoryJobsDb>;

beforeEach(() => {
  vi.stubEnv("PARALLAX_OWNER_UID", OWNER);
  vi.stubEnv("PARALLAX_TRUSTED_ORIGINS", ORIGIN);
  vi.stubEnv("PARALLAX_CSRF_SECRET", "fixture-not-a-real-secret-".repeat(3));
  vi.stubEnv("OPENCLAW_CC_WEBHOOK_TOKEN", "fixture-openclaw-bearer-0123456789");
  vi.stubEnv("CC_CLAUDE_BIN", "/nonexistent/claude");
  sessionVerifier.mockResolvedValue({ uid: OWNER, signInProvider: "password" });
  m = memoryJobsDb();
  mem.db = m.db;
  m.jobs.set(JOB, { id: JOB, status: "running", source: EXECUTOR_SOURCE, input: { executionId: "e1", bindingHash: "b".repeat(64) } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const founder = (): Record<string, string> => {
  const t = issueCsrfToken(COOKIE);
  return { origin: ORIGIN, "content-type": "application/json", cookie: `__session=${COOKIE}`, ...(t.ok ? { "x-parallax-csrf": t.token } : {}) };
};
const cancel = async (headers: Record<string, string>, body: unknown) => {
  const r = await import("@/app/api/command-center/execution/cancel/route");
  const res = await r.POST(new NextRequest(`${ORIGIN}/api/command-center/execution/cancel`, { method: "POST", headers, body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

describe("cancel route", () => {
  it("the founder's cancel is recorded even with dispatch off; repeats and unknown jobs answer plainly", async () => {
    expect(await cancel(founder(), { jobId: JOB })).toMatchObject({ status: 202, json: { data: { cancelRequested: true } } });
    expect(m.events.map((e) => e.kind)).toEqual(["cancel_requested"]);
    m.jobs.get(JOB)!.status = "canceled";
    expect((await cancel(founder(), { jobId: JOB })).status).toBe(409);
    expect((await cancel(founder(), { jobId: "3b1f6c2e-8d4a-4f7b-9c1e-2a5d7e9f0b00" })).status).toBe(404);
    expect((await cancel(founder(), { jobId: "not-a-uuid" })).status).toBe(400);
  });
  it("machine callers and other sessions are denied before anything is recorded", async () => {
    expect([401, 403]).toContain((await cancel({ origin: ORIGIN, "content-type": "application/json", authorization: "Bearer fixture-openclaw-bearer-0123456789" }, { jobId: JOB })).status);
    sessionVerifier.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    expect([401, 403]).toContain((await cancel(founder(), { jobId: JOB })).status);
    expect(m.events).toEqual([]);
  });
  it("a store read failure is a 503, not a silent no-op", async () => {
    m.fail.getJob = "connection reset";
    expect((await cancel(founder(), { jobId: JOB })).status).toBe(503);
  });
});

describe("health route", () => {
  it("founder only; with dispatch off it says Off and lists what would block (here: Claude not checkable, recovery not running)", async () => {
    const r = await import("@/app/api/command-center/execution/health/route");
    const res = await r.GET(new NextRequest(`${ORIGIN}/api/command-center/execution/health`, { headers: { cookie: `__session=${COOKIE}` } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({ state: "off", headline: "Off", readiness: "blocked", counts: { running: 1 } });
    expect(json.data.reasons).toContain("Claude login could not be checked");
    expect(JSON.stringify(json)).not.toMatch(/\/Users|nonexistent|bindingHash/);
    sessionVerifier.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    expect([401, 403]).toContain((await r.GET(new NextRequest(`${ORIGIN}/api/command-center/execution/health`, { headers: { cookie: `__session=${COOKIE}` } }))).status);
  });
});
