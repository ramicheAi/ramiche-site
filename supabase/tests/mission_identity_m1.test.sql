-- SQL tests for supabase/migrations/20261003120000_mission_identity_m1.sql.
-- Plain PostgreSQL: run in ONE psql session against a scratch database that has the Supabase roles (anon,
-- authenticated, service_role), the live baseline, the execution_events migration and this migration applied.
-- Every block raises on failure. Concurrency tests need two sessions and live in the replay harness.
-- Never run this against the production project.

-- ── helpers (session-local, never in public) ──────────────────────────────────────────────────────────
-- run a statement, optionally as a role; return 'OK' or the SQLSTATE it failed with. Each call is its own
-- subtransaction, so a failure leaves nothing behind.
create or replace function pg_temp.try(p_sql text, p_role text default null) returns text language plpgsql as $$
begin
  if p_role is not null then execute format('set local role %I', p_role); end if;
  execute p_sql;
  if p_role is not null then reset role; end if;
  return 'OK';
exception when others then
  return sqlstate;
end $$;

create or replace function pg_temp.mk(
  p_owner text default 'ramon', p_owner_kind text default 'human', p_agents text[] default '{triage}',
  p_criteria jsonb default '[{"id":"c1","text":"it works"},{"id":"c2","text":"it is tested"}]'::jsonb
) returns uuid language sql as $$
  insert into public.missions (objective, owner, owner_kind, agent_ids, success_criteria, created_by, created_by_kind)
  values ('test objective', p_owner, p_owner_kind, p_agents, p_criteria, 'ramon', 'human') returning id
$$;

create or replace function pg_temp.go(p uuid, s text, a text default 'ramon', k text default 'human') returns text
language sql as $$ select (public.mission_transition(p, s, a, k)).state $$;

create or replace function pg_temp.ev(p uuid, crit text, tgt text default 'https://example.test/run') returns uuid
language sql as $$
  insert into public.mission_links (mission_id, target_type, target_id, relation, criterion_id, created_by, created_by_kind)
  values (p, 'url', tgt, 'evidence', crit, 'triage', 'agent') returning id
$$;

create or replace function pg_temp.walk_to(p uuid, target text) returns void language plpgsql as $$
declare path text[] := array['plan','approved','executing','reviewing','completed']; s text;
begin
  foreach s in array path loop
    perform pg_temp.go(p, s);
    exit when s = target;
  end loop;
end $$;

-- @test objects exist, RLS on, no policies
do $$ begin
  assert (select count(*) from pg_class where oid in ('public.missions'::regclass,'public.mission_links'::regclass,'public.mission_events'::regclass) and relrowsecurity) = 3, 'RLS off';
  assert (select count(*) from pg_policies where tablename in ('missions','mission_links','mission_events')) = 0, 'unexpected policies';
end $$;

-- @test anon and authenticated are denied everything, including the transition function
do $$
declare r text; m uuid := pg_temp.mk();
begin
  foreach r in array array['anon','authenticated'] loop
    assert pg_temp.try('select 1 from public.missions', r) = '42501', r || ' read missions';
    assert pg_temp.try('select 1 from public.mission_links', r) = '42501', r || ' read links';
    assert pg_temp.try('select 1 from public.mission_events', r) = '42501', r || ' read events';
    assert pg_temp.try($q$insert into public.missions (objective, owner, owner_kind, created_by, created_by_kind) values ('x','ramon','human','ramon','human')$q$, r) = '42501', r || ' insert';
    assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','human')$q$, m), r) = '42501', r || ' transition';
  end loop;
end $$;

-- @test service_role: may create, read and transition; may never write state directly, delete or truncate
do $$
declare m uuid := pg_temp.mk();
begin
  assert pg_temp.try($q$insert into public.missions (objective, owner, owner_kind, created_by, created_by_kind) values ('svc','atlas','agent','atlas','agent')$q$, 'service_role') = 'OK', 'svc insert';
  assert pg_temp.try('select count(*) from public.missions', 'service_role') = 'OK', 'svc read';
  assert pg_temp.try(format($q$update public.missions set state='plan' where id=%L$q$, m), 'service_role') = '42501', 'svc direct state write';
  assert pg_temp.try(format($q$update public.missions set objective='edited' where id=%L$q$, m), 'service_role') = 'OK', 'svc edit definition in intent';
  assert pg_temp.try(format($q$delete from public.missions where id=%L$q$, m), 'service_role') = '42501', 'svc delete mission';
  assert pg_temp.try('truncate public.missions cascade', 'service_role') = '42501', 'svc truncate';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','human')$q$, m), 'service_role') = 'OK', 'svc transition';
  assert (select state from public.missions where id = m) = 'plan';
  assert pg_temp.try(format($q$update public.mission_events set actor='x' where mission_id=%L$q$, m), 'service_role') = '42501', 'svc update event';
  assert pg_temp.try(format($q$delete from public.mission_events where mission_id=%L$q$, m), 'service_role') = '42501', 'svc delete event';
end $$;

-- @test creation is born in intent and appends exactly one 'created' event automatically
do $$
declare m uuid := pg_temp.mk(); e record;
begin
  assert (select state from public.missions where id = m) = 'intent';
  assert (select count(*) from public.mission_events where mission_id = m) = 1;
  select * into e from public.mission_events where mission_id = m;
  assert e.kind = 'created' and e.from_state is null and e.to_state is null and e.actor = 'ramon' and e.actor_kind = 'human';
  assert (e.detail->>'ref')::bigint = (select ref from public.missions where id = m), 'created event carries ref';
  assert pg_temp.try($q$insert into public.missions (objective, owner, owner_kind, state, created_by, created_by_kind) values ('x','ramon','human','approved','ramon','human')$q$) = 'MI011', 'born non-intent';
  assert pg_temp.try($q$insert into public.missions (ref, objective, owner, owner_kind, created_by, created_by_kind) values (999,'x','ramon','human','ramon','human')$q$) = '428C9', 'ref is never caller-supplied';
end $$;

-- @test happy path: every legal forward step, exactly one event per transition, from/to exact
do $$
declare m uuid := pg_temp.mk(); s text; prev text := 'intent'; n int;
begin
  foreach s in array array['plan','approved','executing','reviewing','completed'] loop
    assert pg_temp.go(m, s) = s;
    assert (select count(*) from public.mission_events where mission_id = m and kind = 'state_changed' and from_state = prev and to_state = s) = 1, prev || '->' || s;
    prev := s;
  end loop;
  perform pg_temp.ev(m, 'c1'); perform pg_temp.ev(m, 'c2');
  assert pg_temp.go(m, 'verified') = 'verified';
  select count(*) into n from public.mission_events where mission_id = m and kind = 'state_changed';
  assert n = 6, format('expected 6 transitions, got %s', n);
  assert (select count(*) from public.mission_events where mission_id = m) = 1 + 6 + 2, 'created + 6 transitions + 2 link_added';
end $$;

-- @test illegal transitions fail closed with MI006 and write nothing
do $$
declare m uuid := pg_temp.mk(); before_ev int;
begin
  select count(*) into before_ev from public.mission_events where mission_id = m;
  assert pg_temp.try(format($q$select public.mission_transition(%L,'approved','ramon','human')$q$, m)) = 'MI006', 'intent->approved skips plan';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'intent','ramon','human')$q$, m)) = 'MI006', 'same state';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','ramon','human')$q$, m)) = 'MI006', 'intent->verified';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'done','ramon','human')$q$, m)) = 'MI001', 'unknown state';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','Bad Actor!','human')$q$, m)) = 'MI002', 'bad actor';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','robot')$q$, m)) = 'MI002', 'bad actor kind';
  assert pg_temp.try($q$select public.mission_transition('00000000-0000-0000-0000-00000000dead','plan','ramon','human')$q$) = 'MI004', 'missing mission';
  perform pg_temp.go(m, 'plan');
  assert pg_temp.try(format($q$select public.mission_transition(%L,'executing','ramon','human')$q$, m)) = 'MI006', 'plan->executing';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'intent','ramon','human')$q$, m)) = 'MI006', 'no going back to intent';
  assert (select state from public.missions where id = m) = 'plan';
  assert (select count(*) from public.mission_events where mission_id = m) = before_ev + 1, 'only the one legal transition wrote an event';
end $$;

-- @test rework: reviewing -> executing is legal, and the cycle can repeat
do $$
declare m uuid := pg_temp.mk();
begin
  perform pg_temp.walk_to(m, 'reviewing');
  assert pg_temp.go(m, 'executing') = 'executing';
  assert pg_temp.go(m, 'reviewing') = 'reviewing';
  assert pg_temp.go(m, 'executing') = 'executing';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'approved','ramon','human')$q$, m)) = 'MI006', 'executing->approved is not rework';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'completed','ramon','human')$q$, m)) = 'MI006', 'executing->completed skips review';
end $$;

-- @test cancelled is reachable from every non-terminal state; verified and cancelled are terminal
do $$
declare s text; m uuid; v uuid;
begin
  foreach s in array array['intent','plan','approved','executing','reviewing','completed'] loop
    m := pg_temp.mk();
    if s <> 'intent' then perform pg_temp.walk_to(m, s); end if;
    assert pg_temp.go(m, 'cancelled', 'atlas', 'agent') = 'cancelled', 'cancel from ' || s;
    assert pg_temp.try(format($q$select public.mission_transition(%L,'intent','ramon','human')$q$, m)) = 'MI006', 'cancelled is terminal';
    assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','human')$q$, m)) = 'MI006', 'cancelled is terminal';
  end loop;
  v := pg_temp.mk(); perform pg_temp.walk_to(v, 'completed'); perform pg_temp.ev(v, 'c1'); perform pg_temp.ev(v, 'c2');
  perform pg_temp.go(v, 'verified');
  assert pg_temp.try(format($q$select public.mission_transition(%L,'cancelled','ramon','human')$q$, v)) = 'MI006', 'verified cannot be cancelled';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'executing','ramon','human')$q$, v)) = 'MI006', 'verified is terminal';
end $$;

-- @test approval needs at least one success criterion
do $$
declare m uuid := pg_temp.mk(p_criteria => '[]'::jsonb);
begin
  perform pg_temp.go(m, 'plan');
  assert pg_temp.try(format($q$select public.mission_transition(%L,'approved','ramon','human')$q$, m)) = 'MI007';
  update public.missions set success_criteria = '[{"id":"c1","text":"defined during plan"}]' where id = m;
  assert pg_temp.go(m, 'approved') = 'approved';
end $$;

-- @test verification: every criterion needs live evidence; tombstoned evidence does not count
do $$
declare m uuid := pg_temp.mk(); l uuid;
begin
  perform pg_temp.walk_to(m, 'completed');
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','ramon','human')$q$, m)) = 'MI009', 'no evidence';
  perform pg_temp.ev(m, 'c1');
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','ramon','human')$q$, m)) = 'MI009', 'c2 uncovered';
  l := pg_temp.ev(m, 'c2');
  update public.mission_links set removed_at = now(), removed_by = 'ramon', removed_by_kind = 'human' where id = l;
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','ramon','human')$q$, m)) = 'MI009', 'tombstoned evidence is not evidence';
  perform pg_temp.ev(m, 'c2', 'https://example.test/rerun');
  assert pg_temp.go(m, 'verified') = 'verified';
end $$;

-- @test an agent can never certify: not by kind, not by declaring itself human, not as an agent owner
do $$
declare m uuid := pg_temp.mk(p_owner => 'atlas', p_owner_kind => 'agent', p_agents => '{triage,vee}');
begin
  perform pg_temp.walk_to(m, 'completed'); perform pg_temp.ev(m, 'c1'); perform pg_temp.ev(m, 'c2');
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','ramon','agent')$q$, m)) = 'MI008', 'agent kind';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','ramon','system')$q$, m)) = 'MI008', 'system kind';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','triage','human')$q$, m)) = 'MI008', 'a working agent claiming human';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'verified','atlas','human')$q$, m)) = 'MI008', 'agent owner claiming human';
  assert (select state from public.missions where id = m) = 'completed', 'nothing changed';
  assert pg_temp.go(m, 'verified', 'ramon', 'human') = 'verified', 'a human outside the team may verify (M2 must prove it is Ramon)';
end $$;

-- @test a human owner may verify their own mission (founder authority is M2's check)
do $$
declare m uuid := pg_temp.mk(p_owner => 'ramon', p_owner_kind => 'human');
begin
  perform pg_temp.walk_to(m, 'completed'); perform pg_temp.ev(m, 'c1'); perform pg_temp.ev(m, 'c2');
  assert pg_temp.go(m, 'verified', 'ramon', 'human') = 'verified';
end $$;

-- @test optimistic check: a stale caller fails closed with MI005 and writes nothing
do $$
declare m uuid := pg_temp.mk(); n int;
begin
  select count(*) into n from public.mission_events where mission_id = m;
  assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','human','{}'::jsonb,'plan')$q$, m)) = 'MI005';
  assert (select state from public.missions where id = m) = 'intent';
  assert (select count(*) from public.mission_events where mission_id = m) = n;
  assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','human','{}'::jsonb,'intent')$q$, m)) = 'OK';
end $$;

-- @test state cannot bypass the transition mechanism, even for the table owner
do $$
declare m uuid := pg_temp.mk();
begin
  assert pg_temp.try(format($q$update public.missions set state='plan' where id=%L$q$, m)) = 'MI014', 'owner direct state write';
  assert pg_temp.try(format($q$insert into public.mission_events (mission_id, kind, from_state, to_state, actor, actor_kind) values (%L,'state_changed','intent','plan','ramon','human')$q$, m)) = 'MI031', 'forged transition event';
  assert pg_temp.try(format($q$insert into public.mission_events (mission_id, kind, from_state, to_state, actor, actor_kind) values (%L,'state_changed','intent','plan','ramon','human')$q$, m), 'service_role') = 'MI031', 'forged transition event as service_role';
  assert pg_temp.try(format($q$insert into public.mission_events (mission_id, kind, actor, actor_kind) values (%L,'created','ramon','human')$q$, m), 'service_role') = 'MI031', 'forged created event';
  assert pg_temp.try(format($q$insert into public.mission_events (mission_id, kind, actor, actor_kind) values (%L,'link_added','ramon','human')$q$, m), 'service_role') = 'MI031', 'forged link event';
  assert (select state from public.missions where id = m) = 'intent';
end $$;

-- @test the internal flag never outlives a transition (no leak into the caller's transaction)
do $$
declare m uuid := pg_temp.mk();
begin
  perform pg_temp.go(m, 'plan');
  assert coalesce(current_setting('mission.internal', true), '') = '', 'flag leaked';
  assert pg_temp.try(format($q$update public.missions set state='approved' where id=%L$q$, m)) = 'MI014', 'direct write right after a transition';
end $$;

-- @test nothing is ever hard-deleted, events are append-only, nothing is truncatable
do $$
declare m uuid := pg_temp.mk(); l uuid;
begin
  l := pg_temp.ev(m, 'c1');
  assert pg_temp.try(format($q$delete from public.missions where id=%L$q$, m)) = 'MI010', 'owner deletes mission';
  assert pg_temp.try(format($q$delete from public.mission_links where id=%L$q$, l)) = 'MI020', 'owner deletes link';
  assert pg_temp.try(format($q$update public.mission_events set actor='x' where mission_id=%L$q$, m)) = 'MI030', 'owner edits event';
  assert pg_temp.try(format($q$delete from public.mission_events where mission_id=%L$q$, m)) = 'MI030', 'owner deletes event';
  assert pg_temp.try('truncate public.mission_events') = 'MI032', 'truncate events';
  assert pg_temp.try('truncate public.mission_links cascade') = 'MI032', 'truncate links';
  assert pg_temp.try('truncate public.missions cascade') = 'MI032', 'truncate missions';
end $$;

-- @test definition is editable while intent/plan, frozen from approval on; identity columns never change; terminal is frozen
do $$
declare m uuid := pg_temp.mk(); c uuid := pg_temp.mk();
begin
  assert pg_temp.try(format($q$update public.missions set objective='refined' where id=%L$q$, m)) = 'OK', 'edit in intent';
  perform pg_temp.go(m, 'plan');
  assert pg_temp.try(format($q$update public.missions set success_criteria='[{"id":"c1","text":"x"}]' where id=%L$q$, m)) = 'OK', 'edit in plan';
  perform pg_temp.go(m, 'approved');
  assert pg_temp.try(format($q$update public.missions set objective='moved goalposts' where id=%L$q$, m)) = 'MI015', 'objective frozen';
  assert pg_temp.try(format($q$update public.missions set success_criteria='[]' where id=%L$q$, m)) = 'MI015', 'criteria frozen (no deleting criteria to dodge evidence)';
  assert pg_temp.try(format($q$update public.missions set deliverables='[{"id":"d1","text":"x"}]' where id=%L$q$, m)) = 'MI015', 'deliverables frozen';
  assert pg_temp.try(format($q$update public.missions set agent_ids='{triage,vee}' where id=%L$q$, m)) = 'OK', 'team can change mid-flight';
  -- ref is GENERATED ALWAYS: Postgres itself refuses the write (428C9) before the trigger runs.
  assert pg_temp.try(format($q$update public.missions set ref=ref+1000 where id=%L$q$, m)) = '428C9', 'ref immutable';
  assert pg_temp.try(format($q$update public.missions set tenant_id=gen_random_uuid() where id=%L$q$, m)) = 'MI012', 'tenant immutable';
  assert pg_temp.try(format($q$update public.missions set created_by='atlas' where id=%L$q$, m)) = 'MI012', 'creator immutable';
  perform pg_temp.go(c, 'cancelled');
  assert pg_temp.try(format($q$update public.missions set agent_ids='{}' where id=%L$q$, c)) = 'MI013', 'terminal frozen';
end $$;

-- @test links: tombstone is one-way and the only legal edit; duplicates of live links rejected; re-add after removal ok
do $$
declare m uuid := pg_temp.mk(); l uuid; n int;
begin
  l := pg_temp.ev(m, 'c1');
  assert pg_temp.try(format($q$insert into public.mission_links (mission_id,target_type,target_id,relation,criterion_id,created_by,created_by_kind) values (%L,'url','https://example.test/run','evidence','c1','triage','agent')$q$, m)) = '23505', 'duplicate live link';
  assert pg_temp.try(format($q$update public.mission_links set target_id='https://evil.test' where id=%L$q$, l)) = 'MI028', 'retarget a link';
  assert pg_temp.try(format($q$update public.mission_links set removed_at=now() where id=%L$q$, l)) = '23514', 'tombstone must be complete';
  assert pg_temp.try(format($q$update public.mission_links set removed_at=now(), removed_by='ramon', removed_by_kind='human' where id=%L$q$, l), 'service_role') = 'OK', 'svc tombstone';
  assert pg_temp.try(format($q$update public.mission_links set removed_at=now(), removed_by='ramon', removed_by_kind='human' where id=%L$q$, l)) = 'MI027', 'remove twice';
  assert pg_temp.try(format($q$update public.mission_links set target_id='x' where id=%L$q$, l), 'service_role') = '42501', 'svc cannot edit link fields';
  perform pg_temp.ev(m, 'c1');
  select count(*) into n from public.mission_links where mission_id = m and criterion_id = 'c1';
  assert n = 2, 'tombstoned row kept, live row re-added';
  assert (select count(*) from public.mission_events where mission_id = m and kind = 'link_added') = 2;
  assert (select count(*) from public.mission_events where mission_id = m and kind = 'link_removed') = 1;
  assert (select actor from public.mission_events where mission_id = m and kind = 'link_removed') = 'ramon', 'removal event names the remover';
end $$;

-- @test link shape rules
do $$
declare m uuid := pg_temp.mk(); other uuid := pg_temp.mk(); q text :=
  $q$insert into public.mission_links (mission_id,target_type,target_id,target_index,relation,criterion_id,created_by,created_by_kind) values (%L,%L,%L,%s,%L,%s,'atlas','agent')$q$;
begin
  assert pg_temp.try(format(q, m, 'synthesis_action', gen_random_uuid(), '2', 'task', 'null')) = 'OK', 'plan action with index';
  assert pg_temp.try(format(q, m, 'synthesis_action', gen_random_uuid(), 'null', 'task', 'null')) = '23514', 'action without index';
  assert pg_temp.try(format(q, m, 'job', gen_random_uuid(), '1', 'task', 'null')) = '23514', 'index on a job';
  assert pg_temp.try(format(q, m, 'job', 'not-a-uuid', 'null', 'task', 'null')) = '23514', 'malformed internal id';
  assert pg_temp.try(format(q, m, 'git_branch', 'p06/mission-m1', 'null', 'branch', 'null')) = 'OK', 'external branch ref';
  assert pg_temp.try(format(q, m, 'url', 'https://x.test', 'null', 'evidence', 'null')) = '23514', 'evidence without criterion';
  assert pg_temp.try(format(q, m, 'url', 'https://x.test', 'null', 'context', quote_literal('c1'))) = '23514', 'criterion on non-evidence';
  assert pg_temp.try(format(q, m, 'url', 'https://x.test', 'null', 'evidence', quote_literal('c9'))) = 'MI024', 'unknown criterion';
  assert pg_temp.try(format(q, m, 'mission', m, 'null', 'dependency', 'null')) = 'MI025', 'self dependency';
  assert pg_temp.try(format(q, m, 'mission', 'zzz', 'null', 'dependency', 'null')) = 'MI025', 'non-uuid mission target';
  assert pg_temp.try(format(q, m, 'mission', gen_random_uuid(), 'null', 'dependency', 'null')) = 'MI026', 'ghost mission';
  assert pg_temp.try(format(q, m, 'mission', other, 'null', 'dependency', 'null')) = 'OK', 'real dependency';
  assert pg_temp.try(format(q, m, 'spaceship', 'x', 'null', 'context', 'null')) = '23514', 'unknown target type';
  assert pg_temp.try(format($q$insert into public.mission_links (mission_id,target_type,target_id,relation,created_by,created_by_kind,removed_at,removed_by,removed_by_kind) values (%L,'url','https://x.test','context','atlas','agent',now(),'atlas','agent')$q$, m)) = 'MI023', 'born removed';
end $$;

-- @test links are frozen on terminal missions (evidence cannot be pulled out of a verified mission)
do $$
declare v uuid := pg_temp.mk(); l uuid;
begin
  perform pg_temp.walk_to(v, 'completed'); l := pg_temp.ev(v, 'c1'); perform pg_temp.ev(v, 'c2');
  perform pg_temp.go(v, 'verified');
  assert pg_temp.try(format($q$update public.mission_links set removed_at=now(), removed_by='ramon', removed_by_kind='human' where id=%L$q$, l)) = 'MI022', 'remove evidence after verify';
  assert pg_temp.try(format($q$insert into public.mission_links (mission_id,target_type,target_id,relation,created_by,created_by_kind) values (%L,'url','https://late.test','context','atlas','agent')$q$, v)) = 'MI022', 'add link after verify';
end $$;

-- @test manual event kinds: notes and risks are writable, bounded and structured
do $$
declare m uuid := pg_temp.mk(); q text :=
  $q$insert into public.mission_events (mission_id, kind, actor, actor_kind, detail) values (%L,%L,'triage','agent',%L::jsonb)$q$;
begin
  assert pg_temp.try(format(q, m, 'note', '{"summary":"build green","pr":36}'), 'service_role') = 'OK', 'note';
  assert pg_temp.try(format(q, m, 'risk_raised', '{"risk_id":"r1","severity":"high"}'), 'service_role') = 'OK', 'risk';
  assert pg_temp.try(format(q, m, 'risk_resolved', '{"risk_id":"r1"}'), 'service_role') = 'OK', 'risk resolved';
  assert pg_temp.try(format(q, m, 'note', '{"prompt":"You are..."}')) = '23514', 'prompt key';
  assert pg_temp.try(format(q, m, 'note', '{"meta":{"Authorization":"Bearer x"}}')) = '23514', 'nested auth header';
  assert pg_temp.try(format(q, m, 'note', '{"api-key":"x"}')) = '23514', 'api key, punctuated';
  assert pg_temp.try(format(q, m, 'note', '{"API_KEY":"x"}')) = '23514', 'api key, upper';
  assert pg_temp.try(format(q, m, 'note', '{"model_response":"x"}')) = 'OK', 'compound names are allowed (only exact sensitive names are denied)';
  assert pg_temp.try(format(q, m, 'note', '{"messages":[{"role":"user"}]}')) = '23514', 'chat transcript';
  assert pg_temp.try(format(q, m, 'note', jsonb_build_object('s', repeat('x', 1001)))) = '23514', 'long string';
  assert pg_temp.try(format(q, m, 'note', jsonb_build_object('a', repeat('x', 900), 'b', repeat('x', 900), 'c', repeat('x', 900), 'd', repeat('x', 900), 'e', repeat('x', 900)))) = '23514', 'over 4 KB total';
  assert pg_temp.try(format(q, m, 'note', '{"a":{"b":{"c":{"d":{"e":1}}}}}')) = '23514', 'too deep';
  assert pg_temp.try(format(q, m, 'note', '[1,2]')) = '23514', 'not an object';
  assert pg_temp.try(format($q$select public.mission_transition(%L,'plan','ramon','human','{"token":"x"}'::jsonb)$q$, m)) = 'MI003', 'transition detail is held to the same contract';
end $$;

-- @test definition shape: ids, criteria and deliverables
do $$
declare q text := $q$insert into public.missions (objective, owner, owner_kind, agent_ids, success_criteria, created_by, created_by_kind) values (%L,%L,'human',%L,%L::jsonb,'ramon','human')$q$;
begin
  assert pg_temp.try(format(q, 'ok', 'ramon', '{triage}', '[{"id":"c1","text":"x"}]')) = 'OK';
  assert pg_temp.try(format(q, '   ', 'ramon', '{}', '[]')) = '23514', 'blank objective';
  assert pg_temp.try(format(q, 'x', 'Ramon W', '{}', '[]')) = '23514', 'owner must be an identifier';
  assert pg_temp.try(format(q, 'x', 'ramon', '{"Not Valid"}', '[]')) = '23514', 'agent ids must be identifiers';
  assert pg_temp.try(format(q, 'x', 'ramon', '{}', '[{"id":"c1","text":"a"},{"id":"c1","text":"b"}]')) = '23514', 'duplicate criterion id';
  assert pg_temp.try(format(q, 'x', 'ramon', '{}', '[{"id":"c1","text":"a","extra":1}]')) = '23514', 'extra keys';
  assert pg_temp.try(format(q, 'x', 'ramon', '{}', '[{"id":"c1","text":"  "}]')) = '23514', 'empty criterion text';
  assert pg_temp.try(format(q, 'x', 'ramon', '{}', '{"id":"c1"}')) = '23514', 'criteria must be an array';
end $$;

-- @test telemetry: execution_events.mission_id now references missions; Packet 3 semantics unchanged
do $$
declare m uuid := pg_temp.mk();
  ins text := $q$insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, mission_id) values (gen_random_uuid(), now(), 'gemini', 'agent-reply', 'ok', 'not_reported', 'unknown', %s)$q$;
begin
  assert (select convalidated from pg_constraint where conname = 'execution_events_mission_id_fkey'), 'fk not validated';
  assert pg_temp.try(format(ins, 'null'), 'service_role') = 'OK', 'null mission_id still fine (the Packet 3 writer)';
  assert pg_temp.try(format(ins, quote_literal(gen_random_uuid())), 'service_role') = '23503', 'unknown mission rejected';
  assert pg_temp.try(format(ins, quote_literal(m)), 'service_role') = 'OK', 'real mission accepted';
  assert pg_temp.try($q$insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode, correlation_type, correlation_id) values (gen_random_uuid(), now(), 'gemini', 'agent-reply', 'ok', 'not_reported', 'unknown', 'mission', gen_random_uuid()::text)$q$) = '23514', 'correlation_type mission stays rejected';
  assert pg_temp.try(format($q$update public.missions set objective='x' where id=%L$q$, m)) = 'OK', 'a mission referenced by telemetry is still editable in intent';
  assert pg_temp.try(format($q$delete from public.missions where id=%L$q$, m)) = 'MI010', 'and still never deletable';
end $$;

select 'mission_identity_m1: all tests passed' as result;
