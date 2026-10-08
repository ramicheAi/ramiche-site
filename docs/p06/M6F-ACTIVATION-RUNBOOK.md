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
| Repository access for the stale-head check | M6G: the Keychain path is removed. The App ("Parallax Executor ramicheAi", Contents+Metadata read only) exists and is installed on mettle and ramiche-site; `check` passed against the protected setup file. Routing the key into the cockpit's own runtime is a production credential change awaiting founder approval (ops-handoff/M6G-RUNTIME-ROUTING-FOUNDER-APPROVAL.md) |
| Natural founder phrase routing | READY: "Inspect METTLE and tell me what is blocking production." (and variants: "What's blocking X from production?", "Analyze the X codebase...", "Find the highest priority problem in X") routes to Claude Code as a read-only analysis, founder approval still required. A vague request ("Analyze the market") still asks. Corpus 0 dangerous false negatives; M5C replay drift 0 |
| Founder Cancel control in the cockpit | READY: approve answers once the run is durably recorded (202 with the job), the card follows it (status polling, a snapshot read that waits for the row and its result to agree) and shows one Cancel control; a run already in progress for the command is found and followed from any tab |
| Long runs through the tunnel | RESOLVED: approve no longer holds the request open for the run. A run of any length is followed by polling the job, so the Cloudflare tunnel's ~100 s response limit no longer loses the on-screen result |
| M5C gate | NOT MET (see the M6F result) |

## PRECHECK (all must hold)

1. M5C gate passed: at least 7 calendar days (not before 2026-10-12 10:05:17 EDT) and at least 40 real labelled
   commands, 0 dangerous false negatives, replay drift 0.
2. Integration branch with this runbook's code is merged to main by the founder and released to the cockpit as usual.
3. The executor's GitHub machine identity is set up (docs/p06/M6G-GITHUB-MACHINE-AUTH.md) and
   `scripts/m6g-github-app-setup.mjs check` prints `M6G CHECK: PASS` from the executor's context. No Keychain or
   person's credential is involved; `GET /api/command-center/execution/health?deep=1` must not report
   "GitHub machine authentication unavailable".
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
3. The card shows "CLAUDE CODE · RUNNING" with a Cancel control immediately (the request does not stay open for the
   run). Then `DONE · Claude Code` with a result, 0 files changed, no worktree left. The jobs row ends `done` with an
   `execution_result` event.
4. Cancel: start a second run, press Cancel while it reads "RUNNING". Confirm the row ends `canceled` and no `claude`
   process is left.
5. Open the palette in a second tab for the same command while a run is going: it shows "RUNNING" with Cancel too
   (not a second Start button).
6. Ask for a change ("Claude Code, fix the METTLE roster import"): it is narrowed to read-only; an explicit L2 choice
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
   that cannot be stopped or proven is reported (health Degraded) and its row is never made terminal. A group whose CLI
   already exited is never signaled automatically (its identity cannot be proven once the CLI is gone): a person checks
   it with `ps -A -o pid,pgid,lstart,args` and stops it by hand.
3. Restore the previous cockpit release: repoint `com.command-center` to the previous `cockpit-releases/<sha>` and
   kickstart. (Rehearsed 2026-10-06: release 9ecae340 boots in 6 s and serves `/api/health` 200 on a side port.)
4. Turn dispatch off in code (revert the ACTIVATE commit) in the next release; then remove HALT if wanted.
5. Audit: every run is a `jobs` row (source `m6-executor`) with its `job_events` (`execution_result`,
   `retry`, `cancel_requested`, `orphan_stop`, `orphan_kill`, `orphan_stopped` or `orphan_stop_failed`, `reap_intent`,
   `reaped`). After a retry the row describes the current attempt (its execution id and the process running it). Missions are untouched by the executor.
