import { supabase, unwrap } from '@/lib/supabase';
import * as store from '@/lib/store';
import { uuid } from '@/lib/uuid';
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
    isPublic: !!row.is_public,
    createdAt: row.created_at,
  };
}

function toDeckWithCount(row: DeckRowWithCount): DeckWithCount {
  return { ...toDeck(row), cardCount: row.cards?.[0]?.count ?? 0 };
}

function mirrorDeckWithCount(deck: Deck): DeckWithCount {
  return { ...deck, cardCount: store.mCountCards(deck.id) };
}

const SELECT_WITH_COUNT = '*, cards(count)';

/** Decks directly inside `folderId` (use `null` for the root level). */
export async function listDecks(folderId: string | null): Promise<DeckWithCount[]> {
  await store.ensureLoaded();
  if (store.isOnline()) {
    try {
      // Scope to the caller so other people's public decks don't show in the
      // user's own Library (RLS alone would also return is_public rows).
      const uid = await store.getUserId();
      let query = supabase.from('decks').select(SELECT_WITH_COUNT).order('title');
      if (uid) query = query.eq('owner_id', uid);
      query = folderId === null ? query.is('folder_id', null) : query.eq('folder_id', folderId);
      const rows = (unwrap(await query) ?? []) as DeckRowWithCount[];
      const result = rows.map(toDeckWithCount);
      store.cacheDecks(result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mDecksByFolder(folderId).map(mirrorDeckWithCount);
}

/** Every deck the user owns, newest first — backs the Study tab. */
export async function listAllDecks(): Promise<DeckWithCount[]> {
  await store.ensureLoaded();
  if (store.isOnline()) {
    try {
      const uid = await store.getUserId();
      let query = supabase
        .from('decks')
        .select(SELECT_WITH_COUNT)
        .order('created_at', { ascending: false });
      if (uid) query = query.eq('owner_id', uid);
      const rows = (unwrap(await query) ?? []) as DeckRowWithCount[];
      const result = rows.map(toDeckWithCount);
      store.cacheDecks(result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mAllDecks().map(mirrorDeckWithCount);
}

export async function getDeck(id: string): Promise<Deck | null> {
  await store.ensureLoaded();
  if (store.isOnline() || !store.hasDeck(id)) {
    // Always try server for getDeck: preview screens load other people's decks
    // that the mirror doesn't hold.
    try {
      const row = unwrap(
        await supabase.from('decks').select('*').eq('id', id).maybeSingle()
      ) as DeckRow | null;
      const result = row ? toDeck(row) : null;
      // Only cache owned decks; a previewed public deck belongs to someone else.
      if (result && result.ownerId === (await store.getUserId())) store.cacheDeck(result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mDeck(id) ?? null;
}

export async function createDeck(
  folderId: string | null,
  title: string,
  description: string
): Promise<string> {
  const id = uuid();
  const uid = (await store.getUserId()) ?? '';
  const now = new Date().toISOString();
  const trimmed = description.trim();
  const deck: Deck = {
    id,
    ownerId: uid,
    folderId,
    title: title.trim(),
    description: trimmed.length > 0 ? trimmed : null,
    isPublic: false,
    createdAt: now,
  };
  await store.insertDeck(deck);
  return id;
}

export async function updateDeck(id: string, title: string, description: string): Promise<void> {
  const trimmed = description.trim();
  await store.updateDeck(id, {
    title: title.trim(),
    description: trimmed.length > 0 ? trimmed : null,
  });
}

/** Deletes a deck. ON DELETE CASCADE removes its cards. */
export async function deleteDeck(id: string): Promise<void> {
  await store.deleteDeck(id);
}

/** Publish/unpublish a deck (Phase 3 sharing). */
export async function setDeckPublic(id: string, isPublic: boolean): Promise<void> {
  await store.updateDeck(id, { isPublic });
}

/**
 * Fork-on-copy: server-side duplicates a public (or owned) deck and its cards
 * into the caller's library as a private, independent copy. Returns the new
 * deck id.
 */
export async function copyDeck(
  sourceDeckId: string,
  targetFolderId: string | null = null
): Promise<string> {
  const newId = unwrap(
    await supabase.rpc('copy_deck', {
      source_deck_id: sourceDeckId,
      target_folder_id: targetFolderId,
    })
  );
  return newId as string;
}
