import { supabase, unwrap } from '@/lib/supabase';
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
  const rows =
    unwrap(
      await supabase
        .from('cards')
        .select('*')
        .eq('deck_id', deckId)
        .order('position')
        .order('created_at')
    ) ?? [];
  return rows.map(toCard);
}

export async function getCard(id: string): Promise<Card | null> {
  const row = unwrap(await supabase.from('cards').select('*').eq('id', id).maybeSingle());
  return row ? toCard(row) : null;
}

export async function createCard(deckId: string, front: string, back: string): Promise<string> {
  // Append after the current last card.
  const last = unwrap(
    await supabase
      .from('cards')
      .select('position')
      .eq('deck_id', deckId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  const position = (last?.position ?? -1) + 1;
  const row = unwrap(
    await supabase
      .from('cards')
      .insert({ deck_id: deckId, front: front.trim(), back: back.trim(), position })
      .select('*')
      .single()
  );
  return row.id;
}

export async function updateCard(id: string, front: string, back: string): Promise<void> {
  unwrap(
    await supabase.from('cards').update({ front: front.trim(), back: back.trim() }).eq('id', id)
  );
}

export async function deleteCard(id: string): Promise<void> {
  unwrap(await supabase.from('cards').delete().eq('id', id));
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
  await Promise.all([
    supabase.from('cards').update({ position: b.position }).eq('id', a.id),
    supabase.from('cards').update({ position: a.position }).eq('id', b.id),
  ]);
}
