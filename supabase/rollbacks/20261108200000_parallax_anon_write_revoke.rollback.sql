-- Exact rollback for supabase/migrations/20261108200000_parallax_anon_write_revoke.sql.
-- Recreates the four dropped policies with the exact qual/with_check captured on 2026-11-08,
-- restoring the pre-change state byte for byte. Apply through the same reviewed manual path.
-- This does not restore any row data (the forward migration never deleted rows, only policies).
begin;

create policy "parallax anon write bets" on public.parallax_bets
  for insert to anon with check (true);
create policy "parallax anon update bets" on public.parallax_bets
  for update to anon using (true);
create policy "parallax anon write cache" on public.parallax_odds_cache
  for insert to anon with check (true);
create policy "parallax anon update cache" on public.parallax_odds_cache
  for update to anon using (true);

commit;
