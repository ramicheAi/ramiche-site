# Host maintenance policy — Parallax fleet

Status: **proposed, not installed.** Nothing on the iMac was changed to produce this document. No
file on the host was edited, no cron was touched, no database was rewritten.

## What was found (evidence, 2026-11-15)

The reported "accidental production VACUUM" is **not** a VACUUM of the production Postgres
database. Production Postgres (Supabase `command-center-hq`, ref `qkbkfsjkysdsfmhgfdoc`) records no
manual vacuum at all:

```
pg_stat_user_tables: last_vacuum is NULL on every user table (all schemas)
pg_stat_progress_vacuum: 0 running
messages: 9 rows, 0 dead tuples, last_vacuum NULL, last_autovacuum NULL
pg_stat_database.stats_reset: NULL (never reset, so the stats are the full history)
```

The event that did happen is on the **host**, in the agent memory stores:

| Evidence | Value |
|---|---|
| `~/.openclaw/memory/*.sqlite` `freelist_count` | **0 on all 22 databases** |
| `auto_vacuum` on those databases | **0 (off)** — freelist 0 is not automatic; only a VACUUM produces it |
| `journal_mode` | `delete` (no WAL sidecar left behind) |
| Modification times | clustered **16:25 to 16:29**, all 22, in name order |
| `main.sqlite` | 3.1 GB, rebuilt in that window |
| Free space | ~5.5 GB before, 9.2 GB after (`df` on `/System/Volumes/Data`) |
| `/tmp/disk-cleanup.log` mtime | **05:03** (the 05:00 cron), so this was **not** the scheduled job |
| Gateway | pid 639, running since Nov 14 15:00, i.e. **live during the rewrite** |
| No record | nothing in the work journal, no script log covering that window, no shell history entry |

So: an unlogged, out-of-window VACUUM sweep of every live agent memory database, including a 3.1 GB
one, while the gateway had them open. The 2026-10-06 lesson already recorded that this class of job
can fill the disk and reclaims nothing when it runs with no maintenance window. It happened again,
without the cron, and left no trace except 3.7 GB of freed space (5.5 to 9.2 GB available) and 22
rebuilt files.

To be exact about the numbers, because they are easy to inflate: 3.7 GB is what the sweep actually
returned. The separate 21 GB figure in the storage audit is the *projected* reclaim from deleting ten
unreferenced release directories plus the npm cache. That deletion has not happened, nothing was
deleted, and it is not evidence about this incident.

**Honest limit on this finding:** no log of the command survives. The conclusion is inference from
the fingerprint (freelist 0 on all 22 with auto_vacuum off, contiguous mtimes, disk gain), not from a
recorded command. Every piece of it is reproducible and none of it is contradicted, but I cannot name
the process or the operator from evidence.

## Rules (proposed)

1. **No ad-hoc maintenance on live data.** Rewriting a live database (`VACUUM`, `VACUUM FULL`,
   `VACUUM INTO`, `REINDEX`, `DROP`) requires a named approval and a maintenance window. "Cheap and
   reversible" does not cover rewriting a 3 GB file under a running gateway.
2. **The host is production.** `~/.openclaw/memory/main.sqlite` is the fleet's working memory. It is
   not a scratch file. A rewrite of it gets the same care as the Postgres database.
3. **Scheduled work stays scheduled.** If a job is meant for 05:00, it must not be run by hand at
   16:25. A manual run goes through the guard, which logs a timestamped record.
4. **Space first, and say the number.** A vacuum needs free space comparable to the largest target.
   Refuse below 2.5x the target size.
5. **Method depends on who has the file open**, and on whether a write is in flight.
   - Gateway live (the normal case): **in-place** `VACUUM`. Refused outright while a `-journal` or
     `-wal` sidecar exists, because that sidecar means a write transaction is open right now. When no
     transaction is open, the VACUUM takes the write lock; a writer that grabs it first makes the
     VACUUM wait up to `SQLITE_WAIT_MS` (default 30 s) and then fail with the database unchanged.
     30 s is not arbitrary: the SQLite CLI's default busy timeout is zero, so without this the
     VACUUM fails the instant any writer is active (verified: "database is locked" in under a
     second), which is a maintenance run that can never succeed on a live fleet.
   - Nobody holds the file: **copy-and-swap** (`VACUUM INTO`, verify, replace). Keeps the original if
     anything fails.
   - Copy-and-swap while any process holds the database open is **forbidden**: that process keeps
     writing to the replaced inode and its writes are silently lost. This is the one failure mode
     that loses data rather than merely stalling, and it is easy to get wrong. The guard checks open
     handles with `lsof` and refuses.
   - Free-space requirement differs by method, because the two write different volumes: **2.5x** the
     target for in-place, **3.5x** for copy-and-swap (copy + preserved backup + original coexist).
     One factor for both would under-provision the path that can actually fill the disk.
6. **Every run leaves a record.** Approval id, operator, start and end, before/after size and free
   space, integrity result. Silence is not success.
7. **An approval id is a deliberate act, not a variable.** `--apply` requires
   `OPENCLAW_MAINTENANCE_APPROVAL` in the form `CC-YYYY-MM-DD-NN`. This is not a security control (a
   local user can set anything); it is an accident control, so a stray `export
   OPENCLAW_MAINTENANCE_APPROVAL=1` in a shell profile cannot authorize a rewrite of live data.

## Guarded runner

`maintenance-guard.sh` (this directory) refuses to run unless:

- `OPENCLAW_MAINTENANCE_APPROVAL` is an approval id of the form `CC-YYYY-MM-DD-NN` (for any
  `--apply`); a value of another shape is refused, so an accidental variable does not authorize a
  rewrite
- the local time is inside the window (default 03:30 to 05:30), unless `--swap` is used, which skips
  the window precisely because it requires that no writer is live
- free space is at least 2.5x the target database
- the target is a real SQLite file (magic checked), has no `-wal`/`-journal` sidecar, and has
  `freelist_count > 0` (otherwise there is nothing to reclaim and the rewrite is pure risk)
- no other maintenance run holds the lock
- every decision, number and result is logged to `~/Library/Logs/parallax-maintenance/<stamp>.log`

It defaults to a dry run and reports, per database: size, pages, freelist, `auto_vacuum`, open
handles, free space, need, and the decision.

Verified paths on real SQLite files (not on the host):

| Case | Result |
|---|---|
| no `--db` | refused |
| dry run, freelist > 0 | reports eligible, rewrites nothing |
| `--apply` with no approval | refused, exit 2 |
| `--apply` outside the window | refused, exit 2 |
| `--apply --swap` with the file held open | refused, in-place named as the correct method |
| `--apply` while a `-journal` sidecar exists | refused (a write transaction is open), unchanged |
| `--apply` in-place with a writer that releases | waits for the lock, then rewrites; rows intact |
| `--apply` in-place with a writer that never releases | fails after `SQLITE_WAIT_MS`, unchanged |
| approval id of the wrong shape (`=1`) | refused, nothing written |
| `--apply` in-place with the file held open | runs, logs the pids that will wait |
| `--apply --swap`, nothing open | copy, integrity ok, swap, backup kept |
| in-place `--apply` inside the window | 13.1 MB to 8.0 kB, integrity ok, data intact |
| non-SQLite file | refused (bad magic) |
| `-wal` sidecar present | refused (a write is in flight) |
| unknown flag | refused |

```bash
# dry run, safe, no approval needed
./maintenance-guard.sh --db ~/.openclaw/memory/*.sqlite

# real run, inside the window, with approval
OPENCLAW_MAINTENANCE_APPROVAL=CC-2026-11-16-01 ./maintenance-guard.sh --apply --db ~/.openclaw/memory/main.sqlite

# copy-and-swap, only with every writer stopped
OPENCLAW_MAINTENANCE_APPROVAL=CC-2026-11-16-02 ./maintenance-guard.sh --apply --swap --db ~/.openclaw/memory/main.sqlite
```

## The scheduled job is the other hole

`~/.openclaw/workspace/scripts/disk-cleanup.sh` step 6 (`[6/7] Vacuuming sqlite databases...`) calls
`sqlite3 "$db" "VACUUM;"` on every database with no approval, no space check, no freelist check and
no per-database log. It is the same operation, run by a timer that cannot see whether the box has
space. See `DISK-CLEANUP-STEP6-PATCH.md` for the exact replacement, not applied.

The recommendation is stronger than guarding it: on 2026-11-15 every one of the 22 databases had
`freelist_count = 0`, so step 6 as written reclaims **nothing** and risks stalling the gateway. It
should report what reclaim is available and do no rewriting by default.

## Before any further host maintenance is authorized

1. Install the guard (exact commands in `DISK-CLEANUP-STEP6-PATCH.md`, not run).
2. Replace `disk-cleanup.sh` step 6 with the guarded, report-by-default version.
3. Re-run the read-only storage audit and confirm the reclaimable release set from CC-RECOVERY-10
   is still accurate.
4. Approve the specific window and the specific databases.

None of this is installed. Steps 1 to 4 each need an explicit go.
