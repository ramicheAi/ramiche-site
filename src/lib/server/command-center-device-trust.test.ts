import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import {
  attemptPinUnlock,
  enrollDevice,
  parseDeviceCookie,
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

  it("denies and increments failed_pin_attempts on a wrong PIN", async () => {
    const updateFn = vi.fn(() => queryStub());
    const q = queryStub({ data: { failed_pin_attempts: 1, locked_until: null } });
    q.update = updateFn;
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await attemptPinUnlock(DEVICE_ID, "0000", () => false);
    expect(result).toEqual({ ok: false, status: 401, reason: "wrong_pin" });
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ failed_pin_attempts: 2, locked_until: null }));
  });

  it("locks out after the 5th consecutive failed attempt", async () => {
    const updateFn = vi.fn((_update: { failed_pin_attempts: number; locked_until: string | null }) => queryStub());
    const q = queryStub({ data: { failed_pin_attempts: 4, locked_until: null } });
    q.update = updateFn;
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await attemptPinUnlock(DEVICE_ID, "0000", () => false);
    expect(result.ok).toBe(false);
    expect((result as { status: number }).status).toBe(429);
    const call = updateFn.mock.calls[0][0];
    expect(call.failed_pin_attempts).toBe(5);
    expect(call.locked_until).not.toBeNull();
  });

  it("refuses to even check the PIN while locked out", async () => {
    const pinMatches = vi.fn(() => true);
    const q = queryStub({ data: { failed_pin_attempts: 5, locked_until: new Date(Date.now() + 60_000).toISOString() } });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await attemptPinUnlock(DEVICE_ID, "2451", pinMatches);
    expect(result).toEqual({ ok: false, status: 429, reason: "locked" });
    expect(pinMatches).not.toHaveBeenCalled();
  });

  it("allows a correct PIN after the lockout window has passed", async () => {
    const q = queryStub({ data: { failed_pin_attempts: 5, locked_until: new Date(Date.now() - 1000).toISOString() } });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result.ok).toBe(true);
  });

  it("mints a signed, verifiable unlock cookie on a correct PIN and resets attempt state", async () => {
    const updateFn = vi.fn(() => queryStub());
    const q = queryStub({ data: { failed_pin_attempts: 3, locked_until: null } });
    q.update = updateFn;
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ failed_pin_attempts: 0, locked_until: null }));

    const verified = verifyUnlockCookie(result.cookieValue);
    expect(verified).toEqual({ ok: true, deviceId: DEVICE_ID });
  });

  it("503s if the unlock-signing secret isn't configured, even with a correct PIN", async () => {
    delete process.env.CC_UNLOCK_SIGNING_SECRET;
    const q = queryStub({ data: { failed_pin_attempts: 0, locked_until: null } });
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q) });

    const result = await attemptPinUnlock(DEVICE_ID, "2451", () => true);
    expect(result).toEqual({ ok: false, status: 503, reason: "unlock_signing_not_configured" });
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
