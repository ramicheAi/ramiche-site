-- NOT YET APPLIED TO PRODUCTION. Prepared per the founder's Priority 1
-- authentication decision (CC-RECOVERY-DELIVERY-CONVERGENCE-01): restore a
-- low-friction PIN unlock on an already-enrolled, Firebase-verified device,
-- without ever letting the PIN alone establish ownership. Requires founder
-- review and approval before running against the live database. See
-- ops-handoff/CC-TRUSTED-DEVICE-AUTH-SAFETY-2026-11-12.md.
--
-- One new table, owned entirely by the Command Center owner boundary. Not
-- referenced by, and does not alter, any existing table, RLS policy, or
-- grant (including the P05-B3 anon lockdown).

create table if not exists public.cc_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  -- The single configured owner uid (PARALLAX_OWNER_UID) this device was
  -- enrolled for. Never trusted from the client — always re-checked against
  -- the live env value, not just stored here, at verification time.
  owner_uid text not null,
  -- SHA-256 hex digest of the device's random secret. The raw secret is
  -- never stored — only ever compared via a fresh hash + timing-safe equal,
  -- same discipline as every other secret in this codebase
  -- (timingSafeSecretEqual in command-center-auth.ts).
  secret_hash text not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  failed_pin_attempts int not null default 0,
  locked_until timestamptz
);

comment on table public.cc_trusted_devices is
  'Devices the Command Center owner has enrolled via a strong Firebase session, allowed to PIN-unlock a short owner session afterward without re-entering Firebase credentials. The PIN never independently establishes ownership — it only unlocks an already-enrolled device/owner relationship, and every verification re-checks owner_uid against the live PARALLAX_OWNER_UID env value.';

-- Primary-key lookups (every PIN-unlock and unlock-session verification
-- looks up by id, already covered by the primary key above) need no extra
-- index. This one instead backs revokeDevice()'s "revoke every device for
-- this owner" query — independent review finding: the comment previously
-- here claimed this index served id lookups, which was never true.
create index if not exists cc_trusted_devices_owner_uid_idx
  on public.cc_trusted_devices (owner_uid)
  where revoked_at is null;

-- Same lockdown posture as every other Command Center table: this table is
-- never read via the anon/authenticated client, only via the service-role
-- key inside the owner-gated server routes that implement enrollment,
-- unlock, and revocation. RLS enabled with zero policies (deny-by-default),
-- identical pattern to the P05-B3 migration.
alter table public.cc_trusted_devices enable row level security;
revoke all on table public.cc_trusted_devices from anon, authenticated;

-- Independent review finding (HIGH): a read-then-write PIN-attempt counter
-- is a classic TOCTOU race — N concurrent requests all read the same
-- "not locked yet" state and each gets to evaluate its own PIN guess
-- before any of their increments land, so the 5-attempt lockout does
-- nothing against a burst of concurrent guesses. A stolen cc_device cookie
-- (no PIN) would otherwise be enough to brute-force the PIN.
--
-- Fixed by making the claim itself atomic: `SELECT ... FOR UPDATE` takes a
-- row lock for the lifetime of the function call, so concurrent callers on
-- the SAME device row are genuinely serialized by Postgres — the second
-- caller's SELECT blocks until the first's function call (and therefore
-- its increment) has committed. This is what actually enforces the limit;
-- the application code never computes "current + 1" itself.
create or replace function public.cc_trusted_device_claim_pin_attempt(
  p_device_id uuid,
  p_max_attempts int,
  p_lockout_seconds int
)
returns table(allowed boolean, attempts int, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_locked_until timestamptz;
begin
  select d.failed_pin_attempts, d.locked_until
    into v_attempts, v_locked_until
    from public.cc_trusted_devices d
    where d.id = p_device_id
    for update;

  if not found then
    return query select false, 0, null::timestamptz;
    return;
  end if;

  if v_locked_until is not null and v_locked_until > now() then
    return query select false, v_attempts, v_locked_until;
    return;
  end if;

  v_attempts := v_attempts + 1;
  if v_attempts >= p_max_attempts then
    v_locked_until := now() + make_interval(secs => p_lockout_seconds);
  else
    v_locked_until := null;
  end if;

  update public.cc_trusted_devices
    set failed_pin_attempts = v_attempts, locked_until = v_locked_until
    where id = p_device_id;

  return query select (v_locked_until is null), v_attempts, v_locked_until;
end;
$$;

comment on function public.cc_trusted_device_claim_pin_attempt is
  'Atomically claims one PIN-attempt slot for a device: increments failed_pin_attempts and sets locked_until under a row lock (SELECT ... FOR UPDATE), so concurrent requests cannot each evaluate their own PIN guess before the others'' increments land. allowed=false means the caller must not even check the PIN this request.';

-- Resets the counter on a successful unlock. Separate function (not folded
-- into the claim above) because it only ever runs after the PIN has
-- actually been verified correct in application code.
create or replace function public.cc_trusted_device_reset_pin_attempts(p_device_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cc_trusted_devices
    set failed_pin_attempts = 0, locked_until = null, last_used_at = now()
    where id = p_device_id;
$$;

revoke all on function public.cc_trusted_device_claim_pin_attempt(uuid, int, int) from public, anon, authenticated;
revoke all on function public.cc_trusted_device_reset_pin_attempts(uuid) from public, anon, authenticated;
