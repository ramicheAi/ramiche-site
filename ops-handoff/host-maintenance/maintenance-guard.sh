#!/usr/bin/env bash
# Guarded runner for rewriting live SQLite agent memory databases.
#
# Why this exists: on 2026-11-15 between 16:25 and 16:29 all 22 databases in
# ~/.openclaw/memory were VACUUMed in name order with the gateway running. Every one has
# auto_vacuum=0 and freelist=0, so that was not automatic maintenance. The scheduled job
# (/tmp/disk-cleanup.log, 05:03) did not do it. main.sqlite is 3.1 GB: whether that rewrite succeeds
# depends on free space, and whether it is safe depends on nobody else writing at the time.
#
# This runner refuses to do anything unless the conditions for a safe rewrite are all true, and it
# records the numbers either way. Default is a dry run.
#
# Two rewrite methods, and the difference matters:
#
#   in place (default)  sqlite VACUUM in a transaction. Correct while the gateway has the file open:
#                       SQLite takes the write lock, other connections wait. The cost is
#                       availability, not data. This is the method for a live fleet.
#   --swap              VACUUM INTO a new file, verify it, then replace the original. Keeps the old
#                       file if anything fails, but it is UNSAFE while any process holds the database
#                       open: that process keeps writing to the replaced inode and its writes are
#                       lost. So --swap refuses when any process has the file open.
#
# Usage:
#   ./maintenance-guard.sh --db ~/.openclaw/memory/main.sqlite                    # dry run
#   OPENCLAW_MAINTENANCE_APPROVAL=CC-2026-11-16-01 \
#     ./maintenance-guard.sh --apply --db ~/.openclaw/memory/*.sqlite             # in window
#   ./maintenance-guard.sh --apply --swap --db ~/.openclaw/memory/main.sqlite    # copy+swap, needs
#                                                                               # no live writer
#
# Exit codes: 0 ok/dry-run-clean, 2 refused (policy), 3 error.
set -euo pipefail

APPLY=0
SWAP=0
WINDOW_START="03:30"
WINDOW_END="05:30"
FREE_SPACE_FACTOR="2.5"
LOG_DIR="${HOME}/Library/Logs/parallax-maintenance"
LOCK="${TMPDIR:-/tmp}/parallax-maintenance.lock"
DBS=()

usage() {
  sed -n '3,22p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --swap) SWAP=1 ;;
    --db) shift; [ $# -gt 0 ] || { echo "REFUSED: --db needs a path" >&2; exit 2; }; DBS+=("$1") ;;
    --db=*) DBS+=("${1#--db=}") ;;
    --window) shift; [ $# -gt 0 ] || { echo "REFUSED: --window needs START-END (HH:MM-HH:MM)" >&2; exit 2; };
             WINDOW_START="${1%%-*}"; WINDOW_END="${1##*-}" ;;
    --help|-h) usage ;;
    *) echo "REFUSED: unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

[ ${#DBS[@]} -gt 0 ] || { echo "REFUSED: no --db given. Nothing to do, and this script does not guess." >&2; exit 2; }

mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%dT%H%M%S)"
LOG="$LOG_DIR/$STAMP.log"
# Tee everything: silence is not success.
exec > >(tee -a "$LOG") 2>&1

say() { echo "[$(date +%H:%M:%S)] $*"; }
refuse() { say "REFUSED: $*"; say "log: $LOG"; exit 2; }
fail() { say "ERROR: $*"; say "log: $LOG"; exit 3; }

# --- human size in bytes, for the space check ------------------------------------------------
size_of() { stat -f %z "$1" 2>/dev/null || stat -c %s "$1"; }
free_bytes() { df -k "$1" | awk 'NR==2 {print $4 * 1024}'; }
hbytes() { awk -v b="$1" 'BEGIN{ split("B KB MB GB TB",u," "); i=1; while (b>=1024 && i<5) {b/=1024; i++} printf "%.1f%s", b, u[i] }'; }

# --- policy checks ----------------------------------------------------------------------------
say "maintenance guard: $( [ "$APPLY" = 1 ] && echo APPLY || echo DRY-RUN )$( [ "$SWAP" = 1 ] && echo ' swap(copy+swap)' || echo ' in-place' )"
say "approval: ${OPENCLAW_MAINTENANCE_APPROVAL:-<none>}"
say "window: ${WINDOW_START}-${WINDOW_END}"
say "targets: ${#DBS[@]}"

if [ "$APPLY" = 1 ]; then
  [ -n "${OPENCLAW_MAINTENANCE_APPROVAL:-}" ] || refuse "OPENCLAW_MAINTENANCE_APPROVAL is not set. A rewrite of live data needs a named approval id."
fi

# Window check compares HH:MM strings lexicographically, which is valid for zero-padded 24h times.
NOW="$(date +%H:%M)"
if [ "$APPLY" = 1 ]; then
  if [ "$SWAP" = 1 ]; then
    say "window: skipped (--swap), which requires no live writer; that is its own gate"
  else
    after_start=$( [ "$NOW" \> "$WINDOW_START" ] || [ "$NOW" = "$WINDOW_START" ] && echo yes || echo no )
    before_end=$( [ "$NOW" \< "$WINDOW_END" ] || [ "$NOW" = "$WINDOW_END" ] && echo yes || echo no )
    if [ "$after_start" = yes ] && [ "$before_end" = yes ]; then
      say "window: inside ($NOW)"
    else
      refuse "outside the maintenance window ($NOW is not between $WINDOW_START and $WINDOW_END). Wait for the window, or use --swap with every writer stopped."
    fi
  fi
else
  say "window: not enforced in a dry run"
fi

# One maintenance run at a time, whichever shell started it.
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +180 2>/dev/null)" ]; then
    say "stale lock (>3h) at $LOCK; removing"
    rmdir "$LOCK" 2>/dev/null || true
    mkdir "$LOCK" 2>/dev/null || refuse "another maintenance run holds $LOCK"
  else
    refuse "another maintenance run holds $LOCK (remove it by hand only if you are sure no run is live)"
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

# --- per-target analysis ----------------------------------------------------------------------
TOTAL_BYTES=0
declare -a OK_DBS=()
for db in "${DBS[@]}"; do
  case "$db" in /*) ;; *) db="$PWD/$db" ;; esac
  [ -f "$db" ] || refuse "not a file: $db"
  command -v sqlite3 >/dev/null || fail "sqlite3 not found"
  [ "$(head -c 15 "$db" | tr -d '\0')" = "SQLite format 3" ] || refuse "not a SQLite database (bad magic): $db"

  # Refuse on a live WAL/journal sidecar: a write is in flight right now.
  for side in "$db-wal" "$db-journal"; do
    [ -e "$side" ] && refuse "$(basename "$side") exists next to $(basename "$db"): a write is in flight. Stop the writer first."
  done

  size=$(size_of "$db")
  freelist=$(sqlite3 "$db" 'pragma freelist_count;' 2>/dev/null || echo "?")
  pages=$(sqlite3 "$db" 'pragma page_count;' 2>/dev/null || echo "?")
  auto=$(sqlite3 "$db" 'pragma auto_vacuum;' 2>/dev/null || echo "?")
  avail=$(free_bytes "$db")
  need=$(awk -v s="$size" -v f="$FREE_SPACE_FACTOR" 'BEGIN{printf "%d", s*f}')
  TOTAL_BYTES=$((TOTAL_BYTES + size))
  say "----"
  say "db:          $db"
  say "size:        $(hbytes "$size")  (pages=$pages freelist=$freelist auto_vacuum=$auto)"
  say "free space:  $(hbytes "$avail")  need $(hbytes "$need") (${FREE_SPACE_FACTOR}x target)"

  if [ "$freelist" = "0" ]; then
    say "decision:    skip, nothing to reclaim (freelist 0)"
    continue
  fi
  if [ "$avail" -lt "$need" ]; then
    say "decision:    skip, insufficient free space ($(hbytes "$avail") < $(hbytes "$need"))"
    continue
  fi
  # lsof exits 1 when nothing holds the file, and pipefail would turn that into an abort. "Nobody
  # has it open" is a normal, common answer, not an error.
  holders=$(lsof -t -- "$db" 2>/dev/null | tr '\n' ' ' | sed 's/ *$//' || true)
  if [ -n "$holders" ]; then
    say "open by:     pid(s) $holders$( [ -n "${OPENCLAW_GATEWAY_PID:-}" ] && [ "$holders" = "$OPENCLAW_GATEWAY_PID" ] && echo ' (gateway)' )"
    if [ "$SWAP" = 1 ]; then
      say "decision:    refuse --swap, the database is open; in-place VACUUM is the correct method here"
      continue
    fi
    say "note:        in-place VACUUM takes the write lock, so these writers wait while it runs"
  elif [ "$SWAP" = 1 ]; then
    say "open by:     nothing, --swap is safe"
  fi
  say "decision:    eligible"
  OK_DBS+=("$db")
done

say "----"
say "total target size: $(hbytes "$TOTAL_BYTES"); eligible: ${#OK_DBS[@]} of ${#DBS[@]}"

if [ "$APPLY" != 1 ]; then
  say "DRY RUN: nothing was rewritten. Re-run with --apply inside the window."
  exit 0
fi

[ ${#OK_DBS[@]} -gt 0 ] || { say "nothing eligible; no rewrite performed"; exit 0; }

# --- the rewrite -------------------------------------------------------------------------------
integrity() { sqlite3 "$1" 'pragma integrity_check;' 2>&1 | head -1; }

for db in "${OK_DBS[@]}"; do
  before_size=$(size_of "$db")
  before_free=$(free_bytes "$db")
  say "== $(basename "$db"): $(hbytes "$before_size")"

  if [ "$SWAP" = 1 ]; then
    # Copy, verify, swap. Only reachable with no process holding the database open: replacing a
    # file another process has open silently discards that process's writes.
    tmp="$db.vacuum-$$"
    backup="$db.pre-vacuum-$STAMP"
    say "   VACUUM INTO $tmp"
    if ! sqlite3 "$db" "VACUUM INTO '$tmp';" 2>&1 | sed 's/^/   /'; then
      rm -f "$tmp"; say "   FAILED: vacuum into copy; original untouched"; continue
    fi
    check=$(integrity "$tmp")
    if [ "$check" != "ok" ]; then
      rm -f "$tmp"; say "   FAILED: copy failed integrity_check ($check); original untouched"; continue
    fi
    say "   copy integrity_check ok"
    cp -p "$db" "$backup" || { rm -f "$tmp"; say "   FAILED: could not keep a backup"; continue; }
    if ! mv -f "$tmp" "$db"; then
      say "   FAILED: swap; original untouched, backup at $backup"; continue
    fi
    after_check=$(integrity "$db")
    if [ "$after_check" != "ok" ]; then
      say "   CRITICAL: swapped file failed integrity_check ($after_check); restoring backup"
      mv -f "$backup" "$db"
      continue
    fi
    say "   swapped and verified; backup kept at $backup"
  else
    if ! sqlite3 "$db" 'VACUUM;' 2>&1 | sed 's/^/   /'; then
      say "   FAILED: vacuum; database left as it was (sqlite vacuums transactionally)"; continue
    fi
    check=$(integrity "$db")
    [ "$check" = "ok" ] && say "   integrity_check ok" || say "   WARNING: integrity_check said: $check"
  fi

  after_size=$(size_of "$db")
  after_free=$(free_bytes "$db")
  say "   size $(hbytes "$before_size") -> $(hbytes "$after_size"); free $(hbytes "$before_free") -> $(hbytes "$after_free")"
done

say "done; log: $LOG"
