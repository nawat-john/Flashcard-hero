import { supabase, unwrap } from '@/lib/supabase';
import type { Deck, DeckWithCount } from '@/lib/types';

type DeckRow = {
  id: string;
  owner_id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

type DeckRowWithCount = DeckRow & { cards: { count: number }[] };

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    ownerId: row.owner_id,
    folderId: row.folder_id,
    title: row.title,
    description: row.description,
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

function toDeckWithCount(row: DeckRowWithCount): DeckWithCount {
  return { ...toDeck(row), cardCount: row.cards?.[0]?.count ?? 0 };
}

const SELECT_WITH_COUNT = '*, cards(count)';

/** Decks directly inside `folderId` (use `null` for the root level). */
export async function listDecks(folderId: string | null): Promise<DeckWithCount[]> {
  let query = supabase.from('decks').select(SELECT_WITH_COUNT).order('title');
  query = folderId === null ? query.is('folder_id', null) : query.eq('folder_id', folderId);
  const rows = unwrap(await query) as DeckRowWithCount[];
  return rows.map(toDeckWithCount);
}

/** Every deck the user owns, newest first — backs the Study tab. */
export async function listAllDecks(): Promise<DeckWithCount[]> {
  const rows = unwrap(
    await supabase.from('decks').select(SELECT_WITH_COUNT).order('created_at', { ascending: false })
  ) as DeckRowWithCount[];
  return rows.map(toDeckWithCount);
}

export async function getDeck(id: string): Promise<Deck | null> {
  const row = unwrap(await supabase.from('decks').select('*').eq('id', id).maybeSingle());
  return row ? toDeck(row) : null;
}

export async function createDeck(
  folderId: string | null,
  title: string,
  description: string
): Promise<string> {
  const trimmed = description.trim();
  const row = unwrap(
    await supabase
      .from('decks')
      .insert({
        folder_id: folderId,
        title: title.trim(),
        description: trimmed.length > 0 ? trimmed : null,
      })
      .select('*')
      .single()
  );
  return row.id;
}

export async function updateDeck(id: string, title: string, description: string): Promise<void> {
  const trimmed = description.trim();
  unwrap(
    await supabase
      .from('decks')
      .update({ title: title.trim(), description: trimmed.length > 0 ? trimmed : null })
      .eq('id', id)
  );
}

/** Deletes a deck. ON DELETE CASCADE removes its cards. */
export async function deleteDeck(id: string): Promise<void> {
  unwrap(await supabase.from('decks').delete().eq('id', id));
}
