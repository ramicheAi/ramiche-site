-- Exact rollback for 20261003120000_mission_identity_m1.sql.
--
-- ⚠️ UNLIKE the DM-conversations rollback, this one DESTROYS DATA: it drops the mission tables. Before any mission
-- exists that is harmless. After missions exist, export them first:
--   copy (select * from public.missions)       to stdout with csv header;
--   copy (select * from public.mission_links)  to stdout with csv header;
--   copy (select * from public.mission_events) to stdout with csv header;
-- execution_events rows are never touched: only the foreign key is dropped, and mission_id values stay exactly as they
-- are. Today every mission_id is NULL (the Packet 3 writer hard-codes it), so rollback and a later re-apply are clean.
--
-- ⚠️ AFTER-USE CASE: once a later packet writes real mission_ids, rolling back leaves those values dangling (harmless
-- without the FK, and deliberately NOT rewritten here: this rollback never alters telemetry). Re-applying M1 after
-- that will FAIL CLOSED at `validate constraint execution_events_mission_id_fkey`. That is intended. Resolving it is
-- an explicit data decision (restore the exported missions, or null the orphaned ids), never an automatic one.
-- Check before re-applying:
--   select count(*) from public.execution_events where mission_id is not null;
--
-- DROP TABLE does not fire row or truncate triggers, so the append-only and no-delete guards do not block this.

alter table public.execution_events drop constraint if exists execution_events_mission_id_fkey;

-- mission_transition returns the missions row type, so it must go before the table can.
drop function if exists public.mission_transition(uuid, text, text, text, jsonb, text);

drop table if exists public.mission_events;
drop table if exists public.mission_links;
drop table if exists public.missions;

drop function if exists public.mission_transition_allowed(text, text);
drop function if exists public.missions_guard();
drop function if exists public.missions_after_insert();
drop function if exists public.mission_links_guard();
drop function if exists public.mission_links_after_write();
drop function if exists public.mission_events_guard();
drop function if exists public.mission_no_truncate();
drop function if exists public.mission_internal_on();
drop function if exists public.mission_detail_ok(jsonb);
drop function if exists public.mission_valid_items(jsonb);
drop function if exists public.mission_valid_ident_array(text[]);
drop function if exists public.mission_valid_ident(text);
