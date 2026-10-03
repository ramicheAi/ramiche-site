-- Exact rollback for 20261003120000_mission_identity_m1.sql.
--
-- FAIL CLOSED AFTER FIRST USE.
--   unused M1 (no mission rows, no telemetry pointing at a mission)  -> rollback permitted
--   used M1   (any mission row, or any execution_events.mission_id)  -> rollback REFUSES; recover forward instead
-- Mission history is never destroyed to make a rollback possible, and telemetry is never rewritten: this script will
-- not null execution_events.mission_id under any circumstance.
--
-- The whole rollback is ONE statement (a single DO block), so it is atomic in every client: psql with or without
-- ON_ERROR_STOP, the Supabase SQL editor, anything. Either every check passes and every drop happens, or the checks
-- refuse and nothing at all has changed. The mission tables are locked ACCESS EXCLUSIVE before the checks run, so no
-- mission (and therefore no telemetry reference to one) can appear between the check and the drop.
--
-- Idempotent: once M1 is gone, re-running finds nothing to check or drop and succeeds.

do $rollback$
declare
  n_missions  bigint := 0;
  n_telemetry bigint := 0;
begin
  if to_regclass('public.missions') is not null then
    lock table public.missions, public.mission_links, public.mission_events in access exclusive mode;
    select count(*) into n_missions from public.missions;
  end if;
  if to_regclass('public.execution_events') is not null then
    select count(*) into n_telemetry from public.execution_events where mission_id is not null;
  end if;

  if n_missions > 0 then
    raise exception 'M1 rollback refused: % mission row(s) exist. Mission data is never destroyed by a rollback; recover forward.', n_missions
      using errcode = 'MI090';
  end if;
  if n_telemetry > 0 then
    raise exception 'M1 rollback refused: % execution_events row(s) reference a mission. Telemetry is never rewritten to permit a rollback; recover forward.', n_telemetry
      using errcode = 'MI091';
  end if;

  -- Unused: safe to remove. Order matters: the FK first, then mission_transition and mission_reassign (they return the
  -- missions row type, so the table cannot be dropped while they exist), then the tables, then the helpers.
  if to_regclass('public.execution_events') is not null then
    execute 'alter table public.execution_events drop constraint if exists execution_events_mission_id_fkey';
  end if;
  execute 'drop function if exists public.mission_transition(uuid, text, text, text, jsonb, text)';
  execute 'drop function if exists public.mission_reassign(uuid, text, text, text[], text, text)';
  execute 'drop table if exists public.mission_events';
  execute 'drop table if exists public.mission_links';
  execute 'drop table if exists public.missions';
  execute 'drop function if exists public.mission_transition_allowed(text, text)';
  execute 'drop function if exists public.missions_guard()';
  execute 'drop function if exists public.missions_after_insert()';
  execute 'drop function if exists public.mission_links_guard()';
  execute 'drop function if exists public.mission_links_after_write()';
  execute 'drop function if exists public.mission_events_guard()';
  execute 'drop function if exists public.mission_no_truncate()';
  execute 'drop function if exists public.mission_internal_on()';
  execute 'drop function if exists public.mission_detail_ok(jsonb)';
  execute 'drop function if exists public.mission_valid_items(jsonb)';
  execute 'drop function if exists public.mission_valid_ident_array(text[])';
  execute 'drop function if exists public.mission_valid_ident(text)';
end
$rollback$;
