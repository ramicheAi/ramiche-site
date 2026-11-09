-- ============================================================================
-- CC-SECURITY-REMEDIATION-05 "Database containment": blocking precondition.
--
-- Run this immediately before applying PR #70's
-- supabase/migrations/20261108200000_parallax_anon_write_revoke.sql.
--
-- That migration's own preflight LOGS the age of the newest write but does not
-- abort on a recent one, by deliberate choice (its comment: "a legitimate
-- repointing would look identical and blocking on it would make the migration
-- un-appliable"). That is the right call for THAT file, which only needs to
-- know the general staleness of the write path. This check exists to cover the
-- different, narrower case the instruction asked for: catching an operator who
-- runs the revoke migration while something is writing RIGHT NOW. This file
-- HARD-ABORTS in that case; it does not just log.
--
-- Usage:
--   psql -v ON_ERROR_STOP=1 -f supabase/checks/parallax-active-writer-check.sql
-- Exit code is non-zero and nothing downstream runs if this aborts (chain it
-- with `&&` before the revoke migration in whatever runs both).
--
-- 10 minutes was chosen as comfortably longer than any plausible single
-- request/retry cycle for this application, while short enough not to block
-- applying the revoke during a quiet period (nights, weekends, after the
-- engine has already been retired or repointed). To use a different window,
-- edit the `interval '10 minutes'` literal below directly -- this file is not
-- parameterized, matching the rest of this repo's migration/check scripts.
--
-- This performs no writes and is safe to run against the production project;
-- it only reads max(fetched_at)/max(created_at) from the two tables.
-- ============================================================================
do $$
declare newest timestamptz; write_age interval;
begin
  select greatest(
    coalesce((select max(fetched_at) from public.parallax_odds_cache), 'epoch'::timestamptz),
    coalesce((select max(created_at) from public.parallax_bets), 'epoch'::timestamptz)
  ) into newest;
  write_age := now() - newest;

  if write_age < interval '10 minutes' then
    raise exception
      'ACTIVE WRITER DETECTED: the newest write to parallax_bets/parallax_odds_cache was % ago, inside the 10-minute safety window. Do NOT apply the anon-write-revoke migration right now -- it would silently cut off whatever just wrote, with no warning to that writer. Either wait and re-run this check, or confirm out-of-band that this write already came from the new parallax_bet_engine role (supabase/migrations/20261109130000_parallax_least_privilege_writer.sql) rather than the anon key -- in that case the anon path is already retired in practice and it is safe to re-run this check once the window has passed to proceed.',
      write_age;
  end if;

  raise notice 'no write to parallax_bets or parallax_odds_cache in the last 10 minutes (newest was % ago) -- safe to proceed with the anon-write-revoke migration', write_age;
end $$;
