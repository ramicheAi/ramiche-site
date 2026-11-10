# CC-SECURITY-REMEDIATION-05: ParallaxBet database containment, part 2

**Status:** prepared, **nothing applied to production, no SQL executed against any
database** (per the mission's hard restrictions). Companion to PR #70
(`supabase/migrations/20261108200000_parallax_anon_write_revoke.sql`), which is
preserved exactly as written and is not modified or applied by anything here.

## 0. What PR #70 does, and the one thing it deliberately leaves open

PR #70 revokes `anon`'s INSERT/UPDATE policies and TRUNCATE/REFERENCES/TRIGGER grants on
`parallax_bets` and `parallax_odds_cache`. Its own preflight logs the age of the newest
write to each table but does not abort on a recent one — by deliberate choice, documented
in its own comment, because a legitimate repointing of the write path would look
identical to an active writer and blocking on that would make the migration
un-appliable in the one case it actually needs to run.

That leaves two gaps the present mission names explicitly:

1. **No replacement credential exists yet.** If PR #70 is applied today, whatever has
   been writing with the anon key (the mission says this is the deployed
   `parallaxbet-engine` application) loses its only write path, with nothing to switch
   to.
2. **No hard block on cutting off something writing right now.** PR #70's own preflight
   only logs; it does not refuse to run just because a write happened moments ago.

This work closes both gaps without touching PR #70's file.

## 1. New files

| File | Purpose |
|---|---|
| `supabase/migrations/20261109130000_parallax_least_privilege_writer.sql` | Creates the `parallax_bet_engine` role, scoped to `SELECT`/`INSERT`/`UPDATE` on exactly these two tables. Purely additive — revokes nothing, so it is safe to apply at any time without affecting the current anon-key path. |
| `supabase/rollbacks/20261109130000_parallax_least_privilege_writer.rollback.sql` | Drops the role and everything granted to it. Exact undo of the migration above. |
| `supabase/tests/parallax_least_privilege_writer.test.sql` | Pre/post SQL test, same pattern as PR #70's own test file. Pre-fix: role doesn't exist, anon write access is untouched. Post-fix: the new role can select/insert/update both tables, cannot delete/truncate either, and — the property that makes this migration safe on its own — anon's original access is still completely unchanged. |
| `supabase/checks/parallax-active-writer-check.sql` | The blocking precondition the mission asked for. Hard-**aborts** (not just logs) if either table was written to in the last 10 minutes. Meant to be run immediately before PR #70's migration, not before this one (this one is non-disruptive and needs no such gate). |

## 2. Why a new role instead of service_role, and why it still isn't enough on its own

The instruction was explicit: do not expose service-role credentials anywhere
client-reachable. `service_role` bypasses RLS on the entire project, not just these two
tables — handing it to an external application would trade "anon key, overly public" for
"god-mode key, overly powerful." `parallax_bet_engine` can touch exactly
`parallax_bets`/`parallax_odds_cache`, exactly `SELECT`/`INSERT`/`UPDATE`, nothing else —
no `DELETE`, no `TRUNCATE`, no DDL, no other table, no membership in
`anon`/`authenticated`/`service_role`. A leak of this credential has a small, specific
blast radius.

**What this repository cannot do:** change `parallaxbet-engine`'s own source or deployed
configuration. That application lives outside this repo (repo-wide search here finds
zero application code referencing either table — only the two migration files). The new
migration's own header documents the two ways that application could actually use this
role (a direct Postgres connection string with its own password set out of band, or
PostgREST JWT role-switching with a JWT signed outside this repo) but cannot choose or
configure either for it. **This is the limit of what can be verified or completed from
inside this codebase**, consistent with "verify, don't assert" — stated as a boundary,
not glossed over.

## 3. The sequencing that actually closes the exposure

1. Apply `20261109130000_parallax_least_privilege_writer.sql` (non-disruptive, safe
   anytime).
2. Reconfigure `parallaxbet-engine` to write through `parallax_bet_engine` instead of the
   anon key. Verify end to end. (External action, outside this repo.)
3. Run `supabase/checks/parallax-active-writer-check.sql`. If it aborts, something is
   still writing — do not proceed; either it hasn't switched over yet, or confirm
   out-of-band that the recent write already came from the new role.
4. Only once step 3 passes, apply PR #70's `20261108200000_parallax_anon_write_revoke.sql`
   exactly as already written and verified.

Skipping step 1–3 and applying PR #70 alone still closes the RLS/TRUNCATE exposure (that
migration's own verification already establishes that) but does so by silently cutting
off whatever is writing today, with nothing to replace it — the disruption the present
mission asked to prevent.

## 4. Verification performed

- Read, not executed: every statement above was checked by hand against PostgreSQL's
  grant/RLS semantics (role-specific policies, `SET ROLE` requiring either superuser or
  membership, `DROP ROLE` requiring no remaining grants) and against the exact schema
  created by `20260710192806_parallax_engine_tables.sql`.
- No SQL was run against any database, scratch or production, per the mission's hard
  restriction on SQL migration execution. The test and check files are written to the
  same runnable convention as PR #70's (`psql -v ON_ERROR_STOP=1 ...`) so a human with
  database access can execute them exactly as documented in each file's own header.
- No live HTTP request was sent to any deployed URL or external system while preparing
  this.

## 5. Explicitly out of scope here

- Actually reconfiguring `parallaxbet-engine` (outside this repo).
- Setting `parallax_bet_engine`'s password or minting any JWT (would be a credential
  action, gated separately).
- Applying PR #70, the new migration, or the rollback to any real database.
- Whether `parallax_bets`/`parallax_odds_cache` should stay anon-**readable** — PR #70
  left that as a separate founder decision and this file does not revisit it.
