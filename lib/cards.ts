import { getDatabase } from '@/db';
import type { Card } from '@/lib/types';

type CardRow = {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  position: number;
  created_at: number;
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
export async function listCards(deckId: number): Promise<Card[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CardRow>(
    'SELECT * FROM cards WHERE deck_id = ? ORDER BY position, id',
    [deckId]
  );
  return rows.map(toCard);
}

export async function getCard(id: number): Promise<Card | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CardRow>('SELECT * FROM cards WHERE id = ?', [id]);
  return row ? toCard(row) : null;
}

export async function createCard(deckId: number, front: string, back: string): Promise<number> {
  const db = await getDatabase();
  const next = await db.getFirstAsync<{ next_position: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM cards WHERE deck_id = ?',
    [deckId]
  );
  const result = await db.runAsync(
    'INSERT INTO cards (deck_id, front, back, position, created_at) VALUES (?, ?, ?, ?, ?)',
    [deckId, front.trim(), back.trim(), next?.next_position ?? 0, Date.now()]
  );
  return result.lastInsertRowId;
}

export async function updateCard(id: number, front: string, back: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE cards SET front = ?, back = ? WHERE id = ?', [
    front.trim(),
    back.trim(),
    id,
  ]);
}

export async function deleteCard(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM cards WHERE id = ?', [id]);
}
