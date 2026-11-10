/**
 * CC-SECURITY-REMEDIATION-05 item 2 / item 7: docs/CC-FOUNDER-AUTHORITY-GUARD-01.md
 * classified `ws` as a "machine caller, keep shared secret" route, implying it
 * already had one. It did not: this is an inter-agent command/query/broadcast bus
 * with no auth of any kind -- anyone could POST a forged "command" to any agent,
 * or GET another recipient's (including "ramon"'s) queued messages. Fixed with
 * the same founder-authority guard (it accepts either a machine bearer token or a
 * founder session, which fits this route either way it ends up being operated).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET, POST } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "q".repeat(48);
const HOST = "command.parallaxvinc.com";

function getReq(recipient: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/ws?recipient=${recipient}`, {
    headers: { host: HOST, ...headers },
  });
}

function postReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://${HOST}/api/command-center/ws`, {
    method: "POST",
    headers: { "content-type": "application/json", host: HOST, ...headers },
    body: JSON.stringify(body),
  });
}

function validCookie(): string {
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, Date.now() + 60_000)}`;
}

beforeEach(() => {
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
  vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", "");
  vi.stubEnv("CC_MACHINE_ROUTES", "");
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("GET /ws", () => {
  it("is unguarded by default (no behavior change yet)", async () => {
    const res = await GET(getReq("ramon"));
    expect(res.status).not.toBe(401);
  });

  it("401s a read for any recipient (including \"ramon\") with no session when enforced", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "ws");
    const res = await GET(getReq("ramon"));
    expect(res.status).toBe(401);
  });

  it("accepts a valid founder session (GET is a safe method, no origin check applies)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await GET(getReq("ramon", { cookie: validCookie() }));
    expect(res.status).not.toBe(401);
  });
});

describe("POST /ws", () => {
  const body = { from: "atlas", to: "ramon", type: "command" as const, payload: "do-the-thing" };

  it("is unguarded by default (no behavior change yet)", async () => {
    const res = await POST(postReq(body));
    expect(res.status).not.toBe(401);
  });

  it("401s a forged command with no session when enforced", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "ws");
    const res = await POST(postReq(body));
    expect(res.status).toBe(401);
  });

  it("403s a valid session used cross-origin", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(postReq(body, { cookie: validCookie(), origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("proceeds for a same-origin request carrying a valid session", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await POST(postReq(body, { cookie: validCookie(), origin: `https://${HOST}` }));
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("accepts the machine credential when this route is explicitly listed", async () => {
    const machineSecret = "m".repeat(48);
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "ws");
    vi.stubEnv("COMMAND_CENTER_MACHINE_SECRET", machineSecret);
    vi.stubEnv("CC_MACHINE_ROUTES", "ws");
    const res = await POST(postReq(body, { authorization: `Bearer ${machineSecret}` }));
    expect(res.status).not.toBe(401);
  });

  it("503s when enforced but the signing secret is missing (fail closed)", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    const res = await POST(postReq(body, { cookie: validCookie() }));
    expect(res.status).toBe(503);
  });
});
