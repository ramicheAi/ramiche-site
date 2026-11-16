# SECURITY-CONTAINMENT-01: parallax_bets / parallax_odds_cache anon write access

**Status:** investigation complete, remediation prepared and **empirically verified on a scratch
PostgreSQL 17 cluster**, **nothing applied to production**. Follows up on
`ramicheAi/ramiche-site#69`'s worst finding. No request was sent to any deployed URL; every
Supabase statement used while preparing this was a read-only `SELECT` against system catalogs
and the two tables' own (non-sensitive) content.

**CC-SECURITY-COMPLETION-02 amendment (2026-11-08).** The first version of this PR shipped a test
that could not fail and a migration that claimed a protection it did not have. Both were found by
executing the SQL instead of reading it, and both are corrected below. §3.1 records the evidence;
§3.2 describes the corrected files. Nothing in §§1–2 changed: the exposure itself was real and is
still real in production.

## 1. Effective live permissions, as of 2026-11-08

| Table | `anon` policies | `authenticated` policies | GRANTs beyond policy | RLS |
|---|---|---|---|---|
| `public.parallax_bets` | SELECT (`qual: true`), INSERT (`with_check: true`), UPDATE (`qual: true`, no `with_check`) | none | `authenticated` holds the same table GRANTs as `anon` (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) but has **no policy**, so RLS denies it everything by default | enabled |
| `public.parallax_odds_cache` | same three policies, same shape | none | same | enabled |

Net effect today: any caller holding the public `anon` key can read, insert, and update every row
of both tables, unrestricted. `authenticated` and every other role is denied writes (no policy
covers it). No `DELETE` policy exists for anyone, so `DELETE` matches zero rows for every
non-`service_role` caller despite the broad `DELETE` grant sitting unused.

**`TRUNCATE` is different, and this is the one correction to the paragraph above as originally
written.** RLS does not apply to `TRUNCATE` at all: it is a table privilege, not a row operation.
Supabase's default grants give `anon` and `authenticated` `arwdDxtm` on new tables in `public`,
which includes `TRUNCATE`. On a scratch copy of this exact schema, `set role anon; truncate
public.parallax_bets;` **succeeds** before the migration and still succeeded after the original
version of the migration, because that version only dropped INSERT/UPDATE policies. A caller with
the public anon key could therefore erase both tables, and the original PR's claim that the
leftover grants were "already denied by RLS today" was wrong for this verb. The corrected
migration revokes `TRUNCATE`, `REFERENCES` and `TRIGGER` from `anon` and `authenticated` on both
tables in the same transaction (see §3.2). Proof, reproduced on the scratch cluster:

```
schema (unpatched):  set role anon; truncate public.parallax_bets;  -> TRUNCATE TABLE
after original fix:  set role anon; truncate public.parallax_bets;  -> TRUNCATE TABLE
after corrected fix: set role anon; truncate public.parallax_bets;  -> ERROR 42501 permission denied
```


The sibling `parallax.*` schema (`bets`, `odds_snapshots`, `bankroll`, `alerts`, `scan_runs`) is
**not** part of this exposure: those five tables have only `SELECT` grants for `anon`/
`authenticated` and a single `public` read-only policy each. Read-exposed, not write-exposed.

## 2. Legitimate readers/writers and the production ingestion path

Repo-wide search (2026-11-08) found exactly two files mentioning either table name, and both are
migrations:

- `supabase/migrations/20260710192806_parallax_engine_tables.sql` — created both tables and their
  policies, under the comment: *"Server-side-only access via anon key (keys never ship to the
  client bundle; our API routes gate writes with an app token)."* No route or script matching that
  description exists anywhere in this repository today, if it ever did. (The premise is also
  confused about what a Supabase anon key is: it is the public, client-safe key by design — the
  only thing standing between it and a client is whatever RLS policy exists, and these three
  policies restrict nothing.)
- `supabase/migrations/20260928120000_p05b3_cockpit_anon_lockdown.sql` (prepared 2026-09-28,
  comment says not yet applied as of this writing) — a broader anon-lockdown pass that explicitly,
  by name, lists `parallax.*`, `public.parallax_bets`, and `public.parallax_odds_cache` as
  **deliberately not changed: "(Parallax Bet product; separate decision)."** This is not a new
  discovery: someone already knew about this exposure and chose to defer it, most likely because
  fixing it depends on a system outside this repository. I could not identify what that system is
  from the code here.

**No current application code in `ramiche-site` writes to either table.** Content freshness
supports, but does not prove, that the write path is stale:

- `parallax_odds_cache`: 13 rows, most recent `fetched_at` 2026-09-26 — about six weeks before this
  investigation.
- `parallax_bets`: 0 rows, ever.

This is evidence the anon-write capability has no live legitimate user inside this repo right now,
not proof nothing outside this repo still uses it. **Before applying the remediation below,
confirm whether an external Parallax Bet scanner (a separate job, cron, or service not in this
repository) still writes to these tables with the anon key.** If one exists and still runs, it will
break the moment this migration is applied, and needs to be moved to the service-role key (or
given its own scoped, non-anon credential) first.

One more thing worth noting while this was already checked: the P05-B3 migration file's own
"NOT APPLIED" status line appears to be stale documentation, not current fact — the chat/tenant
tables it targets (`messages`, `channels`, `channel_members`, `agent_profiles`, `tenants`,
`pipeline_metrics`) already have zero policies and zero anon/authenticated grants today, which is
the end state that migration would produce. Either it was already run and the file's header was
never updated, or those tables reached that state some other way. Either way, it is not evidence
of anything currently open on those six tables — only a documentation inaccuracy worth fixing
separately, so a future reader does not wrongly assume they are still exposed, or wrongly assume
`parallax_bets`/`parallax_odds_cache` are in the same already-handled category (they are not).

## 3. Remediation (prepared, verified on a scratch cluster, not applied)

### 3.1 What the first version got wrong (CC-SECURITY-COMPLETION-02 findings)

Everything here was found by running the SQL on a scratch PostgreSQL 17 cluster that mirrors the
live tables, grants and policies. None of it was visible by reading the files.

1. **The post-fix test was vacuous.** Its `do $$` block did `raise exception 'anon could still
   insert'` *inside* the same `begin ... exception when insufficient_privilege or others` block
   that was supposed to detect the denial. The `others` handler caught the test's own failure
   message, so a **successful** anon insert was counted as a denial. Reproduced on the unpatched
   schema: the insert succeeded and the test still passed.
2. **The `parallax_bets` fixture could not reach the RLS check.** Its inserts supplied only
   `ts_ms` and `event_id`, omitting the `NOT NULL` columns `market`, `outcome`, `book`,
   `odds_taken`. The probe died on SQLSTATE `23502` (not-null violation) instead of `42501`
   (RLS), and the `others` handler swallowed that too. The `service_role` fixture aborted the
   whole file at that point, so the file never ran to completion.
3. **`TRUNCATE` was missed entirely** and is still open after the original migration, as shown
   in §1. This is the most serious of the three: it turns a write-exposure into a
   destroy-everything-exposure.
4. **"Idempotent: safe to re-run" was false.** The `DROP POLICY IF EXISTS` statements are
   idempotent; the preflight is not. A second forward run on an already-contained database aborts
   with `found 0`. That is the correct fail-loud behaviour, but the file said the opposite. It now
   says what it does.

### 3.2 The corrected files

Same three paths, same repository convention (matching
`supabase/migrations/20260930000000_execution_events.sql` and its siblings):

- `supabase/migrations/20261108200000_parallax_anon_write_revoke.sql`
  - **Preflight** asserts the live state before changing anything: exactly 4 matching anon
    INSERT/UPDATE policies, RLS enabled on both tables, and it raises (rather than no-ops) on any
    drift. It also logs row counts and the age of the newest write (`NOTICE`), so the operator
    sees the same staleness evidence §2 was written from. A *recent* write does **not** abort the
    migration: a legitimate external writer that had been repointed to the service role would look
    identical, and blocking on it would make the migration un-appliable. The human confirmation in
    §2 remains a precondition, not something the SQL can decide.
  - Drops the four anon INSERT/UPDATE policies.
  - Revokes `TRUNCATE, REFERENCES, TRIGGER` from `anon` and `authenticated` on both tables.
  - **Postflight** aborts the transaction unless: zero anon/authenticated write policies remain,
    the two anon SELECT policies are intact, RLS is still enabled, and `has_table_privilege()`
    confirms `anon`/`authenticated` no longer hold `TRUNCATE` on either table. A partial apply
    cannot commit.
  - The two `anon` SELECT policies are untouched on purpose — see §4.
- `supabase/rollbacks/20261108200000_parallax_anon_write_revoke.rollback.sql` — recreates the four
  dropped policies with the exact `qual`/`with_check` captured, restores the three table
  privileges, and runs its own postflight. It carries an explicit warning that it restores the
  vulnerable state (anonymous INSERT/UPDATE **and** anonymous TRUNCATE) on purpose: a rollback
  that silently kept half the change would be worse. No row data is at risk in either direction.
- `supabase/tests/parallax_anon_write_revoke.test.sql` — plain PostgreSQL, scratch database only.
  - `psql -v pre=1` asserts the vulnerability **exists** (anon INSERT, UPDATE and TRUNCATE all
    succeed). It must pass on the unpatched schema and fail after the migration, which proves the
    test detects the problem.
  - Default mode asserts it is **gone** (INSERT raises `42501` on both tables, UPDATE affects 0
    rows, TRUNCATE raises `42501`, anon SELECT still works, `service_role` unaffected).
  - Every probe goes through `pg_temp.as_anon_try()`, which returns the **actual SQLSTATE** or
    `NULL` on success. The assertion lives outside the exception handler, so the failure mode
    described in §3.1 cannot recur. Fixtures supply every `NOT NULL` column. The whole file runs
    in one transaction that is rolled back.

### 3.3 Verification actually observed (scratch PostgreSQL 17, not Supabase, not production)

Four databases (`scratch70b`, `scratch70c`, `scratch70d`, plus the initial `scratch70` used for the
findings above), each built with the same role model and the `20260710192806` schema. Observed:

1. **Vulnerable schema, `-v pre=1`** → `pre-fix: anon can INSERT, UPDATE and TRUNCATE both tables`
   and `service_role: unaffected`. Passes, as designed.
2. **Apply the forward migration** → `preflight ok: … row(s) … newest write …`, four `DROP POLICY`,
   `postflight ok: 0 anon/authenticated write policies, 2 anon SELECT policies intact, RLS on,
   TRUNCATE revoked`, `COMMIT`.
3. **Fixed schema, default mode** → `post-fix: anon INSERT/UPDATE/TRUNCATE denied on both tables,
   anon SELECT intact`, `service_role: unaffected`. Passes.
4. **`-v pre=1` again on the fixed schema** → correctly FAILS with
   `expected anon INSERT into parallax_odds_cache to succeed, got SQLSTATE 42501`. The pre-mode is
   a genuine detector, not a tautology.
5. **Rollback** → `COMMIT`; four policies restored, `has_table_privilege('anon', …, 'TRUNCATE')`
   back to `t`.
6. **Forward again after rollback** → applies cleanly, postflight passes. Rollback is a true
   inverse.
7. **Second forward run on an already-fixed database** → correctly aborts with
   `found 0. Re-review before proceeding.`
8. **Drift guard**: rollback, then drop one of the four policies by hand, then run forward → aborts
   with `found 3. Re-review before proceeding.` It refuses to act on a state it was not written
   for.

**Remaining steps, for whoever applies this against the real `command-center-hq` project**
(none of this has been done against it):

1. Export or note the current 13 `parallax_odds_cache` rows (trivial; nothing here deletes data,
   but cheap insurance before any schema change).
2. Confirm the external-scanner question in §2. This is the one gate the SQL cannot check.
3. Apply the migration (`supabase db push`, reviewed manually — this repository's own CI never
   applies a migration automatically; see `.github/workflows/supabase-ci.yml`, `db` only runs
   `--dry-run` and only on manual dispatch).
4. Re-run the read-only queries from §1 against the live project and confirm exactly the four
   named policies are gone, the two SELECT policies remain, and
   `has_table_privilege('anon', 'public.parallax_bets', 'TRUNCATE')` is now `false`.
5. If anything downstream breaks, apply the rollback file immediately; it is an exact inverse,
   proven above.


## 4. Least-privilege review and production-readiness verdict

**What this migration changes, privilege by privilege (`anon` and `authenticated`):**

| Privilege | Before | After | Why |
|---|---|---|---|
| `SELECT` | granted; anon has a `true` policy | **unchanged** | Open product decision, not a security-cleanup default (§5) |
| `INSERT` | granted; anon policy `with_check true` | policy dropped → RLS denies with `42501` | No client in this repo writes these tables |
| `UPDATE` | granted; anon policy `using true` | policy dropped → matches 0 rows | same |
| `DELETE` | granted; no policy existed | **unchanged** (still inert: 0 rows match) | Already denied by RLS; the grant is dead weight handled by PR #69's broader grant proposal |
| `TRUNCATE` | granted, and RLS cannot see it | **revoked** | The actual destructive hole (§1, §3.1) |
| `REFERENCES`, `TRIGGER` | granted | **revoked** | No legitimate client need; least privilege |
| `service_role` | `BYPASSRLS` + full grants | **unchanged** | Server-side writers keep working |

`SELECT` is intentionally left alone because revoking it is a product decision (does anything
public display odds?), not a containment default. `DELETE`'s grant is left for the broader
`revoke_stale_anon_grants` proposal on PR #69's branch, so the two PRs do not fight over the same
`GRANT` statement; the observable behaviour (`DELETE` matches nothing) is identical either way.

**Production readiness:**

- Migration is transactional and self-checking (preflight + postflight); a partial apply cannot
  commit.
- Rollback is an exact inverse and was proven to restore the vulnerable state, including
  `TRUNCATE`; it carries an explicit "this restores the vulnerability" warning.
- Test file is a real detector: it fails on the fixed schema in pre-mode and fails on the
  vulnerable schema in post-mode. Both directions were observed (§3.3).
- **Single open blocker:** the external Parallax Bet scanner question in §2. It cannot be answered
  from this repository (zero non-migration references to either table) and a wrong answer breaks a
  job outside this repo. Recommend confirming it is retired or repointed to `service_role` before
  apply.
- **Not a blocker but worth stating:** `main`'s `security` CI job is red on pre-existing
  `npm audit` findings (62 vulnerabilities, identical on `main` `25f1f51`). This PR does not touch
  dependencies and does not change that check's status. It is PR #62 territory.

**Verdict:** ready to merge as a reviewed, prepared change. **Not ready to apply to production**
until the external-scanner confirmation lands.

## 5. Open founder decision

This migration removes **write**, not **read**. Two things still need your call, named rather than
assumed:

- Is public anon read of `parallax_bets`/`parallax_odds_cache` (and the read-only `parallax.*`
  schema) intentional — e.g., a public odds display — or should it also be revoked?
- Is the external Parallax Bet scanner (if one still exists) ready to move off the anon key before
  this is applied?

## 6. Scope note

This PR is deliberately limited to this one finding, per instruction not to combine unrelated
security and organizational changes. Companion: `ramicheAi/ramiche-site#71` (founder authority).
This PR intentionally does **not** touch the nine `command-center` API routes or
`src/lib/server/founder-authority.ts`; neither PR depends on the other to be correct, but #71
depends on this one only for a clean security baseline, not for a code change.
Earlier context: `ramicheAi/ramiche-os#56`, `ramicheAi/ramiche-site#68`,
`ramicheAi/ramiche-site#69`. Independent of Clockwork (`ramiche-os` PR #49/#52); no file with
"clockwork" in its path is touched.
