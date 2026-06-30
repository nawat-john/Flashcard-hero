-- Flashcard Hero — Phase 6 additions
--
-- Adds:
--   1. tags text[] column on decks
--   2. Updated list_public_decks that returns tags and accepts a filter_tag param
--
-- Safe to run on an existing database: adds a column with a default, replaces
-- the function in-place, touches no data. Run once in the Supabase SQL editor.

alter table public.decks
  add column if not exists tags text[] not null default '{}';

create index if not exists decks_tags_idx on public.decks using gin (tags);

-- Replace list_public_decks to expose tags and support tag filtering.
create or replace function public.list_public_decks(
  search     text default '',
  filter_tag text default ''
)
returns table (
  id           uuid,
  owner_id     uuid,
  title        text,
  description  text,
  tags         text[],
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
    d.tags,
    d.created_at,
    p.display_name as creator_name,
    (select count(*) from public.cards c where c.deck_id = d.id) as card_count
  from public.decks d
  left join public.profiles p on p.id = d.owner_id
  where d.is_public
    and (search = '' or d.title ilike '%' || search || '%')
    and (filter_tag = '' or filter_tag = any(d.tags))
  order by d.created_at desc
  limit 100;
$$;
