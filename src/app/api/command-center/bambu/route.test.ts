/**
 * CC-SECURITY-REMEDIATION-05 item 2: `bambu` (3D printer MQTT control) had no
 * auth on either method. GET returns the printer's MQTT access code in its
 * response body (a credential leak), and POST includes "connect" (give it a new
 * host/access code and open a live MQTT session), "disconnect", and job-state
 * mutations against local JSON state. `fs` is mocked so no real file on disk is
 * touched by these tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "{}"),
  writeFileSync: vi.fn(() => undefined),
  mkdirSync: vi.fn(() => undefined),
}));

vi.mock("fs", () => ({
  existsSync: m.existsSync,
  readFileSync: m.readFileSync,
  writeFileSync: m.writeFileSync,
  mkdirSync: m.mkdirSync,
}));
vi.mock("mqtt", () => ({ default: { connect: vi.fn() } }));

import { GET, POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function getReq(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/bambu`, { headers: { host: HOST, ...headers } });
}

function postReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/bambu`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  m.existsSync.mockReturnValue(false);
  m.writeFileSync.mockClear();
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /bambu", () => {
  it("is unguarded by default (no behavior change yet)", async () => {
    const res = await GET(getReq());
    expect(res.status).not.toBe(401);
  });

  it("401s with no session when enforced (the access code never reaches the response)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "bambu");
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("accepts a valid founder session (GET is safe, no origin check applies)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await GET(getReq({ cookie: validCookie() }));
    expect(res.status).not.toBe(401);
  });
});

describe("POST /bambu", () => {
  const connectBody = { action: "connect", host: "192.168.1.50", accessCode: "secret-code" };

  it("is unguarded by default and reaches the handler", async () => {
    const res = await POST(postReq(connectBody));
    expect(res.status).not.toBe(401);
    expect(m.writeFileSync).toHaveBeenCalled();
  });

  it("401s a connect action with no session when enforced, never writes state", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "bambu");
    const res = await POST(postReq(connectBody));
    expect(res.status).toBe(401);
    expect(m.writeFileSync).not.toHaveBeenCalled();
  });

  it("403s a valid session used cross-origin, never writes state", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(postReq(connectBody, { cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(m.writeFileSync).not.toHaveBeenCalled();
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(postReq(connectBody, { cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(m.writeFileSync).toHaveBeenCalled();
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(postReq(connectBody, { cookie: validCookie() }));
    expect(res.status).toBe(503);
    expect(m.writeFileSync).not.toHaveBeenCalled();
  });
});
