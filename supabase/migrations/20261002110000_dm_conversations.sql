-- P06: multiple DM conversations per agent.
--
-- NOT APPLIED ANYWHERE. Do not run `supabase db push`, a schema diff or a migration repair against the
-- remote project: the P05-B3 migration was applied through execute_sql and its migration-history row is
-- missing, so those commands would misreport or try to reapply B3. Apply this file only through the reviewed
-- manual path (explicit approval, hash-checked SQL, rollback ready). Exact rollback:
-- supabase/rollbacks/20261002110000_dm_conversations.rollback.sql
--
-- WHY: a DM channel's id was ALSO the agent's identity uuid (channels.id = agent registry dmUuid =
-- messages.sender_agent_id). One value meant two things, so an agent could only ever have one conversation.
-- This splits them: the agent stays its registry uuid, and a conversation becomes any channel row that
-- points at that agent. Purely additive. No existing channel id changes and no message row is touched.

alter table public.channels add column if not exists agent_id uuid;
alter table public.channels add column if not exists title text;

comment on column public.channels.agent_id is
  'For type=''dm'': the agent this conversation belongs to (the registry dmUuid, same value used as messages.sender_agent_id). NULL for group/project channels. An agent may own many dm channels.';
comment on column public.channels.title is
  'Optional human label for a dm conversation. NULL means fall back to the channel name.';

-- Backfill the 20 legacy DM rows. Correct precisely BECAUSE of the old conflation: for those rows the
-- channel id already IS the agent uuid. Touches no other row and changes no id.
update public.channels
   set agent_id = id
 where type = 'dm'
   and agent_id is null;

-- The only new access path: "every conversation for this agent".
create index if not exists channels_type_agent_id_idx
    on public.channels (type, agent_id);

-- Guard the invariant going forward: a dm row must name its agent, a non-dm row must not.
-- NOT VALID so it applies to new/updated rows without re-scanning or risking existing data.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'channels_dm_has_agent') then
    alter table public.channels
      add constraint channels_dm_has_agent
      check ((type = 'dm' and agent_id is not null) or (type <> 'dm' and agent_id is null))
      not valid;
  end if;
end $$;
