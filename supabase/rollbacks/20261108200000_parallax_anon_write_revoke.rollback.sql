-- Exact rollback for supabase/migrations/20261108200000_parallax_anon_write_revoke.sql.
-- Recreates the four dropped policies and restores the table grants, returning the database
-- to the pre-change state captured on 2026-11-08. Apply through the same reviewed manual path.
-- This does not restore any row data (the forward migration never deleted rows, only policies
-- and grants).
--
-- WARNING, read before running: this restores anonymous INSERT/UPDATE on both tables AND
-- anonymous TRUNCATE. That is the vulnerable state, restored on purpose, because a rollback
-- that silently keeps half the change is worse than one that says what it does. Run it only
-- to undo a broken forward apply, and re-open the containment afterwards.
begin;

create policy "parallax anon write bets" on public.parallax_bets
  for insert to anon with check (true);
create policy "parallax anon update bets" on public.parallax_bets
  for update to anon using (true);
create policy "parallax anon write cache" on public.parallax_odds_cache
  for insert to anon with check (true);
create policy "parallax anon update cache" on public.parallax_odds_cache
  for update to anon using (true);

grant truncate, references, trigger on public.parallax_bets to anon, authenticated;
grant truncate, references, trigger on public.parallax_odds_cache to anon, authenticated;

-- Postflight: confirm the vulnerable state is fully restored before committing, so a partial
-- rollback cannot masquerade as a completed one.
do $$
declare policies int;
begin
  select count(*) into policies from pg_policies
    where schemaname = 'public'
      and tablename in ('parallax_bets', 'parallax_odds_cache')
      and policyname in ('parallax anon write bets', 'parallax anon update bets',
                         'parallax anon write cache', 'parallax anon update cache')
      and roles = '{anon}';
  if policies <> 4 then
    raise exception 'rollback failed: expected 4 anon write/update policies restored, found %', policies;
  end if;
  if not has_table_privilege('anon', 'public.parallax_bets', 'TRUNCATE') then
    raise exception 'rollback failed: anon TRUNCATE grant was not restored';
  end if;
end $$;

commit;
