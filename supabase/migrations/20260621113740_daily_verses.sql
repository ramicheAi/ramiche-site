-- Daily contextual Bible verse for the Command Center (Wellness).
-- One row per day; the unique(verse_date) constraint + the route's exclude-list
-- enforce "never the same verse twice".
create table if not exists public.daily_verses (
  id              uuid primary key default gen_random_uuid(),
  verse_date      date not null unique,
  reference       text not null,
  verse_text      text not null,
  reflection      text,            -- why this verse fits today (spoken to Ramon)
  context_summary text,            -- what was going on in his day when it was chosen
  source          text,            -- 'claude' | 'fallback' | 'default'
  created_at      timestamptz not null default now()
);

-- Locked down: server-side service-role access only (via getSupabaseAdmin()).
alter table public.daily_verses enable row level security;
-- no policies = no anon/public access; the route uses the service role key.

comment on table public.daily_verses is 'Command Center Wellness — one contextual, never-repeating Bible verse per day.';
