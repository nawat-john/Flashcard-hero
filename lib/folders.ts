import { getDatabase } from '@/db';
import type { Folder } from '@/lib/types';

type FolderRow = {
  id: number;
  parent_id: number | null;
  name: string;
  created_at: number;
};

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

/** Folders directly inside `parentId` (use `null` for the root level). */
export async function listFolders(parentId: number | null): Promise<Folder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FolderRow>(
    parentId === null
      ? 'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name COLLATE NOCASE'
      : 'SELECT * FROM folders WHERE parent_id = ? ORDER BY name COLLATE NOCASE',
    parentId === null ? [] : [parentId]
  );
  return rows.map(toFolder);
}

export async function getFolder(id: number): Promise<Folder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FolderRow>('SELECT * FROM folders WHERE id = ?', [id]);
  return row ? toFolder(row) : null;
}

/**
 * The chain of folders from the root down to `id` (inclusive), used for
 * breadcrumbs. Returns `[]` for the root level (`id === null`).
 */
export async function getFolderPath(id: number | null): Promise<Folder[]> {
  if (id === null) return [];
  const db = await getDatabase();
  const rows = await db.getAllAsync<FolderRow>(
    `WITH RECURSIVE ancestors(id, parent_id, name, created_at, depth) AS (
       SELECT id, parent_id, name, created_at, 0 FROM folders WHERE id = ?
       UNION ALL
       SELECT f.id, f.parent_id, f.name, f.created_at, a.depth + 1
       FROM folders f JOIN ancestors a ON f.id = a.parent_id
     )
     SELECT id, parent_id, name, created_at FROM ancestors ORDER BY depth DESC`,
    [id]
  );
  return rows.map(toFolder);
}

export async function createFolder(parentId: number | null, name: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO folders (parent_id, name, created_at) VALUES (?, ?, ?)',
    [parentId, name.trim(), Date.now()]
  );
  return result.lastInsertRowId;
}

export async function renameFolder(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE folders SET name = ? WHERE id = ?', [name.trim(), id]);
}

/** Deletes a folder. ON DELETE CASCADE removes nested folders, decks and cards. */
export async function deleteFolder(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM folders WHERE id = ?', [id]);
}
