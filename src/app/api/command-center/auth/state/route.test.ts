import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { FOUNDER_SESSION_COOKIE, signFounderSession } from "@/lib/server/founder-authority";

const SECRET = "s".repeat(48);

function stateReq(cookie?: string) {
  return new NextRequest("https://command.parallaxvinc.com/api/command-center/auth/state", {
    method: "GET",
    headers: cookie ? { cookie } : {},
  });
}

function sessionCookie(expiresIn = 60_000): string {
  const now = Date.now();
  // A token that expires in the past must also be issued before it expires, otherwise the
  // verifier correctly reports "malformed" (issuedAt > expiresAt) instead of "expired".
  return `${FOUNDER_SESSION_COOKIE}=${signFounderSession(SECRET, now + expiresIn, Math.min(now, now + expiresIn - 1000))}`;
}

beforeEach(() => {
  vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", SECRET);
  vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/command-center/auth/state", () => {
  it("reports enforcement off and the session state without ever minting one", async () => {
    const res = await GET(stateReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.reason).toBe("missing");
    expect(body.enforcement).toEqual({ on: false, routes: [] });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("reports a valid session and its expiry when the guard is on", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "gate,voice-call");
    const res = await GET(stateReq(sessionCookie()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.expiresAt).toBeGreaterThan(Date.now());
    expect(body.enforcement).toEqual({ on: true, routes: ["gate", "voice-call"] });
  });

  it("distinguishes expired, revoked and forged sessions", async () => {
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const expired = await GET(stateReq(sessionCookie(-1000)));
    expect(expired.status).toBe(401);
    expect((await expired.json()).reason).toBe("expired");

    const forged = await GET(
      stateReq(`${FOUNDER_SESSION_COOKIE}=${signFounderSession("z".repeat(48), Date.now() + 60_000)}`),
    );
    expect(forged.status).toBe(401);
    expect((await forged.json()).reason).toBe("bad_signature");

    vi.stubEnv("CC_FOUNDER_REVOKE_BEFORE", String(Date.now()));
    const revoked = await GET(stateReq(sessionCookie()));
    expect(revoked.status).toBe(401);
    expect((await revoked.json()).reason).toBe("revoked");
  });

  it("reports not_configured without claiming a session when no secret is set", async () => {
    vi.stubEnv("COMMAND_CENTER_SESSION_SECRET", "");
    vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", "all");
    const res = await GET(stateReq(sessionCookie()));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.reason).toBe("not_configured");
    expect(body.enforcement.on).toBe(true);
  });

  it("treats all three enforcement spellings correctly", async () => {
    for (const [raw, expected] of [
      ["ALL", { on: true, routes: ["all"] }],
      [" gate , settings ", { on: true, routes: ["gate", "settings"] }],
      ["", { on: false, routes: [] }],
    ] as const) {
      vi.stubEnv("CC_FOUNDER_GUARD_ENFORCE", raw);
      const body = await (await GET(stateReq())).json();
      expect(body.enforcement).toEqual(expected);
    }
  });
});
