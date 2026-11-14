import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

const { verifySessionCookie } = vi.hoisted(() => ({ verifySessionCookie: vi.fn() }));
vi.mock("@/lib/firebase-admin", () => ({ verifySessionCookie }));
const { getSupabaseAdmin } = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdmin }));

import { POST } from "./route";
import { OWNER_UID_ENV } from "@/lib/server/command-center-auth";

const OWNER = "the-real-owner-uid";
const DEVICE_ID = "33333333-3333-3333-3333-333333333333";
const SECRET = "c".repeat(64);
const SIGNING_SECRET = "test-unlock-signing-secret";

function sign(deviceId: string, issuedAtS: number) {
  return createHmac("sha256", SIGNING_SECRET).update(`${deviceId}.${issuedAtS}`, "utf8").digest("hex");
}
function freshUnlockCookie() {
  const issuedAtS = Math.floor(Date.now() / 1000);
  return `${DEVICE_ID}.${issuedAtS}.${sign(DEVICE_ID, issuedAtS)}`;
}
function validDeviceRow() {
  return {
    id: DEVICE_ID,
    owner_uid: OWNER,
    secret_hash: createHash("sha256").update(SECRET, "utf8").digest("hex"),
    expires_at: new Date(Date.now() + 1e9).toISOString(),
    revoked_at: null,
    failed_pin_attempts: 0,
    locked_until: null,
  };
}

function postReq() {
  return new Request("http://localhost/api/command-center/auth/device/approve", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      cookie: `cc_unlock=${freshUnlockCookie()}; cc_device=${DEVICE_ID}.${SECRET}`,
    },
    body: JSON.stringify({ pin: "2451" }),
  });
}

describe("POST /api/command-center/auth/device/approve", () => {
  const originalOwner = process.env[OWNER_UID_ENV];
  const originalSigning = process.env.CC_UNLOCK_SIGNING_SECRET;
  beforeEach(() => {
    process.env[OWNER_UID_ENV] = OWNER;
    process.env.CC_UNLOCK_SIGNING_SECRET = SIGNING_SECRET;
    process.env.CC_PIN = "2451";
    verifySessionCookie.mockReset();
    verifySessionCookie.mockResolvedValue(null);
    getSupabaseAdmin.mockReset();
  });
  afterEach(() => {
    process.env[OWNER_UID_ENV] = originalOwner;
    process.env.CC_UNLOCK_SIGNING_SECRET = originalSigning;
    delete process.env.CC_PIN;
  });

  it("denies without any valid owner credential", async () => {
    const res = await POST(new Request("http://localhost/api/command-center/auth/device/approve", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("generates a code after a successful step-up PIN re-check, on top of an already-unlocked session", async () => {
    const claimRow = { allowed: true, attempts: 1, locked_until: null };
    const resetRow = { cleared: true, locked_until: null };
    const insertQ: Record<string, unknown> = { error: null };
    insertQ.insert = vi.fn(() => insertQ);

    const deviceQ: Record<string, unknown> = { data: validDeviceRow(), error: null };
    deviceQ.select = vi.fn(() => deviceQ);
    deviceQ.eq = vi.fn(() => deviceQ);
    deviceQ.maybeSingle = vi.fn(() => deviceQ);

    const from = vi.fn((table: string) => (table === "cc_trusted_devices" ? deviceQ : insertQ));
    const rpc = vi.fn((fn: string) => {
      if (fn === "cc_trusted_device_claim_pin_attempt") return Promise.resolve({ data: claimRow, error: null });
      if (fn === "cc_trusted_device_reset_pin_attempts") return Promise.resolve({ data: resetRow, error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });
    getSupabaseAdmin.mockReturnValue({ from, rpc });

    const res = await POST(postReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.code).toBe("string");
    expect(body.code.length).toBeGreaterThan(10);
  });

  it("denies when the step-up PIN is wrong, even with a perfectly valid unlock session", async () => {
    const q: Record<string, unknown> = { data: validDeviceRow(), error: null };
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.maybeSingle = vi.fn(() => q);
    const rpc = vi.fn(() => Promise.resolve({ data: { allowed: true, attempts: 1, locked_until: null }, error: null }));
    getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => q), rpc });

    const res = await POST(
      new Request("http://localhost/api/command-center/auth/device/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
          cookie: `cc_unlock=${freshUnlockCookie()}; cc_device=${DEVICE_ID}.${SECRET}`,
        },
        body: JSON.stringify({ pin: "0000" }), // wrong
      })
    );
    expect(res.status).toBe(401);
  });
});
