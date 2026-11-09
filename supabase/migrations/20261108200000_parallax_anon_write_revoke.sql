-- ============================================================================
-- SECURITY-CONTAINMENT-01: remove anonymous write access to parallax_bets and
-- parallax_odds_cache. PREPARED, NOT APPLIED. Requires separate Ramon
-- approval before running. Companion files:
--   supabase/rollbacks/20261108200000_parallax_anon_write_revoke.rollback.sql
--   supabase/tests/parallax_anon_write_revoke.test.sql
-- Run the test against a scratch database first, per the existing
-- convention in supabase/tests/execution_events.test.sql -- never against
-- the production project.
--
-- Finding (ramicheAi/ramiche-site PR #69, re-verified directly against
-- command-center-hq, 2026-11-08): both tables carry three `anon` policies
-- each (select/insert/update, qual and with_check both `true`), created by
-- supabase/migrations/20260710192806_parallax_engine_tables.sql under the
-- comment "Server-side-only access via anon key ... our API routes gate
-- writes with an app token". No current route or script in this repository
-- references either table (repo-wide grep, 2026-11-08: zero non-migration
-- matches): whatever app-token gate that comment describes does not exist
-- here today, if it ever did.
--
-- EXTERNAL SCANNER DEPENDENCY (CC-SECURITY-COMPLETION-02): the one thing this
-- repository cannot answer is whether some job outside it still writes here
-- with the public anon key. `parallax_odds_cache` last received a write
-- 2026-09-26 (13 rows); `parallax_bets` has zero rows. That is evidence the
-- write path is stale, not proof it is retired. Confirm the external scanner
-- job is gone, or repoint it at the service role, BEFORE applying this. The
-- preflight below logs row counts and the age of the newest write so the
-- operator sees the same evidence this file was written against; it does not
-- abort on a recent write, because a legitimate repointing would look
-- identical and blocking on it would make the migration un-appliable.
--
-- This migration removes only the INSERT/UPDATE policies. The two anon
-- SELECT policies are left exactly as they are, per instruction: whether
-- odds/bet data should stay anon-readable is a separate founder decision,
-- not a security-cleanup default. RLS stays enabled on both tables either
-- way, unchanged.
--
-- TRUNCATE (found by CC-SECURITY-COMPLETION-02, empirically, not by reading):
-- Supabase's default table grants give anon/authenticated ALL privileges,
-- including TRUNCATE. **RLS does not apply to TRUNCATE in PostgreSQL.** On a
-- scratch copy of this exact schema, `set role anon; truncate
-- public.parallax_bets;` SUCCEEDS before AND after dropping the write
-- policies. The earlier claim in this file that the leftover grants were
-- "already denied by RLS today" was therefore wrong for TRUNCATE, and an
-- anon holder of the public key could erase both tables. This migration
-- revokes TRUNCATE, REFERENCES and TRIGGER from anon and authenticated on
-- these two tables as part of the same containment. service_role and the
-- table owner keep them, so a legitimate server-side writer is unaffected.
-- DELETE is already inert (RLS, zero matching policy) and is left to the
-- broader grants proposal in PR #69 (supabase/migrations/
-- 20261108190000_revoke_stale_anon_grants.sql, on branch
-- security/cc-org-authz-assessment-01).
--
-- Not re-runnable, on purpose. The DROP/REVOKE statements themselves are
-- idempotent, but the preflight is not: a second run on an already-contained
-- database finds 0 matching policies and aborts with "found 0". That is the
-- correct behavior for a containment migration (it fails loudly instead of
-- pretending to do work), and it was verified on a scratch database, so this
-- file does not claim "safe to re-run" when it is not. To re-apply after a
-- rollback, run the rollback first, which restores the captured state.
-- Preflight aborts loudly instead of silently no-opping if live policy state
-- has drifted from what was captured above (verified: 3 of 4 policies present
-- aborts with "found 3"), so this never drops the wrong thing. Postflight
-- asserts the result, so a partial apply cannot commit.
-- ============================================================================
begin;

-- Preflight: abort if the live policies no longer match exactly what this
-- migration was written against. A drift here means someone already
-- changed these policies since 2026-11-08 and this file needs re-review,
-- not a silent partial run.
do $$
declare found int; cache_rows bigint; bets_rows bigint; newest timestamptz;
begin
  select count(*) into found from pg_policies
    where schemaname = 'public'
      and tablename in ('parallax_bets', 'parallax_odds_cache')
      and policyname in (
        'parallax anon write bets', 'parallax anon update bets',
        'parallax anon write cache', 'parallax anon update cache'
      )
      and roles = '{anon}'
      and ((cmd = 'INSERT' and with_check = 'true') or (cmd = 'UPDATE' and qual = 'true'));
  if found <> 4 then
    raise exception 'preflight failed: expected exactly 4 matching anon write/update policies on parallax_bets/parallax_odds_cache, found %. Re-review before proceeding.', found;
  end if;

  -- RLS must already be on. If it is not, this migration is not the fix.
  if not (select bool_and(relrowsecurity) from pg_class
          where oid in ('public.parallax_bets'::regclass, 'public.parallax_odds_cache'::regclass)) then
    raise exception 'preflight failed: RLS is not enabled on both tables; re-review before proceeding.';
  end if;

  select count(*) into cache_rows from public.parallax_odds_cache;
  select count(*) into bets_rows from public.parallax_bets;
  select greatest(
    coalesce((select max(fetched_at) from public.parallax_odds_cache), 'epoch'::timestamptz),
    coalesce((select max(created_at) from public.parallax_bets), 'epoch'::timestamptz)
  ) into newest;
  raise notice 'preflight ok: parallax_odds_cache has % row(s), parallax_bets has % row(s), newest write % (age %)',
    cache_rows, bets_rows, newest, (now() - newest);
end $$;

drop policy if exists "parallax anon write bets" on public.parallax_bets;
drop policy if exists "parallax anon update bets" on public.parallax_bets;
drop policy if exists "parallax anon write cache" on public.parallax_odds_cache;
drop policy if exists "parallax anon update cache" on public.parallax_odds_cache;

-- Least privilege on the destructive verb RLS cannot see.
revoke truncate, references, trigger on public.parallax_bets from anon, authenticated;
revoke truncate, references, trigger on public.parallax_odds_cache from anon, authenticated;

-- Postflight: the transaction commits only if the containment is actually complete.
do $$
declare remaining int; read_policies int;
begin
  select count(*) into remaining from pg_policies
    where schemaname = 'public'
      and tablename in ('parallax_bets', 'parallax_odds_cache')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and roles::text[] && array['anon', 'authenticated'];
  if remaining <> 0 then
    raise exception 'postflight failed: % anon/authenticated write policy/policies still present', remaining;
  end if;

  select count(*) into read_policies from pg_policies
    where schemaname = 'public'
      and tablename in ('parallax_bets', 'parallax_odds_cache')
      and cmd = 'SELECT'
      and roles = '{anon}';
  if read_policies <> 2 then
    raise exception 'postflight failed: expected the 2 anon SELECT policies to remain, found %', read_policies;
  end if;

  if not (select bool_and(relrowsecurity) from pg_class
          where oid in ('public.parallax_bets'::regclass, 'public.parallax_odds_cache'::regclass)) then
    raise exception 'postflight failed: RLS was disabled by this migration';
  end if;

  if has_table_privilege('anon', 'public.parallax_bets', 'TRUNCATE')
     or has_table_privilege('anon', 'public.parallax_odds_cache', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.parallax_bets', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.parallax_odds_cache', 'TRUNCATE') then
    raise exception 'postflight failed: TRUNCATE is still granted to anon/authenticated (RLS does not apply to TRUNCATE)';
  end if;

  raise notice 'postflight ok: 0 anon/authenticated write policies, 2 anon SELECT policies intact, RLS on, TRUNCATE revoked';
end $$;

-- Left unchanged, by instruction: "parallax anon read bets" and
-- "parallax anon read cache" (both anon SELECT, qual=true). RLS stays
-- enabled on both tables; service_role is unaffected (BYPASSRLS).

commit;
