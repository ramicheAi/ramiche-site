-- Relay dispatch: terminal-state-aware claiming.
--
-- Precisely what predates this file, because an earlier draft of this comment got it wrong in both
-- directions:
--
--   * the COLUMN relay_claimed HAS a predecessor: 20261112180000_messages_client_idempotency_key.sql
--     adds it. This file therefore does not need to create it, but creates it defensively anyway so
--     it can be applied to a database that never got that migration.
--   * the two FUNCTIONS have no predecessor anywhere in this repo. They exist only here and in the
--     rollback.
--
-- The predecessor's claim predicate was "not claimed, or claimed longer than the lease". That had
-- two proven problems on PostgreSQL 17:
--
--   1. A slow dispatch that outlives the lease lets a second caller claim while the first is still
--      running, so the agent can execute twice concurrently.
--   2. After a successful delivery, the same age-based predicate reclaims the row once the lease
--      ages out, so a retry can dispatch an already-delivered message again.
--
-- The lease must exceed the route's maxDuration (120 s), otherwise a slow turn can be claimed
-- again while it is still running. This migration defaults it to 300 s.
--
-- This migration moves the claim into one atomic statement with an explicit terminal state:
--
--   pending          never dispatched
--   claimed          a caller holds the lease and is dispatching
--   delivered        the turn ran AND its result was recorded (terminal)
--   failed           nothing was ever sent, or the gateway refused before running (retryable)
--   unknown          the turn may have run and its outcome was not recorded (retryable)
--   failed_permanent never retry (terminal)
--
-- delivered and failed_permanent are never reclaimable; claimed is reclaimable only after the
-- lease expires; failed and unknown are reclaimable immediately.
--
-- This is NOT exactly-once execution, and this file does not pretend otherwise. A turn that
-- outlives its lease can still run the agent twice. A dispatch taken while these functions are
-- unavailable does NOT run twice: since CC-RECOVERY-14 the routes fail CLOSED (503, nothing
-- dispatched). An earlier version of this header said they failed open, which was true of the code
-- at the time and is false now. What the states buy is an honest record: a run whose
-- outcome is unknown is never written down as delivered, and is never written down as failed
-- either. 'unknown' is written by the routes, in the transaction of the request that learned the
-- outcome was ambiguous, so it is durable and visible in the row.
--
-- One thing this file deliberately does NOT do: it does not demote an expired 'claimed' row to
-- 'unknown' before re-claiming it. That demotion was in an earlier draft of this migration and an
-- independent review proved it is unobservable — it happens in the same transaction as the claim,
-- so no reader ever sees it, and the row it leaves behind is indistinguishable from one that was
-- reclaimed straight from 'claimed'. A state nobody can ever observe is not an audit trail. The
-- claim simply increments relay_attempts, which IS observable: attempts > 1 on a row means it was
-- dispatched more than once.

-- Self-sufficient: this file may be applied to a database that never got the earlier idempotency
-- migration, and a missing column would only fail at call time inside a swallowed error. Create
-- what this file needs.
alter table public.messages
  add column if not exists relay_claimed boolean not null default false,
  add column if not exists relay_status text not null default 'pending',
  add column if not exists relay_claimed_at timestamptz,
  add column if not exists relay_attempts int not null default 0;

-- Non-terminal rows only: this is the "what is stuck or ambiguous right now" query, which would
-- otherwise sequential-scan a messages table that grows without bound. Partial, so it stays small.
create index if not exists messages_relay_status_idx
  on public.messages (relay_status)
  where relay_status in ('claimed', 'failed', 'unknown');

-- Rows dispatched before this migration have relay_status defaulted to 'pending' by the column add
-- above, which is indistinguishable from "never claimed". Their outcome was never recorded at all,
-- so neither 'delivered' nor 'failed' is true of them: the old system only recorded THAT a dispatch
-- was taken, not what came of it. Mark them 'legacy', which is terminal (never reclaimed) but
-- claims no outcome. Marking them 'delivered' would have asserted a delivery nobody observed;
-- leaving them claimable would re-dispatch messages this host already sent.
-- The lease guard matters on RE-apply, not just on first apply. The still-deployed old route claims
-- by setting relay_claimed = true and leaves relay_status at its default, so a row claimed seconds
-- ago by the running old code looks identical to a row claimed weeks ago by the same code. Without
-- the age condition, re-running this migration during a deploy freezes an attempt that is still in
-- flight, permanently, as `legacy`. A row claimed inside the lease window is left alone: it is
-- either a live dispatch or one whose outcome is still unknown, and neither should be frozen by a
-- migration.
--
-- The age falls back to created_at, never updated_at: every pre-migration row has relay_claimed_at
-- NULL, and updated_at moves for reasons unrelated to a claim, so using it would skip (and then
-- re-dispatch) a row whose record was merely touched recently.
update public.messages
   set relay_status = 'legacy',
       relay_claimed_at = coalesce(relay_claimed_at, created_at, now())
 where relay_claimed = true
   and relay_status = 'pending'
   and coalesce(relay_claimed_at, created_at, now()) < now() - interval '300 seconds';

comment on column public.messages.relay_status is
  'pending | claimed | delivered | failed | unknown | failed_permanent | legacy. delivered, failed_permanent and legacy are terminal and are never reclaimed. failed means nothing was sent (or the gateway refused before running); unknown means the dispatch may have run and its outcome was not recorded; legacy means the dispatch was taken before outcomes were recorded, so nothing is known and it is never retried.';

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
  -- An expired 'claimed' row is reclaimed below, not demoted here first. Demoting it to 'unknown'
  -- inside this same transaction was in an earlier draft and is unobservable: no reader can see the
  -- intermediate value, and the row it leaves behind is identical to one reclaimed straight from
  -- 'claimed'. What IS observable is relay_attempts, incremented by the claim below: attempts > 1
  -- means this message was dispatched more than once, which is the fact an operator needs. The
  -- 'unknown' state remains, written by the routes when a request learns its outcome was
  -- ambiguous.

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
     and coalesce(m.relay_status, 'pending') not in ('delivered', 'failed_permanent', 'legacy')
     and (
       coalesce(m.relay_status, 'pending') in ('pending', 'failed', 'unknown')
       or m.relay_claimed_at is null
       or m.relay_claimed_at < now() - make_interval(secs => greatest(p_lease_seconds, 1))
     )
  returning m.relay_attempts into v_attempts;

  if v_attempts is null then
    select coalesce(m.relay_status, 'pending'), true into v_status, v_found
      from public.messages m
     where m.id = p_message_id;
    if not coalesce(v_found, false) then
      -- No row at all: distinct from "claimed by someone else" so the caller can refuse with a
      -- truthful "no such message" instead of holding a false-forever 409. The caller fails CLOSED
      -- on this, as on every unavailable claim.
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
  if p_status not in ('delivered', 'failed', 'unknown', 'failed_permanent') then
    return false;
  end if;
  update public.messages
     set relay_status = p_status
   where id = p_message_id
     and coalesce(relay_status, 'pending') not in ('delivered', 'failed_permanent', 'legacy')
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
