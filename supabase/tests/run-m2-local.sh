#!/bin/bash
# P06 Mission Identity M2: local, $0, disposable. Never touches a remote database.
# Builds a throwaway PostgreSQL 17 cluster (UTF8), emulates the Supabase roles and default grants, applies the live
# baseline + the migrations production already has + the real M1 migration, seeds a few target records, then runs the
# M2 Mission layer and its routes against it (src/lib/missions/missions-db.test.ts) as service_role.
# Usage: PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash supabase/tests/run-m2-local.sh
set -u
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PG=${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
export LC_ALL=C LANG=C
WORK=$(mktemp -d /tmp/m2rep.XXXX); DATA=$WORK/data; SOCK=$WORK
PORT=${PG_PORT:-55501}
export PGHOST=$SOCK PGPORT=$PORT PGUSER=postgres
cleanup(){ "$PG/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1; rm -rf "$WORK"; }
trap cleanup EXIT

"$PG/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C >/dev/null 2>&1 || { echo "initdb failed"; exit 2; }
"$PG/pg_ctl" -D "$DATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$WORK/pg.log" start >/dev/null 2>&1
for i in $(seq 1 20); do "$PG/pg_isready" >/dev/null 2>&1 && break; sleep 1; done
"$PG/createdb" m2 || { echo "createdb failed"; exit 2; }
apply(){ "$PG/psql" -v ON_ERROR_STOP=1 -q -d m2 -f "$1" >/dev/null 2>&1 || { echo "ABORT: $(basename "$1") did not apply"; exit 1; }; }

"$PG/psql" -q -d m2 >/dev/null 2>&1 <<'SQL'
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls; create role supabase_admin nologin;
create schema if not exists auth; create schema if not exists extensions;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
SQL
apply "$ROOT/supabase/baseline/live-schema-2026-09-28.sql"
apply "$ROOT/supabase/migrations/20260930000000_execution_events.sql"
apply "$ROOT/supabase/migrations/20261002110000_dm_conversations.sql"
apply "$ROOT/supabase/migrations/20261003120000_mission_identity_m1.sql"
[ "$("$PG/psql" -tAq -d m2 -c "select count(*) from pg_class where relname in ('missions','mission_links','mission_events')")" = "3" ] || { echo "ABORT: M1 not present"; exit 1; }

# Fixed seed ids, mirrored in missions-db.test.ts. One job lives in another tenant to prove tenant scoping.
"$PG/psql" -v ON_ERROR_STOP=1 -q -d m2 >/dev/null <<'SQL' || { echo "ABORT: seed failed"; exit 1; }
insert into public.jobs (id, tenant_id, title) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'seed job'),
  ('a0000000-0000-4000-8000-000000000002', '22222222-2222-2222-2222-222222222222', 'other tenant job');
insert into public.channels (id, tenant_id, name, slug, type) values
  ('b0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'general', 'general-m2', 'public');
insert into public.messages (id, tenant_id, channel_id, content, metadata) values
  ('c0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-4000-8000-000000000001', 'synthesis',
   '{"kind":"synthesis","plan":{"decision":"d","actions":[{"owner":"atlas","task":"a"},{"owner":"nova","task":"b"}]}}'),
  ('c0000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'b0000000-0000-4000-8000-000000000001', 'plain', '{}');
insert into public.pipeline_gate (id, kind, title) values ('d0000000-0000-4000-8000-000000000001', 'send', 'seed gate');
insert into public.pipeline_leads (id, tenant_id) values ('e0000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111');
-- a mission in another tenant, inserted as the table owner, to prove it is invisible to the tenant-scoped layer
insert into public.missions (id, tenant_id, objective, owner, owner_kind, created_by, created_by_kind)
values ('f0000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'other tenant', 'ramon', 'human', 'ramon', 'human');
SQL

echo "=== M2 against real M1 (PG17 UTF8, service_role)"
cd "$ROOT" && M2_PG_HOST=$SOCK M2_PG_PORT=$PORT M2_PG_DB=m2 M2_PG_BIN=$PG npx vitest run src/lib/missions/missions-db.test.ts
rc=$?
[ $rc -eq 0 ] && echo "M2 LOCAL DB SUITE: PASSED" || echo "M2 LOCAL DB SUITE: FAILED"
exit $rc
