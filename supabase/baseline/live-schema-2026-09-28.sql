-- ============================================================================
-- LIVE SCHEMA BASELINE (schema only, no rows, no secrets)
-- Source: Supabase project command-center-hq (qkbkfsjkysdsfmhgfdoc), read-only
-- catalog queries on 2026-09-28 (P05-B2). Scope: schemas public + parallax,
-- their grants/RLS/policies, the supabase_realtime publication membership and
-- storage bucket configuration.
--
-- This is EVIDENCE of current production structure, not desired architecture.
-- It includes the insecure allow-all policies and anon grants on purpose, so the
-- P05-B3 migration can be tested against a faithful copy.
-- Not part of supabase/migrations (the existing migration chain already creates
-- some of these objects); see P05-B2 schema-drift report.
-- Platform-managed objects (auth, storage internals, realtime) are NOT included;
-- the local test prelude provides minimal stand-ins.
-- ============================================================================

create schema if not exists parallax;

-- ── tables ──────────────────────────────────────────────────────────────────
create table parallax.scan_runs (
  id bigint generated always as identity not null,
  started_at timestamp with time zone default now() not null,
  finished_at timestamp with time zone,
  sports text[] default '{}'::text[] not null,
  n_events integer default 0 not null,
  n_picks integer default 0 not null,
  n_new_edges integer default 0 not null,
  api_credits_used integer,
  api_credits_remaining integer,
  status text default 'running'::text not null,
  error text
);
create table parallax.bets (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  ts_ms bigint not null,
  bet_day date default ((now() AT TIME ZONE 'utc'::text))::date not null,
  scan_run_id bigint,
  sport text,
  game text not null,
  commence_time timestamp with time zone,
  market_ref text not null,
  side text not null,
  book text not null,
  entry_decimal_odds numeric not null,
  american integer,
  fair_prob numeric not null,
  edge numeric not null,
  ev numeric not null,
  stake numeric not null,
  sharp_book text,
  status text default 'open'::text not null,
  closing_decimal_odds numeric,
  closing_fair_prob numeric,
  won boolean,
  clv_pct numeric,
  pnl numeric,
  alerted boolean default false not null,
  settled_at timestamp with time zone,
  notes text
);
create table parallax.alerts (
  id bigint generated always as identity not null,
  bet_id uuid,
  channel text not null,
  sent_at timestamp with time zone default now() not null,
  ok boolean default true not null,
  detail text
);
create table parallax.bankroll (
  id bigint generated always as identity not null,
  current_bankroll numeric not null,
  start_of_day numeric not null,
  day_date date default ((now() AT TIME ZONE 'utc'::text))::date not null,
  note text,
  updated_at timestamp with time zone default now() not null
);
create table parallax.odds_snapshots (
  id bigint generated always as identity not null,
  scan_run_id bigint,
  captured_at timestamp with time zone default now() not null,
  event_id text not null,
  sport text,
  game text,
  commence_time timestamp with time zone,
  market_ref text not null,
  side text not null,
  book text not null,
  decimal_odds numeric not null,
  fair_prob numeric
);
create table public.tenants (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  logo_url text,
  created_at timestamp with time zone default now()
);
create table public.agent_profiles (
  id uuid default gen_random_uuid() not null,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  name text not null,
  handle text not null,
  model text,
  status text default 'active'::text,
  color_hex text default '#7C3AED'::text,
  avatar_url text,
  skills jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);
create table public.baba_call_time_rsvp (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now() not null,
  event_name text default 'CALL TIME'::text not null,
  event_date date not null,
  full_name text not null,
  mobile text not null,
  instagram text,
  is_adult boolean not null,
  agreed_terms boolean not null,
  signature_name text not null,
  sms_consent boolean default false not null,
  terms_version text not null,
  user_agent text
);
create table public.channels (
  id uuid default gen_random_uuid() not null,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  name text not null,
  slug text not null,
  type text not null,
  description text,
  is_private boolean default false,
  last_activity_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);
create table public.channel_members (
  id uuid default gen_random_uuid() not null,
  channel_id uuid not null,
  agent_id uuid not null,
  role text default 'member'::text,
  joined_at timestamp with time zone default now()
);
create table public.daily_verses (
  id uuid default gen_random_uuid() not null,
  verse_date date not null,
  reference text not null,
  verse_text text not null,
  reflection text,
  context_summary text,
  source text,
  created_at timestamp with time zone default now() not null
);
create table public.jobs (
  id uuid default gen_random_uuid() not null,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  title text not null,
  kind text default 'generic'::text not null,
  agent text,
  status text default 'queued'::text not null,
  source text,
  input jsonb default '{}'::jsonb,
  result text,
  error text,
  progress text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone
);
create table public.job_events (
  id uuid default gen_random_uuid() not null,
  job_id uuid,
  kind text default 'log'::text not null,
  detail jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);
create table public.messages (
  id uuid default gen_random_uuid() not null,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  channel_id uuid not null,
  sender_agent_id uuid,
  content text not null,
  attachments jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  sender_user_id uuid,
  sender_type text default 'agent'::text,
  metadata jsonb default '{}'::jsonb,
  thread_parent_id uuid,
  is_pinned boolean default false,
  updated_at timestamp with time zone default now(),
  pinned boolean default false,
  status text default 'delivered'::text
);
create table public.message_reactions (
  id uuid default gen_random_uuid() not null,
  message_id uuid,
  user_id text not null,
  emoji text not null,
  created_at timestamp with time zone default now()
);
create table public.parallax_bets (
  id bigint generated always as identity not null,
  ts_ms bigint not null,
  event_id text not null,
  market text not null,
  outcome text not null,
  book text not null,
  odds_taken double precision not null,
  p_fair_at_bet double precision,
  stake double precision default 0 not null,
  closing_odds double precision,
  clv_pct double precision,
  result text,
  pnl double precision,
  created_at timestamp with time zone default now() not null
);
create table public.parallax_odds_cache (
  id bigint generated always as identity not null,
  cache_key text not null,
  payload jsonb not null,
  fetched_at timestamp with time zone default now() not null
);
create table public.pipeline_leads (
  id uuid default gen_random_uuid() not null,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  name text,
  company text,
  contact_email text,
  contact_title text,
  product text,
  stage text default 'lead'::text not null,
  value numeric default 0,
  source text,
  owner text,
  tags text[] default '{}'::text[],
  notes text,
  meta jsonb default '{}'::jsonb,
  last_contact timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  feed text default 'agency'::text not null,
  source_signal text,
  closed_signal text
);
create table public.pipeline_events (
  id uuid default gen_random_uuid() not null,
  lead_id uuid,
  kind text not null,
  detail jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);
create table public.pipeline_gate (
  id uuid default gen_random_uuid() not null,
  created_at timestamp with time zone default now(),
  feed text,
  lead_id uuid,
  kind text not null,
  title text not null,
  why text,
  dollar_impact numeric default 0,
  payload jsonb default '{}'::jsonb,
  requested_by text,
  status text default 'pending'::text not null,
  decided_at timestamp with time zone,
  decided_by text
);
create table public.pipeline_proposals (
  id uuid default gen_random_uuid() not null,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  lead_id uuid,
  product text,
  tier text,
  monthly_price numeric,
  discount_pct numeric default 0,
  projected_roi_pct numeric,
  annual_value numeric,
  valid_until date,
  status text default 'draft'::text not null,
  terms jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ── constraints (primary keys first, then unique/check, then foreign keys) ──
alter table parallax.scan_runs add constraint scan_runs_pkey PRIMARY KEY (id);
alter table parallax.scan_runs add constraint scan_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'error'::text])));
alter table parallax.bets add constraint bets_pkey PRIMARY KEY (id);
alter table parallax.bets add constraint bets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'settled'::text, 'void'::text, 'expired'::text])));
alter table parallax.alerts add constraint alerts_pkey PRIMARY KEY (id);
alter table parallax.bankroll add constraint bankroll_pkey PRIMARY KEY (id);
alter table parallax.odds_snapshots add constraint odds_snapshots_pkey PRIMARY KEY (id);
alter table public.tenants add constraint tenants_pkey PRIMARY KEY (id);
alter table public.tenants add constraint tenants_slug_key UNIQUE (slug);
alter table public.agent_profiles add constraint agent_profiles_pkey PRIMARY KEY (id);
alter table public.agent_profiles add constraint agent_profiles_handle_key UNIQUE (handle);
alter table public.baba_call_time_rsvp add constraint baba_call_time_rsvp_pkey PRIMARY KEY (id);
alter table public.baba_call_time_rsvp add constraint baba_rsvp_must_be_adult CHECK ((is_adult = true));
alter table public.baba_call_time_rsvp add constraint baba_rsvp_must_agree CHECK ((agreed_terms = true));
alter table public.channels add constraint channels_pkey PRIMARY KEY (id);
alter table public.channels add constraint channels_tenant_id_slug_key UNIQUE (tenant_id, slug);
alter table public.channel_members add constraint channel_members_pkey PRIMARY KEY (id);
alter table public.daily_verses add constraint daily_verses_pkey PRIMARY KEY (id);
alter table public.daily_verses add constraint daily_verses_verse_date_key UNIQUE (verse_date);
alter table public.jobs add constraint jobs_pkey PRIMARY KEY (id);
alter table public.jobs add constraint jobs_kind_check CHECK ((kind = ANY (ARRAY['generic'::text, 'dev'::text, 'design'::text, 'prospect'::text, 'outreach'::text, 'content'::text, 'analysis'::text])));
alter table public.jobs add constraint jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'canceled'::text])));
alter table public.job_events add constraint job_events_pkey PRIMARY KEY (id);
alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
alter table public.message_reactions add constraint message_reactions_pkey PRIMARY KEY (id);
alter table public.message_reactions add constraint message_reactions_message_id_user_id_emoji_key UNIQUE (message_id, user_id, emoji);
alter table public.parallax_bets add constraint parallax_bets_pkey PRIMARY KEY (id);
alter table public.parallax_odds_cache add constraint parallax_odds_cache_pkey PRIMARY KEY (id);
alter table public.parallax_odds_cache add constraint parallax_odds_cache_cache_key_key UNIQUE (cache_key);
alter table public.pipeline_leads add constraint pipeline_leads_pkey PRIMARY KEY (id);
alter table public.pipeline_leads add constraint pipeline_leads_stage_check CHECK ((stage = ANY (ARRAY['lead'::text, 'qualified'::text, 'proposal'::text, 'negotiation'::text, 'closed'::text, 'lost'::text])));
alter table public.pipeline_events add constraint pipeline_events_pkey PRIMARY KEY (id);
alter table public.pipeline_gate add constraint pipeline_gate_pkey PRIMARY KEY (id);
alter table public.pipeline_gate add constraint pipeline_gate_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'executed'::text])));
alter table public.pipeline_gate add constraint pipeline_gate_kind_check CHECK ((kind = ANY (ARRAY['send'::text, 'publish'::text, 'spend'::text, 'price'::text, 'close'::text, 'other'::text])));
alter table public.pipeline_proposals add constraint pipeline_proposals_pkey PRIMARY KEY (id);
alter table public.pipeline_proposals add constraint pipeline_proposals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'expired'::text])));
alter table parallax.alerts add constraint alerts_bet_id_fkey FOREIGN KEY (bet_id) REFERENCES parallax.bets(id) ON DELETE CASCADE;
alter table parallax.bets add constraint bets_scan_run_id_fkey FOREIGN KEY (scan_run_id) REFERENCES parallax.scan_runs(id) ON DELETE SET NULL;
alter table parallax.odds_snapshots add constraint odds_snapshots_scan_run_id_fkey FOREIGN KEY (scan_run_id) REFERENCES parallax.scan_runs(id) ON DELETE SET NULL;
alter table public.job_events add constraint job_events_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
alter table public.message_reactions add constraint message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
alter table public.messages add constraint messages_thread_parent_id_fkey FOREIGN KEY (thread_parent_id) REFERENCES public.messages(id);
alter table public.pipeline_events add constraint pipeline_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.pipeline_leads(id) ON DELETE CASCADE;
alter table public.pipeline_gate add constraint pipeline_gate_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;
alter table public.pipeline_proposals add constraint pipeline_proposals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.pipeline_leads(id) ON DELETE SET NULL;

-- ── indexes ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX bets_open_uniq ON parallax.bets USING btree (market_ref, side, book, bet_day) WHERE (status = 'open'::text);
CREATE INDEX bets_status_idx ON parallax.bets USING btree (status, commence_time);
CREATE INDEX bets_created_idx ON parallax.bets USING btree (created_at DESC);
CREATE INDEX odds_snapshots_ref_idx ON parallax.odds_snapshots USING btree (market_ref, side, captured_at);
CREATE INDEX odds_snapshots_event_idx ON parallax.odds_snapshots USING btree (event_id);
CREATE INDEX baba_rsvp_event_idx ON public.baba_call_time_rsvp USING btree (event_date, created_at DESC);
CREATE INDEX idx_job_events_job ON public.job_events USING btree (job_id, created_at);
CREATE INDEX idx_jobs_created ON public.jobs USING btree (created_at DESC);
CREATE INDEX idx_jobs_status ON public.jobs USING btree (status);
CREATE INDEX idx_message_reactions_message ON public.message_reactions USING btree (message_id);
CREATE INDEX parallax_odds_cache_key_idx ON public.parallax_odds_cache USING btree (cache_key);
CREATE INDEX idx_pipeline_events_lead ON public.pipeline_events USING btree (lead_id, created_at DESC);
CREATE INDEX idx_pipeline_gate_status ON public.pipeline_gate USING btree (status, created_at DESC);
CREATE INDEX idx_pipeline_leads_created ON public.pipeline_leads USING btree (created_at DESC);
CREATE INDEX idx_pipeline_leads_feed ON public.pipeline_leads USING btree (feed);
CREATE INDEX idx_pipeline_leads_stage ON public.pipeline_leads USING btree (stage);
CREATE INDEX idx_pipeline_proposals_status ON public.pipeline_proposals USING btree (status);
CREATE INDEX idx_pipeline_proposals_lead ON public.pipeline_proposals USING btree (lead_id);

-- ── functions + triggers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jobs_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;
CREATE OR REPLACE FUNCTION public.pg_publication_tables_for(pub text)
 RETURNS TABLE(tablename text)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT pt.tablename::text
    FROM pg_publication_tables pt
    WHERE pt.pubname = pub;
$function$
;
CREATE OR REPLACE FUNCTION public.pipeline_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.jobs_set_updated_at();
CREATE TRIGGER trg_pipeline_leads_updated BEFORE UPDATE ON public.pipeline_leads FOR EACH ROW EXECUTE FUNCTION public.pipeline_set_updated_at();
CREATE TRIGGER trg_pipeline_proposals_updated BEFORE UPDATE ON public.pipeline_proposals FOR EACH ROW EXECUTE FUNCTION public.pipeline_set_updated_at();

-- ── views (as live: pbx_* invoker; pipeline_metrics has NO security_invoker = definer semantics) ──
create view public.pbx_alerts with (security_invoker=on) as
 SELECT id, bet_id, channel, sent_at, ok, detail FROM parallax.alerts;
create view public.pbx_bankroll with (security_invoker=on) as
 SELECT id, current_bankroll, start_of_day, day_date, note, updated_at FROM parallax.bankroll;
create view public.pbx_bets with (security_invoker=on) as
 SELECT id, created_at, ts_ms, bet_day, scan_run_id, sport, game, commence_time, market_ref, side, book,
    entry_decimal_odds, american, fair_prob, edge, ev, stake, sharp_book, status, closing_decimal_odds,
    closing_fair_prob, won, clv_pct, pnl, alerted, settled_at, notes
   FROM parallax.bets;
create view public.pbx_odds_snapshots with (security_invoker=on) as
 SELECT id, scan_run_id, captured_at, event_id, sport, game, commence_time, market_ref, side, book, decimal_odds, fair_prob
   FROM parallax.odds_snapshots;
create view public.pbx_scan_runs with (security_invoker=on) as
 SELECT id, started_at, finished_at, sports, n_events, n_picks, n_new_edges, api_credits_used, api_credits_remaining, status, error
   FROM parallax.scan_runs;
create view public.pipeline_metrics as
 SELECT feed,
    count(*) AS total_leads,
    count(*) FILTER (WHERE stage = 'qualified'::text) AS qualified,
    count(*) FILTER (WHERE stage = 'proposal'::text) AS proposals,
    count(*) FILTER (WHERE stage = 'closed'::text) AS closed_won,
    count(*) FILTER (WHERE stage = 'lost'::text) AS lost,
    COALESCE(sum(value) FILTER (WHERE stage = 'closed'::text), 0::numeric) AS revenue_won,
    COALESCE(sum(value) FILTER (WHERE stage <> ALL (ARRAY['closed'::text, 'lost'::text])), 0::numeric) AS pipeline_value,
    round(100.0 * count(*) FILTER (WHERE stage = 'closed'::text)::numeric / NULLIF(count(*) FILTER (WHERE stage <> 'lead'::text), 0)::numeric, 1) AS close_rate_pct
   FROM public.pipeline_leads
  GROUP BY feed;

-- ── row level security ──────────────────────────────────────────────────────
alter table parallax.alerts enable row level security;
alter table parallax.bankroll enable row level security;
alter table parallax.bets enable row level security;
alter table parallax.odds_snapshots enable row level security;
alter table parallax.scan_runs enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.baba_call_time_rsvp enable row level security;
alter table public.channel_members enable row level security;
alter table public.channels enable row level security;
alter table public.daily_verses enable row level security;
alter table public.job_events enable row level security;
alter table public.jobs enable row level security;
alter table public.message_reactions enable row level security;
alter table public.messages enable row level security;
alter table public.parallax_bets enable row level security;
alter table public.parallax_odds_cache enable row level security;
alter table public.pipeline_events enable row level security;
alter table public.pipeline_gate enable row level security;
alter table public.pipeline_leads enable row level security;
alter table public.pipeline_proposals enable row level security;
alter table public.tenants enable row level security;

-- ── policies (as live) ──────────────────────────────────────────────────────
create policy read_all on parallax.alerts as permissive for select to public using (true);
create policy read_all on parallax.bankroll as permissive for select to public using (true);
create policy read_all on parallax.bets as permissive for select to public using (true);
create policy read_all on parallax.odds_snapshots as permissive for select to public using (true);
create policy read_all on parallax.scan_runs as permissive for select to public using (true);
create policy "Allow all on agent_profiles" on public.agent_profiles as permissive for all to public using (true);
create policy baba_rsvp_anon_insert on public.baba_call_time_rsvp as permissive for insert to anon with check (true);
create policy "Allow all on channel_members" on public.channel_members as permissive for all to public using (true);
create policy "Allow all on channels" on public.channels as permissive for all to public using (true);
create policy "Enable read access for all users" on public.message_reactions as permissive for select to public using (true);
create policy "Allow all on messages" on public.messages as permissive for all to public using (true);
create policy "Enable read access for all users" on public.messages as permissive for select to public using (true);
create policy "parallax anon read bets" on public.parallax_bets as permissive for select to anon using (true);
create policy "parallax anon update bets" on public.parallax_bets as permissive for update to anon using (true);
create policy "parallax anon write bets" on public.parallax_bets as permissive for insert to anon with check (true);
create policy "parallax anon read cache" on public.parallax_odds_cache as permissive for select to anon using (true);
create policy "parallax anon update cache" on public.parallax_odds_cache as permissive for update to anon using (true);
create policy "parallax anon write cache" on public.parallax_odds_cache as permissive for insert to anon with check (true);
create policy "Allow all on tenants" on public.tenants as permissive for all to public using (true);

-- ── schema usage + grants (as live) ─────────────────────────────────────────
grant usage on schema parallax to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on parallax.alerts, parallax.bankroll, parallax.bets, parallax.odds_snapshots, parallax.scan_runs to anon, authenticated;
grant all on parallax.alerts, parallax.bankroll, parallax.bets, parallax.odds_snapshots, parallax.scan_runs to service_role;
grant all on
  public.agent_profiles, public.baba_call_time_rsvp, public.channel_members, public.channels, public.daily_verses,
  public.job_events, public.jobs, public.message_reactions, public.messages, public.parallax_bets,
  public.parallax_odds_cache, public.pbx_alerts, public.pbx_bankroll, public.pbx_bets, public.pbx_odds_snapshots,
  public.pbx_scan_runs, public.pipeline_events, public.pipeline_gate, public.pipeline_leads, public.pipeline_metrics,
  public.pipeline_proposals, public.tenants
  to anon, authenticated, service_role;
-- Function EXECUTE: explicit ACL on all three, as live (re-read 2026-09-28):
--   =X/postgres, anon=X/postgres, authenticated=X/postgres, postgres=X/postgres, service_role=X/postgres
grant execute on function public.jobs_set_updated_at(), public.pg_publication_tables_for(text), public.pipeline_set_updated_at()
  to public, anon, authenticated, service_role;

-- ── realtime publication membership (as live) ───────────────────────────────
-- alter publication supabase_realtime add table parallax.bets, public.agent_profiles, public.channel_members,
--   public.channels, public.message_reactions, public.messages, public.tenants;
-- (Recorded for reference; the local prelude creates the publication when the engine supports it.)

-- ── storage buckets (as live; storage.objects has NO policies) ───────────────
-- insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
--   values ('agent-output', 'agent-output', true, 52428800, '{image/png,image/jpeg,image/webp,image/gif,image/svg+xml}');
-- NOTE: bucket 'chat-attachments' (used by /api/command-center/chat/upload) does NOT exist live.
