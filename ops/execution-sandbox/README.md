# P06 M6D: macOS execution sandbox spike (L3/L4 stay REFUSED)

**Status:** spike only. Nothing here is wired into the executor. `EXECUTABLE_CAPABILITIES` is still L0-L2 and
`PRODUCTION_DISPATCH_ENABLED` is still false. L3 (run repository code) and L4 (commit) remain refused.

## Mechanism
- **Hook point, proven on the real CLI** (iMac C02YW21CJWF2, Claude Code 2.1.290, 2026-10-06):
  - `CLAUDE_CODE_SHELL_PREFIX` makes Claude Code run every Bash tool command through a wrapper, with the whole command string as ONE argument (`ARGC=1` on 14 of 14 calls).
  - `SHELL` is NOT honoured.
- **The wrapper** (`wrap.sh.in`) runs that string as `/usr/bin/sandbox-exec -f <per-run profile> /bin/zsh -c "$1"`, with a fixed PATH, a per-run TMPDIR, no user git config, and a run tag. This contains repository code independently of Claude Code's permission rules. In the test those rules were wide open (`--allowedTools Bash`).
- **The profile** (`profile.sb.in`):
  - allow-default
  - deny all network
  - deny all writes except the worktree, the run temp dir, `/dev` and the system temp dirs
  - deny all reads under HOME except the worktree, plus metadata-only reads of the worktree's ancestors
- **Two independent alternatives:**
  - Claude Code's own sandbox (`--settings '{"sandbox":{"enabled":true,"allowUnsandboxedCommands":false}}'`) applies under `--setting-sources ""`. On the real CLI it blocked a network request and an outside write.
  - Defence in depth would use both.

## Evidence (filesystem, origin refs and exit codes; not the commands' own claims)

The real-CLI run of these attacks (`attacks.sh`, executed exactly as the CLI would, through the wrapper on the iMac):

| Attack | Result |
|---|---|
| a. `npm test` with a malicious pretest/test writing outside and to HOME | blocked (EPERM); the inside write succeeded (positive control) |
| b. `git push` to origin by path and by `file://`, with git env stripped | blocked (git cannot read the shared .git; the origin is unchanged) |
| c. plant `core.fsmonitor` in the shared .git/config | blocked (config unchanged) |
| d. plant a hook in the shared .git/hooks | blocked (Operation not permitted) |
| e. detached child writing later | **survived**; its outside write was blocked, but its in-worktree write landed |
| f/g/h. write outside the worktree, to HOME, to an unrelated repo (`~/mettle`) | blocked |
| g2. read HOME (`~/Documents`) | blocked |
| h2. symlink escape | blocked |
| i. network: curl https://example.com, raw socket to 1.1.1.1:443 | blocked (`000`, EPERM) |

The local spike (`LOCAL-SPIKE-REPORT.md`, a MacBook with node 26) reproduced the same results and also verified an L4 profile. That profile allows commits only on `refs/heads/parallax-exec/*`, and config, hooks, info and push stay blocked.

When the model was asked to run the attacks itself, it refused after two of them. That is why containment was proven by running the same command strings through the same wrapper directly.

## Why L3/L4 stay refused (the smallest next steps)
1. **Git inside the sandbox.** With HOME reads denied, git cannot read the shared .git ("not a git repository"), so `git status` and `git diff` in an L3 run fail.
   - Fix: add a read-only allow for the checkout's common git dir.
   - For L4, add the narrow write rules from the local spike (`objects/`, this worktree's metadata, the `parallax-exec/*` ref namespace).
2. **Detached survivors.** A setsid child outlives the run inside the sandbox, so it cannot escape, but it can write in the worktree after verification.
   - Fix: tag each run, kill every process carrying the tag on exit (verified locally with `pkill -f <tag>`), and verify after quiescence, or verify a snapshot copy of the worktree.
3. **Then wire it in.** Generate a per-run profile and wrapper in the executor for L3/L4 only, set `CLAUDE_CODE_SHELL_PREFIX`, re-run `attacks.sh` against the integrated path, and only then add L3 to `EXECUTABLE_CAPABILITIES` (a founder decision; production dispatch stays off independently).

**Residual caveats:**
- An allow-default profile is a blocklist; a deny-default allowlist (node/git closure) is stronger but aborted node in the local spike.
- `sandbox-exec` is deprecated by Apple (still enforced on macOS 26).
- These results come from a single host and OS build.
