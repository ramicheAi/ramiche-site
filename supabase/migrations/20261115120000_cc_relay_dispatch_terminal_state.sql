-- Relay dispatch: terminal-state-aware claiming.
--
-- The earlier idempotency migration added relay_claimed but the claim predicate the route used
-- was "not claimed, or claimed longer than the lease". Two problems were proven on PostgreSQL 17:
--
--   1. A slow dispatch that outlives the lease lets a second caller claim while the first is still
--      running, so the agent can execute twice concurrently.
--   2. After a successful delivery, the same age-based predicate reclaims the row once the lease
--      ages out, so a retry can dispatch an already-delivered message again.
--
-- This migration adds an explicit terminal state and moves the claim into one atomic statement:
-- delivered and failed_permanent are never reclaimable; claimed/failed rows are reclaimable only
-- after the lease expires. It still does not provide exactly-once execution: if the gateway
-- accepted a turn and the acknowledgement was lost, the retry can dispatch again after the lease.

alter table public.messages
  add column if not exists relay_status text not null default 'pending',
  add column if not exists relay_claimed_at timestamptz,
  add column if not exists relay_attempts int not null default 0;

comment on column public.messages.relay_status is
  'pending | claimed | delivered | failed | failed_permanent. delivered and failed_permanent are terminal and are never reclaimed.';

create index if not exists messages_relay_status_idx
  on public.messages (relay_status)
  where relay_status in ('claimed', 'failed');

-- Claim the right to dispatch one agent turn for a persisted message.
create or replace function public.cc_claim_relay_dispatch(
  p_message_id uuid,
  p_lease_seconds int default 120
)
returns table(claimed boolean, attempts int)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_attempts int;
begin
  update public.messages m
     set relay_claimed = true,
         relay_claimed_at = now(),
         relay_attempts = m.relay_attempts + 1,
         relay_status = 'claimed'
   where m.id = p_message_id
     and coalesce(m.relay_status, 'pending') not in ('delivered', 'failed_permanent')
     and (m.relay_claimed = false or m.relay_claimed_at is null
          or m.relay_claimed_at < now() - make_interval(secs => greatest(p_lease_seconds, 1)))
  returning m.relay_attempts into v_attempts;

  if v_attempts is null then
    return query select false, null::int;
    return;
  end if;
  return query select true, v_attempts;
end;
$$;

-- Record the outcome. Only delivered and failed_permanent are terminal.
create or replace function public.cc_mark_relay_status(
  p_message_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_status not in ('delivered', 'failed', 'failed_permanent') then
    return false;
  end if;
  update public.messages
     set relay_status = p_status
   where id = p_message_id
     and coalesce(relay_status, 'pending') not in ('delivered', 'failed_permanent');
  return found;
end;
$$;

revoke all on function public.cc_claim_relay_dispatch(uuid, int) from public;
revoke all on function public.cc_mark_relay_status(uuid, text) from public;
grant execute on function public.cc_claim_relay_dispatch(uuid, int) to service_role;
grant execute on function public.cc_mark_relay_status(uuid, text) to service_role;
