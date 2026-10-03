#!/bin/bash
# P06 Mission Identity M1: local, $0, disposable replay. Never touches a remote database.
# Builds a throwaway PostgreSQL 17 cluster, emulates the Supabase platform roles and default grants, applies the live
# baseline + the pending migrations production already has + M1, then runs:
#   1. the SQL test suite (supabase/tests/mission_identity_m1.test.sql)
#   2. two-session concurrency races (they need real separate connections)
#   3. an execution_events "rows untouched" proof
#   4. rollback on a copy, then a clean re-apply
# Usage: PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash supabase/tests/run-m1-local.sh
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PG=${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
export LC_ALL=C LANG=C
WORK=$(mktemp -d /tmp/m1rep.XXXX); DATA=$WORK/data; SOCK=$WORK
PORT=${PG_PORT:-55441}
export PGHOST=$SOCK PGPORT=$PORT PGUSER=postgres
fails=0
pass(){ echo "PASS  $1"; }
fail(){ echo "FAIL  $1"; fails=$((fails+1)); }
cleanup(){ "$PG/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1; rm -rf "$WORK"; }
trap cleanup EXIT

"$PG/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null 2>&1 || { echo "initdb failed"; exit 2; }
"$PG/pg_ctl" -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$WORK/pg.log" start >/dev/null 2>&1
for i in $(seq 1 20); do "$PG/pg_isready" >/dev/null 2>&1 && break; sleep 1; done
"$PG/createdb" m1 || { echo "createdb failed"; exit 2; }
q(){ "$PG/psql" -tAq -d m1 -c "$1" 2>&1; }
apply(){ local e; e=$("$PG/psql" -v ON_ERROR_STOP=1 -q -d m1 -f "$1" 2>&1 | grep -E "ERROR" | head -1); [ -z "$e" ] && pass "applies cleanly: $(basename "$1")" || fail "$(basename "$1"): $e"; }

echo "=== 0. Supabase platform emulation (roles + the default grants every new public table/function gets)"
"$PG/psql" -q -d m1 >/dev/null 2>&1 <<'SQL'
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls; create role supabase_admin nologin;
create schema if not exists auth; create schema if not exists extensions;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL
echo "=== 1. live baseline + pending migrations production already has"
apply "$ROOT/supabase/baseline/live-schema-2026-09-28.sql"
apply "$ROOT/supabase/migrations/20260930000000_execution_events.sql"
apply "$ROOT/supabase/migrations/20261002110000_dm_conversations.sql"

echo "=== 2. seed pre-existing telemetry (mission_id NULL, as every production row is)"
q "insert into public.execution_events (id, started_at, provider, purpose, outcome, usage_quality, billing_mode)
   select gen_random_uuid(), now() - (g||' minutes')::interval, 'gemini', 'agent-reply', 'ok', 'not_reported', 'unknown'
   from generate_series(1,25) g" >/dev/null
EV_BEFORE=$(q "select md5(string_agg(e::text, '|' order by id)) from public.execution_events e")
EECON_BEFORE=$(q "select string_agg(conname||':'||pg_get_constraintdef(oid), ' | ' order by conname) from pg_constraint where conrelid='public.execution_events'::regclass")
echo "   25 rows seeded, digest ${EV_BEFORE:0:12}"

echo "=== 3. apply M1"
apply "$ROOT/supabase/migrations/20261003120000_mission_identity_m1.sql"
# Snapshot the realistic production state right after apply: M1 present, no telemetry references a mission yet.
"$PG/psql" -q -d postgres -c "create database rb_clean template m1" >/dev/null 2>&1 || "$PG/createdb" -T m1 rb_clean
# Fail fast: every later check is meaningless if M1 did not apply (no vacuous passes).
[ "$(q "select count(*) from pg_class where relname in ('missions','mission_links','mission_events')")" = "3" ] || { echo "ABORT: M1 did not apply; nothing below would mean anything"; exit 1; }
[ "$(q "select md5(string_agg(e::text, '|' order by id)) from public.execution_events e")" = "$EV_BEFORE" ] && pass "existing execution_events rows byte-identical after M1" || fail "execution_events rows changed"
[ "$(q "select count(*) from public.execution_events where mission_id is not null")" = "0" ] && pass "no existing event gained a mission_id" || fail "mission_id written"
[ "$(q "select convalidated from pg_constraint where conname='execution_events_mission_id_fkey'")" = "t" ] && pass "execution_events.mission_id FK present and validated" || fail "fk"
# the platform default grants are real here; prove M1's revokes beat them
for t in missions mission_links mission_events; do
  for r in anon authenticated; do
    [ "$(q "select has_table_privilege('$r','public.$t','select')::text")" = "false" ] && pass "$r has no access to $t despite default grants" || fail "$r can read $t"
  done
  [ "$(q "select has_table_privilege('service_role','public.$t','delete')::text")" = "false" ] && pass "service_role cannot DELETE $t" || fail "svc delete $t"
  [ "$(q "select has_table_privilege('service_role','public.$t','truncate')::text")" = "false" ] && pass "service_role cannot TRUNCATE $t" || fail "svc truncate $t"
done
[ "$(q "select has_column_privilege('service_role','public.missions','state','update')::text")" = "false" ] && pass "service_role cannot UPDATE missions.state" || fail "svc state update"
[ "$(q "select has_function_privilege('anon','public.mission_transition(uuid,text,text,text,jsonb,text)','execute')::text")" = "false" ] && pass "anon cannot execute mission_transition" || fail "anon exec"

echo "=== 4. SQL test suite"
OUT=$("$PG/psql" -v ON_ERROR_STOP=1 -q -d m1 -f "$ROOT/supabase/tests/mission_identity_m1.test.sql" 2>&1)
if echo "$OUT" | grep -q "mission_identity_m1: all tests passed"; then pass "SQL suite: $(grep -c '^-- @test' "$ROOT/supabase/tests/mission_identity_m1.test.sql") test blocks"
else fail "SQL suite"; echo "$OUT" | grep -E "ERROR|assert|CONTEXT" | head -8; fi

echo "=== 5. concurrency (two real sessions)"
mk(){ q "insert into public.missions (objective, owner, owner_kind, agent_ids, success_criteria, created_by, created_by_kind)
        values ('race','ramon','human','{triage}','[{\"id\":\"c1\",\"text\":\"x\"},{\"id\":\"c2\",\"text\":\"y\"}]','ramon','human') returning id" | head -1; }
walk(){ for s in "$@"; do q "select public.mission_transition('$M','$s','ramon','human')" >/dev/null; done; }
sess(){ "$PG/psql" -q -d m1 -v ON_ERROR_STOP=0 -v VERBOSITY=verbose -c "\\set VERBOSITY verbose" -c "$1" 2>&1; }
code_of(){ grep -oE "ERROR:  [A-Z0-9]{5}" <<<"$1" | head -1 | awk '{print $2}'; }

# C1: two sessions race the same transition. One wins, the other blocks on the row lock, then fails closed.
M=$(mk)
( "$PG/psql" -q -d m1 -c "begin; select public.mission_transition('$M','plan','ramon','human'); select pg_sleep(3); commit;" >/dev/null 2>&1 ) &
sleep 1; T0=$(date +%s)
B=$("$PG/psql" -q -d m1 -c "\\set VERBOSITY verbose" -c "select public.mission_transition('$M','plan','atlas','agent')" 2>&1); T1=$(date +%s); wait
[ "$(code_of "$B")" = "MI006" ] && pass "C1 duplicate transition: loser fails closed (MI006)" || fail "C1 got [$(code_of "$B")]"
[ $((T1-T0)) -ge 1 ] && pass "C1 loser waited on the row lock (${T1}-${T0}s)" || fail "C1 did not block"
[ "$(q "select count(*) from public.mission_events where mission_id='$M' and kind='state_changed'")" = "1" ] && pass "C1 exactly one transition event" || fail "C1 event count"

# C2: verification holds the lock; a concurrent evidence removal waits, then finds the mission terminal.
M=$(mk); walk plan approved executing reviewing completed
L1=$(q "insert into public.mission_links (mission_id,target_type,target_id,relation,criterion_id,created_by,created_by_kind) values ('$M','url','https://e.test/1','evidence','c1','triage','agent') returning id" | head -1)
q "insert into public.mission_links (mission_id,target_type,target_id,relation,criterion_id,created_by,created_by_kind) values ('$M','url','https://e.test/2','evidence','c2','triage','agent')" >/dev/null
( "$PG/psql" -q -d m1 -c "begin; select public.mission_transition('$M','verified','ramon','human'); select pg_sleep(3); commit;" >/dev/null 2>&1 ) &
sleep 1
B=$("$PG/psql" -q -d m1 -c "\\set VERBOSITY verbose" -c "update public.mission_links set removed_at=now(), removed_by='triage', removed_by_kind='agent' where id='$L1'" 2>&1); wait
[ "$(code_of "$B")" = "MI022" ] && pass "C2 evidence cannot be pulled out from under a verification (MI022)" || fail "C2 got [$(code_of "$B")]"
[ "$(q "select state from public.missions where id='$M'")" = "verified" ] && [ "$(q "select count(*) from public.mission_links where mission_id='$M' and removed_at is null")" = "2" ] && pass "C2 verified with its full evidence set intact" || fail "C2 end state"

# C3: the reverse order. A removal holds the mission share lock; verification waits, then sees the gap.
M=$(mk); walk plan approved executing reviewing completed
L1=$(q "insert into public.mission_links (mission_id,target_type,target_id,relation,criterion_id,created_by,created_by_kind) values ('$M','url','https://e.test/1','evidence','c1','triage','agent') returning id" | head -1)
q "insert into public.mission_links (mission_id,target_type,target_id,relation,criterion_id,created_by,created_by_kind) values ('$M','url','https://e.test/2','evidence','c2','triage','agent')" >/dev/null
( "$PG/psql" -q -d m1 -c "begin; update public.mission_links set removed_at=now(), removed_by='triage', removed_by_kind='agent' where id='$L1'; select pg_sleep(3); commit;" >/dev/null 2>&1 ) &
sleep 1
B=$("$PG/psql" -q -d m1 -c "\\set VERBOSITY verbose" -c "select public.mission_transition('$M','verified','ramon','human')" 2>&1); wait
[ "$(code_of "$B")" = "MI009" ] && pass "C3 verification waits for the in-flight removal, then refuses (MI009)" || fail "C3 got [$(code_of "$B")]"
[ "$(q "select state from public.missions where id='$M'")" = "completed" ] && pass "C3 mission stays completed" || fail "C3 end state"

# C4: two callers both believe the mission is in intent. The second one's optimistic check fails closed.
M=$(mk)
( "$PG/psql" -q -d m1 -c "begin; select public.mission_transition('$M','plan','ramon','human','{}'::jsonb,'intent'); select pg_sleep(3); commit;" >/dev/null 2>&1 ) &
sleep 1
B=$("$PG/psql" -q -d m1 -c "\\set VERBOSITY verbose" -c "select public.mission_transition('$M','cancelled','atlas','agent','{}'::jsonb,'intent')" 2>&1); wait
[ "$(code_of "$B")" = "MI005" ] && pass "C4 stale optimistic caller fails closed (MI005)" || fail "C4 got [$(code_of "$B")]"
[ "$(q "select state from public.missions where id='$M'")" = "plan" ] && pass "C4 the intended transition stands, the stale one did not apply" || fail "C4 end state"

# C5: a transition that fails mid-flight leaves no trace (single transaction).
M=$(mk); walk plan
EV=$(q "select count(*) from public.mission_events where mission_id='$M'")
q "begin; select public.mission_transition('$M','approved','ramon','human','{\"secret\":\"x\"}'::jsonb); commit;" >/dev/null 2>&1
[ "$(q "select state from public.missions where id='$M'")" = "plan" ] && [ "$(q "select count(*) from public.mission_events where mission_id='$M'")" = "$EV" ] && pass "C5 rejected transition wrote nothing" || fail "C5 partial write"

echo "=== 6a. rollback in the realistic state (M1 applied, no telemetry references a mission), then clean re-apply"
qr(){ "$PG/psql" -tAq -d rb_clean -c "$1" 2>&1; }
E=$("$PG/psql" -v ON_ERROR_STOP=1 -q -d rb_clean -f "$ROOT/supabase/rollbacks/20261003120000_mission_identity_m1.rollback.sql" 2>&1 | grep ERROR | head -1)
[ -z "$E" ] && pass "rollback applies cleanly" || fail "rollback: $E"
[ "$(qr "select count(*) from pg_class where relname in ('missions','mission_links','mission_events')")" = "0" ] && pass "rollback: mission tables gone" || fail "tables remain"
[ "$(qr "select count(*) from pg_proc where proname like 'mission%'")" = "0" ] && pass "rollback: mission functions gone" || fail "functions remain"
[ "$(qr "select string_agg(conname||':'||pg_get_constraintdef(oid), ' | ' order by conname) from pg_constraint where conrelid='public.execution_events'::regclass")" = "$EECON_BEFORE" ] && pass "rollback: execution_events constraints identical to pre-M1" || fail "execution_events constraints differ"
[ "$(qr "select md5(string_agg(e::text, '|' order by id)) from public.execution_events e")" = "$EV_BEFORE" ] && pass "rollback: execution_events rows byte-identical to pre-M1" || fail "rows differ"
E=$("$PG/psql" -v ON_ERROR_STOP=1 -q -d rb_clean -f "$ROOT/supabase/rollbacks/20261003120000_mission_identity_m1.rollback.sql" 2>&1 | grep ERROR | head -1)
[ -z "$E" ] && pass "rollback is idempotent" || fail "rollback re-run: $E"
E=$("$PG/psql" -v ON_ERROR_STOP=1 -q -d rb_clean -f "$ROOT/supabase/migrations/20261003120000_mission_identity_m1.sql" 2>&1 | grep ERROR | head -1)
[ -z "$E" ] && pass "M1 re-applies cleanly after rollback" || fail "re-apply: $E"

echo "=== 6b. rollback AFTER use (telemetry already references a mission): must not rewrite telemetry, re-apply must fail closed"
"$PG/psql" -q -d postgres -c "create database rb_used template m1" >/dev/null 2>&1 || "$PG/createdb" -T m1 rb_used
qu(){ "$PG/psql" -tAq -d rb_used -c "$1" 2>&1; }
REF=$(qu "select count(*) from public.execution_events where mission_id is not null")
[ "$REF" -ge 1 ] && pass "precondition: $REF telemetry row(s) reference a mission" || fail "no referencing row to test with"
E=$("$PG/psql" -v ON_ERROR_STOP=1 -q -d rb_used -f "$ROOT/supabase/rollbacks/20261003120000_mission_identity_m1.rollback.sql" 2>&1 | grep ERROR | head -1)
[ -z "$E" ] && pass "after-use rollback applies" || fail "after-use rollback: $E"
[ "$(qu "select count(*) from public.execution_events where mission_id is not null")" = "$REF" ] && pass "after-use rollback left telemetry untouched (mission_ids kept, now dangling)" || fail "telemetry was rewritten"
OUT=$("$PG/psql" -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -q -d rb_used -c "\\set VERBOSITY verbose" -f "$ROOT/supabase/migrations/20261003120000_mission_identity_m1.sql" 2>&1 | grep -E "ERROR" | head -1)
echo "$OUT" | grep -q "execution_events_mission_id_fkey" && pass "re-apply after use FAILS CLOSED at the FK (documented; needs an explicit data decision)" || fail "re-apply after use did not fail closed: $OUT"

echo; [ $fails -eq 0 ] && echo "M1 REPLAY: ALL CHECKS PASSED" || echo "M1 REPLAY: $fails FAILURE(S)"
exit $fails
