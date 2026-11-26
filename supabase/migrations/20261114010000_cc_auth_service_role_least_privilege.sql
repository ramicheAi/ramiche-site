-- CC-RELEASE-87 least-privilege correction.
--
-- The three auth tables were created under Supabase's default privileges,
-- which grant ALL on new public tables to service_role. The explicit grants
-- in 20261114000000_cc_auth_service_role_grants.sql added SELECT, INSERT and
-- UPDATE but did not remove the default DELETE, TRUNCATE, REFERENCES,
-- TRIGGER or MAINTAIN. Production catalog evidence confirmed all of them
-- effectively present on all three tables.
--
-- This migration revokes everything from service_role on these three tables
-- and re-grants only what the routes actually use:
--   - cc_trusted_devices: SELECT, INSERT, UPDATE (the app inserts, reads and
--     updates device rows; it never deletes them in normal operation).
--   - cc_device_enrollment_codes: INSERT only (the redeem function updates
--     the row as SECURITY DEFINER).
--   - cc_bootstrap_state: no direct table grant at all. Only the six
--     SECURITY DEFINER functions touch it.
--
-- Function EXECUTE grants are deliberately untouched. Tables, rows,
-- constraints, indexes and RLS configuration are untouched. Grant/revoke are
-- idempotent, so re-running this file (or migrations 1-3 afterward) does not
-- re-add the excess privileges to existing objects.

revoke all on table public.cc_trusted_devices,
                   public.cc_device_enrollment_codes,
                   public.cc_bootstrap_state
  from service_role;

grant select, insert, update on table public.cc_trusted_devices to service_role;
grant insert on table public.cc_device_enrollment_codes to service_role;
