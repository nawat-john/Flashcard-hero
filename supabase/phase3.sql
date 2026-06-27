-- Flashcard Hero — Phase 3 additions (discover + fork-on-copy)
--
-- Safe to run on top of an existing Phase 2 database: it only adds two
-- functions (CREATE OR REPLACE) and drops no data. Run it once in the
-- Supabase SQL editor. These are also included in `schema.sql` for fresh
-- installs.

-- Public decks for the Discover tab, with creator name and card count.
create or replace function public.list_public_decks(search text default '')
returns table (
  id           uuid,
  owner_id     uuid,
  title        text,
  description  text,
  created_at   timestamptz,
  creator_name text,
  card_count   bigint
)
language sql
stable
as $$
  select
    d.id,
    d.owner_id,
    d.title,
    d.description,
    d.created_at,
    p.display_name as creator_name,
    (select count(*) from public.cards c where c.deck_id = d.id) as card_count
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.is_public
    and (search = '' or d.title ilike '%' || search || '%')
  order by d.created_at desc
  limit 100;
$$;

-- Fork-on-copy: duplicate a deck (and its cards) into the caller's library as a
-- private, independent copy. Runs as the calling user (security invoker) so RLS
-- only lets them copy decks they can read; the copy is owned by auth.uid().
create or replace function public.copy_deck(source_deck_id uuid, target_folder_id uuid default null)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_deck_id uuid;
begin
  insert into public.decks (owner_id, folder_id, title, description, is_public)
  select auth.uid(), target_folder_id, d.title, d.description, false
  from public.decks d
  where d.id = source_deck_id
  returning id into new_deck_id;

  if new_deck_id is null then
    raise exception 'deck not found or not accessible';
  end if;

  insert into public.cards (deck_id, front, back, position)
  select new_deck_id, c.front, c.back, c.position
  from public.cards c
  where c.deck_id = source_deck_id;

  return new_deck_id;
end;
$$;
