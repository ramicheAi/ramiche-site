# SECURITY-CONTAINMENT-01: parallax_bets / parallax_odds_cache anon write access

**Status:** investigation complete, remediation prepared, **nothing applied**. Follows up on
`ramicheAi/ramiche-site#69`'s worst finding. No request was sent to any deployed URL; every
Supabase statement used while preparing this was a read-only `SELECT` against system catalogs
and the two tables' own (non-sensitive) content.

## 1. Effective live permissions, as of 2026-11-08

| Table | `anon` policies | `authenticated` policies | GRANTs beyond policy | RLS |
|---|---|---|---|---|
| `public.parallax_bets` | SELECT (`qual: true`), INSERT (`with_check: true`), UPDATE (`qual: true`, no `with_check`) | none | `authenticated` holds the same table GRANTs as `anon` (SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER) but has **no policy**, so RLS denies it everything by default | enabled |
| `public.parallax_odds_cache` | same three policies, same shape | none | same | enabled |

Net effect today: any caller holding the public `anon` key can read, insert, and update every row
of both tables, unrestricted. `authenticated` and every other role is denied (no policy covers
it). No `DELETE` policy exists for anyone, so delete is denied for all non-service roles despite
the broad `DELETE` grant sitting unused.

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

## 3. Remediation (prepared, not applied)

Three new files, following this repository's existing migration/rollback/test convention exactly
(matching `supabase/migrations/20260930000000_execution_events.sql` and its siblings):

- `supabase/migrations/20261108200000_parallax_anon_write_revoke.sql` — drops only the four
  `anon` INSERT/UPDATE policies (two per table). A preflight `do $$ ... $$` block counts the exact
  policies it expects and raises an exception instead of running if the live state has drifted,
  so this can never silently drop the wrong thing or no-op. The two `anon` SELECT policies are
  left untouched on purpose — see §4.
- `supabase/rollbacks/20261108200000_parallax_anon_write_revoke.rollback.sql` — recreates the four
  dropped policies with the exact `qual`/`with_check` captured above. No row data is at risk
  either direction; this migration never deletes rows, only policies.
- `supabase/tests/parallax_anon_write_revoke.test.sql` — plain PostgreSQL, meant for a **scratch
  database**, never production (same convention and warning as the existing
  `execution_events.test.sql`). Run once before applying the migration (the first block
  reproduces the finding: anon insert currently succeeds) and once after (asserts anon
  insert/update now fail with `insufficient_privilege` on both tables, anon select still works,
  and `service_role` is unaffected).

**This was actually executed, not just written and assumed correct** — against a disposable local
PostgreSQL 17 cluster (not Supabase, not production; built with `initdb`/`pg_ctl` in a scratch
directory, torn down afterward), with a schema mirroring the live tables' structure, grants, and
exact policies. Full cycle run and observed:

1. Pre-fix: the probe in the test file reproduced the finding (`anon insert succeeded = t`); the
   post-fix assertions correctly *failed* (`anon could still update parallax_odds_cache`) — proof
   the test genuinely detects the problem rather than trivially passing.
2. Migration applied cleanly: preflight found exactly the 4 expected policies, dropped them,
   committed.
3. Post-fix: the same test file passed completely — insert now rejected with a row-level-security
   error on both tables; update now silently affects 0 rows on both tables (confirmed by reading
   the target row back unchanged, not by expecting an exception — see the note in the test file:
   Postgres's RLS denies INSERT by raising, but denies UPDATE/DELETE by silently matching zero
   rows, which only showed up by actually running this, not by reasoning about it); select
   unaffected; `service_role` unaffected.
4. Rollback applied cleanly, recreating the four policies.
5. Post-rollback: the probe reproduced the original vulnerable state again (`anon insert
   succeeded = t`) — proof the rollback is a true, exact inverse.

**Remaining steps, for whoever applies this against the real `command-center-hq` project**
(none of this has been done against it):

1. Export or note the current 13 `parallax_odds_cache` rows (trivial; nothing here deletes data,
   but cheap insurance before any schema change).
2. Confirm the external-scanner question in §2.
3. Apply the migration (`supabase db push`, reviewed manually — this repository's own CI never
   applies a migration automatically; see `.github/workflows/supabase-ci.yml`, `db` only runs
   `--dry-run` and only on manual dispatch).
4. Re-run the read-only queries from §1 against the live project and confirm exactly the four
   named policies are gone and the two SELECT policies remain.
5. If anything downstream breaks, apply the rollback file immediately; it is an exact inverse,
   proven above.

## 4. Open founder decision

This migration removes **write**, not **read**. Two things still need your call, named rather than
assumed:

- Is public anon read of `parallax_bets`/`parallax_odds_cache` (and the read-only `parallax.*`
  schema) intentional — e.g., a public odds display — or should it also be revoked?
- Is the external Parallax Bet scanner (if one still exists) ready to move off the anon key before
  this is applied?

## 5. Scope note

This PR is deliberately limited to this one finding, per instruction not to combine unrelated
security and organizational changes. The founder-authority server-side guard (gate/pin/outreach
routes) is scoped in a separate PR. Companions: `ramicheAi/ramiche-os#56`,
`ramicheAi/ramiche-site#68`, `ramicheAi/ramiche-site#69`. Independent of Clockwork
(`ramiche-os` PR #49/#52); no file with "clockwork" in its path is touched.
