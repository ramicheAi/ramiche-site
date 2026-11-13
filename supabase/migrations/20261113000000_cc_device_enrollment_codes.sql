-- NOT YET APPLIED TO PRODUCTION. Prepared per the founder's correction
-- (CC-PRODUCTION-OWNER-RECOVERY-01 follow-up): the normal Command Center
-- login experience must be PIN-only, with Firebase reduced to an internal/
-- recovery identity service, never a forced browser login screen — even
-- for first-time device enrollment. Requires founder review and approval
-- before running against the live database.
--
-- One new table, backing short-lived, single-use device-approval codes.
-- Does not alter any existing table.

create table if not exists public.cc_device_enrollment_codes (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 hex digest of the one-time code. The raw code is never stored.
  code_hash text not null,
  owner_uid text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  -- Which already-enrolled device generated this code, for audit only —
  -- never used as an authorization input by itself.
  issued_by_device_id uuid references public.cc_trusted_devices(id) on delete set null
);

comment on table public.cc_device_enrollment_codes is
  'Short-lived, single-use codes that let an already-enrolled, PIN-unlocked device vouch for a NEW device, so enrolling a second/third device never requires Firebase sign-in. Each code is step-up-gated (the approving device must re-enter its PIN at the moment of generation, not just hold an existing unlock session) and expires in minutes, not days.';

create index if not exists cc_device_enrollment_codes_owner_uid_idx
  on public.cc_device_enrollment_codes (owner_uid)
  where used_at is null;

alter table public.cc_device_enrollment_codes enable row level security;
revoke all on table public.cc_device_enrollment_codes from anon, authenticated;

-- Atomically redeem a code: same SELECT ... FOR UPDATE discipline as the
-- PIN-attempt functions, so two concurrent redemption attempts on the same
-- code can never both succeed (one device enrolled per code, not two).
create or replace function public.cc_redeem_device_enrollment_code(
  p_code_hash text,
  p_owner_uid text
)
returns table(ok boolean, issued_by_device_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_id uuid;
  v_expires_at timestamptz;
  v_used_at timestamptz;
  v_issued_by uuid;
begin
  select c.id, c.expires_at, c.used_at, c.issued_by_device_id
    into v_id, v_expires_at, v_used_at, v_issued_by
    from public.cc_device_enrollment_codes c
    where c.code_hash = p_code_hash
      and c.owner_uid = p_owner_uid
    for update;

  if not found then
    return query select false, null::uuid;
    return;
  end if;
  if v_used_at is not null then
    return query select false, null::uuid;
    return;
  end if;
  if v_expires_at <= now() then
    return query select false, null::uuid;
    return;
  end if;

  -- Independent review finding: a code survives its issuing device's
  -- revocation for up to its own 5-minute window. If the owner revoked
  -- that device because it was compromised, a code it already issued
  -- must die with it, not keep working for the remainder of the window.
  if v_issued_by is not null and not exists (
    select 1 from public.cc_trusted_devices d
    where d.id = v_issued_by
      and d.revoked_at is null
      and d.expires_at > now()
  ) then
    return query select false, null::uuid;
    return;
  end if;

  update public.cc_device_enrollment_codes
    set used_at = now()
    where id = v_id;

  return query select true, v_issued_by;
end;
$$;

revoke all on function public.cc_redeem_device_enrollment_code(text, text) from public, anon, authenticated;

-- Independent review finding (HIGH x2): the prior design checked
-- "does any active device currently exist" in application code (a
-- separate SELECT then a separate INSERT, not atomic — two concurrent
-- bootstrap calls could both pass the check and both enroll, multiplying
-- the attacker's PIN-guessing surface) and the check itself was NOT
-- durable (devices expire after 90 days or can be fully revoked, which
-- silently re-opened the bootstrap window on a clock, with no deliberate
-- action required). Both are fixed by tracking "has this owner EVER
-- consumed bootstrap" as its own permanent flag, set atomically together
-- with the device insert under one function call, independent of any
-- device's later revocation or expiry. Re-arming it requires a deliberate
-- Firebase-gated action (see the reset route), never a clock.
create table if not exists public.cc_bootstrap_state (
  owner_uid text primary key,
  -- NULL = bootstrap still available for this owner. Set once, atomically
  -- with the first device's enrollment, and never cleared except by an
  -- explicit Firebase-gated reset.
  consumed_at timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

comment on table public.cc_bootstrap_state is
  'One row per owner. consumed_at being non-null permanently disables the bootstrap-secret enrollment path for that owner, independent of whether any individual device later expires or is revoked — the opposite of the prior design, where the gate re-opened on a clock. failed_attempts/locked_until rate-limit guesses at the bootstrap secret itself, same discipline as the PIN-attempt table.';

alter table public.cc_bootstrap_state enable row level security;
revoke all on table public.cc_bootstrap_state from anon, authenticated;

-- Rate-limits GUESSES AT THE SECRET ITSELF (independent review finding:
-- the bootstrap secret previously had no throttle at all, unlike the PIN).
-- Called BEFORE the secret is compared, same ordering as the PIN claim.
create or replace function public.cc_bootstrap_claim_attempt(
  p_owner_uid text,
  p_max_attempts int,
  p_lockout_seconds int
)
returns table(allowed boolean, attempts int, locked_until timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_attempts int;
  v_locked_until timestamptz;
begin
  insert into public.cc_bootstrap_state (owner_uid)
    values (p_owner_uid)
    on conflict (owner_uid) do nothing;

  select s.failed_attempts, s.locked_until
    into v_attempts, v_locked_until
    from public.cc_bootstrap_state s
    where s.owner_uid = p_owner_uid
    for update;

  if v_locked_until is not null and v_locked_until > now() then
    return query select false, v_attempts, v_locked_until;
    return;
  end if;

  if v_locked_until is not null and v_locked_until <= now() then
    v_attempts := 0;
  end if;

  v_attempts := v_attempts + 1;
  if v_attempts >= p_max_attempts then
    v_locked_until := now() + make_interval(secs => p_lockout_seconds);
  else
    v_locked_until := null;
  end if;

  update public.cc_bootstrap_state
    set failed_attempts = v_attempts, locked_until = v_locked_until
    where owner_uid = p_owner_uid;

  return query select (v_locked_until is null), v_attempts, v_locked_until;
end;
$$;

comment on function public.cc_bootstrap_claim_attempt is
  'Atomically claims one bootstrap-secret-guess slot, same FOR UPDATE discipline as cc_trusted_device_claim_pin_attempt. Called before the secret is compared, so every attempt counts whether or not it was correct.';

-- Atomically checks "never consumed" AND performs the first device's
-- enrollment insert under one row lock — closes the race where two
-- concurrent correct-secret calls could both pass a separate check and
-- both enroll (independent review finding). Called only after the
-- secret itself has already compared correct in application code.
create or replace function public.cc_bootstrap_consume_and_enroll(
  p_owner_uid text,
  p_secret_hash text,
  p_expires_at timestamptz,
  p_label text
)
returns table(ok boolean, device_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_consumed_at timestamptz;
  v_device_id uuid;
begin
  insert into public.cc_bootstrap_state (owner_uid)
    values (p_owner_uid)
    on conflict (owner_uid) do nothing;

  select s.consumed_at into v_consumed_at
    from public.cc_bootstrap_state s
    where s.owner_uid = p_owner_uid
    for update;

  if v_consumed_at is not null then
    return query select false, null::uuid;
    return;
  end if;

  insert into public.cc_trusted_devices (owner_uid, secret_hash, label, expires_at)
    values (p_owner_uid, p_secret_hash, p_label, p_expires_at)
    returning id into v_device_id;

  update public.cc_bootstrap_state
    set consumed_at = now(), failed_attempts = 0, locked_until = null
    where owner_uid = p_owner_uid;

  return query select true, v_device_id;
end;
$$;

-- Deliberate, Firebase-gated-only re-arm (independent review finding: the
-- prior design's "self-disable" wasn't durable because it re-opened on a
-- clock; the fix must not just move that same problem into a new flag
-- with no way to ever legitimately recover from a lost bootstrap secret
-- AND a lost/destroyed device). Called only from a route that requires
-- requireFreshFirebaseOwnerSession — never from any DEVICE-classified route.
create or replace function public.cc_bootstrap_reset(p_owner_uid text)
returns void
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
  insert into public.cc_bootstrap_state (owner_uid, consumed_at, failed_attempts, locked_until)
    values (p_owner_uid, null, 0, null)
  on conflict (owner_uid) do update
    set consumed_at = null, failed_attempts = 0, locked_until = null;
$$;

revoke all on function public.cc_bootstrap_claim_attempt(text, int, int) from public, anon, authenticated;
revoke all on function public.cc_bootstrap_consume_and_enroll(text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.cc_bootstrap_reset(text) from public, anon, authenticated;
