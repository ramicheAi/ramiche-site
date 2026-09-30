-- RECONSTRUCTED BASELINE. This is NOT the original authored migration.
--
-- These tables already exist in production (project command-center-hq, qkbkfsjkysdsfmhgfdoc). They were created outside
-- Supabase migrations, so production migration history has no row for them, and the original creation script was not
-- found (searched: repo history, the iMac, the P05-B2/B3 work). This file reconstructs their structure from the
-- read-only live catalog dump taken on 2026-09-28 (P05-B2, live-schema-2026-09-28.sql,
-- sha256 d7ddb5d9da9e24fbd9b600aa04d959ba85aa3c6701233b0e11688b77fcfb8b24), excluding what
-- 20260513203300_cc_chat_fix.sql (scripts/fix-cc-chat.sql) adds afterwards.
--
-- Version: derived from the earliest observed shared seed timestamp 2026-03-10T10:07:45.579822Z, carried identically by
-- the first rows of tenants, agent_profiles, channels and channel_members (one transaction, so one execution), truncated
-- to seconds. That proves the schema existed by that time. It does NOT prove the DDL executed exactly then.
--
-- Scope: only the structure needed to reproduce the live chat schema and let later migrations replay: columns,
-- defaults, primary and unique keys, and the messages self-reference. No seed rows, policies, grants, RLS or
-- publication membership; 20260928120000_p05b3_cockpit_anon_lockdown.sql owns the access model.
create table if not exists public.tenants (
  id uuid default gen_random_uuid() not null primary key,
  name text not null,
  slug text not null unique,
  logo_url text,
  created_at timestamp with time zone default now()
);

create table if not exists public.agent_profiles (
  id uuid default gen_random_uuid() not null primary key,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  name text not null,
  handle text not null unique,
  model text,
  status text default 'active'::text,
  color_hex text default '#7C3AED'::text,
  avatar_url text,
  skills jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.channels (
  id uuid default gen_random_uuid() not null primary key,
  tenant_id uuid default '11111111-1111-1111-1111-111111111111'::uuid,
  name text not null,
  slug text not null,
  type text not null,
  description text,
  is_private boolean default false,
  last_activity_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique (tenant_id, slug)
);

create table if not exists public.channel_members (
  id uuid default gen_random_uuid() not null primary key,
  channel_id uuid not null,
  agent_id uuid not null,
  role text default 'member'::text,
  joined_at timestamp with time zone default now()
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() not null primary key,
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
  constraint messages_thread_parent_id_fkey foreign key (thread_parent_id) references public.messages(id)
);
