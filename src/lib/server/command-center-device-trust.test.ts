import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import {
  attemptPinUnlock,
  bootstrapEnrollDevice,
  createEnrollmentApprovalCode,
  enrollDevice,
  parseDeviceCookie,
  redeemEnrollmentApprovalCode,
  revokeDevice,
  verifyDeviceCookie,
  verifyUnlockCookie,
  UNLOCK_SESSION_SECONDS,
} from "./command-center-device-trust";

const OWNER = "the-real-owner-uid";
const DEVICE_ID = "11111111-1111-1111-1111-111111111111";
const SECRET = "a".repeat(64);

function queryStub(overrides: Partial<Record<string, unknown>> = {}) {
  const q: Record<string, unknown> = { data: null, error: null, ...overrides };
  for (const m of ["select", "eq", "is", "update", "insert"]) q[m] = vi.fn(() => q);
  q.maybeSingle = vi.fn(() => q);
  q.single = vi.fn(() => q);
  return q;
}

describe("parseDeviceCookie", () => {
  it("rejects malformed values", () => {
    expect(parseDeviceCookie(null)).toBeNull();
    expect(parseDeviceCookie("")).toBeNull();
    expect(parseDeviceCookie("no-dot")).toBeNull();
    expect(parseDeviceCookie("not-a-uuid.short")).toBeNull();
    expect(parseDeviceCookie(`${DEVICE_ID}.tooshort`)).toBeNull();
  });
  it("parses a well-formed cookie", () => {
    expect(parseDeviceCookie(`${DEVICE_ID}.${SECRET}`)).toEqual({ deviceId: DEVICE_ID, secret: SECRET });
  });
});

describe("verifyDeviceCookie", () => {
  beforeEach(() => getSupabaseAdmin.mockReset());

  it("denies when not configured (no DB)", async () => {
    getSupabaseAdmin.mockReturnValue(null);
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: false, reason: "not_configured" });
  });

  it("denies a malformed cookie before touching the database", async () => {
    getSupabaseAdmin.mockReturnValue({ from: vi.fn() });
    expect(await verifyDeviceCookie("garbage", OWNER)).toEqual({ ok: false, reason: "malformed" });
  });

  it("denies when the device row doesn't exist", async () => {
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => queryStub()) });
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: false, reason: "not_found" });
  });

  it("denies when the secret doesn't match the stored hash, even with a real row", async () => {
    const row = { id: DEVICE_ID, owner_uid: OWNER, secret_hash: createHash("sha256").update("different-secret").digest("hex"), expires_at: new Date(Date.now() + 1e9).toISOString(), revoked_at: null, failed_pin_attempts: 0, locked_until: null };
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => queryStub({ data: row })) });
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: false, reason: "secret_mismatch" });
  });

  it("denies a revoked device even with the correct secret", async () => {
    const row = { id: DEVICE_ID, owner_uid: OWNER, secret_hash: createHash("sha256").update(SECRET).digest("hex"), expires_at: new Date(Date.now() + 1e9).toISOString(), revoked_at: new Date().toISOString(), failed_pin_attempts: 0, locked_until: null };
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => queryStub({ data: row })) });
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: false, reason: "revoked" });
  });

  it("denies an expired device even with the correct secret", async () => {
    const row = { id: DEVICE_ID, owner_uid: OWNER, secret_hash: createHash("sha256").update(SECRET).digest("hex"), expires_at: new Date(Date.now() - 1000).toISOString(), revoked_at: null, failed_pin_attempts: 0, locked_until: null };
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => queryStub({ data: row })) });
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: false, reason: "expired" });
  });

  it("denies when the row's owner_uid no longer matches the LIVE configured owner (e.g. PARALLAX_OWNER_UID rotated)", async () => {
    const row = { id: DEVICE_ID, owner_uid: "a-previous-owner", secret_hash: createHash("sha256").update(SECRET).digest("hex"), expires_at: new Date(Date.now() + 1e9).toISOString(), revoked_at: null, failed_pin_attempts: 0, locked_until: null };
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => queryStub({ data: row })) });
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: false, reason: "owner_mismatch" });
  });

  it("accepts a genuinely valid, unexpired, unrevoked, correctly-owned device", async () => {
    const row = { id: DEVICE_ID, owner_uid: OWNER, secret_hash: createHash("sha256").update(SECRET).digest("hex"), expires_at: new Date(Date.now() + 1e9).toISOString(), revoked_at: null, failed_pin_attempts: 0, locked_until: null };
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => queryStub({ data: row })) });
    expect(await verifyDeviceCookie(`${DEVICE_ID}.${SECRET}`, OWNER)).toEqual({ ok: true, deviceId: DEVICE_ID, ownerUid: OWNER });
  });
});

describe("attemptPinUnlock", () => {
  const originalSigningSecret = process.env.CC_UNLOCK_SIGNING_SECRET;
  beforeEach(() => {
    getSupabaseAdmin.mockReset();
    process.env.CC_UNLOCK_SIGNING_SECRET = "test-unlock-signing-secret";
  });
  afterEach(() => {
    process.env.CC_UNLOCK_SIGNING_SECRET = originalSigningSecret;
  });

  // The attempt counter is claimed atomically via an RPC backed by
  // `SELECT ... FOR UPDATE` in the migration (independent review finding,
  // HIGH: a prior read-then-write version let unlimited concurrent
  // requests each evaluate their own PIN guess before any increment
  // landed). These tests mock the RPC's return shape directly, since the
  // actual serialization guarantee lives in Postgres and is covered by the
  // migration SQL, not by anything testable at this layer.
  function mockRpc(claim: unknown, resetError: unknown = null, reset: unknown = { cleared: true, locked_until: null }) {
    const rpc = vi.fn((fn: string) => {
      if (fn === "cc_trusted_device_claim_pin_attempt") return Promise.resolve({ data: claim, error: null });
      if (fn === "cc_trusted_device_reset_pin_attempts") return Promise.resolve({ data: resetError ? null : reset, error: resetError });
      throw new Error(`unexpected rpc ${fn}`);
    });
    getSupabaseAdmin.mockReturnValue({ rpc });
    return rpc;
  }

  it("denies on a wrong PIN, after the claim already counted the attempt", async () => {
    const rpc = mockRpc({ allowed: true, attempts: 2, locked_until: null });
    const result = await attemptPinUnlock(DEVICE_ID, "0000", () => false);
    expect(result).toEqual({ ok: false, status: 401, reason: "wrong_pin" });
    expect(rpc).toHaveBeenCalledWith("cc_trusted_device_claim_pin_attempt", {
      p_device_id: DEVICE_ID,
      p_max_attempts: 5,
      p_lockout_seconds: 900,
    });
    // No reset call on a wrong PIN.
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("denies without even checking the PIN when the claim itself reports locked", async () => {
    const pinMatches = vi.fn(() => true);
    mockRpc({ allowed: false, attempts: 5, locked_until: new Date(Date.now() + 60_000).toISOString() });
    const result = await attemptPinUnlock(DEVICE_ID, "2451", pinMatches);
    expect(result).toEqual({ ok: false, status: 429, reason: "locked" });
    expect(pinMatches).not.toHaveBeenCalled();
  });

  it("denies with 404-equivalent when the device row doesn't exist", async () => {
    mockRpc(null);
    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result).toEqual({ ok: false, status: 401, reason: "not_found" });
  });

  it("503s and does not evaluate the PIN at all if the claim RPC itself errors", async () => {
    const pinMatches = vi.fn(() => true);
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: { message: "db down" } }));
    getSupabaseAdmin.mockReturnValue({ rpc });
    const result = await attemptPinUnlock(DEVICE_ID, "2451", pinMatches);
    expect(result).toEqual({ ok: false, status: 503, reason: "claim_failed" });
    expect(pinMatches).not.toHaveBeenCalled();
  });

  it("mints a signed, verifiable unlock cookie on a correct PIN, after resetting attempt state", async () => {
    const rpc = mockRpc({ allowed: true, attempts: 1, locked_until: null });
    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(rpc).toHaveBeenCalledWith("cc_trusted_device_reset_pin_attempts", { p_device_id: DEVICE_ID });

    const verified = verifyUnlockCookie(result.cookieValue);
    expect(verified).toEqual({ ok: true, deviceId: DEVICE_ID });
  });

  it("fails loud (503), never silently succeeds, if the reset RPC errors after a correct PIN", async () => {
    mockRpc({ allowed: true, attempts: 1, locked_until: null }, { message: "db down" });
    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result).toEqual({ ok: false, status: 503, reason: "reset_failed" });
  });

  // Founder-directed check, reproduced against live Postgres before this
  // fix landed: claim A succeeds (attempt 3->4, allowed), a concurrent
  // wrong-PIN claim B then claims attempt 5 and locks the device in the
  // gap before A's reset runs. An unconditional reset would wipe B's fresh
  // lockout and hand A's caller an unlock session despite a lockout now
  // being active — the reset RPC's `cleared: false` return is exactly how
  // the fixed migration reports "a lockout took effect since your claim,
  // refusing to clear it," and this is the application-code half of that
  // contract: never mint an unlock session when cleared is false.
  it("never mints an unlock session if a lockout took effect between this caller's claim and its reset", async () => {
    mockRpc(
      { allowed: true, attempts: 4, locked_until: null },
      null,
      { cleared: false, locked_until: new Date(Date.now() + 60_000).toISOString() }
    );
    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result).toEqual({ ok: false, status: 429, reason: "locked" });
  });

  it("checks the unlock-signing secret BEFORE evaluating the PIN — no 503-vs-401 oracle for a correct guess", async () => {
    delete process.env.CC_UNLOCK_SIGNING_SECRET;
    const pinMatches = vi.fn(() => true);
    const rpc = vi.fn();
    getSupabaseAdmin.mockReturnValue({ rpc });
    const result = await attemptPinUnlock(DEVICE_ID, "2451", pinMatches);
    expect(result).toEqual({ ok: false, status: 503, reason: "unlock_signing_not_configured" });
    expect(pinMatches).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("verifyUnlockCookie", () => {
  const originalSigningSecret = process.env.CC_UNLOCK_SIGNING_SECRET;
  beforeEach(() => {
    process.env.CC_UNLOCK_SIGNING_SECRET = "test-unlock-signing-secret";
  });
  afterEach(() => {
    process.env.CC_UNLOCK_SIGNING_SECRET = originalSigningSecret;
  });

  function sign(deviceId: string, issuedAtS: number, secret = "test-unlock-signing-secret") {
    return createHmac("sha256", secret).update(`${deviceId}.${issuedAtS}`, "utf8").digest("hex");
  }

  it("rejects a malformed cookie", () => {
    expect(verifyUnlockCookie(null)).toEqual({ ok: false, reason: "missing" });
    expect(verifyUnlockCookie("a.b")).toEqual({ ok: false, reason: "malformed" });
    expect(verifyUnlockCookie("not-a-uuid.123.sig")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a forged signature — a client that never saw the signing secret cannot mint one", () => {
    const now = Math.floor(Date.now() / 1000);
    const forged = `${DEVICE_ID}.${now}.${"0".repeat(64)}`;
    expect(verifyUnlockCookie(forged)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects an expired unlock session (older than 12h)", () => {
    const issuedAtS = Math.floor(Date.now() / 1000) - (UNLOCK_SESSION_SECONDS + 60);
    const sig = sign(DEVICE_ID, issuedAtS);
    expect(verifyUnlockCookie(`${DEVICE_ID}.${issuedAtS}.${sig}`)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a future-issued cookie (clock skew abuse)", () => {
    const issuedAtS = Math.floor(Date.now() / 1000) + 3600;
    const sig = sign(DEVICE_ID, issuedAtS);
    expect(verifyUnlockCookie(`${DEVICE_ID}.${issuedAtS}.${sig}`)).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts a genuinely fresh, correctly signed cookie", () => {
    const issuedAtS = Math.floor(Date.now() / 1000);
    const sig = sign(DEVICE_ID, issuedAtS);
    expect(verifyUnlockCookie(`${DEVICE_ID}.${issuedAtS}.${sig}`)).toEqual({ ok: true, deviceId: DEVICE_ID });
  });
});

describe("enrollDevice / revokeDevice", () => {
  beforeEach(() => getSupabaseAdmin.mockReset());

  it("enrollDevice returns a cookie value that later verifies against what was stored", async () => {
    let storedHash: string | undefined;
    const insertQuery = queryStub();
    insertQuery.insert = vi.fn((row: { secret_hash: string }) => {
      storedHash = row.secret_hash;
      return insertQuery;
    });
    insertQuery.select = vi.fn(() => insertQuery);
    insertQuery.single = vi.fn(() => ({ data: { id: DEVICE_ID }, error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => insertQuery) });

    const result = await enrollDevice(OWNER, "Test MacBook");
    expect("cookieValue" in result).toBe(true);
    if (!("cookieValue" in result)) throw new Error("unreachable");
    const parsed = parseDeviceCookie(result.cookieValue);
    expect(parsed?.deviceId).toBe(DEVICE_ID);
    expect(createHash("sha256").update(parsed!.secret, "utf8").digest("hex")).toBe(storedHash);
  });

  it("revokeDevice targets exactly one device when an id is given", async () => {
    const q = queryStub({ data: [{ id: DEVICE_ID }] });
    const eqSpy = vi.fn(() => q);
    q.eq = eqSpy;
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await revokeDevice(OWNER, DEVICE_ID);
    expect(result).toEqual({ ok: true, revoked: 1 });
    expect(eqSpy).toHaveBeenCalledWith("id", DEVICE_ID);
  });
});

describe("bootstrapEnrollDevice (founder correction: first device without Firebase)", () => {
  const originalBootstrapSecret = process.env.CC_BOOTSTRAP_SECRET;
  beforeEach(() => {
    getSupabaseAdmin.mockReset();
    process.env.CC_BOOTSTRAP_SECRET = "correct-bootstrap-secret";
  });
  afterEach(() => {
    process.env.CC_BOOTSTRAP_SECRET = originalBootstrapSecret;
  });

  function countQuery(count: number) {
    const q: Record<string, unknown> = { count, error: null };
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.is = vi.fn(() => q);
    q.gt = vi.fn(() => q);
    return q;
  }

  it("503s when the bootstrap secret isn't configured, never falls open", async () => {
    delete process.env.CC_BOOTSTRAP_SECRET;
    const result = await bootstrapEnrollDevice("anything", OWNER);
    expect(result).toEqual({ ok: false, status: 503, reason: "bootstrap_not_configured" });
  });

  it("rejects a wrong token", async () => {
    const result = await bootstrapEnrollDevice("wrong-token", OWNER);
    expect(result).toEqual({ ok: false, status: 401, reason: "bad_token" });
  });

  it("enrolls the first device when the token is correct and zero devices exist", async () => {
    const countQ = countQuery(0);
    const insertQ: Record<string, unknown> = { data: { id: DEVICE_ID }, error: null };
    insertQ.insert = vi.fn(() => insertQ);
    insertQ.select = vi.fn(() => insertQ);
    insertQ.single = vi.fn(() => insertQ);
    const fromMock = vi.fn().mockReturnValueOnce(countQ).mockReturnValueOnce(insertQ);
    getSupabaseAdmin.mockReturnValue({ from: fromMock });

    const result = await bootstrapEnrollDevice("correct-bootstrap-secret", OWNER);
    expect(result.ok).toBe(true);
  });

  it("refuses — even with the correct token — the moment ANY active device already exists: not a standing master key", async () => {
    const countQ = countQuery(1);
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => countQ) });

    const result = await bootstrapEnrollDevice("correct-bootstrap-secret", OWNER);
    expect(result).toEqual({ ok: false, status: 403, reason: "already_enrolled" });
  });
});

describe("createEnrollmentApprovalCode / redeemEnrollmentApprovalCode (device-to-device approval)", () => {
  beforeEach(() => getSupabaseAdmin.mockReset());

  it("createEnrollmentApprovalCode stores only a hash, never the raw code", async () => {
    let storedHash: string | undefined;
    const insertQ: Record<string, unknown> = { error: null };
    insertQ.insert = vi.fn((row: { code_hash: string }) => {
      storedHash = row.code_hash;
      return insertQ;
    });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => insertQ) });

    const result = await createEnrollmentApprovalCode(OWNER, DEVICE_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(createHash("sha256").update(result.code, "utf8").digest("hex")).toBe(storedHash);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("redeemEnrollmentApprovalCode denies when the RPC reports the code invalid/expired/used", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: { ok: false, issued_by_device_id: null }, error: null }));
    getSupabaseAdmin.mockReturnValue({ rpc });

    const result = await redeemEnrollmentApprovalCode("some-code", OWNER);
    expect(result).toEqual({ ok: false, status: 401, reason: "invalid_or_expired_code" });
  });

  it("redeemEnrollmentApprovalCode enrolls a NEW device when the RPC reports the code valid", async () => {
    const rpc = vi.fn((fn: string) => {
      if (fn === "cc_redeem_device_enrollment_code") return Promise.resolve({ data: { ok: true, issued_by_device_id: "other-device" }, error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    const NEW_DEVICE_ID = "66666666-6666-6666-6666-666666666666";
    const insertQ: Record<string, unknown> = { data: { id: NEW_DEVICE_ID }, error: null };
    insertQ.insert = vi.fn(() => insertQ);
    insertQ.select = vi.fn(() => insertQ);
    insertQ.single = vi.fn(() => insertQ);
    getSupabaseAdmin.mockReturnValue({ rpc, from: vi.fn(() => insertQ) });

    const result = await redeemEnrollmentApprovalCode("some-code", OWNER);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    const parsed = parseDeviceCookie(result.cookieValue);
    expect(parsed?.deviceId).toBe(NEW_DEVICE_ID);
  });
});
