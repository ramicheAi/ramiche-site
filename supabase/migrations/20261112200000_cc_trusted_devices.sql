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

-- Looked up by id on every PIN-unlock and every unlock-session verification
-- (i.e. on most authenticated Command Center requests from a trusted
-- device) — this index is load-bearing, not optional.
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
