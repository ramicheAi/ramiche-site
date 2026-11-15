#!/usr/bin/env bash
# CC-SECURITY-CI-01 — negative-test harness for supabase/tests/cc_auth_privileges.sql
#
# Proves the privilege regression actually rejects a regression, instead of just
# asserting the happy path. Each scenario opens a transaction, applies one
# deliberate violation, runs the real cc_auth_privileges.sql in that same
# session, and expects it to fail with a SPECIFIC error message (not merely a
# non-zero exit — a connection failure, a typo'd table name, or any other
# unrelated psql error must not be mistaken for the gate working). The
# transaction is never committed — psql exiting on error leaves the
# connection open on an aborted transaction, which the server rolls back when
# the connection closes. No scenario mutation is ever persisted, and
# scenarios run sequentially against the same already-provisioned database.
#
# Usage: cc_auth_privileges_negative.sh <DATABASE_URL>
set -euo pipefail

DB_URL="$1"
TEST_SQL="$(dirname "$0")/cc_auth_privileges.sql"

run_scenario() {
  local name="$1" mutation="$2" expected="$3"
  echo "--- negative scenario: $name ---"
  local out status
  set +e
  out="$(psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL 2>&1
begin;
$mutation
\i $TEST_SQL
rollback;
SQL
)"
  status=$?
  set -e
  echo "$out"
  if [ "$status" -eq 0 ]; then
    echo "::error::negative scenario '$name' did NOT fail — the regression gate failed to catch it"
    exit 1
  fi
  if ! grep -qF "$expected" <<<"$out"; then
    echo "::error::negative scenario '$name' failed, but NOT with the expected error. Expected to contain: $expected"
    echo "::error::This means the gate may have failed for an unrelated reason (connection error, typo, missing object), not the regression it is supposed to catch."
    exit 1
  fi
  echo "OK: '$name' failed with the expected error"
}

run_scenario \
  "accidental SELECT grant on cc_device_enrollment_codes" \
  "grant select on table public.cc_device_enrollment_codes to service_role;" \
  "service_role still has SELECT on cc_device_enrollment_codes"

run_scenario \
  "EXECUTE revoked on cc_redeem_device_enrollment_code" \
  "revoke execute on function public.cc_redeem_device_enrollment_code(text, text) from service_role;" \
  "service_role lacks EXECUTE on public.cc_redeem_device_enrollment_code"

run_scenario \
  "SECURITY DEFINER removed from cc_bootstrap_reset" \
  "alter function public.cc_bootstrap_reset(text) security invoker;" \
  "function public.cc_bootstrap_reset(text) is not SECURITY DEFINER"

run_scenario \
  "search_path widened on cc_trusted_device_claim_pin_attempt" \
  "alter function public.cc_trusted_device_claim_pin_attempt(uuid, int, int) set search_path = public, pg_temp;" \
  "function public.cc_trusted_device_claim_pin_attempt(uuid,int,int) is not SECURITY DEFINER"

run_scenario \
  "migration 4's excess-privilege revoke simulated as deleted (service_role keeps the Supabase default DELETE)" \
  "grant delete on table public.cc_trusted_devices to service_role;" \
  "service_role still has DELETE on cc_trusted_devices"

run_scenario \
  "migrations 1/2's anon table revoke simulated as deleted (anon keeps the Supabase default SELECT)" \
  "grant select on table public.cc_trusted_devices to anon;" \
  "anon has SELECT on public.cc_trusted_devices"

echo "all negative scenarios failed with their exact expected error; no mutation persisted (every scenario ran in an uncommitted transaction)"
