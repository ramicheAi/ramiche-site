/**
 * CC-SECURITY-REMEDIATION-05 item 2 / item 7: docs/CC-FOUNDER-AUTHORITY-GUARD-01.md
 * classified `jobs` as a "machine caller, keep shared secret" route, implying it
 * already had one. It did not: POST had no auth check of any kind, and `kind:
 * "dev"|"design"` jobs run tool-enabled Claude Code with skipped permissions
 * against an allowlisted working directory -- an unauthenticated caller could
 * dispatch that. Reproduced here (pre-fix this would reach db.insert + runJob with
 * no credential at all) and fixed with the same founder-authority guard used
 * elsewhere, since job creation is a browser command-bar action, not an
 * automated webhook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  single: vi.fn(async () => ({ data: { id: "job1" }, error: null })),
  insert: vi.fn(),
  select: vi.fn(),
  runJob: vi.fn(async () => undefined),
  getSupabaseAdmin: vi.fn(),
}));
m.insert.mockImplementation(() => ({ select: m.select }));
m.select.mockImplementation(() => ({ single: m.single }));

vi.mock("@/lib/jobs", () => ({ runJob: m.runJob }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: m.getSupabaseAdmin }));

import { POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function db() {
  return { from: () => ({ insert: m.insert }) };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://${HOST}/api/command-center/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  m.runJob.mockClear();
  m.insert.mockClear();
  m.getSupabaseAdmin.mockReturnValue(db());
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /jobs", () => {
  it("is unguarded by default (no behavior change yet)", async () => {
    const res = await POST(post({ title: "t" }));
    expect(res.status).not.toBe(401);
    expect(m.runJob).toHaveBeenCalled();
  });

  it("401s with no session when enforced, and never inserts or dispatches a job", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "jobs");
    const res = await POST(post({ title: "t", kind: "dev", input: { workingDir: "/Users/admin/ramiche-site" } }));
    expect(res.status).toBe(401);
    expect(m.insert).not.toHaveBeenCalled();
    expect(m.runJob).not.toHaveBeenCalled();
  });

  it("401s a forged cookie, never dispatches", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(
      post({ title: "t" }, { cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}` }),
    );
    expect(res.status).toBe(401);
    expect(m.runJob).not.toHaveBeenCalled();
  });

  it("403s a valid session used cross-origin, never dispatches", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ title: "t" }, { cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(m.runJob).not.toHaveBeenCalled();
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(post({ title: "t" }, { cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(m.runJob).toHaveBeenCalled();
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(post({ title: "t" }, { cookie: validCookie() }));
    expect(res.status).toBe(503);
    expect(m.runJob).not.toHaveBeenCalled();
  });
});
