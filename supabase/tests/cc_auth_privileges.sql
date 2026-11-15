-- CC-RELEASE-87 privilege regression. Read-only.
--
-- Run after all four auth migrations against a database that mirrors
-- production's role setup:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cc_auth_privileges.sql
--
-- It asserts EFFECTIVE privileges with has_table_privilege and
-- has_function_privilege, not the migration text. MAINTAIN is checked only
-- on PostgreSQL 17 and newer, where the privilege exists.

do $$
declare
  t text;
  p text;
  fn text;
  v_count int;
  v_tables constant text[] := array[
    'cc_trusted_devices',
    'cc_device_enrollment_codes',
    'cc_bootstrap_state'
  ];
  v_functions constant text[] := array[
    'cc_trusted_device_claim_pin_attempt(uuid,int,int)',
    'cc_trusted_device_reset_pin_attempts(uuid)',
    'cc_redeem_device_enrollment_code(text,text)',
    'cc_bootstrap_claim_attempt(text,int,int)',
    'cc_bootstrap_consume_and_enroll(text,text,timestamptz,text)',
    'cc_bootstrap_reset(text)'
  ];
begin
  foreach t in array v_tables loop
    if to_regclass('public.' || t) is null then
      raise exception 'missing table public.%', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RLS is not enabled on public.%', t;
    end if;
    if (select relforcerowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RLS is forced on public.% unexpectedly', t;
    end if;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 0 then
      raise exception 'unexpected RLS policy on public.%', t;
    end if;
  end loop;

  -- service_role: devices may select, insert, update. Nothing else.
  foreach p in array array['SELECT','INSERT','UPDATE'] loop
    if not has_table_privilege('service_role', 'public.cc_trusted_devices', p) then
      raise exception 'service_role lacks % on cc_trusted_devices', p;
    end if;
  end loop;
  foreach p in array array['DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('service_role', 'public.cc_trusted_devices', p) then
      raise exception 'service_role still has % on cc_trusted_devices', p;
    end if;
  end loop;
  if current_setting('server_version_num')::int >= 170000
     and has_table_privilege('service_role', 'public.cc_trusted_devices', 'MAINTAIN') then
    raise exception 'service_role still has MAINTAIN on cc_trusted_devices';
  end if;

  -- service_role: enrollment codes are insert-only.
  if not has_table_privilege('service_role', 'public.cc_device_enrollment_codes', 'INSERT') then
    raise exception 'service_role lacks INSERT on cc_device_enrollment_codes';
  end if;
  foreach p in array array['SELECT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('service_role', 'public.cc_device_enrollment_codes', p) then
      raise exception 'service_role still has % on cc_device_enrollment_codes', p;
    end if;
  end loop;
  if current_setting('server_version_num')::int >= 170000
     and has_table_privilege('service_role', 'public.cc_device_enrollment_codes', 'MAINTAIN') then
    raise exception 'service_role still has MAINTAIN on cc_device_enrollment_codes';
  end if;

  -- service_role: bootstrap state has no direct table privilege at all.
  foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege('service_role', 'public.cc_bootstrap_state', p) then
      raise exception 'service_role still has % on cc_bootstrap_state', p;
    end if;
  end loop;
  if current_setting('server_version_num')::int >= 170000
     and has_table_privilege('service_role', 'public.cc_bootstrap_state', 'MAINTAIN') then
    raise exception 'service_role still has MAINTAIN on cc_bootstrap_state';
  end if;

  -- anon and authenticated: nothing on any of the three tables.
  foreach t in array v_tables loop
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon', 'public.' || t, p) then
        raise exception 'anon has % on public.%', p, t;
      end if;
      if has_table_privilege('authenticated', 'public.' || t, p) then
        raise exception 'authenticated has % on public.%', p, t;
      end if;
    end loop;
    if current_setting('server_version_num')::int >= 170000 then
      if has_table_privilege('anon', 'public.' || t, 'MAINTAIN') then
        raise exception 'anon has MAINTAIN on public.%', t;
      end if;
      if has_table_privilege('authenticated', 'public.' || t, 'MAINTAIN') then
        raise exception 'authenticated has MAINTAIN on public.%', t;
      end if;
    end if;
  end loop;

  -- The six auth functions: service_role only, SECURITY DEFINER, safe search_path.
  foreach fn in array v_functions loop
    if not has_function_privilege('service_role', 'public.' || fn, 'EXECUTE') then
      raise exception 'service_role lacks EXECUTE on public.%', fn;
    end if;
    if has_function_privilege('anon', 'public.' || fn, 'EXECUTE') then
      raise exception 'anon can EXECUTE public.%', fn;
    end if;
    if has_function_privilege('authenticated', 'public.' || fn, 'EXECUTE') then
      raise exception 'authenticated can EXECUTE public.%', fn;
    end if;
    select count(*) into v_count
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = split_part(fn, '(', 1)
       and p.prosecdef
       and p.proconfig @> array['search_path=pg_catalog, pg_temp']
       and p.proowner::regrole::text = 'postgres';
    if v_count <> 1 then
      raise exception 'function public.% is not SECURITY DEFINER with the expected search_path and owner', fn;
    end if;
  end loop;

  raise notice 'cc_auth_privileges: PASS';
end $$;

select 'cc_auth_privileges: PASS' as result;
