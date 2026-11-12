import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));

import { ownerOnly, requireCommandCenterOwner } from "./command-center-guard";
import { OWNER_UID_ENV } from "./command-center-auth";

const OWNER_UID = "the-real-owner-uid";

function reqWithCookie(cookie?: string, extraHeaders: Record<string, string> = {}, method = "GET") {
  const headers = new Headers(extraHeaders);
  if (cookie) headers.set("cookie", `__session=${cookie}`);
  return new Request("http://localhost/api/command-center/revenue", { headers, method });
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

  it("rejects a cross-site cookie-bearing mutation BEFORE verifying the session", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password" });
    const result = await requireCommandCenterOwner(
      reqWithCookie("real-session", { "sec-fetch-site": "cross-site", host: "localhost" }, "POST")
    );
    expect(result).toEqual({ ok: false, status: 403, reason: "cross_site" });
    expect(verifySessionCookie).not.toHaveBeenCalled();
  });

  it("rejects a cookie-bearing mutation with no Origin/Sec-Fetch-Site (ambiguous)", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password" });
    const result = await requireCommandCenterOwner(reqWithCookie("real-session", {}, "POST"));
    expect(result).toEqual({ ok: false, status: 403, reason: "missing_origin" });
  });

  it("allows a same-origin owner mutation", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password" });
    const result = await requireCommandCenterOwner(
      reqWithCookie("real-session", { "sec-fetch-site": "same-origin" }, "POST")
    );
    expect(result).toEqual({ ok: true, uid: OWNER_UID });
  });

  it("a mutation with no cookie is a plain 401 (not a CSRF 403)", async () => {
    const result = await requireCommandCenterOwner(reqWithCookie(undefined, {}, "POST"));
    expect(result).toEqual({ ok: false, status: 401, reason: "missing_session" });
  });

  it("a malformed/forged-looking cookie value is denied", async () => {
    verifySessionCookie.mockResolvedValue(null);
    for (const v of ["x", "..", "a.b.c", "Bearer abc", "%00"]) {
      const result = await requireCommandCenterOwner(reqWithCookie(v));
      expect(result.ok).toBe(false);
    }
  });

  it("forged identity headers (uid/role/email/owner) grant nothing", async () => {
    const result = await requireCommandCenterOwner(
      reqWithCookie(undefined, {
        "x-user-id": OWNER_UID,
        "x-owner": "true",
        "x-firebase-uid": OWNER_UID,
        authorization: `Bearer ${OWNER_UID}`,
        "x-forwarded-user": "owner@example.com",
      })
    );
    expect(result).toEqual({ ok: false, status: 401, reason: "missing_session" });
  });

  it("session expires/revoked after a prior success: next call is denied", async () => {
    verifySessionCookie.mockResolvedValueOnce({ uid: OWNER_UID, signInProvider: "password" });
    verifySessionCookie.mockResolvedValueOnce(null); // revoked / expired (checkRevoked=true)
    expect((await requireCommandCenterOwner(reqWithCookie("s"))).ok).toBe(true);
    expect(await requireCommandCenterOwner(reqWithCookie("s"))).toEqual({ ok: false, status: 401, reason: "invalid_session" });
  });
});

describe("ownerOnly wrapper", () => {
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER_UID;
    verifySessionCookie.mockReset();
  });

  it("never runs the handler for an unauthenticated caller", async () => {
    const inner = vi.fn(async () => new Response("secret data"));
    const res = await ownerOnly(inner as (req: Request) => Promise<Response>)(reqWithCookie());
    expect(res.status).toBe(401);
    expect(inner).not.toHaveBeenCalled();
  });

  it("runs the handler for the owner and forwards extra args (route context)", async () => {
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password" });
    const inner = vi.fn(async (...args: unknown[]) => { void args; return new Response("ok"); });
    const ctx = { params: Promise.resolve({ id: "1" }) };
    const res = await ownerOnly(inner)(reqWithCookie("s"), ctx);
    expect(await res.text()).toBe("ok");
    expect(inner).toHaveBeenCalledWith(expect.any(Request), ctx);
  });

  it("503s and never runs the handler when the owner is not configured", async () => {
    delete process.env[OWNER_UID_ENV];
    const inner = vi.fn(async () => new Response("x"));
    const res = await ownerOnly(inner as (req: Request) => Promise<Response>)(reqWithCookie("s"));
    expect(res.status).toBe(503);
    expect(inner).not.toHaveBeenCalled();
  });
});
