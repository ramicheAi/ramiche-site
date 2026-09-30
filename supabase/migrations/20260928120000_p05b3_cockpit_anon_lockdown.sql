-- ============================================================================
-- P05-B3: cockpit anon lockdown (PREPARED IN P05-B2, NOT APPLIED)
-- Target: Supabase project command-center-hq (qkbkfsjkysdsfmhgfdoc)
-- Requires: separate Ramon approval; the P05-B2 application changes deployed
--           and verified FIRST (the cockpit must no longer read/write these
--           tables with the anon key).
-- Rollback: supabase/pending-b3/20260928120000_p05b3_cockpit_anon_lockdown.down.sql
--
-- Scope (minimum): Class-A private cockpit data only.
--   * messages, message_reactions, channels, channel_members, agent_profiles, tenants:
--       drop the allow-all / read-all policies; revoke all table privileges from
--       anon + authenticated. RLS stays ENABLED with no policies (deny by default)
--       as defense in depth. service_role (BYPASSRLS + its own grants) is unchanged.
--   * pipeline_metrics: SECURITY DEFINER-style view -> security_invoker, and revoke
--       from anon + authenticated (it aggregated pipeline_leads while bypassing RLS).
--   * pg_publication_tables_for(text): execute limited to service_role.
-- Deliberately NOT changed:
--   * parallax.*, public.pbx_*, public.parallax_bets, public.parallax_odds_cache
--     (Parallax Bet product; separate decision).
--   * public.baba_call_time_rsvp anon INSERT (public RSVP form).
--   * pipeline_leads/events/gate/proposals, jobs, job_events, daily_verses
--     (already deny anon via RLS-without-policy; grants left as-is to avoid
--     changing error semantics for existing callers).
--   * supabase_realtime publication membership (the owner-only SSE relay uses it
--     with the service role; anon subscribers receive nothing once SELECT is revoked).
--   * Storage (agent-output stays public, by decision).
-- Idempotent: safe to re-run.
-- ============================================================================
begin;

-- 1. Chat / tenant tables
drop policy if exists "Allow all on messages" on public.messages;
drop policy if exists "Enable read access for all users" on public.messages;
drop policy if exists "Enable read access for all users" on public.message_reactions;
drop policy if exists "Allow all on channels" on public.channels;
drop policy if exists "Allow all on channel_members" on public.channel_members;
drop policy if exists "Allow all on agent_profiles" on public.agent_profiles;
drop policy if exists "Allow all on tenants" on public.tenants;

alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.tenants enable row level security;

revoke all on table
  public.messages, public.message_reactions, public.channels,
  public.channel_members, public.agent_profiles, public.tenants
  from anon, authenticated;

-- 2. Pipeline revenue aggregate
alter view public.pipeline_metrics set (security_invoker = on);
revoke all on table public.pipeline_metrics from anon, authenticated;

-- 3. Catalog helper function
revoke execute on function public.pg_publication_tables_for(text) from public, anon, authenticated;
grant execute on function public.pg_publication_tables_for(text) to service_role;

commit;
