import { supabase, unwrap } from '@/lib/supabase';
import type { Folder } from '@/lib/types';

type FolderRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
};

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

/** Folders directly inside `parentId` (use `null` for the root level). */
export async function listFolders(parentId: string | null): Promise<Folder[]> {
  let query = supabase.from('folders').select('*').order('name');
  query = parentId === null ? query.is('parent_id', null) : query.eq('parent_id', parentId);
  const rows = unwrap(await query) ?? [];
  return rows.map(toFolder);
}

export async function getFolder(id: string): Promise<Folder | null> {
  const row = unwrap(await supabase.from('folders').select('*').eq('id', id).maybeSingle());
  return row ? toFolder(row) : null;
}

/**
 * The chain of folders from the root down to `id` (inclusive), used for
 * breadcrumbs. Walks parent links client-side. Returns `[]` for the root.
 */
export async function getFolderPath(id: string | null): Promise<Folder[]> {
  const path: Folder[] = [];
  let currentId = id;
  while (currentId) {
    const folder = await getFolder(currentId);
    if (!folder) break;
    path.unshift(folder);
    currentId = folder.parentId;
  }
  return path;
}

export async function createFolder(parentId: string | null, name: string): Promise<string> {
  // owner_id defaults to auth.uid() in the database.
  const row = unwrap(
    await supabase
      .from('folders')
      .insert({ parent_id: parentId, name: name.trim() })
      .select('*')
      .single()
  );
  return row.id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  unwrap(await supabase.from('folders').update({ name: name.trim() }).eq('id', id));
}

/** Deletes a folder. ON DELETE CASCADE removes nested folders, decks and cards. */
export async function deleteFolder(id: string): Promise<void> {
  unwrap(await supabase.from('folders').delete().eq('id', id));
}
