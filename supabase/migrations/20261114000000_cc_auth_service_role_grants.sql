-- CC-RELEASE-87 correction: explicit service-role permissions.
--
-- The two auth migrations revoke every privilege from PUBLIC (functions) and
-- from anon/authenticated (tables), but they never GRANT anything to
-- service_role. They therefore depend on ambient Supabase default privileges
-- that are not visible in this repository and cannot be verified from it.
--
-- Verified locally on PostgreSQL 17 with a clean role setup: after the two
-- migrations, `set role service_role` could neither read cc_trusted_devices
-- nor execute cc_bootstrap_claim_attempt ("permission denied"). The routes
-- call both through the service-role client, so a production project without
-- those ambient defaults would fail every enrollment and PIN attempt closed.
--
-- This migration makes the permissions explicit and least-privilege:
--   - service-role may read/insert/update device rows and insert enrollment
--     codes; it never needs DELETE.
--   - cc_bootstrap_state is only touched by the SECURITY DEFINER functions,
--     so it gets no direct table grant at all.
--   - anon and authenticated still get nothing.
--
-- Safe to run before or after the two auth migrations; grants are idempotent.

grant usage on schema public to service_role;

grant select, insert, update on table public.cc_trusted_devices to service_role;
grant insert on table public.cc_device_enrollment_codes to service_role;

grant execute on function public.cc_trusted_device_claim_pin_attempt(uuid, int, int) to service_role;
grant execute on function public.cc_trusted_device_reset_pin_attempts(uuid) to service_role;
grant execute on function public.cc_redeem_device_enrollment_code(text, text) to service_role;
grant execute on function public.cc_bootstrap_claim_attempt(text, int, int) to service_role;
grant execute on function public.cc_bootstrap_consume_and_enroll(text, text, timestamptz, text) to service_role;
grant execute on function public.cc_bootstrap_reset(text) to service_role;
