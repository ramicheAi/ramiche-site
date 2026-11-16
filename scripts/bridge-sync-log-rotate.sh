#!/bin/bash
# Narrowly scoped bounded rotation for bridge-sync's stdout/stderr logs ONLY.
# CC-RECOVERY-18 Authorization B. Does NOT touch bridge-sync's own process or plist, and does NOT
# restart it: macOS launchd opens StandardOutPath/StandardErrorPath once at process start and the
# running node process never reopens them on a rename, so a rename+recreate rotation (classic
# newsyslog behavior) would leave bridge-sync writing forever into the renamed file while the
# freshly-created file sits empty forever. This script truncates the live file IN PLACE (same
# inode) instead -- the exact pattern verified safe during this same incident's emergency relief
# step -- after archiving a bounded tail of its content first, so recent diagnostic evidence
# (including 401/403 patterns) survives the rotation.
set -euo pipefail
LOGDIR="/Users/admin/.openclaw/workspace/logs"
ARCHDIR="$LOGDIR/archive"
mkdir -p "$ARCHDIR"
MAX_BYTES=$((50*1024*1024))   # 50MB -- rotate well before this becomes a disk risk again
TAIL_LINES=5000                # bounded diagnostic sample kept per rotation
KEEP_GENERATIONS=10             # bounded retention -- old archives beyond this are pruned

# CC-RECOVERY-20: a lock against a second concurrent invocation. Verified reproducible without
# one: two invocations racing the same oversized file can pick the same one-second timestamp,
# so the second invocation's archive silently overwrites the first's -- a real, if low-probability,
# evidence-loss window (StartInterval is 900s and a rotation normally takes well under a second,
# so overlap needs something unusual, like a stalled gzip under disk pressure -- exactly the
# condition this script exists for). `mkdir` is atomic on every filesystem this runs on, so it
# works as a lock without depending on `flock`, which macOS does not ship by default.
LOCKDIR="$LOGDIR/.rotate.lock"
PIDFILE="$LOCKDIR/pid"
# CC-RECOVERY-22: a PURE time-based staleness check (the CC-RECOVERY-21 version of this file) is
# wrong, and was proven wrong by testing it directly: a legitimate rotation that happens to run
# longer than the staleness threshold (a stalled gzip under real disk pressure -- the exact
# condition this script exists for) would have its OWN lock "reclaimed" out from under it by a
# second invocation, defeating the lock entirely for the one case it most needs to hold. Liveness,
# not age, is the right test: the lock holder writes its PID into the lock dir, and a second
# invocation checks whether that PID is still alive, however long the lock has existed. A lock is
# stale only when its holder is provably gone (the pidfile is missing/unreadable, or `kill -0`
# says that pid does not exist) -- never merely old. The EXIT trap below releases the lock on a
# normal exit, an error exit (set -e) and most signals, but not SIGKILL or a hard crash; this is
# what makes a lock left behind by one of those recoverable without a time guess.
#
# Known, accepted limitation: PID reuse. If the holder's PID is later reassigned to an unrelated
# process before this check runs, `kill -0` would report "alive" for the wrong process and this
# invocation would skip needlessly (safe direction: a missed rotation, not a lost lock) -- on a
# quiet single host with launchd's own short-lived children, this is not worth the complexity of
# a start-time comparison (`ps -o lstart=`) to close completely.
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  holder_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$holder_pid" ] && kill -0 "$holder_pid" 2>/dev/null; then
    echo "$(date -Iseconds) another rotation is still running (pid $holder_pid), skipping this invocation" >> "$LOGDIR/bridge-sync-log-rotate.log"
    exit 0
  fi
  echo "$(date -Iseconds) clearing a stale lock (holder pid '${holder_pid:-unknown}' is not running)" >> "$LOGDIR/bridge-sync-log-rotate.log"
  rm -rf "$LOCKDIR" 2>/dev/null || true
  mkdir "$LOCKDIR" 2>/dev/null || { echo "$(date -Iseconds) another rotation won the lock just after staleness was detected, skipping" >> "$LOGDIR/bridge-sync-log-rotate.log"; exit 0; }
fi
echo $$ > "$PIDFILE"
trap 'rm -rf "$LOCKDIR" 2>/dev/null || true' EXIT

rotate_one() {
  local f="$1"
  local base
  base="$(basename "$f")"
  [ -f "$f" ] || return 0
  local size
  size=$(stat -f%z "$f" 2>/dev/null || echo 0)
  if [ "$size" -lt "$MAX_BYTES" ]; then
    return 0
  fi
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  local arch="$ARCHDIR/${base}.${ts}.gz"
  tail -n "$TAIL_LINES" "$f" | gzip -c > "$arch"
  # In-place truncate: SAME inode, SAME fd the running process already holds open. Verified-safe --
  # does not require bridge-sync to reopen anything or restart.
  : > "$f"
  echo "$(date -Iseconds) rotated $base (${size} bytes) -> $arch" >> "$LOGDIR/bridge-sync-log-rotate.log"
  # Prune old archives for this file beyond KEEP_GENERATIONS.
  ls -1t "$ARCHDIR/${base}."*.gz 2>/dev/null | tail -n +"$((KEEP_GENERATIONS+1))" | xargs -r rm -f
}

rotate_one "$LOGDIR/bridge-sync.log"
rotate_one "$LOGDIR/bridge-sync-error.log"
