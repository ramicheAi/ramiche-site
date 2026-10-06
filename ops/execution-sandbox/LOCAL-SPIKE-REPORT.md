# Seatbelt Containment Spike — Can `sandbox-exec` contain untrusted repository code?

Host: macOS 26.2 (25C56). /usr/bin/sandbox-exec present (root:wheel), WORKS (warns deprecated, enforces).
Toolchain: node v26.0.0 (/opt/homebrew/bin/node), git 2.54.0, npm, /bin/sh. Evidence = filesystem/origin refs/exit codes.

## Working profile (L3) — profileA.sb  [(allow default)+targeted deny WORKS; (deny default) aborts node SIGABRT rc=134]
(version 1)
(allow default)
(deny network*)
(deny file-write*)
(allow file-write* (subpath "/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/exec/wt") (subpath "/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/tmprun") (subpath "/dev"))
(deny file-read* (subpath "/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/fakehome"))
Absolute real paths; spike under /private/tmp (no symlink indirection). Runner sets cwd=/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/exec/wt, TMPDIR=/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/tmprun,
HOME=/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/fakehome, GIT_CONFIG_GLOBAL/SYSTEM=/dev/null. Property: global write-deny, only listed subpaths writable;
shared .git, canary, HOME, unrelated repo, origin all lie outside -> denied by construction.

## Positive controls (PASS): npm goodtest wrote inside wt (WROTE-INSIDE); git status/diff work rc=0.

## Attacks (profile A, L3) — ALL blocked/contained
a npm test pretest escape  BLOCKED  canary/pretest never created
b git push path & file:// (env -u GIT_CONFIG_*)  BLOCKED  both "remote rejected: unpacker error"; origin refs unchanged; commit also blocked (index.lock EPERM)
c core.fsmonitor into shared .git/config  BLOCKED  "could not lock config: Operation not permitted"; sha unchanged
d hook into shared .git/hooks  BLOCKED  Operation not permitted; no pre-commit
e detached setsid child  CONTAINED  survived (in-wt write rc=0) but out-of-wt write blocked (canary-rc=1)
f write canary  BLOCKED   g write fakehome  BLOCKED   g2 read fakehome secret  BLOCKED (EPERM)
h write unrelated repo  BLOCKED
i curl https://example.com rc=6 (DNS blocked); node net.connect 1.1.1.1:443 -> EPERM (socket denied, conclusive)
+ symlink escape BLOCKED (realpath resolved); hardlink escape BLOCKED; mv out of wt BLOCKED
Note: local push by path/file:// is a FILESYSTEM op (stopped by write-deny on origin.git), not network.

## Detached child (e)
Survives: unref'd child outlives sandboxed parent (parent rc=0 immediately; survivor wrote late-inside 3s later),
reparents to ppid=1 with own pgid -> killpg(parent) MISSES it.
Contained: survivor INHERITS sandbox -> out-of-wt write blocked (canary-rc=1). Cannot touch net/HOME/shared-.git/outside.
Discovery/kill (no new account/settings): tag each run (env PARALLAX_SBX_RUN or exec -a <tag>), then pkill -f <tag>
after run (verified: found via ps -o pid,ppid,pgid,sess,command, killed rc=0). lsof +D <wt> finds only survivors
currently holding wt fds (misses idle ones) -> weaker than an explicit tag.
Residual risk: survivor CAN still write INSIDE the worktree after verification (in-wt TOCTOU). Mitigate: pkill -f <tag>
then verify a snapshot/copy of the worktree (or make it read-only), not the live tree.

## L4 commit — profileC_L4.sb (VERIFIED)
Add writable, narrowly: /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/objects, /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/worktrees/wt, /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/refs/heads/parallax-exec (+literal dir),
/private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/logs/refs/heads/parallax-exec, literal /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/logs/refs/heads, literal /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/packed-refs(.lock).
Keep DENY on /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/config, /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/hooks, /private/tmp/claude-501/-Users-ramonwalton-repos-ramiche-site/e6280947-78f5-47e2-b877-4f095df66881/scratchpad/sandbox-spike/repo/.git/info.
Verified: commit on parallax-exec/run1 SUCCEEDED (aacf3bb); core.fsmonitor/hook STILL blocked (config sha unchanged,
no hook); update-ref refs/heads/evil BLOCKED (namespace enforced, only parallax-exec/* writable); push to origin STILL rejected.

## Verdict
L3 (run repo code, no commit): containment CONCLUSIVELY demonstrated with this mechanism vs every in-scope attack
+ symlink/hardlink/mv bypasses + detached survivor, with FS/ref/exit-code evidence. This host/OS build/tool versions.
L4 (commit to parallax-exec/*): demonstrated achievable; config/hooks/info/push stay contained.
Caveats: (allow default) is a BLOCKLIST — only enumerated denies are blocked; untested op classes remain allowed.
The in-wt TOCTOU residual is procedural, not profile-enforced. Single host/OS build; sandbox-exec is deprecated.
Smallest next step: ship profile A for L3 behind a wrapper that sets cwd/TMPDIR/HOME + a per-run exec -a tag and runs
pkill -f <tag> + snapshot-verify on exit; add L4 ref-namespace rules only if commits are needed; then port to a
(deny default) base profile (vetted node/git allow closure) so containment is an allowlist, not a blocklist.
