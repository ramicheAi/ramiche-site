-- ============================================================================
-- CC-ORG-FOUNDATION-02 Phase B: channel_principal (NOT APPLIED — file only)
-- Target: Supabase project command-center-hq (qkbkfsjkysdsfmhgfdoc)
-- Source audit: CC-ORG-INTELLIGENCE-01 (ramiche-os PR #51, not yet merged).
-- Parallel lane: ramiche-os is adding schemas/v1/channel_policy.schema.json
--   with a conceptually matching shape (channel_ref, bootstrap_mode,
--   principals[{principal_id, role, permissions, valid_from, valid_until}]).
--   Field names here are kept aligned with that schema on purpose.
--
-- This file was written by an agent operating under hard restrictions: no
-- migration in this file was applied against the live database. Applying
-- any of it (including the proposed/non-applied sections below) is a human
-- decision for a later PR.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. channel_principal — new table. Not referenced by any application code
--    today (chat-routing.ts's fail-closed `bootstrapMode: false` branch is
--    dead-but-correct until something populates and queries this table).
--    RLS enabled, deny-by-default (no policy for anon/authenticated),
--    service_role continues to bypass RLS as it does for every other table
--    in this schema. This documents and reinforces intent; it does not
--    change today's behavior, since there is currently no direct
--    non-service-role path to this data.
-- ----------------------------------------------------------------------------
create table if not exists public.channel_principal (
  id uuid primary key default gen_random_uuid(),
  -- Advisory only — no FK to channels.id on purpose (mirrors channel_policy's
  -- advisory `channel_ref`: a policy can exist for a channel id/slug that
  -- hasn't landed in `channels` yet, or can outlive a channel row).
  principal_id text not null,
  channel_id uuid references public.channels(id),
  role text not null check (role in ('owner', 'member', 'reviewer', 'observer', 'bot')),
  permissions text[] not null default '{}'::text[],
  valid_from timestamptz not null default now(),
  valid_until timestamptz null,
  created_at timestamptz not null default now()
);

comment on table public.channel_principal is
  'CC-ORG-FOUNDATION-02 Phase B. Mirrors ramiche-os channel_policy.principals[] '
  'conceptually. Not yet consumed by any route — see chat-routing.ts '
  'resolveChatTargets() bootstrapMode:false branch for the intended consumer.';

alter table public.channel_principal enable row level security;

-- Deny-by-default: zero policies for anon/authenticated. service_role has
-- BYPASSRLS and needs no policy (same pattern as every other table in this
-- schema per the 2026-09-28 cockpit anon lockdown migration).
revoke all on table public.channel_principal from anon, authenticated;

create index if not exists channel_principal_channel_id_idx
  on public.channel_principal (channel_id);
create index if not exists channel_principal_principal_id_idx
  on public.channel_principal (principal_id);

-- ----------------------------------------------------------------------------
-- 2. channels.archived_at — new nullable column. Migration only; no data
--    migration is included (setting it on specific rows touches live data,
--    which this agent is not permitted to do). The exact statement a human
--    should run to retire the 8 verified March-era orphan duplicate rows
--    (see docs/CC-ORG-AUTHORIZATION-DESIGN-01.md §5 for how they were found)
--    is proposed below as a comment, NOT executed.
-- ----------------------------------------------------------------------------
alter table public.channels add column if not exists archived_at timestamptz null;

comment on column public.channels.archived_at is
  'CC-ORG-FOUNDATION-02 Phase B. Set to retire a channel row without deleting '
  'it (e.g. the March-era bb0000xx orphan duplicates of the real team '
  'channels). Not set by this migration; see the proposed UPDATE below.';

-- PROPOSED — NOT EXECUTED. For a human to run after independently confirming
-- these 8 ids are still the orphaned March-era rows (zero channel_members
-- rows, not referenced by DEFAULT_CHANNELS or any other frontend code) and
-- after deciding archival (not deletion) is the right remediation:
--
-- update public.channels set archived_at = now()
-- where id in (
--   'bb000001-0000-0000-0000-000000000000', -- Security Team (orphan; real id 77777777-...)
--   'bb000002-0000-0000-0000-000000000000', -- Finance Team (orphan; real id 88888888-...)
--   'bb000003-0000-0000-0000-000000000000', -- Sales Team (orphan; real id 99999999-...)
--   'bb000004-0000-0000-0000-000000000000', -- Strategy Team (orphan; real id aaaaaaaa-...)
--   'bb000005-0000-0000-0000-000000000000', -- Legal Team (orphan; real id bbbbbbbb-...)
--   'bb000006-0000-0000-0000-000000000000', -- Content Team (orphan; real id cccccccc-...)
--   'bb000007-0000-0000-0000-000000000000', -- Wellness Team (orphan; real id dddddddd-...)
--   'bb000008-0000-0000-0000-000000000000'  -- Creative Team (orphan; real id ffffffff-...)
-- )
-- and archived_at is null;
--
-- NOTE: independent re-verification during this task (2026-11-08) found 8
-- orphan/real pairs, not the 6 named in this mission's brief — Content Team
-- and Creative Team are duplicated the same way and were missing from the
-- brief's list. A 9th live duplicate, "DM: Triage" (a DM channel, not a team
-- channel; the second row was created 2026-10-03, not in the March/May
-- pattern), is NOT included above — it doesn't fit this remediation's
-- pattern and should be triaged separately.

-- ----------------------------------------------------------------------------
-- 3. Least-privilege RLS policies — PROPOSED, NOT APPLIED. In scope for this
--    mission: channels, channel_members, agent_profiles, messages, missions,
--    jobs, execution_events. Out of scope (other domains, not touched here
--    or proposed below): daily_verses, model_pricing, tenants, pipeline_*.
--
--    Context verified live on 2026-11-08: channels, channel_members,
--    agent_profiles, messages, missions and execution_events already have
--    NO anon/authenticated grants (channels/channel_members/agent_profiles/
--    messages were revoked by the 2026-09-28 cockpit anon lockdown
--    migration; missions/execution_events appear to have never been
--    granted). `jobs` is the one exception: it STILL holds full
--    SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants for both
--    anon and authenticated (left as-is by that same migration "to avoid
--    changing error semantics for existing callers" per its own comment).
--    RLS-enabled-with-no-policy already denies all rows to non-service-role
--    callers on every one of these tables today, so none of this changes
--    current behavior — it is the same belt-and-suspenders pattern as the
--    2026-09-28 migration, extended to the tables this mission touches.
--    A human should decide the correct per-role policy shape (what should
--    authenticated actually be allowed to read/write here, if anything) —
--    these are a snug default-deny starting point, not a finished design.
-- ----------------------------------------------------------------------------

-- do $$ begin
--   -- channels: service_role only (snug deny-by-default; no authenticated
--   -- read path exists in the app today — it uses the service role key).
--   create policy "channel_principal_design_deny_all_channels"
--     on public.channels for all to authenticated using (false) with check (false);
--
--   create policy "channel_principal_design_deny_all_channel_members"
--     on public.channel_members for all to authenticated using (false) with check (false);
--
--   create policy "channel_principal_design_deny_all_agent_profiles"
--     on public.agent_profiles for all to authenticated using (false) with check (false);
--
--   create policy "channel_principal_design_deny_all_messages"
--     on public.messages for all to authenticated using (false) with check (false);
--
--   create policy "channel_principal_design_deny_all_missions"
--     on public.missions for all to authenticated using (false) with check (false);
--
--   create policy "channel_principal_design_deny_all_execution_events"
--     on public.execution_events for all to authenticated using (false) with check (false);
--
--   -- jobs also needs its lingering anon/authenticated GRANTs revoked before
--   -- a policy is the meaningful boundary (today RLS-with-no-policy already
--   -- denies rows despite the grants, but closing the grant gap removes a
--   -- single point of failure if a permissive policy is ever added by
--   -- mistake).
--   revoke all on table public.jobs from anon, authenticated;
--   create policy "channel_principal_design_deny_all_jobs"
--     on public.jobs for all to authenticated using (false) with check (false);
-- end $$;
