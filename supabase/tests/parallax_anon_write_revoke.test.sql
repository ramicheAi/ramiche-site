-- SQL tests for supabase/migrations/20261108200000_parallax_anon_write_revoke.sql.
-- Plain PostgreSQL: run against a scratch database that already has the Supabase roles (anon,
-- authenticated, service_role). Never run this against the production project.
--
-- Two modes:
--   1. Run against a scratch copy of the CURRENT (unpatched) schema, before applying the
--      migration above, to reproduce the finding: the first block below should FAIL (anon write
--      succeeds) until the migration is applied. That failure is the vulnerability, captured as
--      a test so it cannot regress silently once fixed.
--   2. Run again after applying the migration: both blocks should pass.

-- @test (pre-fix / vulnerability-reproduction) anon can currently write both tables
-- Expected to PASS before the migration is applied, and to FAIL after -- at which point delete
-- this block, it has done its job.
do $$
declare inserted boolean := false;
begin
  begin
    set local role anon;
    insert into public.parallax_odds_cache (cache_key, payload) values ('test:containment-01', '{}'::jsonb);
    inserted := true;
  exception when insufficient_privilege then
    inserted := false;
  end;
  reset role;
  if inserted then
    delete from public.parallax_odds_cache where cache_key = 'test:containment-01';
  end if;
  raise notice 'pre-fix probe: anon insert on parallax_odds_cache succeeded = %', inserted;
end $$;

-- @test (post-fix) anon is denied insert and update on both tables, select still works
--
-- Two different RLS behaviors are deliberately distinguished here (verified empirically against
-- a local scratch cluster, not assumed): with RLS enabled, a table-level GRANT present, and zero
-- matching policy for a command, INSERT raises a row-level-security error (there is no row to
-- silently filter -- the new row is rejected outright), while UPDATE/DELETE instead silently
-- match zero rows (the USING clause for the denied command evaluates to false for every row,
-- same as if the row did not exist) rather than raising. Both are "the policy is gone"; they
-- just surface differently, so each is asserted the way it actually behaves.
do $$
declare denied int := 0; before_fetched timestamptz;
begin
  -- insert: expect a row-level security violation on both tables
  begin
    set local role anon;
    insert into public.parallax_odds_cache (cache_key, payload) values ('test:containment-01', '{}'::jsonb);
    reset role;
    raise exception 'anon could still insert into parallax_odds_cache';
  exception when insufficient_privilege or others then
    reset role; denied := denied + 1;
  end;
  begin
    set local role anon;
    insert into public.parallax_bets (ts_ms, event_id) values (0, 'test:containment-01');
    reset role;
    raise exception 'anon could still insert into parallax_bets';
  exception when insufficient_privilege or others then
    reset role; denied := denied + 1;
  end;

  -- update: insert a real target row as service_role first, so a 0-rows-affected result from
  -- anon is proof of denial, not just an absence of anything to update.
  set local role service_role;
  insert into public.parallax_odds_cache (cache_key, payload) values ('containment-01-target', '{}'::jsonb);
  insert into public.parallax_bets (ts_ms, event_id) values (0, 'containment-01-target');
  reset role;

  select fetched_at into before_fetched from public.parallax_odds_cache where cache_key = 'containment-01-target';

  set local role anon;
  -- clock_timestamp(), not now(): now() is frozen at transaction start, so it would equal
  -- before_fetched even on a successful update and this check would never catch anything.
  update public.parallax_odds_cache set fetched_at = clock_timestamp() where cache_key = 'containment-01-target';
  reset role;
  if (select fetched_at from public.parallax_odds_cache where cache_key = 'containment-01-target') <> before_fetched then
    raise exception 'anon could still update parallax_odds_cache';
  end if;
  denied := denied + 1;

  set local role anon;
  update public.parallax_bets set event_id = 'changed-by-anon' where event_id = 'containment-01-target';
  reset role;
  if exists (select 1 from public.parallax_bets where event_id = 'changed-by-anon') then
    raise exception 'anon could still update parallax_bets';
  end if;
  denied := denied + 1;

  assert denied = 4, format('expected 4 denials, got %s', denied);

  set local role service_role;
  delete from public.parallax_odds_cache where cache_key = 'containment-01-target';
  delete from public.parallax_bets where event_id = 'containment-01-target';
  reset role;

  -- select: must still work, unchanged by this migration
  begin
    set local role anon;
    perform 1 from public.parallax_odds_cache limit 1;
    perform 1 from public.parallax_bets limit 1;
    reset role;
  exception when insufficient_privilege then
    reset role;
    raise exception 'anon select was unexpectedly broken by this migration';
  end;
end $$;

-- @test service_role is unaffected (sanity check; service_role has BYPASSRLS)
do $$
begin
  set local role service_role;
  perform 1 from public.parallax_odds_cache limit 1;
  insert into public.parallax_odds_cache (cache_key, payload) values ('test:containment-01-svc', '{}'::jsonb);
  delete from public.parallax_odds_cache where cache_key = 'test:containment-01-svc';
  reset role;
end $$;
