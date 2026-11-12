/**
 * Command Center trusted-device PIN unlock (founder Priority 1 decision,
 * CC-RECOVERY-DELIVERY-CONVERGENCE-01).
 *
 * The identity boundary is unchanged: `requireCommandCenterOwner` in
 * command-center-guard.ts is still the ONLY authoritative check, and a
 * Firebase human-provider session verified against the exact configured
 * owner uid is still the only thing that can ESTABLISH ownership. This file
 * adds a second, narrower credential that guard accepts in addition to that
 * Firebase session — never instead of it for the step that matters:
 *
 *   1. ENROLLMENT (device trust is created) requires a fully verified
 *      Firebase owner session. There is no other way into this table.
 *   2. UNLOCK (a short owner session is minted from an already-trusted
 *      device) requires BOTH a valid, non-revoked, non-expired device
 *      cookie AND the correct PIN. The PIN alone proves nothing; the device
 *      cookie alone proves nothing. Only the combination unlocks.
 *   3. Every subsequent request on that unlock session is verified against
 *      BOTH the unlock cookie's own signature/expiry AND a live re-check
 *      that the device row is still valid (not revoked, not expired) —
 *      revoking the device immediately invalidates any still-live unlock
 *      session minted from it.
 *
 * Secrets: the raw device secret and the unlock-cookie signing secret are
 * never stored. Only SHA-256 hashes (device secret) or HMAC-SHA256 tags
 * (unlock cookie) are persisted/compared, always via timingSafeEqual.
 * Nothing here is readable by client-side JS (httpOnly cookies only) or
 * written to localStorage.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const DEVICE_COOKIE = "cc_device";
export const UNLOCK_COOKIE = "cc_unlock";

/** How long a newly enrolled device stays trusted before Firebase sign-in is required again. */
const DEVICE_TRUST_SECONDS = (() => {
  const days = Number(process.env.CC_DEVICE_TRUST_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : 90) * 24 * 60 * 60;
})();

/** How long one PIN unlock stays valid — matches the prior Firebase-session cadence (12h), not the device's own 90-day trust window. */
export const UNLOCK_SESSION_SECONDS = 12 * 60 * 60;

const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

function unlockSigningSecret(): string | null {
  const s = process.env.CC_UNLOCK_SIGNING_SECRET?.trim();
  return s || null;
}

function signUnlock(deviceId: string, issuedAtS: number, secret: string): string {
  return createHmac("sha256", secret).update(`${deviceId}.${issuedAtS}`, "utf8").digest("hex");
}

export interface DeviceRow {
  id: string;
  owner_uid: string;
  secret_hash: string;
  expires_at: string;
  revoked_at: string | null;
  failed_pin_attempts: number;
  locked_until: string | null;
}

async function getDb() {
  const db = getSupabaseAdmin();
  return db;
}

/** Parse the `cc_device` cookie into {deviceId, secret}, or null if malformed. */
export function parseDeviceCookie(raw: string | undefined | null): { deviceId: string; secret: string } | null {
  if (!raw) return null;
  const i = raw.indexOf(".");
  if (i < 0) return null;
  const deviceId = raw.slice(0, i);
  const secret = raw.slice(i + 1);
  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || secret.length < 32) return null;
  return { deviceId, secret };
}

/**
 * Enroll a new trusted device. Caller MUST have already passed
 * requireCommandCenterOwner (a verified Firebase owner session) — this
 * function does not itself check that; it only trusts callers that do.
 * Returns the raw cookie value to set (never persisted in raw form).
 */
export async function enrollDevice(ownerUid: string, label?: string): Promise<{ cookieValue: string; expiresAt: Date } | { error: string }> {
  const db = await getDb();
  if (!db) return { error: "not_configured" };

  const secret = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DEVICE_TRUST_SECONDS * 1000);

  const { data, error } = await db
    .from("cc_trusted_devices")
    .insert({
      owner_uid: ownerUid,
      secret_hash: hashSecret(secret),
      label: label?.slice(0, 120) || null,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) return { error: "enroll_failed" };
  return { cookieValue: `${data.id}.${secret}`, expiresAt };
}

export type DeviceVerifyResult =
  | { ok: true; deviceId: string; ownerUid: string }
  | { ok: false; reason: "not_configured" | "malformed" | "not_found" | "secret_mismatch" | "revoked" | "expired" | "owner_mismatch" };

/** Verify a device cookie against the live table and the live configured owner uid. Does NOT check the PIN. */
export async function verifyDeviceCookie(raw: string | undefined | null, configuredOwnerUid: string): Promise<DeviceVerifyResult> {
  const parsed = parseDeviceCookie(raw);
  if (!parsed) return { ok: false, reason: "malformed" };

  const db = await getDb();
  if (!db) return { ok: false, reason: "not_configured" };

  const { data, error } = await db
    .from("cc_trusted_devices")
    .select("id, owner_uid, secret_hash, expires_at, revoked_at, failed_pin_attempts, locked_until")
    .eq("id", parsed.deviceId)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "not_found" };
  const row = data as DeviceRow;

  if (!timingSafeHexEqual(hashSecret(parsed.secret), row.secret_hash)) {
    return { ok: false, reason: "secret_mismatch" };
  }
  if (row.revoked_at) return { ok: false, reason: "revoked" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  // Re-checked against the LIVE env value every time, never trusted from
  // the stored row alone — if PARALLAX_OWNER_UID is ever rotated, every
  // device enrolled under the old uid stops working immediately, same as
  // a Firebase session would.
  if (row.owner_uid !== configuredOwnerUid) return { ok: false, reason: "owner_mismatch" };

  return { ok: true, deviceId: row.id, ownerUid: row.owner_uid };
}

export type PinUnlockResult =
  | { ok: true; cookieValue: string }
  | { ok: false; status: 401 | 403 | 429 | 503; reason: string };

/**
 * Attempt a PIN unlock for an already-verified device (call verifyDeviceCookie
 * first). Enforces attempt limits + a lockout window, server-side, keyed on
 * the device row — never trusted to the client.
 */
export async function attemptPinUnlock(deviceId: string, pin: string, pinMatches: (pin: string) => boolean): Promise<PinUnlockResult> {
  const db = await getDb();
  if (!db) return { ok: false, status: 503, reason: "not_configured" };

  const { data, error } = await db
    .from("cc_trusted_devices")
    .select("failed_pin_attempts, locked_until")
    .eq("id", deviceId)
    .maybeSingle();
  if (error || !data) return { ok: false, status: 401, reason: "not_found" };

  if (data.locked_until && new Date(data.locked_until).getTime() > Date.now()) {
    return { ok: false, status: 429, reason: "locked" };
  }

  if (!pinMatches(pin)) {
    const nextAttempts = (data.failed_pin_attempts ?? 0) + 1;
    const lockedUntil = nextAttempts >= MAX_PIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString() : null;
    await db
      .from("cc_trusted_devices")
      .update({ failed_pin_attempts: nextAttempts, locked_until: lockedUntil })
      .eq("id", deviceId);
    return { ok: false, status: lockedUntil ? 429 : 401, reason: lockedUntil ? "locked" : "wrong_pin" };
  }

  const signingSecret = unlockSigningSecret();
  if (!signingSecret) return { ok: false, status: 503, reason: "unlock_signing_not_configured" };

  await db
    .from("cc_trusted_devices")
    .update({ failed_pin_attempts: 0, locked_until: null, last_used_at: new Date().toISOString() })
    .eq("id", deviceId);

  const issuedAtS = Math.floor(Date.now() / 1000);
  const sig = signUnlock(deviceId, issuedAtS, signingSecret);
  return { ok: true, cookieValue: `${deviceId}.${issuedAtS}.${sig}` };
}

export type UnlockVerifyResult = { ok: true; deviceId: string } | { ok: false; reason: string };

/** Verify the `cc_unlock` cookie's signature and freshness. Does NOT re-check the device row — callers that need full revocation-awareness should also call verifyDeviceCookie. */
export function verifyUnlockCookie(raw: string | undefined | null): UnlockVerifyResult {
  if (!raw) return { ok: false, reason: "missing" };
  const parts = raw.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [deviceId, issuedAtRaw, sig] = parts;
  const issuedAtS = Number(issuedAtRaw);
  if (!/^[0-9a-f-]{36}$/i.test(deviceId) || !Number.isFinite(issuedAtS)) return { ok: false, reason: "malformed" };

  const signingSecret = unlockSigningSecret();
  if (!signingSecret) return { ok: false, reason: "not_configured" };

  const expected = signUnlock(deviceId, issuedAtS, signingSecret);
  if (!timingSafeHexEqual(sig, expected)) return { ok: false, reason: "bad_signature" };

  const ageS = Math.floor(Date.now() / 1000) - issuedAtS;
  if (ageS < 0 || ageS > UNLOCK_SESSION_SECONDS) return { ok: false, reason: "expired" };

  return { ok: true, deviceId };
}

/** Revoke one device (or, with no id, every device for the owner) — always requires a fully verified Firebase owner session at the call site. */
export async function revokeDevice(ownerUid: string, deviceId?: string): Promise<{ ok: boolean; revoked: number }> {
  const db = await getDb();
  if (!db) return { ok: false, revoked: 0 };
  let query = db.from("cc_trusted_devices").update({ revoked_at: new Date().toISOString() }).eq("owner_uid", ownerUid).is("revoked_at", null);
  if (deviceId) query = query.eq("id", deviceId);
  const { data, error } = await query.select("id");
  return { ok: !error, revoked: data?.length ?? 0 };
}
