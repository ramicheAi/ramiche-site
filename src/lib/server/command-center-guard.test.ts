import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));

import { requireCommandCenterOwner } from "./command-center-guard";
import { OWNER_UID_ENV } from "./command-center-auth";

const OWNER_UID = "the-real-owner-uid";

function reqWithCookie(cookie?: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers(extraHeaders);
  if (cookie) headers.set("cookie", `__session=${cookie}`);
  return new Request("http://localhost/api/command-center/revenue", { headers });
}

describe("requireCommandCenterOwner", () => {
  const originalEnv = process.env[OWNER_UID_ENV];

  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER_UID;
    verifySessionCookie.mockReset();
  });

  afterEach(() => {
    process.env[OWNER_UID_ENV] = originalEnv;
  });

  it("fails closed when the owner uid is not configured, before verifying anything", async () => {
    delete process.env[OWNER_UID_ENV];
    const result = await requireCommandCenterOwner(reqWithCookie("some-session-cookie-value"));
    expect(result).toEqual({ ok: false, status: 503, reason: "owner_not_configured" });
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("denies when no session cookie is present", async () => {
    const result = await requireCommandCenterOwner(reqWithCookie());
    expect(result).toEqual({ ok: false, status: 401, reason: "missing_session" });
  });

  it("denies when the session cookie fails verification (expired/revoked/malformed)", async () => {
    verifySessionCookie.mockResolvedValue(null);
    const result = await requireCommandCenterOwner(reqWithCookie("expired-or-revoked"));
    expect(result).toEqual({ ok: false, status: 401, reason: "invalid_session" });
  });

  it("denies when the verifier throws (admin SDK failure) — never passes through", async () => {
    verifySessionCookie.mockRejectedValue(new Error("boom"));
    const result = await requireCommandCenterOwner(reqWithCookie("whatever"));
    expect(result).toEqual({ ok: false, status: 401, reason: "invalid_session" });
  });

  it("denies an anonymous/custom-token identity even with the right uid", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "anonymous" });
    const result = await requireCommandCenterOwner(reqWithCookie("anon-session"));
    expect(result).toEqual({ ok: false, status: 401, reason: "invalid_session" });
  });

  it("denies an authenticated human who is not the exact configured owner", async () => {
    verifySessionCookie.mockResolvedValue({ uid: "someone-else", signInProvider: "password" });
    const result = await requireCommandCenterOwner(reqWithCookie("real-session"));
    expect(result).toEqual({ ok: false, status: 403, reason: "not_owner" });
  });

  it("authorizes the exact owner with a human provider", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password" });
    const result = await requireCommandCenterOwner(reqWithCookie("real-session"));
    expect(result).toEqual({ ok: true, uid: OWNER_UID });
  });

  it("never reads x-forwarded-host/host as identity — a forged host header changes nothing", async () => {
    verifySessionCookie.mockResolvedValue(null);
    const result = await requireCommandCenterOwner(
      reqWithCookie("expired", { "x-forwarded-host": "command.parallaxvinc.com", host: "command.parallaxvinc.com" })
    );
    expect(result.ok).toBe(false);
  });
});
