-- PostgREST already serves `public`. Expose the isolated parallax tables through
-- thin security_invoker views (so the base tables' RLS + grants govern access).
-- Data stays isolated in `parallax`; `public.pbx_*` is only the API surface.
create or replace view public.pbx_bankroll       with (security_invoker=on) as select * from parallax.bankroll;
create or replace view public.pbx_scan_runs      with (security_invoker=on) as select * from parallax.scan_runs;
create or replace view public.pbx_odds_snapshots with (security_invoker=on) as select * from parallax.odds_snapshots;
create or replace view public.pbx_bets           with (security_invoker=on) as select * from parallax.bets;
create or replace view public.pbx_alerts         with (security_invoker=on) as select * from parallax.alerts;

grant select on public.pbx_bankroll, public.pbx_scan_runs, public.pbx_odds_snapshots, public.pbx_bets, public.pbx_alerts to anon, authenticated;
grant all    on public.pbx_bankroll, public.pbx_scan_runs, public.pbx_odds_snapshots, public.pbx_bets, public.pbx_alerts to service_role;

-- Seed starting bankroll ($1000 — the default the engine assumes).
insert into parallax.bankroll (current_bankroll, start_of_day, note)
values (1000, 1000, 'initial seed');