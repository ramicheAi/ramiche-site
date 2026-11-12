-- SQL tests for supabase/migrations/20261108200000_parallax_anon_write_revoke.sql.
-- Plain PostgreSQL 15+. Run against a scratch database that already has the Supabase roles
-- (anon, authenticated, service_role) and the 20260710192806 schema. NEVER run this against
-- the production project.
--
--   psql -v ON_ERROR_STOP=1 -v pre=1 -f supabase/tests/parallax_anon_write_revoke.test.sql
--   # apply the migration to that same scratch database
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/parallax_anon_write_revoke.test.sql
--
-- With `-v pre=1` the file asserts the vulnerability EXISTS: anon can insert, update and
-- TRUNCATE. It must pass on the unpatched schema and fail after the migration, which is the
-- point. Without it (the default) the file asserts the vulnerability is GONE while anon
-- SELECT still works.
--
-- Why this file looks the way it does (CC-SECURITY-COMPLETION-02): the previous version could
-- not fail. It raised its own failure message inside a block whose handler caught `others`,
-- so a SUCCESSFUL anon insert was counted as a denial; and its fixture inserts omitted
-- NOT NULL columns on parallax_bets, so the probe died on SQLSTATE 23502 (not-null) instead of
-- 42501 (RLS) and was swallowed the same way. Both were reproduced on a scratch database.
-- Here every probe returns the SQLSTATE it actually got, and the assertion lives OUTSIDE the
-- exception handler.
--
-- The destructive probes run inside one transaction that is rolled back at the end.

begin;

-- A probe that runs one statement as anon and returns NULL on success or the SQLSTATE on failure.
create function pg_temp.as_anon_try(stmt text) returns text language plpgsql as $$
declare state text;
begin
  begin
    execute 'set role anon';
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
values ('cc-test:target', '{}'::jsonb)
on conflict (cache_key) do nothing;
insert into public.parallax_bets (ts_ms, event_id, market, outcome, book, odds_taken)
values (0, 'cc-test:target', 'moneyline', 'home', 'testbook', 2.0);

\if :{?pre}
-- ---------------------------------------------------------------- vulnerability reproduced
do $$
declare state text;
begin
  state := pg_temp.as_anon_try(
    $q$insert into public.parallax_odds_cache (cache_key, payload) values ('cc-test:pre-insert', '{}'::jsonb)$q$);
  if state is not null then
    raise exception 'expected anon INSERT into parallax_odds_cache to succeed, got SQLSTATE %', state;
  end if;

  state := pg_temp.as_anon_try(
    $q$insert into public.parallax_bets (ts_ms, event_id, market, outcome, book, odds_taken) values (0, 'cc-test:pre-insert', 'moneyline', 'home', 'testbook', 2.0)$q$);
  if state is not null then
    raise exception 'expected anon INSERT into parallax_bets to succeed, got SQLSTATE %', state;
  end if;

  state := pg_temp.as_anon_try(
    $q$update public.parallax_bets set outcome = 'hacked' where event_id = 'cc-test:target'$q$);
  if state is not null then
    raise exception 'expected anon UPDATE on parallax_bets to succeed, got SQLSTATE %', state;
  end if;

  -- TRUNCATE is not subject to RLS. It is the destructive hole this migration must close.
  state := pg_temp.as_anon_try($q$truncate public.parallax_bets$q$);
  if state is not null then
    raise exception 'expected anon TRUNCATE on parallax_bets to succeed (RLS does not apply to TRUNCATE), got SQLSTATE %', state;
  end if;

  raise notice 'pre-fix: anon can INSERT, UPDATE and TRUNCATE both tables (vulnerability reproduced)';
end $$;

\else
-- ------------------------------------------------------------------------- vulnerability closed
do $$
declare state text; affected int;
begin
  state := pg_temp.as_anon_try(
    $q$insert into public.parallax_odds_cache (cache_key, payload) values ('cc-test:post-insert', '{}'::jsonb)$q$);
  if state is distinct from '42501' then
    raise exception 'expected SQLSTATE 42501 (RLS) for anon INSERT into parallax_odds_cache, got %', coalesce(state, 'SUCCESS');
  end if;

  state := pg_temp.as_anon_try(
    $q$insert into public.parallax_bets (ts_ms, event_id, market, outcome, book, odds_taken) values (0, 'cc-test:post-insert', 'moneyline', 'home', 'testbook', 2.0)$q$);
  if state is distinct from '42501' then
    raise exception 'expected SQLSTATE 42501 (RLS) for anon INSERT into parallax_bets, got %', coalesce(state, 'SUCCESS');
  end if;

  -- UPDATE with no matching policy silently affects zero rows rather than raising; assert the
  -- row itself is untouched, which is the observable fact that matters.
  set local role anon;
  update public.parallax_bets set outcome = 'hacked' where event_id = 'cc-test:target';
  get diagnostics affected = row_count;
  reset role;
  if affected <> 0 then
    raise exception 'anon UPDATE on parallax_bets affected % row(s)', affected;
  end if;

  set local role anon;
  update public.parallax_odds_cache set payload = '{"hacked":true}'::jsonb where cache_key = 'cc-test:target';
  get diagnostics affected = row_count;
  reset role;
  if affected <> 0 then
    raise exception 'anon UPDATE on parallax_odds_cache affected % row(s)', affected;
  end if;

  -- The verb RLS cannot see must be denied by privilege, not by policy.
  state := pg_temp.as_anon_try($q$truncate public.parallax_bets$q$);
  if state is distinct from '42501' then
    raise exception 'expected SQLSTATE 42501 (permission denied) for anon TRUNCATE on parallax_bets, got %', coalesce(state, 'SUCCESS');
  end if;
  state := pg_temp.as_anon_try($q$truncate public.parallax_odds_cache$q$);
  if state is distinct from '42501' then
    raise exception 'expected SQLSTATE 42501 (permission denied) for anon TRUNCATE on parallax_odds_cache, got %', coalesce(state, 'SUCCESS');
  end if;

  -- Read access is deliberately unchanged; if this migration broke it, that is a regression.
  state := pg_temp.as_anon_try($q$select 1 from public.parallax_bets limit 1$q$);
  if state is not null then
    raise exception 'anon SELECT on parallax_bets was broken by this migration: SQLSTATE %', state;
  end if;
  state := pg_temp.as_anon_try($q$select 1 from public.parallax_odds_cache limit 1$q$);
  if state is not null then
    raise exception 'anon SELECT on parallax_odds_cache was broken by this migration: SQLSTATE %', state;
  end if;

  raise notice 'post-fix: anon INSERT/UPDATE/TRUNCATE denied on both tables, anon SELECT intact';
end $$;
\endif

-- service_role must be unaffected either way (BYPASSRLS, and it keeps its grants).
do $$
begin
  insert into public.parallax_odds_cache (cache_key, payload) values ('cc-test:service', '{}'::jsonb)
    on conflict (cache_key) do nothing;
  insert into public.parallax_bets (ts_ms, event_id, market, outcome, book, odds_taken)
    values (0, 'cc-test:service', 'moneyline', 'away', 'testbook', 3.0);
  delete from public.parallax_odds_cache where cache_key = 'cc-test:service';
  delete from public.parallax_bets where event_id = 'cc-test:service';
  raise notice 'service_role: unaffected';
end $$;

rollback;
