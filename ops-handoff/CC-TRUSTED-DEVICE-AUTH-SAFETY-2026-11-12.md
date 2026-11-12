# Command Center trusted-device PIN unlock — design & safety (not deployed)

**Status: implemented on an isolated branch (`security/cc-trusted-device-pin-unlock-01`), NOT deployed,
NOT merged.** No production auth, secrets, or sessions were touched. The migration it depends on is
prepared but not applied.

## Founder decision this implements

> Use verified Firebase owner authentication for initial device enrollment, new devices, revoked
> devices and high-risk recovery. After successful owner authentication, establish a securely bound,
> revocable trusted-device credential. On a previously enrolled device, allow PIN-based unlocking
> without requiring Firebase email/password every 12 hours. The PIN must unlock an existing verified
> owner/device relationship; it must never independently establish ownership.

## What changed

- **New table** `cc_trusted_devices` (migration prepared, not applied — `supabase/migrations/
  20261112200000_cc_trusted_devices.sql`, rollback alongside it). RLS enabled, zero grants to
  anon/authenticated, same lockdown posture as every other Command Center table.
- **New library** `src/lib/server/command-center-device-trust.ts`: enroll, verify, PIN-unlock
  (rate-limited, 5 attempts then a 15-minute lockout), revoke. Raw secrets are never stored — only
  SHA-256 hashes (device secret) or HMAC-SHA256 signatures (unlock session), always compared
  timing-safe. Nothing is readable by client-side JS; every credential lives in an httpOnly cookie.
- **`requireCommandCenterOwner`** (the one authoritative guard, used everywhere) now accepts EITHER
  a Firebase session OR a verified unlock+device cookie pair. A new `requireFreshFirebaseOwnerSession`
  export is the strong-only path, used exclusively by enrollment and revocation — a PIN-unlocked
  session can never mint or destroy device trust.
- **New routes**: `POST /api/command-center/auth/device/enroll` (Firebase-only, mints `cc_device`),
  `POST /api/command-center/auth/device/revoke` (Firebase-only, revokes one or all devices, clears the
  caller's own cookies too). **Rewritten** `GET|POST /api/command-center/auth/pin` — no longer wrapped
  in `ownerOnly()` (that was circular: the pre-existing route required a Firebase session just to reach
  the thing meant to let you skip one, making it unreachable as a gate). It now authorizes off the
  device cookie instead, added to a new third "DEVICE" category in the route-classification inventory
  (`command-center-routes.ts`) alongside the existing HUMAN/MACHINE categories — the project's own
  authorization-inventory test now accounts for all three.
- **New page** `/command-center/unlock` (PIN entry) and **middleware.ts**: an already-enrolled device
  (has a `cc_device` cookie, valid or not) is sent here instead of `/command-login` on an auth failure.
  A never-enrolled device still goes straight to Firebase sign-in, unchanged.
- **`/command-login`**: on a successful Firebase sign-in, best-effort silently calls `/device/enroll`
  before navigating on — no extra prompt, matching "no second PIN prompt after successful unlock."

## What it does NOT do (reported limitations, per the founder's instruction to report exactly rather than silently weakening P06)

- **No WebAuthn / platform-backed credential.** The founder's instructions said "prefer... where
  practical." Implementing real WebAuthn (attestation, credential storage, platform authenticator
  ceremonies) is a materially larger system than a signed-cookie device credential, and wasn't
  attempted here. The device credential implemented instead (a random 256-bit secret in an httpOnly,
  secure, SameSite cookie, hashed server-side) has the same "never readable by JS, never in
  localStorage" property WebAuthn would give, but it is a bearer credential, not an asymmetric
  platform-bound one. If a true WebAuthn implementation is wanted, that's a separate, larger piece of
  work — flagging it now rather than quietly substituting the weaker version without saying so.
- **Device trust period is 90 days by default** (`CC_DEVICE_TRUST_DAYS`), separate from the 12h unlock
  session. A stolen, unlocked device within that window has standing Command Center access until the
  unlock session itself expires (12h) or the device is explicitly revoked. This is the same bearer-
  credential tradeoff any "remember this device" design has; revocation (point 1's "revoked devices")
  is the mitigation, not prevention.

## Why the PIN still never establishes ownership on its own

Every PIN check first requires `cc_device` to independently verify: not just present, but hashed-and-
timing-safe-compared against a non-revoked, non-expired row in `cc_trusted_devices` whose `owner_uid`
matches the LIVE `PARALLAX_OWNER_UID` env value (not just what was stored at enrollment time — rotating
the owner uid invalidates every device immediately, same guarantee a Firebase session has). Only once
that passes does the PIN get checked at all, and even then it only mints a 12h unlock session, re-
verified against the live device row on every subsequent request — never a standing credential on its
own.

## Independent review

Dispatched on this exact branch before any further integration work; see the commit history for
findings and fixes applied.
