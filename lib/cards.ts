import { supabase, unwrap } from '@/lib/supabase';
import * as store from '@/lib/store';
import { uuid } from '@/lib/uuid';
import type { Card } from '@/lib/types';

type CardRow = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  position: number;
  created_at: string;
};

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    position: row.position,
    createdAt: row.created_at,
  };
}

/** Cards of a deck, in their authored order. */
export async function listCards(deckId: string): Promise<Card[]> {
  await store.ensureLoaded();
  if (store.isOnline()) {
    try {
      const rows = (unwrap(
        await supabase
          .from('cards')
          .select('*')
          .eq('deck_id', deckId)
          .order('position')
          .order('created_at')
      ) ?? []) as CardRow[];
      const result = rows.map(toCard);
      store.replaceDeckCards(deckId, result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mCardsByDeck(deckId);
}

export async function getCard(id: string): Promise<Card | null> {
  await store.ensureLoaded();
  const cached = store.mCard(id);
  if (cached) return cached;
  if (store.isOnline()) {
    try {
      const row = unwrap(
        await supabase.from('cards').select('*').eq('id', id).maybeSingle()
      ) as CardRow | null;
      return row ? toCard(row) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function createCard(deckId: string, front: string, back: string): Promise<string> {
  const cached = store.mCardsByDeck(deckId);
  const position = cached.length > 0 ? cached[cached.length - 1].position + 1 : 0;
  const id = uuid();
  const uid = (await store.getUserId()) ?? '';
  const card: Card = {
    id,
    deckId,
    front: front.trim(),
    back: back.trim(),
    position,
    createdAt: new Date().toISOString(),
  };
  // Optimistically put the card in the mirror even before knowing its server
  // position (position is assigned locally; the server accepts whatever value we send).
  void uid; // owner is set by DB default
  await store.insertCard(card);
  return id;
}

export async function updateCard(id: string, front: string, back: string): Promise<void> {
  await store.updateCard(id, { front: front.trim(), back: back.trim() });
}

export async function deleteCard(id: string): Promise<void> {
  await store.deleteCard(id);
}

/**
 * Persists a new ordering for all cards in a deck given an array of card ids
 * in the desired order (position = index in the array).
 */
export async function reorderCards(deckId: string, orderedIds: string[]): Promise<void> {
  await store.reorderCards(orderedIds);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void deckId; // not needed at the store level; kept for call-site clarity
}

/** Swaps a card's position with its neighbour above/below (no-op at the ends). */
export async function moveCard(
  deckId: string,
  cardId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const cards = await listCards(deckId);
  const i = cards.findIndex((c) => c.id === cardId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= cards.length) return;
  const a = cards[i];
  const b = cards[j];
  await store.updateCard(a.id, { position: b.position });
  await store.updateCard(b.id, { position: a.position });
}
