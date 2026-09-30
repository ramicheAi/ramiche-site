-- ParallaxBet Engine — isolated schema in command-center-hq.
-- Fully namespaced under `parallax`; zero interference with existing public tables.
create schema if not exists parallax;

-- ── Bankroll state (append-only history; latest row = current state) ────────────
create table if not exists parallax.bankroll (
  id            bigint generated always as identity primary key,
  current_bankroll numeric not null,
  start_of_day  numeric not null,
  day_date      date not null default (now() at time zone 'utc')::date,
  note          text,
  updated_at    timestamptz not null default now()
);

-- ── Scan cycles (one row per poll of The Odds API) ─────────────────────────────
create table if not exists parallax.scan_runs (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  sports        text[] not null default '{}',
  n_events      int not null default 0,
  n_picks       int not null default 0,
  n_new_edges   int not null default 0,
  api_credits_used int,
  api_credits_remaining int,
  status        text not null default 'running' check (status in ('running','ok','error')),
  error         text
);

-- ── Line history (one row per book/side/scan) — powers CLV + line-move sparklines ─
create table if not exists parallax.odds_snapshots (
  id            bigint generated always as identity primary key,
  scan_run_id   bigint references parallax.scan_runs(id) on delete set null,
  captured_at   timestamptz not null default now(),
  event_id      text not null,
  sport         text,
  game          text,
  commence_time timestamptz,
  market_ref    text not null,
  side          text not null,
  book          text not null,
  decimal_odds  numeric not null,
  fair_prob     numeric
);
create index if not exists odds_snapshots_ref_idx on parallax.odds_snapshots (market_ref, side, captured_at);
create index if not exists odds_snapshots_event_idx on parallax.odds_snapshots (event_id);

-- ── Bets / picks (open -> settled) ─────────────────────────────────────────────
create table if not exists parallax.bets (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  ts_ms         bigint not null,
  bet_day       date not null default (now() at time zone 'utc')::date,
  scan_run_id   bigint references parallax.scan_runs(id) on delete set null,
  sport         text,
  game          text not null,
  commence_time timestamptz,
  market_ref    text not null,
  side          text not null,
  book          text not null,
  entry_decimal_odds numeric not null,
  american      int,
  fair_prob     numeric not null,
  edge          numeric not null,
  ev            numeric not null,
  stake         numeric not null,
  sharp_book    text,
  status        text not null default 'open' check (status in ('open','settled','void','expired')),
  closing_decimal_odds numeric,
  closing_fair_prob    numeric,
  won           boolean,
  clv_pct       numeric,
  pnl           numeric,
  alerted       boolean not null default false,
  settled_at    timestamptz,
  notes         text
);
-- Dedupe backstop: at most one OPEN bet per market/side/book/day (writer also checks first).
create unique index if not exists bets_open_uniq
  on parallax.bets (market_ref, side, book, bet_day) where status = 'open';
create index if not exists bets_status_idx on parallax.bets (status, commence_time);
create index if not exists bets_created_idx on parallax.bets (created_at desc);

-- ── Alerts sent (audit of pushes) ──────────────────────────────────────────────
create table if not exists parallax.alerts (
  id            bigint generated always as identity primary key,
  bet_id        uuid references parallax.bets(id) on delete cascade,
  channel       text not null,
  sent_at       timestamptz not null default now(),
  ok            boolean not null default true,
  detail        text
);

-- ── RLS: read-only for anon/authenticated (the PWA); writes only via service_role ─
alter table parallax.bankroll        enable row level security;
alter table parallax.scan_runs       enable row level security;
alter table parallax.odds_snapshots  enable row level security;
alter table parallax.bets            enable row level security;
alter table parallax.alerts          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bankroll','scan_runs','odds_snapshots','bets','alerts'] loop
    execute format('drop policy if exists "read_all" on parallax.%I', t);
    execute format('create policy "read_all" on parallax.%I for select using (true)', t);
  end loop;
end $$;

-- Grants (RLS + grants are both required for PostgREST access)
grant usage on schema parallax to anon, authenticated, service_role;
grant select on all tables in schema parallax to anon, authenticated;
grant all    on all tables in schema parallax to service_role;
grant all    on all sequences in schema parallax to service_role;
alter default privileges in schema parallax grant select on tables to anon, authenticated;
alter default privileges in schema parallax grant all on tables to service_role;

-- Realtime: stream new bets to the PWA (new-edge toast)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table parallax.bets;
  end if;
exception when duplicate_object then null;
end $$;
