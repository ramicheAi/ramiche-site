# Host maintenance: installation procedure

**Status: NOT INSTALLED. Nothing below has been run on the production host.**

Four separately approvable steps. Each one has its own approval, its own verification, and its own
rollback. No step executes maintenance. Step 4 is the only one that changes behaviour over time, and
it makes the cron *report* rather than rewrite.

Host: iMac `admin@100.118.84.5` (`c02yw21cjwf2`). Today's date for approval ids: see the run date.

---

## What is being installed, and why

| File | Goes to | Purpose |
|---|---|---|
| `maintenance-guard.sh` | `~/.openclaw/workspace/scripts/maintenance-guard.sh` | The only thing allowed to rewrite a live SQLite store. Refuses without an issued approval id, inside a window, with enough free space, a real SQLite file, no open write transaction, and a non-empty freelist. Logs every decision. |
| step-6 replacement | inside `~/.openclaw/workspace/scripts/disk-cleanup.sh` | The cron's current step 6 runs `sqlite3 "$db" "VACUUM;"` on every store with `2>/dev/null \|\| true`. No approval, no space check, no freelist check, every error swallowed. The replacement reports by default and can only rewrite when an approval id is present in the cron's environment, which it never is. |
| `MAINTENANCE-POLICY.md` | stays in the repo | The rules. Not installed on the host. |

The incident that motivates this is in `MAINTENANCE-POLICY.md`. It is **not fully explained**: all 22
agent memory stores were rewritten between 16:25 and 16:29 on 2026-11-15 with the gateway live, and
**no log of the command survives**. The fingerprint (freelist 0 on all 22 with `auto_vacuum` off,
contiguous mtimes, 3.7 GB returned) is reproducible and uncontradicted, but the process and the
operator are unknown. Do not read this package as a closed incident; it is a set of controls for an
event whose cause is still unidentified.

---

## Step 0. Prove the guard cannot execute anything (no approval needed)

This is the answer to "verify it cannot accidentally run maintenance while being tested or
installed." It runs on a **copy** in a temp directory. It touches no live store.

```bash
# on the host, after copying the script ONLY (no install, no cron edit)
cd /tmp && rm -rf guardproof && mkdir guardproof && cd guardproof

# a copy of a real store, and a fingerprint of it
cp ~/.openclaw/memory/main.sqlite ./probe.sqlite
stat -f 'size=%z mtime=%m' ./probe.sqlite
sqlite3 ./probe.sqlite 'pragma freelist_count; pragma integrity_check;'

G=~/maintenance-guard.sh    # wherever the copy landed

# every one of these must leave the fingerprint identical
$G --help                        >/dev/null 2>&1 ; echo "help exit=$?"
$G                               >/dev/null 2>&1 ; echo "no-args exit=$?"
$G --db ./probe.sqlite           >/dev/null 2>&1 ; echo "dry-run exit=$?"
$G --apply --db ./probe.sqlite   >/dev/null 2>&1 ; echo "apply-no-approval exit=$?"
OPENCLAW_MAINTENANCE_APPROVAL=1 $G --apply --window 00:00-23:59 --db ./probe.sqlite >/dev/null 2>&1
echo "apply-wrong-id exit=$?"
OPENCLAW_MAINTENANCE_APPROVAL=CC-2026-01-01-01 $G --apply --db ./probe.sqlite >/dev/null 2>&1
echo "apply-outside-window exit=$?"

# the fingerprint MUST be unchanged
stat -f 'size=%z mtime=%m' ./probe.sqlite
sqlite3 ./probe.sqlite 'pragma freelist_count; pragma integrity_check;'

rm -rf /tmp/guardproof
```

Expected and verified on real SQLite files:

| Invocation | Exit | Writes? |
|---|---|---|
| `--help` | 0 | no |
| no arguments | 2 | no |
| `--db <file>` (dry run) | 0 | no |
| `--apply` without an approval id | 2 | no |
| `--apply` with a wrong-shaped id (`1`) | 2 | no |
| `--apply` with a valid id, outside the window | 2 | no |
| `--apply --swap` while the file is open | 2 | no |
| `--apply` while a `-journal` sidecar exists | 2 | no |

The only file a refusal creates is a log line under `~/Library/Logs/parallax-maintenance/`. That is
the audit trail, not maintenance, and it is how a refusal becomes visible instead of silent.

Two real defects were found and fixed by running this matrix rather than reading the script:
`--swap` used the in-place free-space factor (2.5x) when it needs 3.5x, and the in-place VACUUM
inherited the SQLite CLI's zero busy timeout, so it failed the instant any writer was active.

---

## Step 1. Install the guard script (approval 1)

Copies one file. Executes nothing.

```bash
# approval 1: "install maintenance-guard.sh, no execution"
ssh admin@100.118.84.5 'ls -l ~/.openclaw/workspace/scripts/maintenance-guard.sh 2>/dev/null || echo "not present (expected)"'
scp maintenance-guard.sh admin@100.118.84.5:/Users/admin/.openclaw/workspace/scripts/maintenance-guard.sh
ssh admin@100.118.84.5 'chmod 500 ~/.openclaw/workspace/scripts/maintenance-guard.sh; shasum -a 256 ~/.openclaw/workspace/scripts/maintenance-guard.sh'
```

**Verify:** the remote `shasum -a 256` matches the local one. Mode `500` means the owner may read and
execute but not write it, so the cron cannot rewrite the guard.

**Rollback:** `ssh admin@100.118.84.5 'rm -f ~/.openclaw/workspace/scripts/maintenance-guard.sh'`
(only safe because step 2 has not run; after step 2, revert step 2 first).

**This step does not make anything run.** No cron entry points at the script.

---

## Step 2. Back up the cron script (approval 2)

```bash
# approval 2: "back up disk-cleanup.sh"
ssh admin@100.118.84.5 'cp -p ~/.openclaw/workspace/scripts/disk-cleanup.sh \
  ~/.openclaw/workspace/scripts/disk-cleanup.sh.bak-$(date +%Y%m%d) && \
  shasum -a 256 ~/.openclaw/workspace/scripts/disk-cleanup.sh.bak-*'
```

**Verify:** the backup's sha256 equals the live script's sha256.

**Rollback:** delete the backup. Nothing else changed.

---

## Step 3. Replace step 6 with the report-only version (approval 3)

The exact replacement text is in `DISK-CLEANUP-STEP6-PATCH.md`. Apply it with a script that fails
loudly rather than a sed one-liner, and diff immediately.

```bash
# approval 3: "replace disk-cleanup.sh step 6 with the report-only version"
# edit a local copy first, then push it, then diff on the host
scp disk-cleanup.sh.patched admin@100.118.84.5:/Users/admin/.openclaw/workspace/scripts/disk-cleanup.sh
ssh admin@100.118.84.5 'diff ~/.openclaw/workspace/scripts/disk-cleanup.sh.bak-* \
  ~/.openclaw/workspace/scripts/disk-cleanup.sh; echo "diff exit=$?"'
```

**Verify, all of these:**

1. `diff` shows only the step-6 block and nothing else.
2. `bash -n` on the patched script is clean.
3. The new step 6 reports and rewrites nothing when run by hand with no approval:
   ```bash
   ssh admin@100.118.84.5 'env -u OPENCLAW_MAINTENANCE_APPROVAL bash -c \
     "sed -n \"/6. Sqlite maintenance/,/^# 7/p\" ~/.openclaw/workspace/scripts/disk-cleanup.sh > /tmp/step6.sh; bash /tmp/step6.sh; rm /tmp/step6.sh"'
   ```
   Expected: one line per store saying "nothing to reclaim", and
   `no approval set: reporting only, nothing rewritten`.
4. Fingerprint a live store before and after that run and confirm it is unchanged.

**Rollback:** `ssh admin@100.118.84.5 'cp -p ~/.openclaw/workspace/scripts/disk-cleanup.sh.bak-* ~/.openclaw/workspace/scripts/disk-cleanup.sh'`

**This step stops the cron from rewriting stores. It does not start anything.**

---

## Step 4. First guarded run (approval 4, separate, and optional)

Not part of installation. A maintenance run needs its own approval, its own window, and a reason.
It should only happen if a store actually has a freelist to reclaim; on 2026-11-15 all 22 had
`freelist_count = 0`, so there was nothing to reclaim and a run would have been pure risk.

```bash
# 1. report only, no approval, no writes -- do this first and read the output
ssh admin@100.118.84.5 '~/.openclaw/workspace/scripts/maintenance-guard.sh --db ~/.openclaw/memory/*.sqlite'

# 2. only if something is eligible, and only with an issued approval id, inside the window
#    OPENCLAW_MAINTENANCE_APPROVAL=CC-YYYY-MM-DD-NN \
#      ~/.openclaw/workspace/scripts/maintenance-guard.sh --apply --db ~/.openclaw/memory/<one store>
```

One store at a time. Not all 22 in a loop: the incident was a sweep, and a sweep cannot be verified
between targets.

**Rollback of a guarded run:** the in-place path is transactional (a failure leaves the database as
it was). The swap path keeps `<db>.pre-vacuum-<stamp>` and refuses to leave a file that fails
`integrity_check`; restore with `mv <db>.pre-vacuum-<stamp> <db>` and re-run
`sqlite3 <db> 'pragma integrity_check;'`.

---

## What is deliberately not in this package

- No change to the cron schedule, the other six cron steps, or the log path.
- No deletion of any release directory or cache, despite the storage audit's projected 21 GB. That
  deletion is a separate approval and is not part of host maintenance safety.
- No `VACUUM FULL` or `VACUUM INTO` anywhere in a scheduled script.
- No attempt to close the incident. The operator and process are still unknown.

## The uncertainty this package preserves

The 2026-11-15 rewrite is described here as **fingerprint-consistent with a bulk VACUUM**, not as a
confirmed command. Everything about it that can be checked has been: `freelist_count = 0` on all 22
stores with `auto_vacuum = 0` (only a VACUUM produces that), contiguous mtimes in name order,
3.1 GB `main.sqlite` rebuilt, 5.5 to 9.2 GB free afterwards, the 05:00 cron log untouched at 05:03,
gateway pid 639 live throughout, and no journal entry, script log or shell history covering it. That
is enough to say what happened to the files. It is not enough to say who or what did it, and this
document does not claim otherwise.
