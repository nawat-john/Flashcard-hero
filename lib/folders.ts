import { supabase, unwrap } from '@/lib/supabase';
import * as store from '@/lib/store';
import { uuid } from '@/lib/uuid';
import type { Folder } from '@/lib/types';

type FolderRow = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  is_public: boolean;
  color: string | null;
  icon: string | null;
  created_at: string;
};

function toFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    name: row.name,
    isPublic: !!row.is_public,
    color: row.color ?? null,
    icon: row.icon ?? null,
    createdAt: row.created_at,
  };
}

/** All folders owned by the signed-in user, sorted by name (for the folder picker). */
export async function listAllFolders(): Promise<Folder[]> {
  await store.ensureLoaded();
  if (store.isOnline()) {
    try {
      const uid = await store.getUserId();
      let query = supabase.from('folders').select('*').order('name');
      if (uid) query = query.eq('owner_id', uid);
      const rows = (unwrap(await query) ?? []) as FolderRow[];
      const result = rows.map(toFolder);
      store.cacheFolders(result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mAllFolders();
}

/** Folders directly inside `parentId` (use `null` for the root level). */
export async function listFolders(parentId: string | null): Promise<Folder[]> {
  await store.ensureLoaded();
  if (store.isOnline()) {
    try {
      // Scope to the caller: RLS would otherwise also return other people's
      // public folders, which must not appear in the user's own Library.
      const uid = await store.getUserId();
      let query = supabase.from('folders').select('*').order('name');
      if (uid) query = query.eq('owner_id', uid);
      query = parentId === null ? query.is('parent_id', null) : query.eq('parent_id', parentId);
      const rows = (unwrap(await query) ?? []) as FolderRow[];
      const result = rows.map(toFolder);
      store.cacheFolders(result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mFoldersByParent(parentId);
}

export async function getFolder(id: string): Promise<Folder | null> {
  await store.ensureLoaded();
  if (store.isOnline()) {
    try {
      const row = unwrap(
        await supabase.from('folders').select('*').eq('id', id).maybeSingle()
      ) as FolderRow | null;
      const result = row ? toFolder(row) : null;
      // Only cache folders the caller owns; a previewed public folder belongs to
      // someone else and must not pollute the owned-data mirror.
      if (result && result.ownerId === (await store.getUserId())) store.cacheFolder(result);
      return result;
    } catch {
      // fall through to mirror
    }
  }
  return store.mFolder(id) ?? null;
}

/**
 * The chain of folders from the root down to `id` (inclusive), used for
 * breadcrumbs. Walks parent links. Returns `[]` for the root.
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
  const id = uuid();
  const uid = (await store.getUserId()) ?? '';
  const now = new Date().toISOString();
  const folder: Folder = {
    id,
    ownerId: uid,
    parentId,
    name: name.trim(),
    isPublic: false,
    color: null,
    icon: null,
    createdAt: now,
  };
  await store.insertFolder(folder);
  return id;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await store.updateFolder(id, { name: name.trim() });
}

export async function updateFolder(
  id: string,
  patch: { name?: string; color?: string | null; icon?: string | null }
): Promise<void> {
  const storePatch: Partial<Pick<Folder, 'name' | 'color' | 'icon'>> = {};
  if (patch.name !== undefined) storePatch.name = patch.name.trim();
  if ('color' in patch) storePatch.color = patch.color;
  if ('icon' in patch) storePatch.icon = patch.icon;
  await store.updateFolder(id, storePatch);
}

/** Deletes a folder. ON DELETE CASCADE removes nested folders, decks and cards. */
export async function deleteFolder(id: string): Promise<void> {
  await store.deleteFolder(id);
}

/** Publish or unpublish an entire folder subtree (folder + all descendant decks). */
export async function shareFolder(id: string, isPublic: boolean): Promise<void> {
  // This calls the server RPC regardless of online status — sharing is an
  // inherently online action (affects what others can discover). Mirror is
  // updated optimistically so the UI reflects the change immediately.
  const cur = store.mFolder(id);
  if (cur) await store.updateFolder(id, { isPublic });
  unwrap(await supabase.rpc('share_folder', { root: id, make_public: isPublic }));
}

/**
 * Fork-on-copy: server-side duplicates a public (or owned) folder subtree into
 * the caller's library as private, independent copies. Returns the new folder id.
 */
export async function copyFolder(
  sourceFolderId: string,
  targetParentId: string | null = null
): Promise<string> {
  const newId = unwrap(
    await supabase.rpc('copy_folder', {
      source_folder_id: sourceFolderId,
      target_parent_id: targetParentId,
    })
  );
  return newId as string;
}
