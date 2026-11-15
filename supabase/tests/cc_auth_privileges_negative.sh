#!/usr/bin/env bash
# CC-SECURITY-CI-01 — negative-test harness for supabase/tests/cc_auth_privileges.sql
#
# Proves the privilege regression actually rejects a regression, instead of just
# asserting the happy path. Each scenario opens a transaction, applies one
# deliberate violation, runs the real cc_auth_privileges.sql in that same
# session, and expects it to fail (psql -v ON_ERROR_STOP=1 exits non-zero on
# the raised exception). The transaction is never committed — psql exiting on
# error leaves the connection open on an aborted transaction, which the server
# rolls back when the connection closes. No scenario mutation is ever persisted,
# and scenarios run sequentially against the same already-provisioned database.
#
# Usage: cc_auth_privileges_negative.sh <DATABASE_URL>
set -euo pipefail

DB_URL="$1"
TEST_SQL="$(dirname "$0")/cc_auth_privileges.sql"

run_scenario() {
  local name="$1" mutation="$2"
  echo "--- negative scenario: $name ---"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
begin;
$mutation
\i $TEST_SQL
rollback;
SQL
  then
    echo "::error::negative scenario '$name' did NOT fail — the regression gate failed to catch it"
    exit 1
  fi
  echo "OK: '$name' was correctly rejected by cc_auth_privileges.sql"
}

run_scenario \
  "accidental SELECT grant on cc_device_enrollment_codes" \
  "grant select on table public.cc_device_enrollment_codes to service_role;"

run_scenario \
  "EXECUTE revoked on cc_redeem_device_enrollment_code" \
  "revoke execute on function public.cc_redeem_device_enrollment_code(text, text) from service_role;"

run_scenario \
  "SECURITY DEFINER removed from cc_bootstrap_reset" \
  "alter function public.cc_bootstrap_reset(text) security invoker;"

run_scenario \
  "search_path widened on cc_trusted_device_claim_pin_attempt" \
  "alter function public.cc_trusted_device_claim_pin_attempt(uuid, int, int) set search_path = public, pg_temp;"

echo "all negative scenarios correctly rejected; no mutation persisted (every scenario ran in an uncommitted transaction)"
