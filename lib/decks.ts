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
  tags: string[];
  color: string | null;
  icon: string | null;
  front_label: string;
  back_label: string;
  study_order: string;
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
    tags: row.tags ?? [],
    color: row.color ?? null,
    icon: row.icon ?? null,
    frontLabel: row.front_label ?? 'Front',
    backLabel: row.back_label ?? 'Back',
    studyOrder: row.study_order === 'random' ? 'random' : 'sequential',
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
  description: string,
  tags: string[] = []
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
    tags,
    color: null,
    icon: null,
    frontLabel: 'Front',
    backLabel: 'Back',
    studyOrder: 'sequential',
    isPublic: false,
    createdAt: now,
  };
  await store.insertDeck(deck);
  return id;
}

export type DeckPatch = Partial<{
  title: string;
  description: string;
  tags: string[];
  color: string | null;
  icon: string | null;
  frontLabel: string;
  backLabel: string;
  studyOrder: 'sequential' | 'random';
}>;

export async function updateDeck(id: string, patch: DeckPatch): Promise<void> {
  const storePatch: Partial<Pick<Deck, 'title' | 'description' | 'tags' | 'color' | 'icon' | 'frontLabel' | 'backLabel' | 'studyOrder'>> = {};
  if (patch.title !== undefined) storePatch.title = patch.title.trim();
  if (patch.description !== undefined) {
    const trimmed = patch.description.trim();
    storePatch.description = trimmed.length > 0 ? trimmed : null;
  }
  if (patch.tags !== undefined) storePatch.tags = patch.tags;
  if ('color' in patch) storePatch.color = patch.color;
  if ('icon' in patch) storePatch.icon = patch.icon;
  if (patch.frontLabel !== undefined) storePatch.frontLabel = patch.frontLabel;
  if (patch.backLabel !== undefined) storePatch.backLabel = patch.backLabel;
  if (patch.studyOrder !== undefined) storePatch.studyOrder = patch.studyOrder;
  await store.updateDeck(id, storePatch);
}

/** Move a deck to a different folder (or to the root when `targetFolderId` is null). */
export async function moveDeck(id: string, targetFolderId: string | null): Promise<void> {
  await store.updateDeck(id, { folderId: targetFolderId });
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
