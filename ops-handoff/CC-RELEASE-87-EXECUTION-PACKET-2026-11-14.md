# CC-RELEASE-87 — corrective execution packet (production on hold)

**Status:** local implementation and verification complete. No production SQL, merge, deploy or
enrollment performed in this phase.

**Pinned branch:** `security/cc-trusted-device-pin-unlock-01`, PR #87. The exact head is recorded in
the PR and the final disposition report.

**Production:** `50b45f4b` / `dpl_8qEVs3qapwhHvRLToNUienWG3H3w`, READY, untouched.

## Current database state

| Item | State |
|---|---|
| Migrations 1-3 | applied |
| Corrective migration 4 | prepared, not applied |
| Auth table rows | 0 devices, 0 codes, 0 bootstrap rows |
| `service_role` on the three tables | ALL, including DELETE/TRUNCATE/MAINTAIN |
| Migration history | two ad-hoc rows, `cc_trusted_devices` missing |
| Intended history | `20261112200000`, `20261113000000`, `20261114000000`, `20261114010000` |

## Exact production order (requires separate authorization)

1. Re-run the release preflight: PR head, `main`, CI, production deployment, rollback target, zero
   auth rows, and the exact history rows. Stop on any drift.
2. Apply `20261114010000_cc_auth_service_role_least_privilege.sql` in one transaction through the
   SQL editor. Use plain SQL, not a migration runner, so history is unchanged.
3. Run the read-only privilege regression `supabase/tests/cc_auth_privileges.sql`. It must print
   PASS. Stop on any failure.
4. Run the guarded metadata repair `ops-handoff/CC-RELEASE-87-HISTORY-REPAIR.sql` in one
   transaction. It verifies the two ad-hoc rows, the absence of canonical rows, the schema and the
   corrective privileges, then rewrites history to the four canonical versions. It aborts on any
   mismatch.
5. Verify the final history has exactly the four canonical rows and no ad-hoc rows.
6. Merge/deploy PR #87 only, after separate authorization. PRs #83-#86 remain out.
7. Smoke tests, then stop before first-device enrollment.

## Failure handling

- Privilege regression fails: stop. Do not repair history. Migration 4 is additive and can be
  inspected; do not grant broad privileges back without review.
- History repair aborts: nothing changed, because it runs in one transaction. Send the error. Do
  not run an unconditional repair.
- History repair succeeds but a later gate fails: the metadata is accurate; leave it and report.
  Do not improvise a second repair.
- Deployment fails after a successful database phase: Vercel keeps the prior deployment; instant
  rollback to `dpl_8qEV` if a promoted deployment misbehaves. Database tables remain and are inert
  to the old code.
- Never use a database rollback to compensate for a code rollback. They are separate.

## Read-only gates

- `select has_table_privilege('service_role','public.cc_trusted_devices','DELETE');` must be false.
- The same for TRUNCATE, REFERENCES, TRIGGER, MAINTAIN.
- `has_function_privilege('service_role', ...)` must be true for all six functions; false for anon
  and authenticated.
- History must contain exactly the four canonical versions with the exact names, and no ad-hoc
  versions.

See the final disposition report for the complete SQL and the before/after matrix.
