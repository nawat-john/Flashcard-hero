-- Flashcard Hero — Supabase schema (Phase 2)
--
-- HOW TO USE
--   1. Create a project at https://supabase.com (free tier is fine).
--   2. Open the project → SQL Editor → New query.
--   3. Paste this whole file and run it once.
--   4. Project Settings → Data API: copy the Project URL and the `anon` public
--      key into the app's `.env` (see `.env.example`).
--   5. (For easy testing) Authentication → Providers → Email: turn OFF
--      "Confirm email" so sign-up logs you in immediately.
--
-- This script is idempotent enough to re-run during development, but it DROPS
-- the app tables first — do not run it against data you want to keep.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

drop table if exists public.card_reviews cascade;
drop table if exists public.cards cascade;
drop table if exists public.decks cascade;
drop table if exists public.folders cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users on delete cascade,
  parent_id  uuid references public.folders(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.decks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  folder_id   uuid references public.folders(id) on delete cascade,
  title       text not null,
  description text,
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.cards (
  id         uuid primary key default gen_random_uuid(),
  deck_id    uuid not null references public.decks(id) on delete cascade,
  front      text not null,
  back       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- Per-user study progress, kept separate from the card itself so a copied deck
-- starts with fresh progress (Phase 3 / Phase 4).
create table public.card_reviews (
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  card_id   uuid not null references public.cards(id) on delete cascade,
  due_date  timestamptz,
  interval  integer not null default 0,
  ease      real not null default 2.5,
  primary key (user_id, card_id)
);

create index folders_owner_parent_idx on public.folders (owner_id, parent_id);
create index decks_owner_folder_idx on public.decks (owner_id, folder_id);
create index decks_public_idx on public.decks (is_public) where is_public;
create index cards_deck_idx on public.cards (deck_id);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Recursive subtree helper (used by Phase 3 folder copy/delete; runs as the
-- calling user so RLS still applies)
-- ---------------------------------------------------------------------------

create or replace function public.folder_descendants(root uuid)
returns setof public.folders
language sql
stable
as $$
  with recursive tree as (
    select * from public.folders where id = root
    union all
    select f.* from public.folders f join tree t on f.parent_id = t.id
  )
  select * from tree;
$$;

-- ---------------------------------------------------------------------------
-- Phase 3: discover + fork-on-copy
--
-- Both functions run as the CALLING user (security invoker), so RLS still
-- decides what's visible/writable — the caller can only copy decks they're
-- allowed to read (their own or is_public), and the copy is created under
-- their own auth.uid().
-- ---------------------------------------------------------------------------

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
-- private, independent copy. Study progress does NOT carry over because the
-- copied cards get brand-new ids (no card_reviews rows).
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.folders      enable row level security;
alter table public.decks        enable row level security;
alter table public.cards        enable row level security;
alter table public.card_reviews enable row level security;

-- profiles: display names are readable by anyone (so public-deck creators can be
-- shown in Phase 3); a user may only edit their own profile.
create policy profiles_select_all on public.profiles
  for select using (true);
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- folders: fully private to the owner.
create policy folders_select_own on public.folders
  for select using (auth.uid() = owner_id);
create policy folders_insert_own on public.folders
  for insert with check (auth.uid() = owner_id);
create policy folders_update_own on public.folders
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy folders_delete_own on public.folders
  for delete using (auth.uid() = owner_id);

-- decks: owner has full access; anyone may READ a deck flagged is_public.
create policy decks_select_own_or_public on public.decks
  for select using (auth.uid() = owner_id or is_public);
create policy decks_insert_own on public.decks
  for insert with check (auth.uid() = owner_id);
create policy decks_update_own on public.decks
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy decks_delete_own on public.decks
  for delete using (auth.uid() = owner_id);

-- cards: access mirrors the parent deck (readable if the deck is owned or public,
-- writable only if the deck is owned).
create policy cards_select_via_deck on public.cards
  for select using (
    exists (
      select 1 from public.decks d
      where d.id = cards.deck_id and (d.owner_id = auth.uid() or d.is_public)
    )
  );
create policy cards_insert_via_deck on public.cards
  for insert with check (
    exists (select 1 from public.decks d where d.id = deck_id and d.owner_id = auth.uid())
  );
create policy cards_update_via_deck on public.cards
  for update using (
    exists (select 1 from public.decks d where d.id = cards.deck_id and d.owner_id = auth.uid())
  );
create policy cards_delete_via_deck on public.cards
  for delete using (
    exists (select 1 from public.decks d where d.id = cards.deck_id and d.owner_id = auth.uid())
  );

-- card_reviews: each user sees and edits only their own progress.
create policy card_reviews_all_own on public.card_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
