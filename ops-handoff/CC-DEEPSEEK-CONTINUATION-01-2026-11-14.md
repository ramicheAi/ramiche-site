# CC-DEEPSEEK-CONTINUATION-01 — state, fix, acceptance (2026-11-14)

Continuation of the Command Center access recovery after Claude Code's credits ran out. No merge, no
deploy, no production migration, no secret change, no iMac/OpenClaw restart, no production data
write. Everything below is either read-only inspection or local work.

## CC-RELEASE-87 corrective update (2026-11-14, later)

Production migrations 1-3 are applied and verified. A least-privilege defect was found in the
production catalog: Supabase default ACLs left `service_role` with DELETE, TRUNCATE, REFERENCES,
TRIGGER and MAINTAIN on all three auth tables, despite the migration's stated "no DELETE" contract.
A fourth migration, `20261114010000_cc_auth_service_role_least_privilege.sql`, revokes all table
privileges from `service_role` and re-grants only SELECT/INSERT/UPDATE on devices and INSERT on
codes. It is tested locally and not yet applied to production.

The production migration history also needs reconciliation: it contains two ad-hoc versions
(`20261114213728`, `20261114213754`) and omits `cc_trusted_devices`. A guarded metadata repair,
`ops-handoff/CC-RELEASE-87-HISTORY-REPAIR.sql`, aligns it to the four canonical versions and aborts
on any unexpected state. It is tested locally and not yet applied. See
`ops-handoff/CC-RELEASE-87-EXECUTION-PACKET-2026-11-14.md`.

## A. Exact current state

| Item | Value |
|---|---|
| Repo | `ramicheAi/ramiche-site` |
| PR #87 | OPEN, **DRAFT**, MERGEABLE / CLEAN, base `main` |
| Handoff head | `5b1692612dee56fefcc089605bbd107ad673ed79` (matches the mission) |
| Current head | `6b8289c6` (two fix commits on top, pushed) |
| Production commit | `50b45f4bcfb3c2733edeef4c1b8564a023a72d42` |
| Production deployment | `dpl_8qEVs3qapwhHvRLToNUienWG3H3w`, READY |
| Live baseline | `/command-center` → 307 `/command-login?next=...`; `/api/command-center/agents` → 401 `missing_session`; `/` → 200 |
| Integration candidate 01 | `fcd353af`, stale: lacks `4463cb99` and `5b169261` |
| Integration candidate 02 | `b5935c39` + final merge, rebuilt in isolation from `fcd353af` |

CI on `6b8289c6`: lint-build, test, security, validate all pass; `db` skipped (workflow_dispatch
only, unchanged).

## B. Work completed

### 1. Fixed the entry-page blocker (real, reproduced)

The command-center layout still wrapped every page in the original client-side PIN gate
(`sessionStorage 'cc-pin-auth'`). At `5b169261`, a real Chromium load of `/command-center/bootstrap`
and `/command-center/unlock` never left the hydration placeholder (`COMMAND CENTER · INITIALIZING`);
the forms never appeared. A new device could not enroll and an enrolled device could not unlock.
On an authorized page it was also a redundant second PIN prompt, and it was never a security
control (`sessionStorage` is client-writable; the server cookies are authoritative).

Fix (`7edbf11a`): entry routes render bare; every other page renders the cockpit after middleware
authorization; lock now clears the httpOnly `cc_unlock` cookie in middleware via `?lock=1`.
Hardening (`6b8289c6`): the lock is only honored for same-origin navigation, so a cross-site
subresource cannot force a logout.

### 2. Rebuilt the integration candidate

`integration/cc-release-candidate-02` = `fcd353af` + merge of #87 at `6b8289c6`. In that worktree:
`tsc --noEmit` clean, `vitest run` **996 passed, 2 expected fail, 4 skipped**, `eslint src` 0 errors,
`next build` clean.

### 3. Verification on PR #87 head

```
npx tsc --noEmit      clean
npx eslint src        0 errors (191 pre-existing warnings)
npx vitest run        893 passed, 4 skipped, zero regressions
npm run build         clean
```

## C. Authentication acceptance — proven vs untested vs failed

### Proven on this machine, real browser + real database

A local production build of this exact tree (`next start`) against **real PostgreSQL 17.11**,
**real PostgREST 16.5**, and Chromium (Playwright). Nothing touched production; the database was
created in a temp directory and torn down.

| Scenario | Result |
|---|---|
| Fresh browser → `/command-center` | redirects to `/command-center/bootstrap`; **no Firebase screen** |
| First device: bootstrap secret | device enrolled, redirected to `/command-center/unlock` |
| Wrong PIN | `Incorrect PIN.` (401) |
| Correct PIN | `/command-center` dashboard renders (`PARALLAX OS v4 · COMMAND CENTER OPERATIONS`) |
| Browser refresh | still unlocked, no second PIN prompt |
| Add device: step-up PIN | 32-hex one-time link generated |
| iPhone-shaped second context: open link | auto-redeemed, PIN → dashboard, no Firebase |
| Replay the same approval code | 401 `invalid_or_expired_code` |
| Explicit lock | unlock cookie cleared; `/command-center` → `/command-center/unlock` |
| Five wrong PINs | lockout message; a correct PIN is still 429 `locked` |
| Forged `cc_unlock` signature | rejected; page → `/command-center/unlock` |
| Expired device row | page → `/command-center/unlock` |
| Revoked device row | page → `/command-center/unlock` |
| Anonymous `/api/command-center/agents` | 401 `missing_session` |
| Cookie flags | `cc_device` and `cc_unlock` are httpOnly |
| Migrations on fresh PG17 | both apply cleanly, re-run is a no-op |
| Rollback files | remove exactly the new tables/functions (0 remaining) |

Raw transcript: `ops-handoff/CC-LOCAL-ACCEPTANCE-2026-11-14.json`.

### Not tested (cannot be, without authorization or a physical device)

- Firebase recovery sign-in and the Firebase-only enrollment/revocation routes (needs Firebase
  credentials and a real sign-in).
- The real Vercel production deployment and the real Supabase project (migrations not applied,
  secrets not configured).
- iPhone Safari in the founder's hand; MacBook in the founder's hand.
- 12-hour unlock expiry and 90-day trust expiry as wall-clock waits (the expired/revoked paths were
  tested by changing the row, not by waiting).
- Cloudflare Access in front of `command.parallaxvinc.com` (it redirects to an Access login before
  the app, which is a separate gate to consider when choosing the acceptance URL).

### Failed on the handoff commit, fixed here

- `/command-center/bootstrap` and `/command-center/unlock` were unusable in a real browser (stuck on
  the hydration placeholder). This is the one product-acceptance failure found and closed.

## D. Integration readiness (#83–#87)

| PR | State | Release dependency |
|---|---|---|
| #83 | head `976975c4`, in candidate | `CRON_SECRET` still **absent** from Vercel production; the route fails closed, so cron stops until configured |
| #84 | head `af750ecf`, in candidate | none beyond deploy |
| #85 | head `37a18403`, in candidate | `BRIDGE_API_SECRET` present on both sides, **match unverified**; iMac runs pre-mission code and was not restarted |
| #86 | head `1c7b086d`, in candidate | migration `20261112180000_messages_client_idempotency_key.sql` is **not applied to production** |
| #87 | corrective branch head, merged into candidate 02 | four migrations + two secrets, below |

Migration order for #87:

1. `20261112200000_cc_trusted_devices.sql`
2. `20261113000000_cc_device_enrollment_codes.sql`
3. `20261114000000_cc_auth_service_role_grants.sql` (release correction, see below)

They are additive (three new tables, six functions, explicit service-role grants, and a
least-privilege correction; no existing table, grant, or RLS policy is altered). They must be applied **before** the code is deployed, or every
auth path fails closed. Rollback files exist; a rollback after real devices are enrolled destroys
their trust rows, so it is not a free undo.

### Service-role grants correction (verified defect)

The two auth migrations revoked PUBLIC execute on every function but granted nothing to
`service_role`, relying on ambient Supabase default privileges that are not visible in this repo.
Tested on PostgreSQL 17 with a clean role setup:

- before the correction: `set role service_role; select ... from cc_trusted_devices` and
  `select ... from cc_bootstrap_claim_attempt(...)` both returned **permission denied**;
- after `20261114000000_cc_auth_service_role_grants.sql`: select, insert and update on
  `cc_trusted_devices`, insert on `cc_device_enrollment_codes`, and all six auth functions work as
  `service_role`;
- `anon` is still denied, and re-running the grants file is a clean no-op.

Least privilege is explicit: no DELETE anywhere, and `cc_bootstrap_state` gets no direct table grant
because only the SECURITY DEFINER functions touch it.

## E. Production safety — unchanged

No merge, deploy, migration, secret write, credential rotation, production data write, iMac service
restart, or feature-gate change. Production remains `50b45f4b` / `dpl_8qEV...`, READY. The only
writes were development commits on the PR branch and the candidate branch, plus local temp files.

## F. Remaining blockers

1. **`CC_UNLOCK_SIGNING_SECRET` is absent from Vercel production.** Every PIN attempt fails closed
   with 503 until it exists. (Names checked via `vercel env ls`; no values read or printed.)
2. **`CC_BOOTSTRAP_SECRET` is absent from Vercel production.** First-device bootstrap fails closed
   with 503 until it exists.
3. **The three #87 migrations are not applied to production.** Applying them before deploy is
   mandatory; applying them is itself a production database change requiring authorization.
4. **No safe hosted staging exists.** Supabase branching needs a plan upgrade; preview deployments
   have no `PARALLAX_OWNER_UID`/`CC_*` env (production-only), so they fail closed. This is why the
   acceptance above is local, not hosted.
5. **PR #87 is still a draft** and the founder has not authorized merge/deploy.

## G. Minimum founder action

1. Authorize two production secrets (values never shown to me):
   ```bash
   vercel env add CC_UNLOCK_SIGNING_SECRET production   # e.g. openssl rand -hex 32
   vercel env add CC_BOOTSTRAP_SECRET production        # ≥20 chars, e.g. openssl rand -hex 32
   ```
2. Apply the corrective migration 4 to production, run the privilege regression, then run the
   guarded history repair. Verify the four canonical history rows and the least-privilege matrix.
3. Authorize merging PR #87 (or deploying `integration/cc-release-candidate-02`). `CC_PIN_HASH` and
   `PARALLAX_OWNER_UID` are already present.
4. Run the MacBook + iPhone checklist below. Until that passes, product acceptance is not claimed.

## Real-device acceptance checklist (Phase D)

Use a URL that reaches the app directly (not the Cloudflare Access gate) unless testing that gate
deliberately.

1. **MacBook, normal browser profile** (not private, so the device cookie persists), hard reload:
   open `/command-center` → bootstrap page, no Firebase. Paste the
   bootstrap secret → PIN → dashboard. **Pass = no email/password screen at any point.**
2. **Refresh** twice, and navigate between pages: no PIN prompt again.
3. **Wrong PIN** once: clear error; then five wrong PINs: lockout message; the correct PIN is also
   refused until the window ends.
4. **iPhone Safari**: on the MacBook, `Devices` → re-enter PIN → copy the five-minute link → open it
   on the iPhone → PIN → dashboard.
5. **Replay** the same link after use: rejected.
6. **Revoke** the iPhone from a Firebase recovery session; on the iPhone, the next navigation goes
   to unlock and cannot be recovered with the PIN alone.
7. **Session expiry**: after 12h (or with a tampered `cc_unlock`), the PIN prompt returns.
8. **Trust expiry**: with the device row expired, enrollment must be redone via approval code (or
   Firebase recovery).
9. **Lost all devices**: the in-app reset path requires a fresh Firebase owner session. The
   minimum operator alternative without Firebase is the documented SQL re-arm in the next section;
   a PIN-unlocked session can never call either path.
10. **Unauthorized API**: `curl /api/command-center/agents` → 401 `missing_session`.
11. **No regressions**: `/`, `/command-login` (fallback only), `/mettle`, `/portal`, `/pricing`, and
    three Command Center subpages load.
12. **Cookie audit** in DevTools: `cc_device`, `cc_unlock` httpOnly + Secure + SameSite=Lax in
    production; no secrets in `localStorage`.

## Honest limits

- The acceptance above is a local production build against a local database, not the founder's
  devices and not production. It proves the wiring, the cookies, the routes and the SQL; it does not
  prove the deployed environment's configuration.
- No WebAuthn / platform-bound credential. The device secret is a bearer credential in an httpOnly
  cookie, hashed server-side, 90-day trust; revocation is the control.
- `CC_PIN_HASH` is an unsalted SHA-256 of the PIN (pre-existing, unchanged).
- PR #87's body previously described the Firebase-enrollment design; it now describes the current
  PIN-first design and this fix.

## All devices lost: recovery without Firebase, and the Firebase limitation

Normal login and normal enrollment never show Firebase. Administrative recovery is different: the
shipped reset route (`POST /api/command-center/auth/device/bootstrap/reset`) requires
`requireFreshFirebaseOwnerSession`, so the built-in recovery path **does** require Firebase. That is
the honest limitation. It is a recovery-only screen, never the daily flow.

Minimum secure operator alternative, using the existing mechanism and no redesign:

1. Open the Supabase SQL editor as the project owner (the highest-privilege administrative session,
   not the app).
2. Re-arm bootstrap for the owner. This is exactly what `cc_bootstrap_reset` does, without Firebase:

   ```sql
   update public.cc_bootstrap_state
      set consumed_at = null, failed_attempts = 0, locked_until = null
    where owner_uid = '<PARALLAX_OWNER_UID>';
   ```

3. Enroll one device through the normal bootstrap page with the bootstrap secret, then PIN.
4. Revoke the old, lost devices from the devices page once, if desired, so their cookies cannot be
   used if they resurface.

Verified on PostgreSQL 17: after all devices were revoked, `cc_bootstrap_consume_and_enroll` kept
returning `false`; after the single SQL re-arm it returned `true` and created exactly one active
device. The bootstrap secret is still required, so this is a deliberate operator re-arm, not a
bypass. If the bootstrap secret is also lost, rotate `CC_BOOTSTRAP_SECRET` in Vercel and redeploy
before enrolling.
