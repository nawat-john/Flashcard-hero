-- Flashcard Hero — Phase 5 additions (share / copy a whole folder subtree)
--
-- Safe to run on top of an existing database: it adds one column, one index,
-- swaps the folders SELECT policy to allow public reads, and adds three
-- functions. It drops no data. Run it once in the Supabase SQL editor. These
-- changes are also folded into `schema.sql` for fresh installs.

-- 1. Folders can now be published like decks.
alter table public.folders
  add column if not exists is_public boolean not null default false;

create index if not exists folders_public_idx on public.folders (is_public) where is_public;

-- 2. Anyone may READ a folder flagged is_public (mirrors the decks policy).
drop policy if exists folders_select_own on public.folders;
drop policy if exists folders_select_own_or_public on public.folders;
create policy folders_select_own_or_public on public.folders
  for select using (auth.uid() = owner_id or is_public);

-- 3. Publish/unpublish an entire folder subtree (folders + all decks within).
create or replace function public.share_folder(root uuid, make_public boolean)
returns void
language plpgsql
security invoker
as $$
begin
  if not exists (select 1 from public.folders f where f.id = root and f.owner_id = auth.uid()) then
    raise exception 'folder not found or not owned by caller';
  end if;

  with recursive tree as (
    select id from public.folders where id = root
    union all
    select f.id from public.folders f join tree t on f.parent_id = t.id
  )
  update public.folders f
  set is_public = make_public
  where f.id in (select id from tree);

  with recursive tree as (
    select id from public.folders where id = root
    union all
    select f.id from public.folders f join tree t on f.parent_id = t.id
  )
  update public.decks d
  set is_public = make_public
  where d.folder_id in (select id from tree);
end;
$$;

-- 4. Top-level public folders for Discover (creator name + deck count).
create or replace function public.list_public_folders(search text default '')
returns table (
  id           uuid,
  owner_id     uuid,
  name         text,
  created_at   timestamptz,
  creator_name text,
  deck_count   bigint
)
language sql
stable
as $$
  select
    f.id,
    f.owner_id,
    f.name,
    f.created_at,
    p.display_name as creator_name,
    (
      with recursive tree as (
        select f.id
        union all
        select c.id from public.folders c join tree t on c.parent_id = t.id
      )
      select count(*) from public.decks d where d.folder_id in (select id from tree)
    ) as deck_count
  from public.folders f
  left join public.profiles p on p.id = f.owner_id
  where f.is_public
    and not exists (
      select 1 from public.folders parent
      where parent.id = f.parent_id and parent.is_public
    )
    and (search = '' or f.name ilike '%' || search || '%')
  order by f.created_at desc
  limit 100;
$$;

-- 5. Fork-on-copy for a whole folder subtree (folders + decks + cards).
create or replace function public.copy_folder(source_folder_id uuid, target_parent_id uuid default null)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_folder_id uuid;
  child record;
  src_deck record;
  new_deck_id uuid;
begin
  insert into public.folders (owner_id, parent_id, name, is_public)
  select auth.uid(), target_parent_id, f.name, false
  from public.folders f
  where f.id = source_folder_id
  returning id into new_folder_id;

  if new_folder_id is null then
    raise exception 'folder not found or not accessible';
  end if;

  for src_deck in select id from public.decks where folder_id = source_folder_id loop
    insert into public.decks (owner_id, folder_id, title, description, is_public)
    select auth.uid(), new_folder_id, d.title, d.description, false
    from public.decks d
    where d.id = src_deck.id
    returning id into new_deck_id;

    insert into public.cards (deck_id, front, back, position)
    select new_deck_id, c.front, c.back, c.position
    from public.cards c
    where c.deck_id = src_deck.id;
  end loop;

  for child in select id from public.folders where parent_id = source_folder_id loop
    perform public.copy_folder(child.id, new_folder_id);
  end loop;

  return new_folder_id;
end;
$$;
