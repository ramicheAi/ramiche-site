-- CC-RELEASE-87 migration-history reconciliation. METADATA ONLY.
--
-- This is not a schema migration and must never be placed in
-- supabase/migrations. It repairs the Supabase migration history table so the
-- four canonical migration versions in this repository match production.
--
-- Preconditions, all enforced below. The script ABORTS on any mismatch:
--   * supabase_migrations.schema_migrations exists.
--   * The two manually recorded ad-hoc rows exist with exactly these names:
--       20261114213728  cc_device_enrollment_codes
--       20261114213754  cc_auth_service_role_grants
--   * None of the four canonical versions exist yet.
--   * The schema and privilege state show migrations 1-3 AND the corrective
--     migration 20261114010000 applied (service_role can SELECT/INSERT/UPDATE
--     devices, cannot DELETE/TRUNCATE, and can EXECUTE all six functions).
--
-- If the final four canonical rows already exist with exact names, the script
-- notices, changes nothing and returns. Any partial or conflicting state
-- raises an exception and the transaction rolls back.
--
-- Run only after applying 20261114010000_cc_auth_service_role_least_privilege:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f ops-handoff/CC-RELEASE-87-HISTORY-REPAIR.sql
--
-- Or paste, wrapped in one transaction, in the Supabase SQL editor.

do $$
declare
  v_count int;
  v_rows int;
  v_canonical constant text[] := array[
    '20261112200000', '20261113000000', '20261114000000', '20261114010000'
  ];
  v_ad_hoc constant text[] := array['20261114213728', '20261114213754'];
  v_names constant text[] := array[
    'cc_trusted_devices',
    'cc_device_enrollment_codes',
    'cc_auth_service_role_grants',
    'cc_auth_service_role_least_privilege'
  ];
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'schema_migrations table is missing';
  end if;

  -- Already reconciled: exact four canonical rows, no ad-hoc rows.
  select count(*) into v_count
    from supabase_migrations.schema_migrations
   where version = any (v_canonical);
  if v_count = 4 then
    select count(*) into v_rows
      from supabase_migrations.schema_migrations
     where version = any (v_ad_hoc);
    if v_rows <> 0 then
      raise exception 'canonical and ad-hoc history rows coexist; aborting';
    end if;
    if exists (
      select 1
        from supabase_migrations.schema_migrations
       where version = any (v_canonical)
         and (version, name) not in (
           ('20261112200000', 'cc_trusted_devices'),
           ('20261113000000', 'cc_device_enrollment_codes'),
           ('20261114000000', 'cc_auth_service_role_grants'),
           ('20261114010000', 'cc_auth_service_role_least_privilege')
         )
    ) then
      raise exception 'canonical history has an unexpected name; aborting';
    end if;
    raise notice 'history already reconciled; no changes';
    return;
  end if;
  if v_count <> 0 then
    raise exception 'partial canonical history (% of 4 rows); aborting', v_count;
  end if;

  -- Exactly the two expected ad-hoc rows, with exact names.
  select count(*) into v_rows
    from supabase_migrations.schema_migrations
   where version = any (v_ad_hoc);
  if v_rows <> 2 then
    raise exception 'expected exactly 2 ad-hoc history rows, found %; aborting', v_rows;
  end if;
  if not exists (
    select 1 from supabase_migrations.schema_migrations
     where version = '20261114213728' and name = 'cc_device_enrollment_codes'
  ) then
    raise exception 'ad-hoc row 20261114213728 has an unexpected name; aborting';
  end if;
  if not exists (
    select 1 from supabase_migrations.schema_migrations
     where version = '20261114213754' and name = 'cc_auth_service_role_grants'
  ) then
    raise exception 'ad-hoc row 20261114213754 has an unexpected name; aborting';
  end if;

  -- No intended name hiding under an unexpected version.
  if exists (
    select 1 from supabase_migrations.schema_migrations
     where name = any (v_names)
       and version <> all (v_ad_hoc)
       and version <> all (v_canonical)
  ) then
    raise exception 'an intended migration name exists under an unexpected version; aborting';
  end if;

  -- Schema and privilege state: the corrective migration must already be applied.
  if to_regclass('public.cc_trusted_devices') is null
     or to_regclass('public.cc_device_enrollment_codes') is null
     or to_regclass('public.cc_bootstrap_state') is null then
    raise exception 'one or more auth tables are missing; aborting';
  end if;
  if not has_table_privilege('service_role', 'public.cc_trusted_devices', 'SELECT')
     or not has_table_privilege('service_role', 'public.cc_trusted_devices', 'INSERT')
     or not has_table_privilege('service_role', 'public.cc_trusted_devices', 'UPDATE') then
    raise exception 'service_role lacks a required device privilege; aborting';
  end if;
  if has_table_privilege('service_role', 'public.cc_trusted_devices', 'DELETE')
     or has_table_privilege('service_role', 'public.cc_trusted_devices', 'TRUNCATE') then
    raise exception 'corrective migration 20261114010000 is not applied; aborting';
  end if;
  if current_setting('server_version_num')::int >= 170000
     and has_table_privilege('service_role', 'public.cc_trusted_devices', 'MAINTAIN') then
    raise exception 'service_role still has MAINTAIN; corrective migration not applied; aborting';
  end if;
  if not has_function_privilege('service_role',
         'public.cc_bootstrap_claim_attempt(text,int,int)', 'EXECUTE')
     or not has_function_privilege('service_role',
         'public.cc_bootstrap_consume_and_enroll(text,text,timestamptz,text)', 'EXECUTE')
     or not has_function_privilege('service_role',
         'public.cc_bootstrap_reset(text)', 'EXECUTE') then
    raise exception 'a required auth function grant is missing; aborting';
  end if;

  -- Apply the metadata repair. Each step is checked; any mismatch rolls back.
  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261112200000', 'cc_trusted_devices');

  update supabase_migrations.schema_migrations
     set version = '20261113000000', name = 'cc_device_enrollment_codes'
   where version = '20261114213728';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'rename of 20261114213728 affected % rows; aborting', v_rows;
  end if;

  update supabase_migrations.schema_migrations
     set version = '20261114000000', name = 'cc_auth_service_role_grants'
   where version = '20261114213754';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'rename of 20261114213754 affected % rows; aborting', v_rows;
  end if;

  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261114010000', 'cc_auth_service_role_least_privilege');

  select count(*) into v_count
    from supabase_migrations.schema_migrations
   where version = any (v_canonical);
  if v_count <> 4 then
    raise exception 'final canonical count is % (expected 4); aborting', v_count;
  end if;
  if exists (
    select 1 from supabase_migrations.schema_migrations
     where version = any (v_ad_hoc)
  ) then
    raise exception 'ad-hoc history rows remain after repair; aborting';
  end if;

  raise notice 'history reconciled to 4 canonical versions';
end $$;

select version, name
  from supabase_migrations.schema_migrations
 where version in ('20261112200000','20261113000000','20261114000000','20261114010000')
 order by version;
