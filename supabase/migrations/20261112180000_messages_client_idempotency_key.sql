-- NOT YET APPLIED TO PRODUCTION. Prepared per CC-RECOVERY-DELIVERY-CONVERGENCE-01
-- for founder review and approval before running against the live database.
-- See ops-handoff/CC-CHAT-IDEMPOTENCY-MIGRATION-SAFETY-2026-11-12.md for the
-- safety proof and rollback.
--
-- Adds a client-generated idempotency key so a lost HTTP response followed by
-- a client retry cannot create two persisted chat messages (CC-RECOVERY-
-- INTEGRATION-01 pre-merge review, finding: "no server-side idempotency on
-- POST"). Additive only: one nullable column, one partial unique index.
-- Agent-authored rows never set this column and are unaffected (NULL values
-- never collide in a unique index).

alter table public.messages
  add column if not exists client_message_id uuid;

comment on column public.messages.client_message_id is
  'Client-generated UUID for one logical send attempt (owner/user sends only). Agent-authored rows leave this NULL. A unique violation on retry means the message already persisted — the route looks the existing row up by this key instead of inserting a duplicate.';

-- Partial unique index: only non-null values participate, so this never
-- constrains pre-existing rows or agent-authored messages that don't set it.
create unique index if not exists messages_client_message_id_key
  on public.messages (client_message_id)
  where client_message_id is not null;
