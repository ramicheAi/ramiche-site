-- Exact rollback for 20261002110000_dm_conversations.sql.
--
-- Safe at any time: the migration was purely additive. Dropping the columns cannot lose conversation
-- history, because history lives in `messages` keyed by `channel_id`, which this never touched.
--
-- ⚠️ ONE ORDERING RULE: if any NEW conversation channel rows were created after the migration (that is,
-- type='dm' rows whose id is NOT one of the 20 legacy aa0000NN-… ids), dropping `agent_id` makes them
-- unreachable from the UI (orphaned but intact) because nothing else links a channel to an agent.
-- Either leave them, or reassign/delete them deliberately BEFORE rolling back. Inspect first:
--   select id, name, slug, title, created_at from public.channels
--    where type = 'dm' and id <> agent_id order by created_at;

alter table public.channels drop constraint if exists channels_dm_has_agent;
drop index if exists public.channels_type_agent_id_idx;
alter table public.channels drop column if exists title;
alter table public.channels drop column if exists agent_id;
