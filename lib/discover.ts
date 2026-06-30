import { supabase, unwrap } from '@/lib/supabase';

/** A public folder as shown in Discover. */
export type PublicFolder = {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  creatorName: string | null;
  deckCount: number;
};

type PublicFolderRow = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  creator_name: string | null;
  deck_count: number;
};

function toPublicFolder(row: PublicFolderRow): PublicFolder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at,
    creatorName: row.creator_name,
    deckCount: row.deck_count,
  };
}

/** Public top-level folders, optionally filtered by name. */
export async function listPublicFolders(search = ''): Promise<PublicFolder[]> {
  const rows =
    (unwrap(await supabase.rpc('list_public_folders', { search: search.trim() })) as
      | PublicFolderRow[]
      | null) ?? [];
  return rows.map(toPublicFolder);
}

/** A public deck as shown in Discover (creator name + card count joined in). */
export type PublicDeck = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  creatorName: string | null;
  cardCount: number;
};

type PublicDeckRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  tags: string[];
  created_at: string;
  creator_name: string | null;
  card_count: number;
};

function toPublicDeck(row: PublicDeckRow): PublicDeck {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    creatorName: row.creator_name,
    cardCount: row.card_count,
  };
}

/** Public decks, optionally filtered by title substring and/or tag. */
export async function listPublicDecks(search = '', filterTag = ''): Promise<PublicDeck[]> {
  const rows =
    (unwrap(
      await supabase.rpc('list_public_decks', { search: search.trim(), filter_tag: filterTag })
    ) as PublicDeckRow[] | null) ?? [];
  return rows.map(toPublicDeck);
}
