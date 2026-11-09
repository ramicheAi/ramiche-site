/**
 * CC-SECURITY-REMEDIATION-05 item 3: GET used to call the same `run()` as POST --
 * a plain browser navigation or crawler could trigger a real scan-and-insert pass
 * with zero auth. GET must never mutate; POST must require either a founder
 * session or the machine credential.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  geocode: vi.fn(async () => ({ lat: 0, lon: 0 })),
  searchBusinesses: vi.fn(async () => []),
  getSupabaseAdmin: vi.fn(() => null),
}));

vi.mock("@/lib/prospector", () => ({ geocode: m.geocode, searchBusinesses: m.searchBusinesses }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin: m.getSupabaseAdmin }));

import { GET, POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";
const MACHINE_SECRET = "m".repeat(48);

function req(method: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/prospector/daily`, {
    method,
    headers: { host: HOST, ...headers },
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  m.geocode.mockClear();
  m.searchBusinesses.mockClear();
  m.getSupabaseAdmin.mockClear();
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /prospector/daily", () => {
  it("never runs the prospector, regardless of enforcement state", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(m.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(m.geocode).not.toHaveBeenCalled();
    expect(m.searchBusinesses).not.toHaveBeenCalled();
  });
});

describe("POST /prospector/daily", () => {
  it("is unguarded by default (no behavior change yet) and reaches run()", async () => {
    const res = await POST(req("POST"));
    expect(res.status).not.toBe(401);
    // getSupabaseAdmin() returns null in this test env, so run() 503s past the guard --
    // that's run() executing, which is exactly what "unguarded by default" means.
    expect(m.getSupabaseAdmin).toHaveBeenCalled();
  });

  it("401s with no credential when enforced, and never reaches run()", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "prospector-daily");
    const res = await POST(req("POST"));
    expect(res.status).toBe(401);
    expect(m.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(m.geocode).not.toHaveBeenCalled();
  });

  it("401s a forged founder cookie, never reaches run()", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(
      req("POST", { cookie: `${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}` }),
    );
    expect(res.status).toBe(401);
    expect(m.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("accepts the machine credential on this route when explicitly listed", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "prospector-daily");
    vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", MACHINE_SECRET);
    vi.stubEnv("CC_MACHINE_ROUTES", "prospector-daily");
    const res = await POST(req("POST", { authorization: `Bearer ${MACHINE_SECRET}` }));
    expect(res.status).not.toBe(401);
    expect(m.getSupabaseAdmin).toHaveBeenCalled();
  });

  it("refuses the machine credential when this route is not listed", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "prospector-daily");
    vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", MACHINE_SECRET);
    vi.stubEnv("CC_MACHINE_ROUTES", "some-other-route");
    const res = await POST(req("POST", { authorization: `Bearer ${MACHINE_SECRET}` }));
    expect(res.status).toBe(401);
    expect(m.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("accepts a same-origin founder session when enforced", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(req("POST", { cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(m.getSupabaseAdmin).toHaveBeenCalled();
  });
});
