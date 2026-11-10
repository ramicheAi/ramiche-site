# CC-SECURITY-COMPLETION-02: production-readiness report

Date: 2026-11-08. Scope: PR #70 (database containment) and PR #71 (founder authorization) in
`ramicheAi/ramiche-site`, plus the registry records in `ramicheAi/ramiche-os`.

**Bottom line: both PRs are ready to merge as drafts-turned-reviewable. NEITHER is ready for
production activation.** #70 needs one external confirmation before its SQL is applied. #71 is
safe to merge because it is inert by default, but enforcement must be rolled out per route and
must not be set to `all` until 37 unwired routes are classified. No merge, deployment, migration
or live access change was performed by this mission.

Base for both: `main` @ `25f1f517`. Neither branch changes a dependency, so neither can move the
pre-existing red `security` CI job.

## 1. PR #70 — parallax_bets / parallax_odds_cache containment

Head before this mission: `053982f4`. Files: 4 (migration, rollback, SQL test, design doc).

### What was found by executing the SQL (not reading it)

1. The original post-fix test **could not fail**: it raised its own failure message inside the
   same `exception when ... others` block that was meant to catch the denial, so a successful anon
   insert was recorded as "denied". Reproduced on an unpatched scratch database.
2. The `parallax_bets` fixtures omitted `NOT NULL` columns and died on SQLSTATE `23502` (not-null),
   not `42501` (RLS); the `service_role` fixture then aborted the file. Reproduced.
3. `TRUNCATE` was never addressed. RLS does not apply to `TRUNCATE`; Supabase's default grants
   give `anon` `TRUNCATE`. `set role anon; truncate public.parallax_bets;` **succeeded** before and
   after the original migration. This was a live destroy-the-table hole, not a theoretical one.
4. "Idempotent: safe to re-run" was false; the preflight makes a second run abort (`found 0`).

### What the branch now contains

- Forward migration with preflight (exact 4 policies, RLS on, row counts, newest-write age),
  policy drops, `REVOKE TRUNCATE, REFERENCES, TRIGGER` from `anon`/`authenticated`, and postflight
  assertions. A partial apply cannot commit.
- Rollback that restores the four policies **and** the three privileges, with its own postflight
  and an explicit warning that it restores the vulnerable state.
- Test file rewritten: `pg_temp.as_anon_try()` returns the real SQLSTATE, assertions live outside
  the handler, fixtures supply every `NOT NULL` column, `-v pre=1` asserts the vulnerability
  exists, default mode asserts it is gone, whole file rolls back.
- Doc amended with the three findings, the least-privilege table, and the eight observed
  scratch-database runs (§3.1–3.3 of that doc).

### Evidence (scratch PostgreSQL 17, four databases, not Supabase)

| Run | Result |
|---|---|
| vulnerable schema, `-v pre=1` | passed: anon INSERT/UPDATE/TRUNCATE all succeed |
| apply forward | preflight/postflight notices, `COMMIT` |
| fixed schema, default | passed: INSERT/TRUNCATE `42501`, UPDATE 0 rows, SELECT intact, service_role unaffected |
| `-v pre=1` on fixed schema | correctly FAILED (`got SQLSTATE 42501`) — the test is a real detector |
| rollback | `COMMIT`, 4 policies and anon TRUNCATE restored |
| forward again after rollback | applied cleanly |
| second forward run on fixed DB | correctly aborted (`found 0`) |
| drift (3 of 4 policies) | correctly aborted (`found 3`) |

App test suite in this worktree: 53 files, 524 passed, 4 skipped (same as `main`; SQL files are
not part of vitest).

### Blocker before production apply

**One, not resolvable from this repository:** confirm the external Parallax Bet scanner (a job
outside `ramiche-site`) is retired or repointed off the anon key. Repo-wide, there are zero
non-migration references to either table. `parallax_odds_cache` was last written 2026-09-26
(13 rows); `parallax_bets` has 0 rows. That is evidence the path is stale, not proof it is gone.
Applying without this confirmation can break a job this repo cannot see.

### Recommendation

**Merge: yes** as a reviewed, prepared change (it is still a draft; mark ready when the founder
wants it reviewed). **Apply to production: not yet** — wait for the scanner confirmation, then
follow the five-step runbook in the doc. **Do not** enable or run anything automatically.

## 2. PR #71 — founder authorization

Head before this mission: `e9c73f11`. Originally 7 files, +631/-4, opt-in guard on one route.
Now 23 paths changed (+2049/-17), and eight privileged routes are wired.

### Requirements coverage

| Requirement | Implementation | Evidence |
|---|---|---|
| Server-side founder authorization | HMAC-signed `cc_founder_session` cookie (`ccf2.<iat>.<exp>.<mac>`); only the cookie is consulted | `founder-authority.test.ts`; body/header/sessionStorage identity ignored |
| PIN brute-force protection + rate limiting | per-client 5/15m with doubling lockouts to 2h, plus global 50/10m breaker, `Retry-After`, check before compare | `pin-rate-limit.test.ts`, pin route 429 tests |
| Origin/CSRF for cookie mutations | Origin→Referer vs proxy Host; missing = reject; 403 | `founder-authority.test.ts`, eight-route matrix |
| Safe expiry, revocation, rotation | 8h absolute TTL, clock-skew rules, `CC_FOUNDER_REVOKE_BEFORE` cut-off, secret rotation | revocation tests (epoch/ISO/invalid) |
| Unauthorized requests cannot cause side effects | guard is the first statement; side-effect modules spied and asserted zero calls | `guard-wiring.test.ts` |
| Browser recovery | `auth/state` endpoint; layout checks on mount/focus/visibility, clears sessionStorage, shows specific notice; **does not clear when the guard is off or the secret is missing** (that would loop) | `session-recovery.ts` + tests, `layout.tsx`, state route tests |
| Missing/invalid/expired/forged tests | all four, per route and unit-level | 58 files / 624 passed / 4 skipped |
| Machine-to-machine preserved | `COMMAND_CENTER_MACHINE_SECRET` bearer, constant time, only on `CC_MACHINE_ROUTES` (default empty) | machine cases in unit + wiring tests |

### Evidence

- `vitest run`: **60 files, 635 passed, 4 skipped** (baseline 53 / 524 / 4 → **+111 tests**).
- `tsc --noEmit`: clean.
- `eslint`: 0 errors, 6 pre-existing warnings (unused vars and two `setState`-in-effect warnings in
  files this PR already owned).
- The guard is off by default; a merge changes no route's access control.

### Bug caught during this review

The first version of the browser recovery treated every 401 from `auth/state` as session loss. In
today's default state (guard off, no signing secret) that would clear `sessionStorage`, show the
PIN gate, and loop forever, because the PIN route cannot mint a cookie without a secret. Fixed by
`decideSessionRecovery()`, which recovers only when the guard is on, the secret is configured, and
the session is genuinely missing/expired/revoked. Six cases are pinned by tests.

### Blocker before enabling enforcement globally

**37 of 45 privileged `POST` routes under `/api/command-center` are not wired.** Setting
`CC_FOUNDER_GUARD_ENFORCE=all` would protect 8 and leave 37 untouched. They split into machine
routes that keep shared secrets (webhooks, crons, push, ws, jobs) and browser-facing routes still
unguarded (chat family, pipeline family, prospector, leads intel/kit, image-gen, briefing, oracle,
firestore-sync, security, roadmap, wellness, tasks/notify, bambu, voice family). Full list in
`docs/CC-FOUNDER-AUTHORITY-GUARD-01.md` §6.

Second, smaller gap: the rate limiter is per instance, so the true cross-instance ceiling is
`instances × 5`. Documented, not hidden. A shared store is the follow-up.

### Recommendation

**Merge: yes** (inert by default; useful to have the mechanism and tests on `main`).
**Enable: staged, founder-driven** — set the secret, re-enter the PIN, then
`CC_FOUNDER_GUARD_ENFORCE=gate`, verify browser flows, widen one key at a time. **Do not set
`all`** until the 37 routes are wired. No deployment or env change was made here.

## 3. Cross-cutting status

- `main`'s `security` CI job is red on `npm audit` (62 vulnerabilities). Identical on `main`
  `25f1f51`; neither PR touches dependencies. This is PR #62 territory and should not block #70 or
  #71.
- PR #69's `supabase/migrations/20261108190000_revoke_stale_anon_grants.sql` exists only on its
  own branch and covers `SELECT`-adjacent grant cleanup for a different table set. #70
  deliberately does not duplicate it: #70 handles the policies, `TRUNCATE` on its two tables, and
  leaves broader `DELETE`/`GRANT` cleanup to #69.
- No file with "clockwork" in its path was touched by either branch.

## 4. Merge and deployment order

1. Review and merge **#70** (no runtime effect; SQL is a file).
2. Merge **#71** (no runtime effect; guard off).
3. Founder confirms the external scanner is gone/repointed → apply #70's migration through the
   reviewed manual path → run the post-migration read-only checks → keep the rollback ready.
4. Set `COMMAND_CENTER_SESSION_SECRET` in Vercel → redeploy → re-enter PIN.
5. Enable `CC_FOUNDER_GUARD_ENFORCE` one route at a time, starting `gate`, then `voice-call`,
   `leads-send`, `settings`, `agents`, `yolo-approve`, `chat-approve`, `chat-approve-stream`.
6. Only after the remaining 37 routes are classified and wired, consider `all`.

Nothing in steps 1–2 requires a deployment; nothing in steps 3–6 was performed.
