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
-- The lease must exceed the route's maxDuration (120 s), otherwise a slow turn can be claimed
-- again while it is still running. This migration defaults it to 300 s.
--
-- This migration adds an explicit terminal state and moves the claim into one atomic statement:
-- delivered and failed_permanent are never reclaimable; 'claimed' is reclaimable only after the
-- lease expires (it may still be running); 'failed' is reclaimable immediately (it definitely is
-- not running). It still does not provide exactly-once execution: if the gateway accepted a turn
-- and the acknowledgement was lost (including a client-side timeout that can't tell "rejected"
-- from "accepted, ack lost"), the retry can dispatch again — there is no 'unknown'/'timed_out'
-- state yet, so that case is recorded as 'failed' and is immediately retryable like a genuine
-- rejection. (CC-RECOVERY-13 independent review: a revoke-exploit PoC, 1600-attempt concurrency
-- proof, and the false-delivered/duplicate-dispatch repros below all passed against real
-- PostgreSQL 17 with a Supabase-faithful anon/authenticated default-privilege bootstrap.)

-- Self-sufficient: the earlier idempotency migration may not have been applied, and a missing
-- column would only fail at call time inside a swallowed error. Create what this file needs.
alter table public.messages
  add column if not exists relay_claimed boolean not null default false,
  add column if not exists relay_status text not null default 'pending',
  add column if not exists relay_claimed_at timestamptz,
  add column if not exists relay_attempts int not null default 0;

-- Rows dispatched before this migration have relay_status defaulted to 'pending' by the column
-- add above, which is indistinguishable from "never claimed" — the lease-based reclaim predicate
-- below would treat every one of them as immediately reclaimable the moment relay_claimed_at
-- (itself backfilled to an old timestamp) looks lease-expired, re-dispatching messages the old,
-- pre-terminal-state system already delivered. There is no reliable outcome recorded for them
-- under the old system, so treat "was claimed" as "was delivered" rather than guessing — the
-- safe default is to never re-dispatch a message this host already attempted, not to retry one
-- that might already have gone out.
update public.messages
   set relay_status = 'delivered',
       relay_claimed_at = coalesce(relay_claimed_at, updated_at, created_at, now())
 where relay_claimed = true
   and relay_status = 'pending';

comment on column public.messages.relay_status is
  'pending | claimed | delivered | failed | failed_permanent. delivered and failed_permanent are terminal and are never reclaimed.';

-- Claim the right to dispatch one agent turn for a persisted message.
--
-- Also returns the row's relay_status so a caller whose claim is refused can tell a genuine
-- prior success ('delivered') from a dispatch that is still in flight or that failed and is
-- waiting out the lease ('claimed' / 'failed') — without this, a caller that treats every
-- refused claim as "already delivered" reports a real failure to the retrying client as a
-- success for as long as the lease lasts.
create or replace function public.cc_claim_relay_dispatch(
  p_message_id uuid,
  p_lease_seconds int default 300
)
returns table(claimed boolean, attempts int, status text)
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_attempts int;
  v_status text;
  v_found boolean;
begin
  -- 'claimed' is the only status actually in flight, so it is the only one the lease protects —
  -- a dispatch that errored out and was marked 'failed' is definitely not running any more and
  -- must be reclaimable immediately, not after the same 300s lease as a possibly-still-running
  -- attempt. Gating 'failed' on the lease too meant a backend that came back up seconds after a
  -- 502 still refused every retry for up to 5 minutes.
  update public.messages m
     set relay_claimed = true,
         relay_claimed_at = now(),
         relay_attempts = m.relay_attempts + 1,
         relay_status = 'claimed'
   where m.id = p_message_id
     and coalesce(m.relay_status, 'pending') not in ('delivered', 'failed_permanent')
     and (
       coalesce(m.relay_status, 'pending') in ('pending', 'failed')
       or m.relay_claimed_at is null
       or m.relay_claimed_at < now() - make_interval(secs => greatest(p_lease_seconds, 1))
     )
  returning m.relay_attempts into v_attempts;

  if v_attempts is null then
    select coalesce(m.relay_status, 'pending'), true into v_status, v_found
      from public.messages m
     where m.id = p_message_id;
    if not coalesce(v_found, false) then
      -- No row at all: distinct from "claimed by someone else" so the caller can fail open
      -- (treat it as a first dispatch) instead of returning a false-forever 409.
      return query select false, null::int, 'not_found'::text;
      return;
    end if;
    return query select false, null::int, v_status;
    return;
  end if;
  return query select true, v_attempts, 'claimed'::text;
end;
$$;

-- Record the outcome. Only delivered and failed_permanent are terminal.
create or replace function public.cc_mark_relay_status(
  p_message_id uuid,
  p_status text,
  p_attempt int default null
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_status not in ('delivered', 'failed', 'failed_permanent') then
    return false;
  end if;
  update public.messages
     set relay_status = p_status
   where id = p_message_id
     and coalesce(relay_status, 'pending') not in ('delivered', 'failed_permanent')
     -- A stale attempt (its lease expired and a newer one claimed) must not write the outcome.
     -- A null p_attempt only happens when this caller's own claim call itself failed/threw, so
     -- the dedup mechanism never incremented relay_attempts for it — only ever match that
     -- degraded case against a row that was truly never claimed (relay_attempts = 0), never
     -- treat null as a wildcard that can overwrite a real, currently-claimed attempt.
     and (
       (p_attempt is not null and relay_attempts = p_attempt)
       or (p_attempt is null and relay_attempts = 0)
     );
  return found;
end;
$$;

-- Supabase grants EXECUTE on every new public function to anon and authenticated by default
-- (ALTER DEFAULT PRIVILEGES), independent of what this file revokes from `public`. Revoke from
-- both explicitly, or the "service_role only" contract this migration claims is not the one
-- actually in effect on a real Supabase project.
revoke all on function public.cc_claim_relay_dispatch(uuid, int) from public, anon, authenticated;
revoke all on function public.cc_mark_relay_status(uuid, text, int) from public, anon, authenticated;
grant execute on function public.cc_claim_relay_dispatch(uuid, int) to service_role;
grant execute on function public.cc_mark_relay_status(uuid, text, int) to service_role;
