-- CC-SECURITY-CI-01 — role bootstrap for a vanilla (non-Supabase-hosted)
-- ephemeral CI Postgres instance.
--
-- Production Supabase provisions anon/authenticated/service_role as platform
-- roles. A plain `postgres:17` CI service container does not have them, so
-- this file creates role placeholders — no login, no password — AND
-- reproduces the one piece of Supabase platform behavior the privilege
-- migrations exist to correct: Supabase's `ALTER DEFAULT PRIVILEGES` on the
-- `public` schema grants ALL on every newly created table and function to
-- anon, authenticated and service_role. Without that default-privilege
-- state, the CC auth migrations' own `revoke all ... from <role>` statements
-- revoke privileges that were never present, and a privilege-regression test
-- run afterward cannot tell a correct revoke from a deleted one — both leave
-- the same empty grant set. Reproducing the default here is what makes the
-- revokes (and therefore the regression gate) actually exercised.
--
-- This file never runs anywhere but the ephemeral CI database.
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

grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
