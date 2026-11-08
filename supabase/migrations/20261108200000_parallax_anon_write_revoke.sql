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
-- writes with an app token." No current route or script in this repository
-- references either table (repo-wide grep, 2026-11-08): whatever app-token
-- gate that comment describes does not exist here today, if it ever did.
-- `parallax_odds_cache` last received a write 2026-09-26 (13 rows total);
-- `parallax_bets` has zero rows. That is evidence the write path is stale,
-- not proof: a separate, external Parallax Bet scanner could still write
-- here directly with the public anon key. Confirm that is genuinely retired
-- (check whatever external job/cron runs the scanner) before applying this.
--
-- This migration removes only the INSERT/UPDATE policies. The two anon
-- SELECT policies are left exactly as they are, per instruction: whether
-- odds/bet data should stay anon-readable is a separate founder decision,
-- not a security-cleanup default. RLS stays enabled on both tables either
-- way, unchanged.
--
-- The same earlier migration also left broad DELETE/TRUNCATE/REFERENCES/
-- TRIGGER grants on both tables with no matching policy (already denied by
-- RLS today; see PR #69). This migration does not touch those GRANTs; that
-- proposal is in
-- supabase/migrations/20261108190000_revoke_stale_anon_grants.sql.
--
-- Idempotent: safe to re-run (DROP POLICY IF EXISTS). Preflight aborts
-- loudly instead of silently no-opping if live policy state has drifted
-- from what was captured above, so this never drops the wrong thing.
-- ============================================================================
begin;

-- Preflight: abort if the live policies no longer match exactly what this
-- migration was written against. A drift here means someone already
-- changed these policies since 2026-11-08 and this file needs re-review,
-- not a silent partial run.
do $$
declare found int;
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
  -- Logged so an operator can see at a glance that no row content is lost by this change.
  raise notice 'preflight ok: parallax_odds_cache currently has % row(s), parallax_bets has % row(s)',
    (select count(*) from public.parallax_odds_cache), (select count(*) from public.parallax_bets);
end $$;

drop policy if exists "parallax anon write bets" on public.parallax_bets;
drop policy if exists "parallax anon update bets" on public.parallax_bets;
drop policy if exists "parallax anon write cache" on public.parallax_odds_cache;
drop policy if exists "parallax anon update cache" on public.parallax_odds_cache;

-- Left unchanged, by instruction: "parallax anon read bets" and
-- "parallax anon read cache" (both anon SELECT, qual=true). RLS stays
-- enabled on both tables; service_role is unaffected (BYPASSRLS).

commit;
