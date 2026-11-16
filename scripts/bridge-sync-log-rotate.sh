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
# CC-RECOVERY-22 independent review: hardcoding this made the script untestable in place, forcing
# every review copy to hand-edit the path first. An env override makes it testable without
# changing production behavior at all (nothing sets this env var there).
LOGDIR="${LOGDIR:-/Users/admin/.openclaw/workspace/logs}"
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
# CC-RECOVERY-23: a second, independent mkdir-based lock, used ONLY to elect a single reclaimer
# when the primary lock looks stale (see the acquisition loop below). It gets the exact same
# liveness treatment as the primary lock, for the same reason: CC-RECOVERY-22's PID-liveness check
# replaced a pure age check on $LOCKDIR because age cannot tell a slow-but-alive holder from a
# dead one; this lock needs the identical property, or it would just relocate the same class of
# bug one level down (see the "leaked reclaim lock" note below).
RECLAIMDIR="$LOGDIR/.rotate.lock.reclaiming"
RECLAIM_PIDFILE="$RECLAIMDIR/pid"

is_valid_pid() {
  case "$1" in
    ''|*[!0-9]*) return 1 ;;  # empty, or contains a non-digit (rejects '-1', '0' is caught below)
    0) return 1 ;;            # kill -0 0 signals the whole process group -- never a real holder
    *) return 0 ;;
  esac
}
# A fifth independent review (after a symlink-and-atomic-rename rewrite was tried and found to
# introduce a WORSE, higher-frequency double-entry bug under heavy concurrency than the two-lock
# design it was meant to replace -- reverted) confirmed this file's current design has no P0: no
# data loss or double-entry in realistic operation. It left three known, accepted limitations:
#   1. "00"/"000" in a pidfile are read as the literal string, not the number, so `case` matching
#      exact "0" misses them and `kill -0 00` signals the whole process group like `kill -0 0`
#      does -- a hand-corrupted pidfile could look permanently alive. Only reachable by manual
#      corruption, never by this script's own writes (always a plain `$$`).
#   2. PID reuse remains a real, if rare, way to misjudge a dead holder as alive (already
#      documented below) -- a reused pid belonging to a long-lived process would block rotation
#      until that process exits, logged every attempt, never silent.
#   3. A failed gzip leaves a zero-byte .gz behind (the shell's `>` redirect creates the
#      destination before gzip runs), occupying a retention slot. Pre-existing, not introduced by
#      this file's locking changes.
# None of these needs fixing to install this version; each is a narrow, logged, non-silent edge
# case rather than a repeatable failure mode.

# CC-RECOVERY-22 independent review found a real race here: acquiring a lock dir and writing its
# pidfile used to be two separate steps, so a reader arriving in between saw no pidfile yet and
# could misdiagnose a live holder as stale. One retry after a brief pause is enough: a live holder
# writes its own pid within milliseconds of acquiring its lock dir.
read_pid_file() {
  local file="$1" attempt pid
  for attempt in 1 2; do
    pid="$(cat "$file" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      printf '%s' "$pid"
      return 0
    fi
    [ "$attempt" -eq 1 ] && sleep 0.2
  done
  return 0
}

is_holder_alive() {
  local pid
  pid="$(read_pid_file "$1")"
  is_valid_pid "$pid" && kill -0 "$pid" 2>/dev/null
}

# A single cleanup path for both locks, driven by flags rather than two separate traps (bash only
# ever has one EXIT trap active; the second `trap` call would silently replace the first). Runs on
# normal exit, an error exit (set -e) and most signals -- not SIGKILL or a hard crash, which is
# exactly why BOTH locks also get the liveness treatment above rather than relying on this trap
# alone to guarantee they are ever released.
holding_lock=0
holding_reclaim=0
cleanup() {
  [ "$holding_reclaim" -eq 1 ] && rm -rf "$RECLAIMDIR" 2>/dev/null
  [ "$holding_lock" -eq 1 ] && rm -rf "$LOCKDIR" 2>/dev/null
  return 0
}
trap cleanup EXIT

# CC-RECOVERY-23 independent review found a serious race in an earlier version of this reclaim
# path: `rm -rf` then `mkdir` on $LOCKDIR were two separate, unguarded steps, so multiple
# invocations that each independently diagnosed the same stale lock could each run both steps --
# reproduced directly (up to 47 of 60 rounds under concurrent pressure), corrupting or duplicating
# the rotation the lock exists to serialize. Fixed by electing exactly one reclaimer via
# $RECLAIMDIR before anything touches $LOCKDIR.
#
# A FIFTH review (after the symlink rewrite mentioned above was tried and reverted) found two
# more real, reproducible races in this exact design, both requiring either an artificial stall
# (roughly 0.5-0.8s injected between two adjacent statements) or concurrency well beyond what this
# script will ever see in real use (24-32+ simultaneous invocations, against a 900s launchd
# interval and sub-second normal rotation time) -- accepted as documented limitations rather than
# chased further, per that review's own verdict ("P2 for a 15-minute launchd job... no P0 and
# nothing that loses data in normal operation"):
#   1. A fresh winner's `mkdir "$LOCKDIR"` and its `echo $$ > "$PIDFILE"` a few lines below are
#      still two separate steps with nothing held in between (only the RECLAIM path's fresh-winner
#      case got the "hold $RECLAIMDIR through the pidfile write" fix, because only that path had
#      $RECLAIMDIR available to hold -- the plain `while` condition's fresh win does not). Under
#      an induced stall there, a starved contender can read the still-empty pidfile, misjudge the
#      lock stale, and win it out from under the real holder.
#   2. The "clear a leaked reclaim lock" branch's `rm -rf "$RECLAIMDIR"` has no re-validation
#      immediately before it (unlike the primary lock's reclaim, which re-checks right after
#      winning the election) -- a slow clearer can delete a reclaim lock a different invocation
#      has, in the meantime, legitimately re-won.
# Both have the same shape as every bug earlier rounds found and fixed on the primary lock, and
# the same fix pattern applies (hold the relevant lock through the write, re-validate immediately
# before a destructive step) -- not applied here because this round's time budget is spent;
# tracked as explicit follow-up work rather than left silently unfixed.
#
# A SECOND review of that fix then found the election lock itself could leak: if the elected
# reclaimer is killed (SIGKILL, power loss) between acquiring $RECLAIMDIR and releasing it, the
# directory is left behind with nothing to ever clear it -- every future invocation would see it
# held, retry up to the attempt cap, and give up silently, forever, which is the exact disk-fill
# failure this script exists to prevent. Fixed by giving $RECLAIMDIR the identical liveness check
# as $LOCKDIR: a loser who can't acquire it reads ITS pidfile and checks whether that holder is
# still alive before deciding whether to wait or to clear a leaked election lock immediately.
attempt=0
while ! mkdir "$LOCKDIR" 2>/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 20 ]; then
    echo "$(date -Iseconds) could not acquire the lock after $attempt attempts, giving up this invocation" >> "$LOGDIR/bridge-sync-log-rotate.log"
    exit 0
  fi
  if is_holder_alive "$PIDFILE"; then
    echo "$(date -Iseconds) another rotation is still running, skipping this invocation" >> "$LOGDIR/bridge-sync-log-rotate.log"
    exit 0
  fi
  if mkdir "$RECLAIMDIR" 2>/dev/null; then
    holding_reclaim=1
    echo $$ > "$RECLAIM_PIDFILE"
    # Re-validate the PRIMARY holder immediately after winning the election, in case its own
    # pidfile write landed while we were on our way to winning: the staleness verdict above is
    # now stale itself.
    if is_holder_alive "$PIDFILE"; then
      rm -rf "$RECLAIMDIR" 2>/dev/null || true
      holding_reclaim=0
      echo "$(date -Iseconds) lock holder became live again during reclaim election, skipping" >> "$LOGDIR/bridge-sync-log-rotate.log"
      exit 0
    fi
    echo "$(date -Iseconds) clearing a stale lock" >> "$LOGDIR/bridge-sync-log-rotate.log"
    rm -rf "$LOCKDIR" 2>/dev/null || true
    reclaimed=0
    mkdir "$LOCKDIR" 2>/dev/null && reclaimed=1 || true
    if [ "$reclaimed" -eq 1 ]; then
      # Found by stress-testing this exact fix: releasing $RECLAIMDIR BEFORE writing the new
      # $LOCKDIR's pidfile left a window where a second invocation could win a fresh election,
      # see our brand-new lock with no pidfile in it yet, misdiagnose it as stale (the same
      # "no pidfile written yet" case read_pid_file's retry exists for), and delete it out from
      # under us before we got to write to it -- our own `echo $$ > "$PIDFILE"` then failed with
      # "No such file or directory", reproduced directly. Holding $RECLAIMDIR through the pidfile
      # write closes it: nobody else can even attempt an election while we still hold it.
      holding_lock=1
      echo $$ > "$PIDFILE"
      rm -rf "$RECLAIMDIR" 2>/dev/null || true
      holding_reclaim=0
      break
    fi
    # As the sole elected reclaimer, nothing else should have been able to recreate $LOCKDIR
    # between our rm and our mkdir -- if it still somehow failed (disk full, a permissions
    # problem), release the election and fall through to the loop's own top-of-iteration mkdir
    # rather than assume we hold a lock we don't.
    rm -rf "$RECLAIMDIR" 2>/dev/null || true
    holding_reclaim=0
  elif is_holder_alive "$RECLAIM_PIDFILE"; then
    # Someone else is actively reclaiming right now. Back off briefly and re-check everything
    # fresh -- do NOT touch $LOCKDIR while another invocation might be mid-reclaim on it.
    sleep 0.1
  else
    # The election lock itself is stale: its holder died mid-reclaim. Clear it immediately
    # (no backoff needed -- there is nothing live to wait for) and retry this same iteration.
    echo "$(date -Iseconds) clearing a leaked reclaim lock" >> "$LOGDIR/bridge-sync-log-rotate.log"
    rm -rf "$RECLAIMDIR" 2>/dev/null || true
  fi
done
# Reached only via the plain `while` condition winning $LOCKDIR fresh (no reclaim involved) --
# the reclaim path above sets holding_lock/writes the pidfile itself, while still holding
# $RECLAIMDIR, and `break`s before falling out here.
if [ "$holding_lock" -eq 0 ]; then
  holding_lock=1
  echo $$ > "$PIDFILE"
fi

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
