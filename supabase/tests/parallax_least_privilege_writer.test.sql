-- SQL tests for supabase/migrations/20261109130000_parallax_least_privilege_writer.sql.
-- Plain PostgreSQL 15+. Run against a scratch database that already has the Supabase
-- roles (anon, authenticated, service_role) and the 20260710192806 schema. NEVER run
-- this against the production project.
--
--   psql -v ON_ERROR_STOP=1 -v pre=1 -f supabase/tests/parallax_least_privilege_writer.test.sql
--   # apply the migration to that same scratch database
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parallax_least_privilege_writer.test.sql
--
-- With `-v pre=1` the file asserts the role does not exist yet and anon still has its
-- original write access (the starting state this migration is meant to add to, not
-- replace). Without it (the default) the file asserts: the new role can
-- select/insert/update both tables and cannot delete/truncate either one, AND -- the
-- property that makes this migration safe to apply on its own -- anon's original
-- write access is completely unchanged (this migration is purely additive; only PR
-- #70's separate, unapplied-by-this-file migration touches anon's grants).
--
-- Same probe pattern as parallax_anon_write_revoke.test.sql: run one statement as a
-- given role and return NULL on success or the SQLSTATE on failure, with the
-- assertion outside the exception handler so a surprise success cannot be swallowed.

begin;

create function pg_temp.as_role_try(role_name text, stmt text) returns text language plpgsql as $$
declare state text;
begin
  begin
    execute format('set role %I', role_name);
    execute stmt;
    execute 'reset role';
    return null;
  exception when others then
    get stacked diagnostics state = returned_sqlstate;
    begin
      execute 'reset role';
    exception when others then
      null;
    end;
    return state;
  end;
end $$;

-- Fixtures, written as the owner. Every NOT NULL column is supplied.
insert into public.parallax_odds_cache (cache_key, payload)
values ('cc-lpw-test:target', '{}'::jsonb)
on conflict (cache_key) do nothing;
insert into public.parallax_bets (ts_ms, event_id, market, outcome, book, odds_taken)
values (0, 'cc-lpw-test:target', 'moneyline', 'home', 'testbook', 2.0);

\if :{?pre}
-- ---------------------------------------------------------- starting state, pre-fix
do $$
declare state text;
begin
  if exists (select 1 from pg_roles where rolname = 'parallax_bet_engine') then
    raise exception 'expected parallax_bet_engine to not exist yet (pre-fix), but it does';
  end if;

  -- anon's original write access (from 20260710192806) must still be exactly as it
  -- was -- this is the state the new migration is meant to add to, not replace.
  state := pg_temp.as_role_try('anon',
    $q$insert into public.parallax_odds_cache (cache_key, payload) values ('cc-lpw-test:pre-anon-insert', '{}'::jsonb)$q$);
  if state is not null then
    raise exception 'expected anon INSERT into parallax_odds_cache to still succeed pre-fix, got SQLSTATE %', state;
  end if;

  raise notice 'pre-fix: parallax_bet_engine does not exist; anon write access is untouched (expected starting state)';
end $$;

\else
-- ------------------------------------------------------------------- post-fix state
do $$
declare state text;
begin
  if not exists (select 1 from pg_roles where rolname = 'parallax_bet_engine') then
    raise exception 'expected parallax_bet_engine to exist after the migration';
  end if;

  -- The new role can select, insert and update both tables.
  state := pg_temp.as_role_try('parallax_bet_engine',
    $q$insert into public.parallax_odds_cache (cache_key, payload) values ('cc-lpw-test:post-insert', '{}'::jsonb)$q$);
  if state is not null then
    raise exception 'expected parallax_bet_engine INSERT into parallax_odds_cache to succeed, got SQLSTATE %', state;
  end if;

  state := pg_temp.as_role_try('parallax_bet_engine',
    $q$insert into public.parallax_bets (ts_ms, event_id, market, outcome, book, odds_taken) values (0, 'cc-lpw-test:post-insert', 'moneyline', 'home', 'testbook', 2.0)$q$);
  if state is not null then
    raise exception 'expected parallax_bet_engine INSERT into parallax_bets to succeed, got SQLSTATE %', state;
  end if;

  state := pg_temp.as_role_try('parallax_bet_engine',
    $q$update public.parallax_bets set outcome = 'closed' where event_id = 'cc-lpw-test:target'$q$);
  if state is not null then
    raise exception 'expected parallax_bet_engine UPDATE on parallax_bets to succeed, got SQLSTATE %', state;
  end if;

  state := pg_temp.as_role_try('parallax_bet_engine',
    $q$select count(*) from public.parallax_bets$q$);
  if state is not null then
    raise exception 'expected parallax_bet_engine SELECT on parallax_bets to succeed, got SQLSTATE %', state;
  end if;

  -- The new role cannot delete or truncate either table.
  state := pg_temp.as_role_try('parallax_bet_engine',
    $q$delete from public.parallax_bets where event_id = 'cc-lpw-test:target'$q$);
  if state is distinct from '42501' then
    raise exception 'expected SQLSTATE 42501 for parallax_bet_engine DELETE on parallax_bets, got %', coalesce(state, 'SUCCESS');
  end if;

  state := pg_temp.as_role_try('parallax_bet_engine', $q$truncate public.parallax_bets$q$);
  if state is null then
    raise exception 'expected parallax_bet_engine TRUNCATE on parallax_bets to fail, got SUCCESS';
  end if;

  -- The property that makes this migration safe to apply on its own: anon's original
  -- write access is completely untouched. Only PR #70's separate migration (not this
  -- one) ever revokes it.
  state := pg_temp.as_role_try('anon',
    $q$insert into public.parallax_odds_cache (cache_key, payload) values ('cc-lpw-test:post-anon-insert', '{}'::jsonb)$q$);
  if state is not null then
    raise exception 'expected anon INSERT into parallax_odds_cache to still succeed after this migration (it must not touch anon''s grants), got SQLSTATE %', state;
  end if;

  raise notice 'post-fix: parallax_bet_engine can select/insert/update, cannot delete/truncate, and anon''s original access is unchanged';
end $$;
\endif

rollback;
