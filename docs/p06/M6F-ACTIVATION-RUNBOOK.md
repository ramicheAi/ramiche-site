# P06 M6F: Phase 1 production execution (L0 + L1 only)

Status: PREPARED, NOT ACTIVE. `PRODUCTION_DISPATCH_ENABLED` is `false`. Nothing in this document has been run
against production. Activation is a founder decision, taken only after the M5C gate passes.

## What Phase 1 allows

| Capability | Phase 1 production | Where it is enforced |
|---|---|---|
| L0 inspect | allowed | `PRODUCTION_MAX_CAPABILITY = "L1"` (policy.ts), prepare and executor |
| L1 analyze | allowed | same |
| L2 modify locally | OFF (a change command is narrowed to read-only, shown as "read only: changing files is not enabled yet") | prepare narrows, executor refuses `capability_not_enabled` |
| L3 run tests, L4 commit | REFUSED | `EXECUTABLE_CAPABILITIES` (no OS sandbox), the ceiling |
| push, PR, merge, deploy, migration, credentials, production config, messages, payments, Mission verification, autonomous approval | no tool exists for them at L0/L1 (Read, Glob, Grep only), and founder-authority commands stop at prepare | `cliPolicy`, router `human` handler, approval signed with the session founder only |

The executor never writes Missions; a result is suggested as Mission evidence and the founder attaches it.

## Readiness (as of 2026-10-06, evidence in the M6F PR)

| Item | Status |
|---|---|
| Production jobs/job_events schema | READY, no migration (columns match; CHECK, FK and updated_at trigger proven on a real Postgres with the same migration) |
| Store end to end (create, heartbeat, result, cancel, reaper, idempotency, fail closed) | READY on real Postgres (`jobs-postgres.integration.test.ts`) |
| Reaper | READY, scheduled job prepared and NOT loaded (`ops/execution/com.parallax.m6-reaper.plist`); dry run against production read 0 running rows |
| Real Claude cancel and timeout (L1) | PROVEN on the iMac in gui/501 on a throwaway sandbox repository |
| Kill switch | PROVEN in tests: constant gate refuses before store, approval, remote, CLI, telemetry; no env can enable; HALT file stops runs without a redeploy |
| Claude auth in the executor session | READY (logged in, first party, Max) |
| Repository access for the stale-head check | BLOCKED: in gui/501 the keychain credential read for a private repository hangs (killed at 45 s). Founder action needed on the iMac; see Precheck 3 |
| Exact founder phrase routing | "Inspect METTLE and tell me what is blocking production." routes to no handler (asks who). Naming Claude Code works. Router semantics unchanged by design; M5C labels decide |
| Founder Cancel control in the cockpit | NOT WIRED: `POST /api/command-center/execution/cancel {jobId}` exists and works with dispatch off, but the approval card does not yet show a Cancel button while a run is working (the approve call holds the request until the run ends and does not return the job id first) |
| Long runs through the tunnel | RISK: the cockpit is served through a Cloudflare tunnel; a proxied request with no response for about 100 s ends with error 524. Approve holds the request for the whole run, so a run longer than that loses its on-screen result (the jobs row still records it). The real L1 analyze took 38 s |
| M5C gate | NOT MET (see the M6F result) |

## PRECHECK (all must hold)

1. M5C gate passed: at least 7 calendar days (not before 2026-10-12 10:05:17 EDT) and at least 40 real labelled
   commands, 0 dangerous false negatives, replay drift 0.
2. Integration branch with this runbook's code is merged to main by the founder and released to the cockpit as usual.
3. On the iMac, in the founder's GUI session: a credentialed `git ls-remote` of `ramicheAi/mettle` completes in a few
   seconds from the executor context. If a Keychain dialog appears for `git-credential-osxkeychain`, the founder
   answers it (Always Allow). Then `GET /api/command-center/execution/health?deep=1` must not report
   "Repository access needs attention".
4. Health reasons list nothing except "Recovery check is not running" (the reaper is loaded in ACTIVATE step 2;
   state is `off` before activation): Claude logged in, disk above 4 GB, store reachable, 0 stuck, 0 not reporting.
   After ACTIVATE step 2, `readiness` must be `ready`.
5. `~/.parallax/executions/HALT` does not exist. No `parallax-exec/*` branches or stale worktrees.

## ACTIVATE (one reviewed PR into integration, then the normal release; founder approved)

1. Code (the only two lines that turn it on, both reviewed):
   - `policy.ts`: `PRODUCTION_DISPATCH_ENABLED = true`.
   - `policy.ts` `surfaceAllowed`: the live cockpit build (`NEXT_DIST_DIR=.next-cc`) currently refuses every surface.
     Allow the production surface there; keep refusing the harness surface on the live build.
   - Keep `PRODUCTION_MAX_CAPABILITY = "L1"`. Do not touch `EXECUTABLE_CAPABILITIES`.
2. Load the reaper (inert until there is something to reap):
   `sed "s#__RELEASE_DIR__#/Users/admin/cockpit-releases/<release>#" ops/execution/com.parallax.m6-reaper.plist > ~/Library/LaunchAgents/com.parallax.m6-reaper.plist`
   then `launchctl bootstrap gui/501 ~/Library/LaunchAgents/com.parallax.m6-reaper.plist`. The plist names one release
   directory: repoint it at every cockpit release (and never prune the release it names), or health turns Degraded.
3. Release the cockpit the usual way (new release directory, repoint `com.command-center`, kickstart).

## SMOKE (founder, in the cockpit, about 5 minutes)

1. Health: "Ready · inspect and analyze".
2. "Claude Code, inspect METTLE and tell me what is blocking production." The card reads "Claude Code wants to
   analyze METTLE (read only: changing files is not enabled yet)." Approve.
3. Expect `DONE · Claude Code` with a result, 0 files changed, no worktree left. The jobs row ends `done` with an
   `execution_result` event.
4. Cancel: only once the Cancel control is wired (see Readiness). Until then, cancel through the route with the job id
   from the jobs table, and confirm the row ends `canceled` and no `claude` process is left.
5. Ask for a change ("Claude Code, fix the METTLE roster import"): it is narrowed to read-only; an explicit L2 choice
   is refused with "not enabled yet".

## OBSERVE (first 7 days)

Daily: health headline; failed runs (degraded at 3 a day); stuck runs (any is a bug); the reaper log
`~/Library/Logs/parallax/m6-reaper.log`; one founder spot check of a result against the repository.

## ROLLBACK (no database rollback: the schema is unchanged)

1. Stop new runs now, no redeploy: `touch ~/.parallax/executions/HALT` on the iMac. Prepare and approve refuse with
   403 `execution_halted`; health says "Off · halted on the execution host".
2. Running runs: cancel through the cancel route (it works with dispatch off), or wait: each run is bounded by its own
   timeout. If the cockpit itself was restarted, the reaper's orphan pass stops the run's whole process group when it can
   prove the CLI is that run's (own process group, the Claude binary, its worktree as working directory): SIGTERM, a
   5 second wait, SIGKILL if any member survives, then it confirms the group is empty before the row is failed. A group
   that cannot be stopped or proven is reported (health Degraded) and its row is never made terminal.
3. Restore the previous cockpit release: repoint `com.command-center` to the previous `cockpit-releases/<sha>` and
   kickstart. (Rehearsed 2026-10-06: release 9ecae340 boots in 6 s and serves `/api/health` 200 on a side port.)
4. Turn dispatch off in code (revert the ACTIVATE commit) in the next release; then remove HALT if wanted.
5. Audit: every run is a `jobs` row (source `m6-executor`) with its `job_events` (`execution_result`,
   `retry`, `cancel_requested`, `orphan_stop`, `orphan_kill`, `orphan_stopped` or `orphan_stop_failed`, `reap_intent`,
   `reaped`). After a retry the row describes the current attempt (its execution id and the process running it). Missions are untouched by the executor.
