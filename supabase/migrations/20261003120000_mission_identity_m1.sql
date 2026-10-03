-- P06 Mission Identity, packet M1: the canonical mission identity layer (schema only).
--
-- NOT APPLIED ANYWHERE. Do not run `supabase db push`, a schema diff or a migration repair against the remote
-- project: the P05-B3 migration was applied through execute_sql and its migration-history row is missing, so those
-- commands would misreport or try to reapply B3. Apply this file only through the reviewed manual path (explicit
-- approval, hash-checked SQL, rollback ready). Exact rollback:
-- supabase/rollbacks/20261003120000_mission_identity_m1.rollback.sql
--
-- MODEL (approved): Mission = canonical identity/definition + links + append-only events.
--   missions        the definition only: objective, owner, agents, success criteria, expected deliverables, state.
--   mission_links   pointers to records that stay in their own stores (jobs, synthesis plans and actions, gate items,
--                   YOLO builds, projects, tasks, Git objects, evidence). Nothing is copied in.
--   mission_events  append-only history: creation, every state change, link added/removed, notes, risks.
--   Costs are never stored here. They are derived from execution_events (execution_events.mission_id, plus
--   correlation through links in a later packet).
--
-- WHAT THE DATABASE ENFORCES vs WHAT IT CANNOT:
--   Enforced here: legal transitions only, one locked transaction per transition with exactly one event, no hard
--   deletes, append-only events, tombstoned link removal, definition frozen once approved, terminal states frozen,
--   success criteria required before approval, full per-criterion evidence coverage before verification, and the
--   structural rule that a mission's own agents (or an agent owner) can never be recorded as its verifier.
--   NOT enforced here: that a verifier is really Ramon. Postgres cannot see the Firebase session, and actor_kind is
--   caller-supplied, so actor_kind='human' is a declaration, never proof. Authenticated founder authority for
--   completed -> verified is reserved for the guarded M2 verification route.
--
-- Access: RLS enabled with NO policies; anon and authenticated get nothing. service_role gets only what the mission
-- mechanism needs: no DELETE or TRUNCATE anywhere, no UPDATE of missions.state (only mission_transition, a
-- SECURITY DEFINER function, can change it), and links may only be tombstoned.

-- ─── helpers (pure, immutable) ──────────────────────────────────────────────────────────────────────────
create or replace function public.mission_valid_ident(v text) returns boolean
language sql immutable parallel safe as $$
  select v is not null and v ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
$$;

-- A bounded set of identifiers (agent ids). CHECK constraints cannot hold subqueries, so the per-element test lives here.
create or replace function public.mission_valid_ident_array(v text[]) returns boolean
language plpgsql immutable parallel safe as $$
declare x text;
begin
  if v is null or cardinality(v) > 32 then return false; end if;
  foreach x in array v loop
    if not public.mission_valid_ident(x) then return false; end if;
  end loop;
  return true;
end $$;

-- [{"id": "<ident>", "text": "<1..500 chars>"}], at most 50 items, unique ids, no other keys.
create or replace function public.mission_valid_items(v jsonb) returns boolean
language plpgsql immutable parallel safe as $$
declare it jsonb; ids text[] := '{}';
begin
  if v is null or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 50 then return false; end if;
  for it in select * from jsonb_array_elements(v) loop
    if jsonb_typeof(it) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(it)) <> 2 then return false; end if;
    if jsonb_typeof(it->'id') <> 'string' or jsonb_typeof(it->'text') <> 'string' then return false; end if;
    if not public.mission_valid_ident(it->>'id') then return false; end if;
    if length(btrim(it->>'text')) < 1 or length(it->>'text') > 500 then return false; end if;
    if (it->>'id') = any(ids) then return false; end if;
    ids := ids || (it->>'id');
  end loop;
  return true;
end $$;

-- Event payload discipline: a small object of structured metadata. Bounded total size, bounded strings, bounded
-- depth, and no key (at any depth) that names prompts, model output, credentials, headers or raw logs.
create or replace function public.mission_detail_ok(v jsonb) returns boolean
language plpgsql immutable parallel safe as $$
declare forbidden text[] := array[
  'prompt','prompts','systemprompt','userprompt','response','responses','completion','completions','output',
  'messages','content','body','rawbody','raw','log','logs','stdout','stderr','trace','stack','stacktrace',
  'authorization','auth','cookie','cookies','setcookie','header','headers','token','tokens','accesstoken',
  'refreshtoken','idtoken','bearer','apikey','secret','secrets','password','passwd','credential','credentials',
  'privatekey','sessioncookie','session'];
begin
  if v is null or jsonb_typeof(v) <> 'object' then return false; end if;
  if length(v::text) > 4096 then return false; end if;
  return not exists (
    with recursive walk(val, depth) as (
      select v, 1
      union all
      select c.val, w.depth + 1
      from walk w
      cross join lateral (
        select e.value as val from jsonb_each(case when jsonb_typeof(w.val) = 'object' then w.val else '{}'::jsonb end) e
        union all
        select a.value from jsonb_array_elements(case when jsonb_typeof(w.val) = 'array' then w.val else '[]'::jsonb end) a
      ) c
      where w.depth < 6
    )
    select 1 from walk w
    where w.depth > 4
       or (jsonb_typeof(w.val) = 'string' and length(w.val #>> '{}') > 1000)
       or (jsonb_typeof(w.val) = 'object' and exists (
             select 1 from jsonb_object_keys(w.val) k
             where regexp_replace(lower(k), '[^a-z0-9]', '', 'g') = any(forbidden)))
  );
end $$;

-- ─── missions: identity + definition ────────────────────────────────────────────────────────────────────
create table if not exists public.missions (
  id                uuid primary key default gen_random_uuid(),
  -- Short human handle ("M-42") for future Universal Command. Never reused, never typed in by a caller.
  ref               bigint generated always as identity unique,
  tenant_id         uuid not null default '11111111-1111-1111-1111-111111111111'::uuid,
  objective         text not null check (length(btrim(objective)) between 1 and 2000),
  owner             text not null check (public.mission_valid_ident(owner)),
  owner_kind        text not null check (owner_kind in ('human', 'agent')),
  agent_ids         text[] not null default '{}' check (public.mission_valid_ident_array(agent_ids)),
  success_criteria  jsonb not null default '[]'::jsonb check (public.mission_valid_items(success_criteria)),
  deliverables      jsonb not null default '[]'::jsonb check (public.mission_valid_items(deliverables)),
  state             text not null default 'intent'
                    check (state in ('intent','plan','approved','executing','reviewing','completed','verified','cancelled')),
  created_by        text not null check (public.mission_valid_ident(created_by)),
  created_by_kind   text not null check (created_by_kind in ('human', 'agent', 'system')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists missions_state_idx on public.missions (state);
create index if not exists missions_owner_idx on public.missions (owner);

-- ─── mission_links: pointers into the systems that keep their own records ───────────────────────────────
create table if not exists public.mission_links (
  id                uuid primary key default gen_random_uuid(),
  mission_id        uuid not null references public.missions(id) on delete restrict,
  target_type       text not null check (target_type in (
                      'job','synthesis','synthesis_action','pipeline_gate','pipeline_lead','chat_channel','chat_message',
                      'yolo_build','project','firestore_task','git_branch','git_commit','pull_request','mission','url')),
  target_id         text not null check (length(target_id) between 1 and 512),
  target_index      integer check (target_index is null or target_index between 0 and 999),
  relation          text not null check (relation in (
                      'context','task','dependency','approval','evidence','deliverable','branch','source')),
  criterion_id      text check (criterion_id is null or public.mission_valid_ident(criterion_id)),
  created_by        text not null check (public.mission_valid_ident(created_by)),
  created_by_kind   text not null check (created_by_kind in ('human', 'agent', 'system')),
  created_at        timestamptz not null default now(),
  removed_at        timestamptz,
  removed_by        text check (removed_by is null or public.mission_valid_ident(removed_by)),
  removed_by_kind   text check (removed_by_kind is null or removed_by_kind in ('human', 'agent', 'system')),
  -- a plan action is addressed as (synthesis message id, action index); nothing else carries an index
  constraint mission_links_index_only_for_actions check ((target_type = 'synthesis_action') = (target_index is not null)),
  -- records that live in this database are uuid-keyed; reject malformed ids at the door
  constraint mission_links_uuid_targets check (
    target_type not in ('job','synthesis','synthesis_action','pipeline_gate','pipeline_lead','chat_channel','chat_message','mission')
    or target_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  -- evidence always says which success criterion it proves; nothing else carries a criterion
  constraint mission_links_evidence_names_criterion check ((relation = 'evidence') = (criterion_id is not null)),
  -- a tombstone is all-or-nothing
  constraint mission_links_tombstone_complete check (
    (removed_at is null) = (removed_by is null) and (removed_by is null) = (removed_by_kind is null))
);
-- one live link per (mission, target, relation, criterion); a removed link may be re-added as a new row
create unique index if not exists mission_links_live_unique on public.mission_links
  (mission_id, target_type, target_id, coalesce(target_index, -1), relation, coalesce(criterion_id, ''))
  where removed_at is null;
create index if not exists mission_links_mission_idx on public.mission_links (mission_id) where removed_at is null;
-- reverse lookup ("which missions point at this job/message/lead") for cost attribution and the UI
create index if not exists mission_links_target_idx on public.mission_links (target_type, target_id) where removed_at is null;

-- ─── mission_events: append-only history ───────────────────────────────────────────────────────────────
create table if not exists public.mission_events (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions(id) on delete restrict,
  seq         bigint generated always as identity,
  kind        text not null check (kind in (
                'created','state_changed','link_added','link_removed','note','risk_raised','risk_resolved')),
  from_state  text check (from_state is null or from_state in
                ('intent','plan','approved','executing','reviewing','completed','verified','cancelled')),
  to_state    text check (to_state is null or to_state in
                ('intent','plan','approved','executing','reviewing','completed','verified','cancelled')),
  actor       text not null check (public.mission_valid_ident(actor)),
  actor_kind  text not null check (actor_kind in ('human', 'agent', 'system')),
  detail      jsonb not null default '{}'::jsonb check (public.mission_detail_ok(detail)),
  created_at  timestamptz not null default now(),
  constraint mission_events_states_only_on_transition check (
    (kind = 'state_changed') = (from_state is not null and to_state is not null)
    and (kind = 'state_changed' or (from_state is null and to_state is null)))
);
create index if not exists mission_events_mission_seq_idx on public.mission_events (mission_id, seq);

-- ─── internal-write flag ───────────────────────────────────────────────────────────────────────────────
-- Transaction-local. Set only inside the mission mechanism's own functions and cleared before they return, so the
-- normal application path (PostgREST / supabase-js as service_role) can never present it. A raw SQL session as the
-- table owner is outside that boundary by definition.
create or replace function public.mission_internal_on() returns boolean
language sql stable as $$ select coalesce(current_setting('mission.internal', true), '') = 'on' $$;

-- ─── guards: missions ──────────────────────────────────────────────────────────────────────────────────
create or replace function public.missions_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'missions are never hard-deleted (cancel the mission instead)' using errcode = 'MI010';
  end if;
  if tg_op = 'INSERT' then
    if new.state <> 'intent' then
      raise exception 'a mission is created in state intent, not %', new.state using errcode = 'MI011';
    end if;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;
  -- UPDATE
  if new.id is distinct from old.id or new.ref is distinct from old.ref or new.tenant_id is distinct from old.tenant_id
     or new.created_by is distinct from old.created_by or new.created_by_kind is distinct from old.created_by_kind
     or new.created_at is distinct from old.created_at then
    raise exception 'mission identity columns are immutable' using errcode = 'MI012';
  end if;
  if old.state in ('verified', 'cancelled') then
    raise exception 'mission % is terminal (%) and cannot change', old.id, old.state using errcode = 'MI013';
  end if;
  if new.state is distinct from old.state and not public.mission_internal_on() then
    raise exception 'mission state changes only through mission_transition()' using errcode = 'MI014';
  end if;
  if old.state not in ('intent', 'plan')
     and (new.objective is distinct from old.objective
          or new.success_criteria is distinct from old.success_criteria
          or new.deliverables is distinct from old.deliverables) then
    raise exception 'mission definition is frozen once approved (state %)', old.state using errcode = 'MI015';
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.missions_after_insert() returns trigger
language plpgsql as $$
begin
  perform set_config('mission.internal', 'on', true);
  insert into public.mission_events (mission_id, kind, actor, actor_kind, detail)
  values (new.id, 'created', new.created_by, new.created_by_kind, jsonb_build_object('ref', new.ref));
  perform set_config('mission.internal', '', true);
  return null;
end $$;

-- ─── guards: mission_links ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mission_links_guard() returns trigger
language plpgsql as $$
declare m public.missions;
begin
  if tg_op = 'DELETE' then
    raise exception 'mission links are never hard-deleted (set removed_at)' using errcode = 'MI020';
  end if;
  -- FOR SHARE serializes against mission_transition's FOR UPDATE: the evidence set cannot shift underneath a
  -- verification, and nothing attaches to or detaches from a mission while it is becoming terminal.
  select * into m from public.missions where id = new.mission_id for share;
  if not found then
    raise exception 'mission % does not exist', new.mission_id using errcode = 'MI021';
  end if;
  if m.state in ('verified', 'cancelled') then
    raise exception 'mission % is terminal (%); its links are frozen', m.id, m.state using errcode = 'MI022';
  end if;
  if tg_op = 'INSERT' then
    if new.removed_at is not null then
      raise exception 'a link cannot be created already removed' using errcode = 'MI023';
    end if;
    if new.criterion_id is not null and not exists (
         select 1 from jsonb_array_elements(m.success_criteria) c where c->>'id' = new.criterion_id) then
      raise exception 'criterion % is not a success criterion of mission %', new.criterion_id, m.id using errcode = 'MI024';
    end if;
    if new.target_type = 'mission' then
      if new.target_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'mission link target must be a mission uuid' using errcode = 'MI025';
      end if;
      if new.target_id::uuid = new.mission_id then
        raise exception 'a mission cannot link to itself' using errcode = 'MI025';
      end if;
      if not exists (select 1 from public.missions where id = new.target_id::uuid) then
        raise exception 'linked mission % does not exist', new.target_id using errcode = 'MI026';
      end if;
    end if;
    new.created_at := now();
    return new;
  end if;
  -- UPDATE: the only legal change is a one-way tombstone.
  if old.removed_at is not null then
    raise exception 'link % is already removed', old.id using errcode = 'MI027';
  end if;
  if new.removed_at is null
     or new.id is distinct from old.id or new.mission_id is distinct from old.mission_id
     or new.target_type is distinct from old.target_type or new.target_id is distinct from old.target_id
     or new.target_index is distinct from old.target_index or new.relation is distinct from old.relation
     or new.criterion_id is distinct from old.criterion_id or new.created_by is distinct from old.created_by
     or new.created_by_kind is distinct from old.created_by_kind or new.created_at is distinct from old.created_at then
    raise exception 'a mission link can only be tombstoned (removed_at, removed_by, removed_by_kind)' using errcode = 'MI028';
  end if;
  new.removed_at := now();
  return new;
end $$;

create or replace function public.mission_links_after_write() returns trigger
language plpgsql as $$
begin
  perform set_config('mission.internal', 'on', true);
  if tg_op = 'INSERT' then
    insert into public.mission_events (mission_id, kind, actor, actor_kind, detail)
    values (new.mission_id, 'link_added', new.created_by, new.created_by_kind,
            jsonb_build_object('link_id', new.id, 'target_type', new.target_type, 'relation', new.relation,
                               'criterion_id', new.criterion_id));
  elsif old.removed_at is null and new.removed_at is not null then
    insert into public.mission_events (mission_id, kind, actor, actor_kind, detail)
    values (new.mission_id, 'link_removed', new.removed_by, new.removed_by_kind,
            jsonb_build_object('link_id', new.id, 'target_type', new.target_type, 'relation', new.relation,
                               'criterion_id', new.criterion_id));
  end if;
  perform set_config('mission.internal', '', true);
  return null;
end $$;

-- ─── guards: mission_events (append-only) ──────────────────────────────────────────────────────────────
create or replace function public.mission_events_guard() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'mission_events is append-only' using errcode = 'MI030';
  end if;
  -- lifecycle and link kinds are written only by the mission mechanism itself
  if new.kind in ('created', 'state_changed', 'link_added', 'link_removed') and not public.mission_internal_on() then
    raise exception 'event kind % is written only by the mission mechanism', new.kind using errcode = 'MI031';
  end if;
  new.created_at := now();
  return new;
end $$;

create or replace function public.mission_no_truncate() returns trigger
language plpgsql as $$
begin
  raise exception '% cannot be truncated', tg_table_name using errcode = 'MI032';
end $$;

drop trigger if exists missions_guard on public.missions;
create trigger missions_guard before insert or update or delete on public.missions
  for each row execute function public.missions_guard();
drop trigger if exists missions_after_insert on public.missions;
create trigger missions_after_insert after insert on public.missions
  for each row execute function public.missions_after_insert();
drop trigger if exists missions_no_truncate on public.missions;
create trigger missions_no_truncate before truncate on public.missions
  for each statement execute function public.mission_no_truncate();

drop trigger if exists mission_links_guard on public.mission_links;
create trigger mission_links_guard before insert or update or delete on public.mission_links
  for each row execute function public.mission_links_guard();
drop trigger if exists mission_links_after_write on public.mission_links;
create trigger mission_links_after_write after insert or update on public.mission_links
  for each row execute function public.mission_links_after_write();
drop trigger if exists mission_links_no_truncate on public.mission_links;
create trigger mission_links_no_truncate before truncate on public.mission_links
  for each statement execute function public.mission_no_truncate();

drop trigger if exists mission_events_guard on public.mission_events;
create trigger mission_events_guard before insert or update or delete on public.mission_events
  for each row execute function public.mission_events_guard();
drop trigger if exists mission_events_no_truncate on public.mission_events;
create trigger mission_events_no_truncate before truncate on public.mission_events
  for each statement execute function public.mission_no_truncate();

-- ─── the state machine ─────────────────────────────────────────────────────────────────────────────────
-- intent → plan → approved → executing → reviewing → completed → verified
-- reviewing → executing                 (rework)
-- {intent, plan, approved, executing, reviewing, completed} → cancelled
-- verified and cancelled are terminal.
create or replace function public.mission_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable parallel safe as $$
  select (p_from, p_to) in (
    ('intent','plan'), ('plan','approved'), ('approved','executing'), ('executing','reviewing'),
    ('reviewing','completed'), ('completed','verified'), ('reviewing','executing'),
    ('intent','cancelled'), ('plan','cancelled'), ('approved','cancelled'), ('executing','cancelled'),
    ('reviewing','cancelled'), ('completed','cancelled'))
$$;

-- The ONLY way a mission's state changes. One call = one transaction step: lock the row, read the real current
-- state, validate, update, append exactly one state_changed event. Any failure raises and nothing is written.
-- p_expected_from is an optional optimistic check: a caller acting on a stale view fails closed instead of
-- applying a transition it did not mean.
create or replace function public.mission_transition(
  p_mission_id    uuid,
  p_to_state      text,
  p_actor         text,
  p_actor_kind    text,
  p_detail        jsonb default '{}'::jsonb,
  p_expected_from text default null
) returns public.missions
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  m        public.missions;
  v_from   text;
  missing  text[];
begin
  if p_to_state is null or p_to_state not in
     ('intent','plan','approved','executing','reviewing','completed','verified','cancelled') then
    raise exception 'unknown target state %', p_to_state using errcode = 'MI001';
  end if;
  if not public.mission_valid_ident(p_actor) then
    raise exception 'invalid actor' using errcode = 'MI002';
  end if;
  if p_actor_kind is null or p_actor_kind not in ('human', 'agent', 'system') then
    raise exception 'invalid actor_kind' using errcode = 'MI002';
  end if;
  if not public.mission_detail_ok(coalesce(p_detail, '{}'::jsonb)) then
    raise exception 'event detail violates the payload contract' using errcode = 'MI003';
  end if;

  select * into m from public.missions where id = p_mission_id for update;
  if not found then
    raise exception 'mission % not found', p_mission_id using errcode = 'MI004';
  end if;
  v_from := m.state;
  if p_expected_from is not null and m.state <> p_expected_from then
    raise exception 'mission % is in state %, not the expected %', m.id, m.state, p_expected_from using errcode = 'MI005';
  end if;
  if not public.mission_transition_allowed(m.state, p_to_state) then
    raise exception 'transition % -> % is not allowed', m.state, p_to_state using errcode = 'MI006';
  end if;

  if p_to_state = 'approved' and jsonb_array_length(m.success_criteria) = 0 then
    raise exception 'a mission needs at least one success criterion before approval' using errcode = 'MI007';
  end if;

  if p_to_state = 'verified' then
    -- Structural only. actor_kind is caller-supplied: 'human' is a declaration, not proof. Authenticated founder
    -- authority is enforced by the guarded M2 verification route, never here.
    if p_actor_kind <> 'human' then
      raise exception 'verification must be declared by a human actor, not %', p_actor_kind using errcode = 'MI008';
    end if;
    if p_actor = any(m.agent_ids) or (m.owner_kind = 'agent' and p_actor = m.owner) then
      raise exception 'an agent on this mission cannot certify its own work' using errcode = 'MI008';
    end if;
    select array_agg(c->>'id' order by c->>'id') into missing
      from jsonb_array_elements(m.success_criteria) c
     where not exists (
       select 1 from public.mission_links l
        where l.mission_id = m.id and l.relation = 'evidence' and l.removed_at is null
          and l.criterion_id = c->>'id');
    if missing is not null then
      raise exception 'success criteria without evidence: %', array_to_string(missing[1:20], ', ') using errcode = 'MI009';
    end if;
  end if;

  perform set_config('mission.internal', 'on', true);
  update public.missions set state = p_to_state where id = m.id returning * into m;
  insert into public.mission_events (mission_id, kind, from_state, to_state, actor, actor_kind, detail)
  values (m.id, 'state_changed', v_from, p_to_state, p_actor, p_actor_kind, coalesce(p_detail, '{}'::jsonb));
  perform set_config('mission.internal', '', true);
  return m;
end $$;

-- ─── access posture ────────────────────────────────────────────────────────────────────────────────────
alter table public.missions       enable row level security;
alter table public.mission_links  enable row level security;
alter table public.mission_events enable row level security;

revoke all on table public.missions, public.mission_links, public.mission_events from public, anon, authenticated, service_role;
grant select, insert on table public.missions to service_role;
grant update (objective, owner, owner_kind, agent_ids, success_criteria, deliverables) on table public.missions to service_role;
grant select, insert on table public.mission_links to service_role;
grant update (removed_at, removed_by, removed_by_kind) on table public.mission_links to service_role;
grant select, insert on table public.mission_events to service_role;

revoke all on function public.mission_transition(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.mission_transition(uuid, text, text, text, jsonb, text) to service_role;
revoke all on function public.mission_internal_on() from public, anon, authenticated;
grant execute on function public.mission_internal_on() to service_role;

-- ─── telemetry linkage (Packet 3 column, unchanged semantics) ──────────────────────────────────────────
-- execution_events.mission_id was reserved in Packet 3 and every existing row holds NULL. This only adds the
-- referential check; no event row is changed, correlation_type='mission' stays rejected, and no pricing or truth
-- rule changes. NOT VALID + VALIDATE keeps the lock short: the scan only confirms the existing NULLs.
alter table public.execution_events
  add constraint execution_events_mission_id_fkey
  foreign key (mission_id) references public.missions(id) on delete restrict not valid;
alter table public.execution_events validate constraint execution_events_mission_id_fkey;
