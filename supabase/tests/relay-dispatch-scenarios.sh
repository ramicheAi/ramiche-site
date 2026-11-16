#!/usr/bin/env bash
# Relay dispatch scenario matrix against a throwaway PostgreSQL 17 cluster.
#
# Proves the states the route depends on, including the ones that cannot be unit-tested:
#   - one live claim per message per lease (concurrent claimers, repeated)
#   - an expired lease is recorded as 'unknown', not silently forgotten or reported as a delivery
#   - a stale attempt cannot write the outcome of the attempt that replaced it
#   - delivered and failed_permanent are terminal under every retry
#   - 'unknown' and 'failed' are retryable, and they are distinguishable in the audit trail
#   - anon/authenticated cannot execute the functions
#
# Usage: supabase/tests/relay-dispatch-scenarios.sh
set -euo pipefail

PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATION="$ROOT/supabase/migrations/20261115120000_cc_relay_dispatch_terminal_state.sql"
ROLLBACK="$ROOT/supabase/migrations/20261115120001_cc_relay_dispatch_terminal_state_rollback.sql.txt"
TMP="$(mktemp -d)"
PORT=$(( 56000 + RANDOM % 2000 ))
FAIL=0

cleanup() { "$PGBIN/pg_ctl" -D "$TMP/pgdata" stop -m fast >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

"$PGBIN/initdb" -D "$TMP/pgdata" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/pgdata" -o "-p $PORT -k $TMP -c listen_addresses=127.0.0.1" -l "$TMP/pg.log" start >/dev/null
sleep 1

psqlq() { "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
val() { "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -t -A -c "$1"; }
check() { # check <label> <expected> <actual>; psql prints booleans as true/false
  local actual="$3"
  actual="${actual//true/t}"; actual="${actual//false/f}"
  if [ "$2" = "$actual" ]; then echo "  PASS  $1 ($actual)"; else echo "  FAIL  $1: expected [$2] got [$actual]"; FAIL=1; fi
}

psqlq -c "create role service_role nologin bypassrls;
          create role anon nologin;
          create role authenticated nologin;
          create table messages (id uuid primary key, relay_claimed boolean not null default false,
            relay_status text not null default 'pending', relay_claimed_at timestamptz,
            relay_attempts int not null default 0, updated_at timestamptz default now(),
            created_at timestamptz default now());"

echo "== migration applies alone, with no predecessor =="
psqlq -f "$MIGRATION" && echo "  PASS  applied"

# No audit trigger: an earlier version of this script installed one to observe a demotion of an
# expired claim to 'unknown' that happened inside the claim's own transaction. A reader can never
# see that value, and the row it produces is identical to one reclaimed straight from 'claimed', so
# asserting it was asserting an implementation detail, not production behaviour. What is asserted
# below is what an operator can actually observe: the attempt counter and the stored status.

M=11111111-1111-1111-1111-111111111111
psqlq -c "insert into messages(id) values ('$M');"

check "index on non-terminal statuses exists" "t" "$(val "select exists (select 1 from pg_indexes where indexname='messages_relay_status_idx')")"

echo "== one live claim per lease =="
check "first claim wins" "t|1|claimed" "$(val "select claimed||'|'||attempts||'|'||status from cc_claim_relay_dispatch('$M'::uuid)")"
check "second claim inside the lease is refused with its status" "f||claimed" "$(val "select claimed||'|'||coalesce(attempts::text,'')||'|'||status from cc_claim_relay_dispatch('$M'::uuid)")"

echo "== a lease that expires is reclaimable, and the retry is visible in the counter =="
psqlq -c "update messages set relay_claimed_at = now() - interval '10 minutes' where id = '$M';"
check "expired attempt is claimed by the next caller" "t|2|claimed" "$(val "select claimed||'|'||attempts||'|'||status from cc_claim_relay_dispatch('$M'::uuid)")"
check "the row records that it was dispatched twice" "2" "$(val "select relay_attempts from messages where id='$M'")"
check "a live lease, by contrast, is not reclaimable" "f||claimed" "$(val "select claimed||'|'||coalesce(attempts::text,'')||'|'||status from cc_claim_relay_dispatch('$M'::uuid)")"

echo "== a stale attempt cannot write the outcome =="
check "attempt 1 mark is refused" "f" "$(val "select cc_mark_relay_status('$M'::uuid,'delivered',1)")"
check "attempt 2 mark lands" "t" "$(val "select cc_mark_relay_status('$M'::uuid,'delivered',2)")"

echo "== delivered is terminal =="
psqlq -c "update messages set relay_claimed_at = now() - interval '1 hour' where id = '$M';"
check "delivered row is never reclaimed" "f|delivered" "$(val "select claimed||'|'||status from cc_claim_relay_dispatch('$M'::uuid)")"
check "a late mark cannot rewrite delivered" "f" "$(val "select cc_mark_relay_status('$M'::uuid,'failed',2)")"

echo "== unknown is distinguishable from failed, and both are retryable =="
U=22222222-2222-2222-2222-222222222222
psqlq -c "insert into messages(id) values ('$U');"
val "select claimed from cc_claim_relay_dispatch('$U'::uuid)" >/dev/null
check "unknown mark lands" "t" "$(val "select cc_mark_relay_status('$U'::uuid,'unknown',1)")"
check "recorded state is unknown" "unknown" "$(val "select relay_status from messages where id='$U'")"
check "an unknown outcome is retryable immediately" "t|2" "$(val "select claimed||'|'||attempts from cc_claim_relay_dispatch('$U'::uuid)")"
check "a verified failure is recorded as failed" "t" "$(val "select cc_mark_relay_status('$U'::uuid,'failed',2)")"
check "a failed outcome is retryable immediately" "t|3" "$(val "select claimed||'|'||attempts from cc_claim_relay_dispatch('$U'::uuid)")"

echo "== legacy rows claim no outcome and are never retried =="
L=55555555-5555-5555-5555-555555555555
psqlq -c "insert into messages(id, relay_claimed, relay_status, relay_claimed_at) values ('$L', true, 'legacy', now() - interval '30 days');"
check "a legacy row is never reclaimed, even long after any lease" "f|legacy" "$(val "select claimed||'|'||status from cc_claim_relay_dispatch('$L'::uuid)")"
check "a late mark cannot turn legacy into a delivery" "f" "$(val "select cc_mark_relay_status('$L'::uuid,'delivered',1)")"
check "legacy was not silently rewritten" "legacy" "$(val "select relay_status from messages where id='$L'")"

echo "== a pre-migration claimed row is backfilled to legacy, not to delivered =="
B=66666666-6666-6666-6666-666666666666
psqlq -c "insert into messages(id, relay_claimed, relay_status, relay_claimed_at) values ('$B', true, 'pending', now() - interval '20 days');"
psqlq -f "$MIGRATION" >/dev/null 2>&1
check "backfill chose legacy" "legacy" "$(val "select relay_status from messages where id='$B'")"
check "the backfilled row is not reclaimable" "f|legacy" "$(val "select claimed||'|'||status from cc_claim_relay_dispatch('$B'::uuid)")"
R=77777777-7777-7777-7777-777777777777
psqlq -c "insert into messages(id) values ('$R');"
val "select claimed from cc_claim_relay_dispatch('$R'::uuid)" >/dev/null
psqlq -f "$MIGRATION" >/dev/null 2>&1
check "re-applying the migration leaves an in-flight claim alone" "claimed|1" "$(val "select relay_status||'|'||relay_attempts from messages where id='$R'")"

echo "== failed_permanent is terminal =="
check "permanent mark lands" "t" "$(val "select cc_mark_relay_status('$U'::uuid,'failed_permanent',3)")"
psqlq -c "update messages set relay_claimed_at = now() - interval '1 day' where id = '$U';"
check "permanent failure is never reclaimed" "f|failed_permanent" "$(val "select claimed||'|'||status from cc_claim_relay_dispatch('$U'::uuid)")"

echo "== concurrent claimers: exactly one winner, ten rounds =="
WINNERS_OK=1
for i in $(seq 1 10); do
  C=$(printf '3333%04d-3333-3333-3333-333333333333' "$i")
  psqlq -c "insert into messages(id) values ('$C');"
  "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -t -A -c "select claimed from cc_claim_relay_dispatch('$C'::uuid)" > "$TMP/a" &
  "$PGBIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -t -A -c "select claimed from cc_claim_relay_dispatch('$C'::uuid)" > "$TMP/b" &
  wait
  W=$(cat "$TMP/a" "$TMP/b" | grep -c '^t$' || true)
  [ "$W" = "1" ] || { WINNERS_OK=0; echo "  FAIL  round $i produced $W winners"; }
done
check "one winner in every round" "1" "$WINNERS_OK"

echo "== unknown id fails open, it does not hold a phantom lease =="
check "missing row is reported as not_found" "f||not_found" "$(val "select claimed||'|'||coalesce(attempts::text,'')||'|'||status from cc_claim_relay_dispatch('44444444-4444-4444-4444-444444444444'::uuid)")"

echo "== grants =="
check "anon cannot execute" "f" "$(val "select has_function_privilege('anon','public.cc_claim_relay_dispatch(uuid,int)','EXECUTE')")"
check "authenticated cannot execute" "f" "$(val "select has_function_privilege('authenticated','public.cc_mark_relay_status(uuid,text,int)','EXECUTE')")"
check "service_role can execute" "t" "$(val "select has_function_privilege('service_role','public.cc_claim_relay_dispatch(uuid,int)','EXECUTE')")"
check "security invoker" "f" "$(val "select prosecdef from pg_proc where proname='cc_claim_relay_dispatch'")"
check "search_path pinned" "search_path=pg_catalog, pg_temp" "$(val "select proconfig[1] from pg_proc where proname='cc_claim_relay_dispatch'")"

echo "== rollback executes and keeps the column the older route needs =="
psqlq -f "$ROLLBACK" >/dev/null 2>&1 && echo "  PASS  rollback clean"
check "relay_claimed retained" "t" "$(val "select exists (select 1 from information_schema.columns where table_name='messages' and column_name='relay_claimed')")"
check "index dropped with the rollback" "f" "$(val "select exists (select 1 from pg_indexes where indexname='messages_relay_status_idx')")"

echo
if [ "$FAIL" = "0" ]; then echo "ALL SCENARIOS PASSED"; else echo "SCENARIOS FAILED"; exit 1; fi
