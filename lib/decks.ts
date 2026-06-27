import { getDatabase } from '@/db';
import type { Deck, DeckWithCount } from '@/lib/types';

type DeckRow = {
  id: number;
  folder_id: number | null;
  title: string;
  description: string | null;
  created_at: number;
  card_count?: number;
};

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
  };
}

function toDeckWithCount(row: DeckRow): DeckWithCount {
  return { ...toDeck(row), cardCount: row.card_count ?? 0 };
}

const SELECT_WITH_COUNT = `
  SELECT d.*, (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) AS card_count
  FROM decks d
`;

/** Decks directly inside `folderId` (use `null` for the root level). */
export async function listDecks(folderId: number | null): Promise<DeckWithCount[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DeckRow>(
    folderId === null
      ? `${SELECT_WITH_COUNT} WHERE d.folder_id IS NULL ORDER BY d.title COLLATE NOCASE`
      : `${SELECT_WITH_COUNT} WHERE d.folder_id = ? ORDER BY d.title COLLATE NOCASE`,
    folderId === null ? [] : [folderId]
  );
  return rows.map(toDeckWithCount);
}

/** Every deck in the library, newest first — backs the Study tab. */
export async function listAllDecks(): Promise<DeckWithCount[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DeckRow>(`${SELECT_WITH_COUNT} ORDER BY d.created_at DESC`);
  return rows.map(toDeckWithCount);
}

export async function getDeck(id: number): Promise<Deck | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DeckRow>('SELECT * FROM decks WHERE id = ?', [id]);
  return row ? toDeck(row) : null;
}

export async function createDeck(
  folderId: number | null,
  title: string,
  description: string
): Promise<number> {
  const db = await getDatabase();
  const trimmedDescription = description.trim();
  const result = await db.runAsync(
    'INSERT INTO decks (folder_id, title, description, created_at) VALUES (?, ?, ?, ?)',
    [folderId, title.trim(), trimmedDescription.length > 0 ? trimmedDescription : null, Date.now()]
  );
  return result.lastInsertRowId;
}

export async function updateDeck(id: number, title: string, description: string): Promise<void> {
  const db = await getDatabase();
  const trimmedDescription = description.trim();
  await db.runAsync('UPDATE decks SET title = ?, description = ? WHERE id = ?', [
    title.trim(),
    trimmedDescription.length > 0 ? trimmedDescription : null,
    id,
  ]);
}

/** Deletes a deck. ON DELETE CASCADE removes its cards. */
export async function deleteDeck(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM decks WHERE id = ?', [id]);
}
