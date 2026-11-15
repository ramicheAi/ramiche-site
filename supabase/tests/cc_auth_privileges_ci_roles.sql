-- CC-SECURITY-CI-01 — role bootstrap for a vanilla (non-Supabase-hosted)
-- ephemeral CI Postgres instance.
--
-- Production Supabase provisions anon/authenticated/service_role as platform
-- roles. A plain `postgres:17` CI service container does not have them, so
-- this file creates role placeholders ONLY — no login, no password, no
-- privileges beyond what the real migrations later grant. This file never
-- runs anywhere but the ephemeral CI database.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;
