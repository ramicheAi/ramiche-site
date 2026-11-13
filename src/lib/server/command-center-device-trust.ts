/**
 * Command Center trusted-device PIN unlock (founder Priority 1 decision,
 * CC-RECOVERY-DELIVERY-CONVERGENCE-01, revised per the founder's correction:
 * Firebase email/password must never be the NORMAL user-facing login —
 * not for daily use, and not for first-time device enrollment either).
 *
 * The identity boundary is unchanged: `requireCommandCenterOwner` in
 * command-center-guard.ts is still the ONLY authoritative check. What
 * changed is which credentials can satisfy it. Three ways to ESTABLISH
 * device trust now exist, in decreasing order of how "strong" the proof is,
 * but all three are still narrow, fail-closed, and auditable — none of them
 * make the PIN itself an unrestricted master credential:
 *
 *   1. BOOTSTRAP (first device only): a high-entropy static secret
 *      (`CC_BOOTSTRAP_SECRET`, owner-configured in Vercel, never in git) —
 *      but ONLY while the owner currently has ZERO active (non-revoked,
 *      non-expired) enrolled devices. The moment one device exists, this
 *      path is dead even if the secret leaks; it is not a standing master
 *      key. See `bootstrapEnrollDevice`.
 *   2. DEVICE-TO-DEVICE APPROVAL (every subsequent device): an
 *      already-enrolled, already-unlocked device generates a short-lived
 *      (5-minute), single-use code — but generating one requires a STEP-UP:
 *      re-entering the PIN at that exact moment, through the same
 *      rate-limited `attemptPinUnlock` path, not merely holding an existing
 *      unlock session. See `createEnrollmentApprovalCode` /
 *      `redeemEnrollmentApprovalCode`.
 *   3. FIREBASE (fallback/recovery only, unchanged from before): a fully
 *      verified Firebase owner session can still enroll a device directly
 *      (`enrollDevice`, called from the Firebase-gated enroll route) — kept
 *      as the recovery path for when no device is enrolled AND the
 *      bootstrap secret is unavailable/rotated away, never the primary UX.
 *
 * UNLOCK (minting a short owner session from an already-trusted device)
 * is unchanged: requires BOTH a valid, non-revoked, non-expired device
 * cookie AND the correct PIN, verified live on every subsequent request —
 * revoking a device invalidates any still-live unlock session from it
 * immediately.
 *
 * Secrets: no raw secret (device secret, bootstrap secret, enrollment code)
 * is ever stored — only SHA-256 hashes or HMAC-SHA256 tags, always compared
 * timing-safe. Nothing here is readable by client-side JS (httpOnly cookies
 * only) or written to localStorage.
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

// Independent review finding: an under-entropy bootstrap secret (e.g. a
// short word someone typed in a hurry) would be guessable even with rate
// limiting. Fail closed rather than accept a weak one — 20 chars is a
// floor, not a target; generate it with something like `openssl rand -hex
// 32` (64 chars) as the safety doc recommends.
const MIN_BOOTSTRAP_SECRET_LENGTH = 20;

function bootstrapSecret(): string | null {
  const s = process.env.CC_BOOTSTRAP_SECRET?.trim();
  if (!s || s.length < MIN_BOOTSTRAP_SECRET_LENGTH) return null;
  return s;
}

export type BootstrapResult =
  | { ok: true; cookieValue: string; expiresAt: Date }
  | { ok: false; status: 401 | 403 | 429 | 503; reason: string };

/**
 * First-device-only enrollment via a static, high-entropy, owner-configured
 * secret — never stored in git, never printed, compared timing-safe.
 *
 * Fixed per independent review (two HIGH findings in the first version):
 * 1. The "zero active devices" check used to be a separate SELECT, then a
 *    separate INSERT — not atomic, so two concurrent correct-secret calls
 *    could both pass the check and both enroll, multiplying an attacker's
 *    PIN-guessing surface (each enrolled device gets its own 5-attempt
 *    lockout budget). Fixed: cc_bootstrap_consume_and_enroll does the
 *    check-and-insert under one row lock in the database, not in app code.
 * 2. "Active device" was keyed on device expiry/revocation, which put the
 *    window back on a 90-day clock (or immediately, on a full revoke) with
 *    no deliberate action required — a leaked secret was NOT actually
 *    one-shot. Fixed: consumption is now a separate, permanent
 *    `consumed_at` flag in cc_bootstrap_state, touched only by this
 *    function and by the explicit Firebase-gated resetBootstrap below —
 *    never by anything that happens to an individual device afterward.
 *
 * Also now rate-limited (cc_bootstrap_claim_attempt, same FOR UPDATE
 * discipline as the PIN-attempt functions) — the secret itself previously
 * had no throttle at all.
 */
export async function bootstrapEnrollDevice(suppliedToken: string, ownerUid: string, label?: string): Promise<BootstrapResult> {
  const secret = bootstrapSecret();
  if (!secret) return { ok: false, status: 503, reason: "bootstrap_not_configured" };

  const db = await getDb();
  if (!db) return { ok: false, status: 503, reason: "not_configured" };

  const { data: claim, error: claimError } = await db.rpc("cc_bootstrap_claim_attempt", {
    p_owner_uid: ownerUid,
    p_max_attempts: MAX_PIN_ATTEMPTS,
    p_lockout_seconds: LOCKOUT_SECONDS,
  });
  if (claimError) return { ok: false, status: 503, reason: "claim_failed" };
  const claimRow = (Array.isArray(claim) ? claim[0] : claim) as { allowed: boolean } | undefined;
  if (!claimRow?.allowed) return { ok: false, status: 429, reason: "locked" };

  if (!timingSafeHexEqual(hashSecret(suppliedToken || ""), hashSecret(secret))) {
    return { ok: false, status: 401, reason: "bad_token" };
  }

  const deviceSecret = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + DEVICE_TRUST_SECONDS * 1000);
  const { data, error } = await db.rpc("cc_bootstrap_consume_and_enroll", {
    p_owner_uid: ownerUid,
    p_secret_hash: hashSecret(deviceSecret),
    p_expires_at: expiresAt.toISOString(),
    p_label: label?.slice(0, 120) || null,
  });
  if (error) return { ok: false, status: 503, reason: "enroll_failed" };
  const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; device_id: string } | undefined;
  if (!row?.ok) return { ok: false, status: 403, reason: "already_enrolled" };

  return { ok: true, cookieValue: `${row.device_id}.${deviceSecret}`, expiresAt };
}

export type BootstrapResetResult = { ok: boolean };

/**
 * Deliberately re-arms the bootstrap path for an owner who has lost both
 * their bootstrap secret AND every enrolled device. Caller MUST have
 * already passed requireFreshFirebaseOwnerSession — never
 * requireCommandCenterOwner's unlock path — the whole point of making
 * consumption permanent (see bootstrapEnrollDevice above) is that only the
 * strong credential can undo it, not a clock and not a PIN.
 */
export async function resetBootstrap(ownerUid: string): Promise<BootstrapResetResult> {
  const db = await getDb();
  if (!db) return { ok: false };
  const { error } = await db.rpc("cc_bootstrap_reset", { p_owner_uid: ownerUid });
  return { ok: !error };
}

const ENROLLMENT_CODE_TTL_SECONDS = 5 * 60;

export type GenerateEnrollmentCodeResult =
  | { ok: true; code: string; expiresAt: Date }
  | { ok: false; status: 503; reason: string };

/**
 * Called ONLY after the approving device's PIN has been freshly re-verified
 * (step-up — see the approve route, which calls attemptPinUnlock itself
 * before this). Generates a random code, stores only its hash, scoped to
 * the owner and a 5-minute expiry, auditable to the approving device id.
 */
export async function createEnrollmentApprovalCode(ownerUid: string, approvingDeviceId: string): Promise<GenerateEnrollmentCodeResult> {
  const db = await getDb();
  if (!db) return { ok: false, status: 503, reason: "not_configured" };
  const code = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + ENROLLMENT_CODE_TTL_SECONDS * 1000);
  const { error } = await db.from("cc_device_enrollment_codes").insert({
    code_hash: hashSecret(code),
    owner_uid: ownerUid,
    expires_at: expiresAt.toISOString(),
    issued_by_device_id: approvingDeviceId,
  });
  if (error) return { ok: false, status: 503, reason: "generate_failed" };
  return { ok: true, code, expiresAt };
}

export type RedeemEnrollmentCodeResult =
  | { ok: true; cookieValue: string; expiresAt: Date }
  | { ok: false; status: 401 | 503; reason: string };

/**
 * Redeems a device-approval code on a NEW device. Atomic via the migration's
 * `cc_redeem_device_enrollment_code` RPC (SELECT ... FOR UPDATE, same
 * discipline as the PIN-attempt functions) — two concurrent redemption
 * attempts on the same code can never both succeed.
 */
export async function redeemEnrollmentApprovalCode(code: string, ownerUid: string, label?: string): Promise<RedeemEnrollmentCodeResult> {
  const db = await getDb();
  if (!db) return { ok: false, status: 503, reason: "not_configured" };
  const { data, error } = await db.rpc("cc_redeem_device_enrollment_code", {
    p_code_hash: hashSecret(code),
    p_owner_uid: ownerUid,
  });
  if (error) return { ok: false, status: 503, reason: "redeem_failed" };
  const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean } | undefined;
  if (!row?.ok) return { ok: false, status: 401, reason: "invalid_or_expired_code" };

  const result = await enrollDevice(ownerUid, label);
  if ("error" in result) return { ok: false, status: 503, reason: result.error };
  return { ok: true, cookieValue: result.cookieValue, expiresAt: result.expiresAt };
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

  // Checked FIRST, before the PIN is ever evaluated (independent review
  // finding): checking the signing secret only on a correct PIN made its
  // own 503 vs. 401 an oracle for "did you guess the right PIN" during a
  // misconfiguration window.
  const signingSecret = unlockSigningSecret();
  if (!signingSecret) return { ok: false, status: 503, reason: "unlock_signing_not_configured" };

  // Atomic claim via a `SELECT ... FOR UPDATE`-backed RPC (independent
  // review finding, HIGH): the previous read-then-write counter was a
  // classic TOCTOU — N concurrent requests all read "not locked yet" and
  // each got to evaluate its own PIN guess before any increment landed, so
  // the 5-attempt lockout did nothing against a burst of concurrent
  // guesses once an attacker had a stolen `cc_device` cookie. The database
  // row lock is what actually serializes this, not any check in this
  // function — see cc_trusted_device_claim_pin_attempt in the migration.
  const { data: claim, error: claimError } = await db.rpc("cc_trusted_device_claim_pin_attempt", {
    p_device_id: deviceId,
    p_max_attempts: MAX_PIN_ATTEMPTS,
    p_lockout_seconds: LOCKOUT_SECONDS,
  });
  if (claimError) return { ok: false, status: 503, reason: "claim_failed" };
  const row = (Array.isArray(claim) ? claim[0] : claim) as { allowed: boolean; attempts: number; locked_until: string | null } | undefined;
  if (!row) return { ok: false, status: 401, reason: "not_found" };
  if (!row.allowed) {
    // Either already locked out from a prior cycle, or this exact claim
    // just tipped it into lockout — both deny WITHOUT evaluating the PIN,
    // so a locked-out attacker gets zero further guesses, not one more.
    return { ok: false, status: 429, reason: "locked" };
  }

  if (!pinMatches(pin)) {
    // The attempt was already counted by the claim above (that's the
    // whole point — it's counted before we even know if it's right).
    // Nothing further to write here.
    return { ok: false, status: 401, reason: "wrong_pin" };
  }

  const { data: resetData, error: resetError } = await db.rpc("cc_trusted_device_reset_pin_attempts", { p_device_id: deviceId });
  if (resetError) {
    // Fail loud (independent review finding): a failed reset must not be
    // swallowed into a silent success. The device is left in whatever
    // attempt-count state the claim above produced; the caller must retry.
    return { ok: false, status: 503, reason: "reset_failed" };
  }
  const resetRow = (Array.isArray(resetData) ? resetData[0] : resetData) as { cleared: boolean; locked_until: string | null } | undefined;
  if (!resetRow?.cleared) {
    // Founder-directed check, reproduced against live Postgres: a
    // concurrent wrong-PIN burst can claim its way to a fresh lockout in
    // the gap between THIS caller's own (now-stale) successful claim and
    // this reset call. The lockout that took effect since then wins —
    // never mint an unlock session on a correct PIN that was verified
    // against state the database has since moved past.
    return { ok: false, status: 429, reason: "locked" };
  }

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
