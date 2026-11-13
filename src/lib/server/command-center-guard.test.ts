import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import { ownerOnly, requireCommandCenterOwner, requireFreshFirebaseOwnerSession } from "./command-center-guard";
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

  it("rejects an owner cookie older than 12h even though it still verifies (30-day METTLE cookie)", async () => {
    const now = Math.floor(Date.now() / 1000);
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password", issuedAt: now - 13 * 3600 });
    expect(await requireCommandCenterOwner(reqWithCookie("old"))).toEqual({ ok: false, status: 401, reason: "session_expired" });
    verifySessionCookie.mockResolvedValue({ uid: OWNER_UID, signInProvider: "password", issuedAt: now - 3600 });
    expect((await requireCommandCenterOwner(reqWithCookie("fresh"))).ok).toBe(true);
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

describe("requireCommandCenterOwner — trusted-device PIN-unlock credential (founder Priority 1)", () => {
  const originalEnv = process.env[OWNER_UID_ENV];
  const originalSigningSecret = process.env.CC_UNLOCK_SIGNING_SECRET;
  const DEVICE_ID = "22222222-2222-2222-2222-222222222222";
  const SIGNING_SECRET = "test-unlock-signing-secret";

  function sign(deviceId: string, issuedAtS: number) {
    return createHmac("sha256", SIGNING_SECRET).update(`${deviceId}.${issuedAtS}`, "utf8").digest("hex");
  }
  function freshUnlockCookie(deviceId = DEVICE_ID) {
    const issuedAtS = Math.floor(Date.now() / 1000);
    return `${deviceId}.${issuedAtS}.${sign(deviceId, issuedAtS)}`;
  }
  function reqWithUnlock(unlockCookie: string | undefined, deviceCookie: string | undefined, extraHeaders: Record<string, string> = {}, method = "GET") {
    const headers = new Headers(extraHeaders);
    const parts: string[] = [];
    if (unlockCookie) parts.push(`cc_unlock=${unlockCookie}`);
    if (deviceCookie) parts.push(`cc_device=${deviceCookie}`);
    if (parts.length) headers.set("cookie", parts.join("; "));
    return new Request("http://localhost/api/command-center/revenue", { headers, method });
  }
  function validDeviceRow(secret: string) {
    return {
      id: DEVICE_ID,
      owner_uid: OWNER_UID,
      secret_hash: createHash("sha256").update(secret, "utf8").digest("hex"),
      expires_at: new Date(Date.now() + 1e9).toISOString(),
      revoked_at: null,
      failed_pin_attempts: 0,
      locked_until: null,
    };
  }
  function dbReturning(row: unknown) {
    const q: Record<string, unknown> = { data: row, error: null };
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.maybeSingle = vi.fn(() => q);
    return { from: vi.fn(() => q) };
  }

  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER_UID;
    process.env.CC_UNLOCK_SIGNING_SECRET = SIGNING_SECRET;
    verifySessionCookie.mockReset();
    verifySessionCookie.mockResolvedValue(null);
    getSupabaseAdmin.mockReset();
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = originalEnv;
    process.env.CC_UNLOCK_SIGNING_SECRET = originalSigningSecret;
  });

  it("authorizes via a valid unlock cookie + a live, valid device row — no Firebase session needed", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning(validDeviceRow(secret)));
    const result = await requireCommandCenterOwner(reqWithUnlock(freshUnlockCookie(), `${DEVICE_ID}.${secret}`));
    expect(result).toEqual({ ok: true, uid: OWNER_UID });
  });

  it("denies an unlock cookie with no device cookie at all", async () => {
    const result = await requireCommandCenterOwner(reqWithUnlock(freshUnlockCookie(), undefined));
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toBe("device_malformed");
  });

  it("denies when the device has been revoked, even with a perfectly valid unlock cookie", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning({ ...validDeviceRow(secret), revoked_at: new Date().toISOString() }));
    const result = await requireCommandCenterOwner(reqWithUnlock(freshUnlockCookie(), `${DEVICE_ID}.${secret}`));
    expect(result).toEqual({ ok: false, status: 401, reason: "device_revoked" });
  });

  it("denies when the device has expired", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning({ ...validDeviceRow(secret), expires_at: new Date(Date.now() - 1000).toISOString() }));
    const result = await requireCommandCenterOwner(reqWithUnlock(freshUnlockCookie(), `${DEVICE_ID}.${secret}`));
    expect(result).toEqual({ ok: false, status: 401, reason: "device_expired" });
  });

  it("denies a forged unlock signature even if a real device cookie is attached", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning(validDeviceRow(secret)));
    const forged = `${DEVICE_ID}.${Math.floor(Date.now() / 1000)}.${"0".repeat(64)}`;
    const result = await requireCommandCenterOwner(reqWithUnlock(forged, `${DEVICE_ID}.${secret}`));
    expect(result).toEqual({ ok: false, status: 401, reason: "unlock_bad_signature" });
  });

  it("denies when the unlock cookie names a different device than the one presented", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning(validDeviceRow(secret)));
    const otherDeviceId = "33333333-3333-3333-3333-333333333333";
    const result = await requireCommandCenterOwner(reqWithUnlock(freshUnlockCookie(otherDeviceId), `${DEVICE_ID}.${secret}`));
    expect(result).toEqual({ ok: false, status: 401, reason: "device_mismatch" });
  });

  it("still enforces CSRF on a mutation authorized via unlock cookie", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning(validDeviceRow(secret)));
    const result = await requireCommandCenterOwner(
      reqWithUnlock(freshUnlockCookie(), `${DEVICE_ID}.${secret}`, { "sec-fetch-site": "cross-site" }, "POST")
    );
    expect(result).toEqual({ ok: false, status: 403, reason: "cross_site" });
  });

  it("falls back to the unlock path when a Firebase session cookie is present but invalid, and the unlock cookie is valid", async () => {
    verifySessionCookie.mockResolvedValue(null); // Firebase side fails
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning(validDeviceRow(secret)));
    const headers = new Headers();
    headers.set("cookie", `__session=stale; cc_unlock=${freshUnlockCookie()}; cc_device=${DEVICE_ID}.${secret}`);
    const result = await requireCommandCenterOwner(new Request("http://localhost/api/command-center/revenue", { headers }));
    expect(result).toEqual({ ok: true, uid: OWNER_UID });
  });

  it("requireFreshFirebaseOwnerSession never accepts an unlock cookie, even a perfectly valid one", async () => {
    const secret = "b".repeat(64);
    getSupabaseAdmin.mockReturnValue(dbReturning(validDeviceRow(secret)));
    const result = await requireFreshFirebaseOwnerSession(reqWithUnlock(freshUnlockCookie(), `${DEVICE_ID}.${secret}`));
    expect(result).toEqual({ ok: false, status: 401, reason: "missing_session" });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
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
