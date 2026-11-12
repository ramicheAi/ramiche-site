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

## Independent review (fresh context, head `2a8f4100`)

**The property that matters most held: there is no path where the PIN alone, without a prior
genuinely-verified Firebase enrollment, grants access.** The reviewer tried to break this directly
(trace every call into `attemptPinUnlock`, every insert into `cc_trusted_devices`, every way
`requireFreshFirebaseOwnerSession` might accept a PIN-unlock session) and could not.

One real HIGH-severity bug was found and fixed in this same commit: the PIN-attempt lockout counter
was read-then-write, a classic TOCTOU race — a burst of concurrent requests (trivial for an attacker
holding a stolen `cc_device` cookie but not the PIN) could each read "not locked yet" and each
evaluate its own guess before any single increment landed, defeating the 5-attempt lockout entirely
against concurrency. Fixed by moving the claim into a Postgres function using `SELECT ... FOR UPDATE`
(the migration now includes `cc_trusted_device_claim_pin_attempt`/`..._reset_pin_attempts`), so the row
lock — not application code — is what actually serializes concurrent attempts. Two lower-severity
findings were also fixed in the same pass: the unlock-signing-secret check now runs before the PIN is
evaluated (closes a 503-vs-401 oracle for a correct guess during a misconfiguration window), and a
failed attempt-reset after a correct PIN now fails loud (503) instead of silently proceeding.

## Round 3 — exercised against real Postgres 17, not just reviewed as SQL

Supabase branching needs a Pro-plan upgrade this project doesn't have (confirmed via the API, not
assumed), so both migrations were instead exercised against an isolated local Postgres 17 instance
(matching production's engine) in a throwaway scratch directory, torn down afterward. This found one
real, genuine logic bug the SQL-only review missed:

- **CRITICAL-equivalent logic bug (confirmed with a live `FOR UPDATE` concurrency test and fixed):**
  `cc_trusted_device_claim_pin_attempt` checked whether `locked_until` was in the future, but never
  reset the attempt counter when a lockout had merely EXPIRED (still set, just in the past). The next
  claim after a lockout window ended added to the stale count that already tripped the lock once,
  immediately re-locking for another full window — regardless of whether the PIN was now correct.
  **One lockout cycle permanently bricked the PIN unlock for that device**, forever, until a fresh
  Firebase sign-in + re-enrollment — the opposite of "unlock after the window passes," and a real
  self-inflicted denial-of-service against the feature's own purpose. Fixed by resetting the counter
  to 0 before incrementing when the lock has expired. Reproduced the exact bug and the exact fix
  against live Postgres: inserted a device row with `locked_until` one minute in the past and
  `failed_pin_attempts=5`; before the fix this would have re-locked, after the fix the claim correctly
  returns `allowed=true, attempts=1, locked_until=null`.
- **The HIGH-severity concurrency fix from round 2 was independently re-verified with REAL concurrent
  connections, not mocks**: 20 simultaneous `psql` processes racing the same device row (starting at 3
  attempts) produced exactly one `allowed=true` (the 4th attempt) and nineteen consistent
  `allowed=false, attempts=5` results, with the final row state landing at exactly 5/locked — proving
  the `SELECT ... FOR UPDATE` row lock genuinely serializes concurrent claims under real Postgres, not
  just in a mocked test.
- **Rollback tested against both migrations**, including with pre-existing data present (3 seeded
  "pre-migration" messages, one pre-existing device row) — both forward migrations apply cleanly, both
  rollbacks remove exactly what they claim and nothing else, and pre-existing rows were confirmed
  completely unaffected (`client_message_id`/`relay_claimed` default correctly to null/false on rows
  that existed before the migration ran).
- **Hardening applied in the same pass**: both `SECURITY DEFINER` functions' `search_path` narrowed
  from `public` to `pg_catalog, pg_temp` (defense-in-depth against schema-injection, even though the
  functions already fully-qualify every table reference); the dev-fallback PIN `"2451"` now also
  requires `VERCEL_ENV !== "production"` in addition to the existing `CC_PIN_ALLOW_DEV`/`NODE_ENV`
  checks, closing the one realistic way it could go live — a forgotten `CC_PIN_ALLOW_DEV=1`  — since
  `VERCEL_ENV` is platform-set, never user-configurable the way the other two are.
- **Independently confirmed held, not just asserted**: the reset function cannot clear another
  device's lockout (tested: locked device A, reset device B, confirmed device A's lock untouched);
  `requireFreshFirebaseOwnerSession` never accepts an unlock-only session (confirmed by direct test);
  this PR makes zero changes to `firebase-admin.ts` or any METTLE-facing auth path (confirmed by diff).

Findings reviewed and consciously NOT changed, because they're existing, disclosed tradeoffs rather
than new regressions this PR introduced:
- **Auto-enrollment with no opt-in prompt.** This is literally what the founder's decision asked for
  ("no second PIN prompt after successful unlock" / low friction) — adding a confirmation step would
  reverse that. The mitigation is revocation, already built (`device/revoke`), not prevention.
- **The pre-existing `CC_PIN_ALLOW_DEV`/unsalted-hash PIN storage.** Unchanged from the PIN route this
  PR replaces; out of this PR's scope. Flagged for a separate hardening pass if the founder wants one.
- **No IP-level rate limit on `verifyDeviceCookie`'s DB lookup for a garbage device cookie** — a minor
  DB-amplification vector, not an auth bypass. Not fixed here; noted for a follow-up if traffic ever
  makes it relevant on a single-owner system.
