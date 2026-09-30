-- Release + RSVP capture for The Baba Production Studios / Call Time.
-- Public form inserts only. The anon key can never read this table back.
create table if not exists public.baba_call_time_rsvp (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event_name     text not null default 'CALL TIME',
  event_date     date not null,
  full_name      text not null,
  mobile         text not null,
  instagram      text,
  is_adult       boolean not null,
  agreed_terms   boolean not null,
  signature_name text not null,
  sms_consent    boolean not null default false,
  terms_version  text not null,
  user_agent     text,
  constraint baba_rsvp_must_be_adult check (is_adult = true),
  constraint baba_rsvp_must_agree    check (agreed_terms = true)
);

comment on table public.baba_call_time_rsvp is
  'Signed filming releases + RSVPs for The Baba / Call Time events. Legal record: do not delete rows. terms_version records which wording the person actually agreed to.';

create index if not exists baba_rsvp_event_idx on public.baba_call_time_rsvp (event_date, created_at desc);

alter table public.baba_call_time_rsvp enable row level security;

-- Anonymous visitors may submit a release. They may not read, update or delete.
drop policy if exists baba_rsvp_anon_insert on public.baba_call_time_rsvp;
create policy baba_rsvp_anon_insert
  on public.baba_call_time_rsvp
  for insert
  to anon
  with check (true);
