import { supabase, unwrap } from '@/lib/supabase';

/** A public deck as shown in Discover (creator name + card count joined in). */
export type PublicDeck = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  createdAt: string;
  creatorName: string | null;
  cardCount: number;
};

type PublicDeckRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
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
    createdAt: row.created_at,
    creatorName: row.creator_name,
    cardCount: row.card_count,
  };
}

/** Public decks, optionally filtered by a title substring. */
export async function listPublicDecks(search = ''): Promise<PublicDeck[]> {
  const rows =
    (unwrap(await supabase.rpc('list_public_decks', { search: search.trim() })) as
      | PublicDeckRow[]
      | null) ?? [];
  return rows.map(toPublicDeck);
}
