# CC-RECOVERY-21 — recoverable migration + deployment sequence

**Status: plan only. Nothing in this document has been executed.** Production is frozen at
Vercel commit `f5c88ba4` (PR #91) and the iMac canonical cockpit at `41d183a0` (PR #46). Neither
calls the new relay state machine. The two migrations below are prepared, reviewed, and (per
`fix/cc-relay-historical-backfill`) corrected, but not applied.

## Pre-migration integrity fingerprint (verified, content-safe)

Computed directly against production (`qkbkfsjkysdsfmhgfdoc`, `public.messages`) without pulling
any message text into this session — the hash covers identity/shape fields only:

```sql
select md5(string_agg(
  id::text || '|' || channel_id::text || '|' || coalesce(sender_type,'') || '|'
    || length(content)::text || '|' || created_at::text,
  ',' order by id
)) as fingerprint, count(*) as n
from public.messages;
```

**Result at 2026-11-16: `fingerprint = 7c895ac039dbae3e2119771890304486`, `n = 432`.**

Both migrations are purely additive (new columns, new functions) and the backfill UPDATE touches
only the new `relay_status`/`relay_claimed_at` columns — never `id`, `channel_id`, `sender_type`,
`content`, or `created_at`. **Re-running this exact query immediately after applying the
migrations must return the identical fingerprint and `n = 432`.** Any difference means something
touched existing rows beyond what the migration is supposed to do, and is the stop condition below.

## What a managed backup actually looks like here (verified, not assumed)

- Supabase organization `ramicheAi's Org` is on the **free tier** (confirmed via
  `get_organization`). I could not find a "list backups" / PITR-status endpoint through the
  available administrative tools to confirm what, if anything, Supabase itself retains
  automatically. **This has not been positively confirmed either way — verify directly in the
  Supabase dashboard's Database → Backups page before treating "a backup exists" as true.**
- A real, available, verified-to-exist recovery mechanism: Supabase branching. `list_branches`
  confirms this project supports creating a branch with data, which forks the database. This has
  not been created — doing so is a safe, non-destructive action but still a production-adjacent
  change this document stops short of without your sign-off.
- **Full-content backup, not done in this session, by design:** the 432 rows contain your own
  private chat history. Pulling the actual message text through this session to build a
  restorable dump is possible via the same read-only SQL access used for the fingerprint above,
  but I did not do it unprompted — that's your call, not mine, given the content involved. If you
  want a real point-in-time content dump (not just the integrity fingerprint), say so explicitly
  and I'll pull it into a local file under your control.
- **What I did instead, and fully proved:** the mechanics of applying, verifying, and rolling back
  the schema changes themselves, against a disposable PostgreSQL 17 instance built to the exact
  production shape (see `fix/cc-relay-historical-backfill`'s commit message for the full
  before/after proof). That instance is not persisted; it was stopped and deleted after each test.

## Proposed coordinated sequence (not yet executed — each step is a separate authorization)

1. **Confirm backup posture.** Check the Supabase dashboard directly for backup/PITR status. If
   none exists and you want one, authorize a real content export (branch-with-data, or a
   straight `pg_dump`-equivalent via this session) before step 2.
2. **Capture the fingerprint above as the stop/verify baseline** (already done).
3. **Apply `20261112180000_messages_client_idempotency_key.sql`.** Metadata-only, sub-millisecond
   on a 432-row table (measured). Re-run the fingerprint query — must match.
4. **Apply the corrected `20261115120000_cc_relay_dispatch_terminal_state.sql`** (from
   `fix/cc-relay-historical-backfill`, not the version currently on `main` — that one still has
   the historical-row gap this round fixed). Re-run the fingerprint query — must match. Separately
   confirm: `select relay_status, count(*) from messages group by 1` should show `legacy: 432` (or
   fewer, if real time has passed and some are now inside a hypothetical lease window — unlikely
   at this row count but check `pending` is 0 or explainable).
5. **Stop here and verify before touching any deployment.** At this point: schema is live, but
   *zero* currently-deployed code (Vercel or the iMac cockpit) calls any of it — confirmed in
   CC-RECOVERY-20. Production traffic is unaffected. This is a safe place to pause for as long as
   needed.
6. **Deploy.** Only once 1–5 are verified: lift the Vercel deployment freeze for a single release
   containing PRs #100, #101, #103, #105, and (once reviewed) #106, #104. This is the first moment
   the new code path becomes reachable — before this, the schema existing changes nothing live.
7. **Immediately after deploy, verify against real production traffic**, not just the disposable
   instance: send one real chat message through the main Command Center chat, confirm it dispatches
   exactly once (check `relay_attempts = 1` on its row), confirm the legacy console's chat now
   actually persists and dispatches (it didn't before this round — see PR #105).
8. **Rollback, if step 7 fails:** the down-migrations for both migrations have been proven clean
   against a populated disposable instance (data intact, columns removed). A Vercel rollback to
   `f5c88ba4` is a one-click, already-proven-safe action (the prior session verified that exact
   release is a fully built, runnable rollback target). Running the down-migrations and rolling
   the Vercel deployment back together returns the system to today's exact state.

## Stop conditions

- Fingerprint mismatch after any migration step → stop, do not deploy, investigate before
  proceeding.
- Any row count change (`n != 432` plus whatever real new sends occurred since this document was
  written) not explained by genuine new traffic → stop.
- Step 7's live-traffic check dispatching more than once for one send, or the legacy console still
  not persisting → roll back per step 8, do not attempt to patch forward in production.
