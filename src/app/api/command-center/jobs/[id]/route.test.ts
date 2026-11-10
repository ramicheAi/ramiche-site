/**
 * CC-SECURITY-REMEDIATION-05 item 2 / item 7: same gap as `jobs` -- re-running a
 * finished job (POST /jobs/[id]) had no auth check at all. Fixed with the same
 * founder-authority guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  single: vi.fn(async () => ({ data: { id: "job1", status: "done" }, error: null })),
  eq2: vi.fn(),
  eq1: vi.fn(),
  update: vi.fn(),
  select: vi.fn(),
  runJob: vi.fn(async () => undefined),
  getSupabaseAdmin: vi.fn(),
}));
m.eq2.mockImplementation(() => Promise.resolve({ error: null }));
m.update.mockImplementation(() => ({ eq: m.eq2 }));
m.eq1.mockImplementation(() => ({ single: m.single }));
m.select.mockImplementation(() => ({ eq: m.eq1 }));

vi.mock("@/lib/jobs", () => ({ runJob: m.runJob }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: m.getSupabaseAdmin }));

import { POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function db() {
  return { from: () => ({ select: m.select, update: m.update }) };
}

function post(headers: Record<string, string> = {}): Request {
  return new Request(`https://${HOST}/api/command-center/jobs/job1`, {
    method: "POST",
    headers: { host: HOST, ...headers },
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

const params = Promise.resolve({ id: "job1" });

beforeEach(() => {
  m.runJob.mockClear();
  m.update.mockClear();
  m.getSupabaseAdmin.mockReturnValue(db());
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /jobs/[id]", () => {
  it("is unguarded by default (no behavior change yet)", async () => {
    const res = await POST(post(), { params });
    expect(res.status).not.toBe(401);
    expect(m.runJob).toHaveBeenCalled();
  });

  it("401s with no session when enforced, and never re-dispatches the job", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "jobs-id");
    const res = await POST(post(), { params });
    expect(res.status).toBe(401);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.runJob).not.toHaveBeenCalled();
  });

  it("403s a valid session used cross-origin, never re-dispatches", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ cookie: validCookie(), origin: "https://evil.example" }), { params });
    expect(res.status).toBe(403);
    expect(m.runJob).not.toHaveBeenCalled();
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ cookie: validCookie(), origin: `https://${HOST}` }), { params });
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(m.runJob).toHaveBeenCalled();
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(post({ cookie: validCookie() }), { params });
    expect(res.status).toBe(503);
    expect(m.runJob).not.toHaveBeenCalled();
  });
});
