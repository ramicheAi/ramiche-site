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

  update public.cc_device_enrollment_codes
    set used_at = now()
    where id = v_id;

  return query select true, v_issued_by;
end;
$$;

revoke all on function public.cc_redeem_device_enrollment_code(text, text) from public, anon, authenticated;
