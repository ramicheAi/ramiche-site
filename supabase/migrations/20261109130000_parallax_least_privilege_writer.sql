-- ============================================================================
-- CC-SECURITY-REMEDIATION-05 "Database containment": least-privilege writer
-- role for the ParallaxBet engine, to replace its reliance on the shared
-- anon key. Companion to, and separate from, PR #70's
-- supabase/migrations/20261108200000_parallax_anon_write_revoke.sql, which
-- is preserved exactly as written and is NOT changed by this file.
--
-- PREPARED, NOT APPLIED. Requires separate Ramon approval.
--
-- SEQUENCING, read before applying either migration:
--   1. Apply THIS migration. It is purely additive -- it creates a role and
--      grants privileges; it revokes nothing and drops nothing. The current
--      anon-key write path keeps working exactly as today. Safe to apply at
--      any time on its own.
--   2. Reconfigure the parallaxbet-engine application (outside this repo;
--      this migration cannot see or change that application's source or
--      deployment) to write using the `parallax_bet_engine` role created
--      below instead of the anon key. Verify it is actually working end to
--      end against the new role before step 3.
--   3. Run supabase/checks/parallax-active-writer-check.sql (hard-aborts if
--      either table was written to in the last 10 minutes, i.e. something
--      may still be using the anon path right now) immediately before
--      applying PR #70's revoke migration. Only once that check passes AND
--      step 2 is confirmed does cutting off anon's write access stop being
--      a silent disruption.
--
-- WHY A NEW ROLE INSTEAD OF HANDING OUT service_role: service_role bypasses
-- RLS on every table in the project, not just these two -- using it here
-- would trade "anon key, overly public" for "god-mode key, overly powerful,"
-- and the instruction was explicit: do not expose service-role credentials
-- anywhere client-reachable. This role can SELECT/INSERT/UPDATE exactly
-- parallax_bets and parallax_odds_cache and nothing else in the database --
-- no DELETE, no TRUNCATE, no DDL, no other table, no membership in
-- anon/authenticated/service_role. A leak of this credential has a small,
-- specific blast radius; a leak of service_role does not.
--
-- HOW parallaxbet-engine ACTUALLY USES THIS ROLE (pick one; this migration
-- supports both, but can't choose or configure either for you):
--   (a) Direct Postgres connection string authenticating as this role.
--       Set its password OUT OF BAND, directly against the Supabase
--       project (e.g. `ALTER ROLE parallax_bet_engine PASSWORD '...'` run
--       by hand, or via the Supabase dashboard) -- never commit a password
--       for this role to this repo or any env file here.
--   (b) PostgREST JWT role-switching: mint a JWT whose `role` claim is
--       `parallax_bet_engine`, signed with the project's JWT secret (never
--       the anon or service_role key). This migration grants the role to
--       `authenticator` (Supabase's PostgREST connection-pool role) so that
--       switch is possible; it does not mint or store any JWT.
-- Either way, this credential must never reach a browser bundle or any
-- client-reachable config, same as the restriction already in force for
-- service_role.
--
-- Idempotent: every statement below is safe to re-run.
-- ============================================================================
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'parallax_bet_engine') then
    create role parallax_bet_engine with login nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

grant usage on schema public to parallax_bet_engine;
grant select, insert, update on public.parallax_bets to parallax_bet_engine;
grant select, insert, update on public.parallax_odds_cache to parallax_bet_engine;

-- Listed explicitly so a future reviewer doesn't have to infer the absence: this role
-- never gets delete, truncate, references or trigger on either table, any privilege on
-- any other table, or membership in anon/authenticated/service_role.
revoke delete, truncate, references, trigger on public.parallax_bets from parallax_bet_engine;
revoke delete, truncate, references, trigger on public.parallax_odds_cache from parallax_bet_engine;

-- RLS policies are role-specific: the existing anon-scoped policies (from
-- 20260710192806_parallax_engine_tables.sql, and whatever PR #70 leaves of them) do not
-- apply to this role. Mirror exactly the table grants above as policies -- belt and
-- suspenders with the grants, not a substitute: both must pass for an operation to
-- succeed.
drop policy if exists "parallax_bet_engine read bets" on public.parallax_bets;
create policy "parallax_bet_engine read bets" on public.parallax_bets
  for select to parallax_bet_engine using (true);
drop policy if exists "parallax_bet_engine write bets" on public.parallax_bets;
create policy "parallax_bet_engine write bets" on public.parallax_bets
  for insert to parallax_bet_engine with check (true);
drop policy if exists "parallax_bet_engine update bets" on public.parallax_bets;
create policy "parallax_bet_engine update bets" on public.parallax_bets
  for update to parallax_bet_engine using (true);

drop policy if exists "parallax_bet_engine read cache" on public.parallax_odds_cache;
create policy "parallax_bet_engine read cache" on public.parallax_odds_cache
  for select to parallax_bet_engine using (true);
drop policy if exists "parallax_bet_engine write cache" on public.parallax_odds_cache;
create policy "parallax_bet_engine write cache" on public.parallax_odds_cache
  for insert to parallax_bet_engine with check (true);
drop policy if exists "parallax_bet_engine update cache" on public.parallax_odds_cache;
create policy "parallax_bet_engine update cache" on public.parallax_odds_cache
  for update to parallax_bet_engine using (true);

-- Option (b) support above: let PostgREST's pool role switch into this one via a JWT
-- `role` claim. Harmless even if option (a) is used instead -- a grant to a role
-- nobody ever authenticates as does nothing.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'grant parallax_bet_engine to authenticator';
  end if;
end $$;

-- Postflight: confirm the scoped grants landed and nothing broader did, before commit.
do $$
begin
  if not (has_table_privilege('parallax_bet_engine', 'public.parallax_bets', 'SELECT')
      and has_table_privilege('parallax_bet_engine', 'public.parallax_bets', 'INSERT')
      and has_table_privilege('parallax_bet_engine', 'public.parallax_bets', 'UPDATE')
      and has_table_privilege('parallax_bet_engine', 'public.parallax_odds_cache', 'SELECT')
      and has_table_privilege('parallax_bet_engine', 'public.parallax_odds_cache', 'INSERT')
      and has_table_privilege('parallax_bet_engine', 'public.parallax_odds_cache', 'UPDATE')) then
    raise exception 'postflight failed: parallax_bet_engine is missing an expected grant';
  end if;
  if has_table_privilege('parallax_bet_engine', 'public.parallax_bets', 'DELETE')
     or has_table_privilege('parallax_bet_engine', 'public.parallax_bets', 'TRUNCATE')
     or has_table_privilege('parallax_bet_engine', 'public.parallax_odds_cache', 'DELETE')
     or has_table_privilege('parallax_bet_engine', 'public.parallax_odds_cache', 'TRUNCATE') then
    raise exception 'postflight failed: parallax_bet_engine has an excess privilege';
  end if;
  raise notice 'postflight ok: parallax_bet_engine scoped to select/insert/update on parallax_bets and parallax_odds_cache only';
end $$;

commit;
