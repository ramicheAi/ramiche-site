-- Exact rollback for supabase/migrations/20261109130000_parallax_least_privilege_writer.sql.
-- Drops the parallax_bet_engine role and everything granted to it. Safe only once
-- parallaxbet-engine (if it was ever reconfigured to use this role) is confirmed to no
-- longer be connecting as it -- dropping a role that something is actively
-- authenticating as will break that connection immediately, not gracefully.
begin;

drop policy if exists "parallax_bet_engine read bets" on public.parallax_bets;
drop policy if exists "parallax_bet_engine write bets" on public.parallax_bets;
drop policy if exists "parallax_bet_engine update bets" on public.parallax_bets;
drop policy if exists "parallax_bet_engine read cache" on public.parallax_odds_cache;
drop policy if exists "parallax_bet_engine write cache" on public.parallax_odds_cache;
drop policy if exists "parallax_bet_engine update cache" on public.parallax_odds_cache;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator')
     and exists (select 1 from pg_roles where rolname = 'parallax_bet_engine') then
    execute 'revoke parallax_bet_engine from authenticator';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parallax_bet_engine') then
    -- Must own nothing and hold no other grants for DROP ROLE to succeed; revoking the
    -- two explicit grants this migration made first keeps this a clean, exact undo.
    revoke all on public.parallax_bets from parallax_bet_engine;
    revoke all on public.parallax_odds_cache from parallax_bet_engine;
    revoke usage on schema public from parallax_bet_engine;
    drop role parallax_bet_engine;
  end if;
end $$;

-- Postflight: confirm the role is fully gone before committing.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'parallax_bet_engine') then
    raise exception 'rollback failed: parallax_bet_engine role still exists';
  end if;
end $$;

commit;
