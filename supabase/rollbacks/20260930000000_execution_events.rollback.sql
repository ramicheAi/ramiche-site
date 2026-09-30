-- Exact rollback for supabase/migrations/20260930000000_execution_events.sql.
-- Removes only the three objects that migration created, in dependency order. It deletes all recorded
-- execution events, so export them first if they are wanted. Apply through the same reviewed manual path.
drop view if exists public.execution_events_with_shadow_cost;
drop table if exists public.model_pricing;
drop table if exists public.execution_events;
