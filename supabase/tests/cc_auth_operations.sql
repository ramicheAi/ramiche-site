-- CC-RELEASE-87 functional regression for the four auth migrations.
--
-- Runs as service_role inside a transaction and rolls everything back. It
-- exercises bootstrap enrollment, the PIN-attempt functions, enrollment-code
-- redemption and its single-use property, and the Firebase-gated bootstrap
-- reset function. Run after migrations 20261112200000 through
-- 20261114010000:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/cc_auth_operations.sql
--
-- No row survives the rollback.

begin;

set local role service_role;

do $$
declare
  v_allowed boolean;
  v_ok boolean;
  v_cleared boolean;
  v_device uuid;
  v_count int;
begin
  -- Bootstrap claim and first-device enrollment.
  select allowed into v_allowed
    from public.cc_bootstrap_claim_attempt('cc-release-test-owner', 5, 900);
  if not v_allowed then
    raise exception 'bootstrap claim was refused';
  end if;

  select ok, device_id into v_ok, v_device
    from public.cc_bootstrap_consume_and_enroll(
      'cc-release-test-owner', repeat('a', 64), now() + interval '90 days', 'test device');
  if not v_ok or v_device is null then
    raise exception 'bootstrap enrollment failed';
  end if;

  -- A second bootstrap attempt must be refused until a deliberate reset.
  select ok into v_ok
    from public.cc_bootstrap_consume_and_enroll(
      'cc-release-test-owner', repeat('b', 64), now() + interval '90 days', 'second');
  if v_ok then
    raise exception 'bootstrap was not one-shot';
  end if;

  -- The enrolled device row is readable and updatable.
  select count(*) into v_count from public.cc_trusted_devices where id = v_device;
  if v_count <> 1 then
    raise exception 'enrolled device is not readable';
  end if;
  update public.cc_trusted_devices set label = 'test device' where id = v_device;

  -- PIN attempt claim and successful-reset path.
  select allowed into v_allowed
    from public.cc_trusted_device_claim_pin_attempt(v_device, 5, 900);
  if not v_allowed then
    raise exception 'PIN attempt claim was refused on a fresh device';
  end if;
  select cleared into v_cleared
    from public.cc_trusted_device_reset_pin_attempts(v_device);
  if not v_cleared then
    raise exception 'PIN attempt reset did not clear';
  end if;

  -- Enrollment code creation, redemption, and single-use replay refusal.
  insert into public.cc_device_enrollment_codes
    (code_hash, owner_uid, expires_at, issued_by_device_id)
  values
    (repeat('c', 64), 'cc-release-test-owner', now() + interval '5 minutes', v_device);

  select ok into v_ok
    from public.cc_redeem_device_enrollment_code(
      repeat('c', 64), 'cc-release-test-owner');
  if not v_ok then
    raise exception 'valid enrollment code was refused';
  end if;

  select ok into v_ok
    from public.cc_redeem_device_enrollment_code(
      repeat('c', 64), 'cc-release-test-owner');
  if v_ok then
    raise exception 'enrollment code was redeemable twice';
  end if;

  -- Bootstrap reset re-arms the path for the configured owner.
  perform public.cc_bootstrap_reset('cc-release-test-owner');
  select ok into v_ok
    from public.cc_bootstrap_consume_and_enroll(
      'cc-release-test-owner', repeat('d', 64), now() + interval '90 days', 'after reset');
  if not v_ok then
    raise exception 'bootstrap reset did not re-arm the path';
  end if;

  raise notice 'cc_auth_operations: PASS';
end $$;

rollback;

select 'cc_auth_operations: PASS' as result;
