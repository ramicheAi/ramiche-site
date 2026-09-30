-- ParallaxBet engine tables (isolated by parallax_ prefix; drop with:
--   drop table parallax_odds_cache, parallax_bets;)

create table if not exists parallax_odds_cache (
  id bigint generated always as identity primary key,
  cache_key text not null unique,          -- e.g. 'featured:soccer_fifa_world_cup' or 'event:<id>:props'
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists parallax_odds_cache_key_idx on parallax_odds_cache (cache_key);

create table if not exists parallax_bets (
  id bigint generated always as identity primary key,
  ts_ms bigint not null,
  event_id text not null,
  market text not null,
  outcome text not null,
  book text not null,
  odds_taken double precision not null,
  p_fair_at_bet double precision,
  stake double precision not null default 0,
  closing_odds double precision,
  clv_pct double precision,
  result text,                              -- 'win' | 'loss' | null pending
  pnl double precision,
  created_at timestamptz not null default now()
);

alter table parallax_odds_cache enable row level security;
alter table parallax_bets enable row level security;

-- Server-side-only access via anon key (keys never ship to the client bundle;
-- our API routes gate writes with an app token).
create policy "parallax anon read cache" on parallax_odds_cache for select to anon using (true);
create policy "parallax anon write cache" on parallax_odds_cache for insert to anon with check (true);
create policy "parallax anon update cache" on parallax_odds_cache for update to anon using (true);
create policy "parallax anon read bets" on parallax_bets for select to anon using (true);
create policy "parallax anon write bets" on parallax_bets for insert to anon with check (true);
create policy "parallax anon update bets" on parallax_bets for update to anon using (true);