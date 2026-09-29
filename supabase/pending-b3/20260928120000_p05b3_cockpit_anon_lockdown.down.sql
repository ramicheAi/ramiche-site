-- ============================================================================
-- P05-B3 ROLLBACK: restores the exact pre-B3 state recorded in
-- supabase/baseline/live-schema-2026-09-28.sql (policies, grants, view mode,
-- function execute). Idempotent.
-- Re-opens the anon exposure; use only if the B3 change breaks production and
-- cannot be fixed forward.
-- ============================================================================
begin;

grant all on table
  public.messages, public.message_reactions, public.channels,
  public.channel_members, public.agent_profiles, public.tenants
  to anon, authenticated;

drop policy if exists "Allow all on messages" on public.messages;
create policy "Allow all on messages" on public.messages as permissive for all to public using (true);
drop policy if exists "Enable read access for all users" on public.messages;
create policy "Enable read access for all users" on public.messages as permissive for select to public using (true);
drop policy if exists "Enable read access for all users" on public.message_reactions;
create policy "Enable read access for all users" on public.message_reactions as permissive for select to public using (true);
drop policy if exists "Allow all on channels" on public.channels;
create policy "Allow all on channels" on public.channels as permissive for all to public using (true);
drop policy if exists "Allow all on channel_members" on public.channel_members;
create policy "Allow all on channel_members" on public.channel_members as permissive for all to public using (true);
drop policy if exists "Allow all on agent_profiles" on public.agent_profiles;
create policy "Allow all on agent_profiles" on public.agent_profiles as permissive for all to public using (true);
drop policy if exists "Allow all on tenants" on public.tenants;
create policy "Allow all on tenants" on public.tenants as permissive for all to public using (true);

alter view public.pipeline_metrics reset (security_invoker);
grant all on table public.pipeline_metrics to anon, authenticated;

-- Live ACL (2026-09-28): =X, anon=X, authenticated=X, postgres=X, service_role=X (service_role is kept by the up migration).
grant execute on function public.pg_publication_tables_for(text) to public, anon, authenticated;

commit;
