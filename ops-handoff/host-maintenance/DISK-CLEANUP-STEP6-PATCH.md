# `disk-cleanup.sh` step 6 — exact patch, not applied

File on the host: `/Users/admin/.openclaw/workspace/scripts/disk-cleanup.sh`
Current mtime: Apr 21 2026. Cron: daily 05:00, output to `/tmp/disk-cleanup.log`.

Nothing below has been run. This is the change text, ready for approval.

## Why

Step 6 is the same operation that happened by hand on 2026-11-15 at 16:25 to 16:29, except it is
scheduled:

```bash
# 6. Vacuum sqlite DBs
echo "[6/7] Vacuuming sqlite databases..."
for db in /Users/admin/.openclaw/memory/*.sqlite; do
  if [ -f "$db" ]; then
    sqlite3 "$db" "VACUUM;" 2>/dev/null || true
  fi
done
```

Four problems, in the order they bite:

1. **No space check.** A `VACUUM` of `main.sqlite` (3.1 GB) needs temp space on the order of its
   size. On 2026-10-06 this exact class of job filled the disk at 05:03 and needed manual cleanup.
2. **No reclaim check.** All 22 databases reported `freelist_count = 0` on 2026-11-15. `VACUUM` with
   nothing free reclaims nothing: the whole cost, zero benefit. This is why the log line says
   `est. 0MB freed`.
3. **`|| true` and `2>/dev/null`.** Every failure, including "disk full", is erased. That is how a job
   can run for months, reclaim nothing, and look healthy.
4. **It rewrites a 3.1 GB file while the gateway is live**, taking the write lock for the duration,
   with no record of how long the fleet was stalled.

## The patch

Replace the block above with:

```bash
# 6. Sqlite maintenance: REPORT by default, rewrite only under the guard.
#    A VACUUM with freelist 0 reclaims nothing and still takes the write lock on a live database.
#    See ops-handoff/host-maintenance/MAINTENANCE-POLICY.md.
echo "[6/7] Checking sqlite databases (no rewrite by default)..."
GUARD=/Users/admin/.openclaw/workspace/scripts/maintenance-guard.sh
for db in /Users/admin/.openclaw/memory/*.sqlite; do
  [ -f "$db" ] || continue
  free=$(sqlite3 "$db" "pragma freelist_count;" 2>/dev/null || echo "?")
  size=$(du -m "$db" 2>/dev/null | cut -f1)
  if [ "$free" = "0" ]; then
    echo "  $(basename "$db"): ${size}MB, nothing to reclaim"
  else
    echo "  $(basename "$db"): ${size}MB, ${free} free pages reclaimable only via an approved run"
  fi
done
# Opt in deliberately; the guard enforces approval, the window, free space and logging.
if [ "${OPENCLAW_MAINTENANCE_APPROVAL:-}" != "" ] && [ -x "$GUARD" ]; then
  "$GUARD" --apply --db /Users/admin/.openclaw/memory/*.sqlite || echo "  guard refused or failed; see its log"
else
  echo "  no approval set: reporting only, nothing rewritten"
fi
```

Result: the cron reports, never silently rewrites, and can only rewrite when an approval id is
present in its environment. The `|| true` and the swallowed stderr are gone, so a real failure shows
up in `/tmp/disk-cleanup.log`.

## Install sequence (each step needs a go)

```bash
# 1. back up the script (the only irreversible risk here is losing the original)
ssh admin@100.118.84.5 'cp -p ~/.openclaw/workspace/scripts/disk-cleanup.sh \
  ~/.openclaw/workspace/scripts/disk-cleanup.sh.bak-$(date +%Y%m%d)'

# 2. install the guard next to it
scp ops-handoff/host-maintenance/maintenance-guard.sh \
  admin@100.118.84.5:~/.openclaw/workspace/scripts/maintenance-guard.sh
ssh admin@100.118.84.5 'chmod +x ~/.openclaw/workspace/scripts/maintenance-guard.sh'

# 3. prove it refuses and reports, with no approval and no rewrite
ssh admin@100.118.84.5 '~/.openclaw/workspace/scripts/maintenance-guard.sh \
  --db ~/.openclaw/memory/*.sqlite'

# 4. apply the step-6 patch, then re-read the file and diff against the backup
ssh admin@100.118.84.5 'diff ~/.openclaw/workspace/scripts/disk-cleanup.sh.bak-* \
  ~/.openclaw/workspace/scripts/disk-cleanup.sh'
```

Step 3 is a dry run of a script that has no side effects. Step 4 changes when and whether a cron job
rewrites production memory databases, which is a scheduling change and therefore gated.

## Not in scope of this patch

- Do not change the cron schedule, the other six steps, or the log path in this change.
- Do not delete the ssh backup for 30 days.
- Do not add `VACUUM FULL` or `VACUUM INTO` anywhere in a scheduled script.
