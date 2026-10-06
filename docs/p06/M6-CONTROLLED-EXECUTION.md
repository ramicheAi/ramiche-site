# P06 M6: controlled execution and the Claude Code adapter

**Status:** built and tested behind a disabled production gate. `PRODUCTION_DISPATCH_ENABLED = false` is a constant
(`src/lib/execution/policy.ts`), and the live cockpit deployment (`NEXT_DIST_DIR=.next-cc`) refuses to run executions
whatever the caller says. Universal Command stays shadow-only (M5C observation continues). No route, page or job calls
the executor in production.

## What already existed, and what M6 reuses

| Existing | Reused for |
|---|---|
| `jobs` / `job_events` (status `queued, running, done, failed, canceled`) | the execution record (`JobsExecutionStore`): one jobs row per idempotency key, kind `dev`, agent `claude-code`, source `m6-executor`; the structured result as a `job_events` detail. No migration. |
| `execution_events` + `recordExecution` | telemetry: provider `claude-max`, purpose `job`, correlation `job` (the jobs row id), billing `subscription`, unknown kept NULL |
| `PROJECTS` (shared-projects.ts) | canonical project identity; the M6 registry only adds the repository, keyed by the same slugs. A slug must be in `PROJECTS` or listed explicitly in `REGISTRY_ONLY_PROJECTS` (a test fails otherwise) |
| `CC_BUILDER_ROOTS` allowlist idea | `roots`: checkouts are only used from configured directories |
| `PARALLAX_CSRF_SECRET` | the approval key is derived from it with a fixed label (no new secret) |
| M5 router (`NEEDS_FOUNDER`, `missionRecommended`) and the Mission API (`job` link type, evidence) | approval policy input and Mission suggestion; the executor never writes Missions |

Not reused, on purpose: the claude-max proxy (it runs every call with `--dangerously-skip-permissions` and no working
directory) and the in-process `runJob` text path (no isolation, no cancel).

## Flow

Universal Command, then router (shadow decision), then **ExecutionRequest**, then **founder approval** (HMAC bound to
the request), then **executor** (fail-closed checks, isolated worktree, Claude Code), then **boundary verification**
(git state), then **ExecutionResult**, then telemetry and the jobs record.

## Contract (`src/lib/execution/contract.ts`)

- **ExecutionRequest binds:**
  - executionId, commandId, missionId, founder uid, executor
  - project slug; repository origin, branch and head (a 40-character commit)
  - task (instruction and context refs), capability, limits (timeout, turns, budget)
  - idempotency key, createdAt
- **ExecutionResult reports:**
  - status, start and end times, repository, execution branch and worktree, resulting head
  - files changed and checks run, summary
  - evidence (log path, turns, model), usage (tokens, subscription billing, the CLI's cost as a labelled estimate)
  - warnings, the next step, and a failure (the smallest actionable message)
- **Excluded:** neither object carries secrets, credentials or conversation history. The task text goes to the CLI on stdin, never argv.

## Authority (`contract.ts`, `approval.ts`, `policy.ts`)

| Level | Meaning | CLI tools |
|---|---|---|
| L0 | observe | Read, Glob, Grep |
| L1 | analyze, recommend | Read, Glob, Grep |
| L2 | modify locally (isolated worktree) | + Edit, Write |
| L3 | run tests/build locally | + Bash, limited to allowlisted test/build and git-read prefixes. **Not executable in M6.** |
| L4 | commit locally (execution branch) | + `git add`, `git commit`. **Not executable in M6.** |

**Why L3 and L4 are not executable.** They run the repository's own code (test scripts, commit hooks), and that code
can do anything the user account can. The PR #47 review reproduced this: `npm test` rewritten to
`env -u GIT_CONFIG_COUNT git push <origin>` pushed with the user's credentials. A detached child outlived the
process-group kill and acted after verification. A script planted `core.fsmonitor` in the shared `.git/config`.
Git-level guards cannot bound this. L3 and L4 stay defined in the contract but are refused (`capability_unavailable`)
until the executor runs inside an OS sandbox: no network, writes only in the worktree, every process of the run
reaped. L0 to L2 give the CLI no shell at all.

**Consequential acts are not levels and cannot be granted by any request:**
- push, pull request, merge, deploy, migration
- credential change, external message, payment, production mutation

After an L4 commit the next step is reported as "Open a pull request", which needs separate authority.

**The approval** is an HMAC over the request's binding:
- command, founder, executor, project, origin, branch, head, capability
- the task hash, context refs, limits, idempotency key

It expires after at most 15 minutes. Changing any bound field, widening the capability, using it after expiry, or presenting it as another founder fails verification.

## Boundary: three independent layers (none trusts the model)

1. **CLI.**
   - An exact `--tools` set in `--permission-mode dontAsk`, with `--setting-sources ""`, `--strict-mcp-config` and `--disable-slash-commands`. A repository's own `.claude/settings.json` cannot widen it.
   - **File access is confined to the run's worktree.** No allow rule is ever a bare `Read`, `Edit` or `Write`, because a bare name matches every path on the machine. Allow rules are anchored at the canonical (realpath) worktree as `//<path>/**`, and the worktree's `.git` link is denied. Per the Claude Code permissions docs:
     - reads outside the working directory and all edits need approval, and `dontAsk` denies them
     - allow rules must match both the requested path and its symlink target
     - Glob and Grep follow Read rules
   - Bash appears only at L3 and L4, limited to allowlisted prefixes. Push, remote, config, branch, reset, rebase, merge, tag, gh, vercel, supabase, curl, wget and ssh are explicitly denied.
2. **Process.**
   - A fresh git worktree on `parallax-exec/<executionId>`, created from the approved commit. It lives under the execution root, never in the founder's checkout and never in /tmp.
   - A stripped environment: PATH, HOME, USER, LOGNAME, LANG, TMPDIR and SHELL only. No cockpit secrets.
   - Git is forced through `GIT_CONFIG_*`:
     - `remote.origin.pushurl` and `pushInsteadOf` for every URL form and local path, so any push fails
     - `credential.helper` empty
     - `core.hooksPath=/dev/null`
     - `GIT_SSH_COMMAND=/usr/bin/false`
   - Its own process group: a timeout or cancel kills everything it started.
3. **Verification after the run**, from git state alone, using the executor's own hardened git (system and global config ignored, `core.fsmonitor` and hooks forced off on the command line, so a planted config cannot execute during the checks). Each of these is a `boundary_violation`:
   - any ref outside the execution branch moved
   - the shared `.git` changed (config, hooks, info, alternates, another worktree's metadata)
   - the worktree left the execution branch
   - the founder's checkout changed (HEAD, branch or working-tree status)
   - a commit below L4, or a rewritten base at L4
   - any file change at L0 or L1

## Fail closed (nothing runs)

The executor refuses in these cases:
- production surface or cockpit deployment
- invalid contract
- not the founder
- approval missing, invalid, mismatched, expired, from the wrong founder, or no key on the host
- idempotency conflict, or already running
- project unresolved, ambiguous or unsettled
- wrong project for the repository
- no checkout with the right origin containing the commit
- unknown branch
- stale head: the branch on the remote itself (`git ls-remote`, not a possibly stale remote-tracking ref) moved since approval; an unreachable remote fails closed
- the record cannot be written

## Project resolution (`projects.ts`)

- **Registered:**
  - METTLE: `ramicheAi/mettle`
  - Galactik Antics: `ramicheAi/galactik-antics`
  - Command Center / Parallax OS: `ramicheAi/ramiche-site`
- **Resolution asks rather than guesses** when no project or more than one is named.
- **Formerly open questions:**
  - **Resolved 2026-10-06 (PR #51, repositories verified):**
    - the Parallax website (parallaxvinc.com) is `ramicheAi/parallax-site` (`~/parallax-site`)
    - Parallax OS / Command Center is `ramicheAi/ramiche-site`
    - RAMICHE OS is private `ramicheAi/ramiche-os` (`~/repos/ramiche-os`), a registry-only project
  - Bare "Parallax" still asks.
  - A project without a verified local checkout fails closed with "NO VERIFIED LOCAL CHECKOUT".

## Mission integration (`mission.ts`)

- **Simple work:** command, then execution, then result.
- **A Mission is suggested only when it adds value:** the router recommended one, or more approved steps follow.
- **Linking:** a run issued inside a Mission is linkable back as `job` evidence.
- **Executor never writes Missions:** the founder links through the existing Mission API. Machine callers still have no Mission authority.

## Result UX (`src/components/command-center/execution/ExecutionCards.tsx`)

- **Approval:** "Claude Code wants to modify METTLE locally." with [Approve] [Cancel] [Details].
- **Result:**
  - "DONE · Claude Code / METTLE / summary / n of m checks passed / k files changed" with [Review changes]
  - "READY FOR APPROVAL / Next requested action: Create commit" with [Approve]
  - "STOPPED" with the smallest explanation
- **Details:** raw logs stay behind Details.
- **Not mounted** on any production surface.

## Evidence

- **Tests:**
  - `src/lib/execution/*.test.ts`: real git plus a fake CLI that ignores its permissions, so every claim is checked against git and file state.
  - `ExecutionCards.test.tsx`.
- **Mutation:** every enforcement point was mutated (36 in total, including the review fixes), and each mutant is caught.
- **Red-team review (PR #47):** three P1s and two P2s were reproduced and fixed:
  - L3/L4 are refused
  - the shared `.git` is verified and the executor's own checks are hardened
  - store errors throw
  - the stale check asks the remote
  - origins are github.com only
  - logs are capped
- **Codex review (PR #47):**
  - a P1: bare file-tool allow rules were not path-confined; fixed with worktree-anchored rules
  - a P1 on package scripts, which L3/L4 refusal resolves
  - a P2 on silent store errors, fixed
- **Real CLI** (`scripts/m6-execution-proof.mjs`, a throwaway sandbox repo):
  - The real Claude Code CLI started with exactly the granted tools in `dontAsk` mode.
  - Every run failed with the CLI's 401 "OAuth access token has expired". The executor reported `failed` (not succeeded), changed nothing, and pushed nothing.
  - Stale head, missing approval and the production surface were refused.

## Before production dispatch can be enabled (each is a founder decision)

0. **Before anything else, prove a real completed run with the real CLI.** Confirm its Write and Edit path scope at L2.
1. **A working CLI credential on the execution host.**
   - Over SSH the iMac CLI cannot refresh its OAuth session, and launchd jobs cannot read the Keychain (the known claude_call.py lesson).
   - The MacBook's standalone CLI token has expired.
   - A non-interactive credential needs Ramon's choice.
2. **Database.** Wire `JobsExecutionStore` to Supabase (one adapter, no migration), and decide on a reaper for rows left `running` by a restart.
3. **Mount the cards** and an owner-only approve endpoint (`guardProtectedMutation`) that signs with `approve()`.
4. **Flip the constant**, as a reviewed PR.

**Residual risks to accept or close:**
- **To confirm on the real CLI:** that worktree-anchored rules deny reads and writes elsewhere (`~/.ssh`, `~/.zshrc`, other repositories), as the permissions docs state. This needs a working CLI credential. The shared `.git` and the founder's checkout are verified after every run either way.
- **Needs an OS sandbox:** L3 and L4 (see above), and anything that runs repository code.
- **Fails safe:** concurrent edits by the founder in the same checkout during a run, or a background fetch, are reported as a violation.
