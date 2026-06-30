/**
 * Offline store: an AsyncStorage-backed mirror of the signed-in user's OWN
 * folders / decks / cards / reviews, plus an outbox write-queue.
 *
 * Strategy (cache-aside):
 *   - Reads: when online, the data layer fetches from Supabase, refreshes the
 *     mirror, and returns the fresh rows; when offline (or on a network error)
 *     it serves the mirror. So online behaviour is unchanged and the mirror is
 *     kept warm as an offline cache.
 *   - Writes: mutate the mirror immediately, append an op to the outbox, then
 *     flush the outbox if online. Offline writes stay queued and replay on
 *     reconnect. Rows use client-generated UUIDs so an offline create→edit
 *     chain needs no id remapping, and `owner_id` / `user_id` are never sent —
 *     the DB column defaults to `auth.uid()` when the op finally replays.
 *
 * This module has no React imports; it is the lowest layer the data layer sits
 * on. Mirror reads/writes only ever hold the user's own data — discover /
 * preview / copy of other people's content stays online-only in the data layer.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { supabase, unwrap } from '@/lib/supabase';
import type { Card, Deck, Folder, Review } from '@/lib/types';

// Bumped to v2 to discard any write-queue persisted before the folders.is_public
// migration (a queued folder insert referencing is_public would otherwise wedge
// the outbox on databases that haven't run phase5.sql yet).
const STORAGE_KEY = 'flashcard.mirror.v2';

type Mirror = {
  folders: Record<string, Folder>;
  decks: Record<string, Deck>;
  cards: Record<string, Card>;
  reviews: Record<string, Review>; // keyed by cardId
};

type Op =
  | { kind: 'insert'; table: string; values: Record<string, unknown> }
  | {
      kind: 'update';
      table: string;
      match: Record<string, unknown>;
      values: Record<string, unknown>;
    }
  | { kind: 'delete'; table: string; match: Record<string, unknown> }
  | { kind: 'upsert'; table: string; values: Record<string, unknown>; onConflict: string };

function emptyMirror(): Mirror {
  return { folders: {}, decks: {}, cards: {}, reviews: {} };
}

let mirror = emptyMirror();
let outbox: Op[] = [];
let userId: string | null = null;
let online = true;
let loaded = false;
let loadPromise: Promise<void> | null = null;
let flushing: Promise<void> | null = null;

const onlineListeners = new Set<(value: boolean) => void>();

// ---------------------------------------------------------------------------
// Row mappers (kept here so the store has no dependency on the data layer)
// ---------------------------------------------------------------------------

function toFolder(row: any): Folder {
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

function toDeck(row: any): Deck {
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

function toCard(row: any): Card {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toReview(row: any): Review {
  return {
    cardId: row.card_id,
    dueDate: row.due_date,
    interval: row.interval,
    ease: row.ease,
  };
}

// ---------------------------------------------------------------------------
// Persistence / loading
// ---------------------------------------------------------------------------

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ mirror, outbox }));
  } catch {
    // Best-effort: a storage failure must not break a data-layer call.
  }
}

/** Loads the persisted mirror + outbox into memory exactly once. */
export function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { mirror?: Mirror; outbox?: Op[] };
          mirror = { ...emptyMirror(), ...(parsed.mirror ?? {}) };
          outbox = parsed.outbox ?? [];
        }
      } catch {
        mirror = emptyMirror();
        outbox = [];
      } finally {
        loaded = true;
      }
    })();
  }
  return loadPromise;
}

// ---------------------------------------------------------------------------
// Session / connectivity
// ---------------------------------------------------------------------------

export function setUser(id: string | null): void {
  userId = id;
}

export async function getUserId(): Promise<string | null> {
  if (userId) return userId;
  const { data } = await supabase.auth.getSession();
  userId = data.session?.user.id ?? null;
  return userId;
}

export function isOnline(): boolean {
  return online;
}

export function subscribeOnline(cb: (value: boolean) => void): () => void {
  onlineListeners.add(cb);
  return () => onlineListeners.delete(cb);
}

function setOnline(value: boolean): void {
  if (value === online) return;
  online = value;
  onlineListeners.forEach((cb) => cb(value));
  if (value) void hydrate(); // came back online → push queued writes, pull fresh
}

/** Subscribes to connectivity changes. Call once; returns an unsubscribe fn. */
export function initSync(): () => void {
  NetInfo.fetch().then((state) => setOnline(state.isConnected !== false));
  return NetInfo.addEventListener((state) => setOnline(state.isConnected !== false));
}

// ---------------------------------------------------------------------------
// Outbox flush
// ---------------------------------------------------------------------------

async function runOp(op: Op): Promise<void> {
  if (op.kind === 'insert') {
    unwrap(await supabase.from(op.table).insert(op.values));
  } else if (op.kind === 'upsert') {
    unwrap(await supabase.from(op.table).upsert(op.values, { onConflict: op.onConflict }));
  } else if (op.kind === 'update') {
    let query = supabase.from(op.table).update(op.values);
    for (const [k, v] of Object.entries(op.match)) query = query.eq(k, v);
    unwrap(await query);
  } else {
    let query = supabase.from(op.table).delete();
    for (const [k, v] of Object.entries(op.match)) query = query.eq(k, v);
    unwrap(await query);
  }
}

/**
 * Replays queued writes in order. Stops (and retries later) on the first error,
 * which is how a genuinely-offline device keeps its writes queued. The loop is
 * NOT gated on the NetInfo `online` flag on purpose: that flag is only a hint
 * (NetInfo is unreliable in Expo Go and can report offline on a working
 * connection), so we let the actual request outcome decide. The `flushing`
 * singleton coalesces concurrent calls.
 */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      while (outbox.length > 0) {
        try {
          await runOp(outbox[0]);
        } catch (e) {
          // A network failure means we're really offline → keep the op queued
          // and retry on the next flush. Surface the cause so a real server
          // rejection (RLS / constraint) isn't silently swallowed.
          console.warn('[store] outbox flush failed', outbox[0], e);
          break;
        }
        outbox.shift();
        await persist();
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/**
 * Applies a mirror mutation's op(s): queue, persist, then push to the server.
 * We always attempt the flush; when the NetInfo hint says we're online we await
 * it so callers (and the e2e tests) see the write land, otherwise we fire it in
 * the background to keep offline writes instant. Either way a failed attempt
 * just leaves the op queued for the next reconnect.
 */
async function commit(op: Op | Op[]): Promise<void> {
  if (Array.isArray(op)) outbox.push(...op);
  else outbox.push(op);
  await persist();
  if (online) await flush();
  else void flush();
}

// ---------------------------------------------------------------------------
// Cache writes (used by the data layer to refresh the mirror after a fetch)
// ---------------------------------------------------------------------------

export function cacheFolders(list: Folder[]): void {
  for (const f of list) mirror.folders[f.id] = f;
  void persist();
}

export function cacheDecks(list: Deck[]): void {
  for (const d of list) mirror.decks[d.id] = d;
  void persist();
}

export function cacheDeck(deck: Deck): void {
  mirror.decks[deck.id] = deck;
  void persist();
}

export function cacheFolder(folder: Folder): void {
  mirror.folders[folder.id] = folder;
  void persist();
}

/** Replaces the cached cards of one deck (so deletes elsewhere don't linger). */
export function replaceDeckCards(deckId: string, list: Card[]): void {
  for (const c of Object.values(mirror.cards)) if (c.deckId === deckId) delete mirror.cards[c.id];
  for (const c of list) mirror.cards[c.id] = c;
  void persist();
}

export function cacheReviews(list: Review[]): void {
  for (const r of list) mirror.reviews[r.cardId] = r;
  void persist();
}

// ---------------------------------------------------------------------------
// Mirror reads (synchronous; call ensureLoaded() first)
// ---------------------------------------------------------------------------

export function mAllFolders(): Folder[] {
  return Object.values(mirror.folders).sort((a, b) => a.name.localeCompare(b.name));
}

export function mFoldersByParent(parentId: string | null): Folder[] {
  return Object.values(mirror.folders)
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mFolder(id: string): Folder | undefined {
  return mirror.folders[id];
}

export function mDecksByFolder(folderId: string | null): Deck[] {
  return Object.values(mirror.decks)
    .filter((d) => (d.folderId ?? null) === folderId)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function mAllDecks(): Deck[] {
  return Object.values(mirror.decks).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mDeck(id: string): Deck | undefined {
  return mirror.decks[id];
}

export function hasDeck(id: string): boolean {
  return !!mirror.decks[id];
}

export function mCardsByDeck(deckId: string): Card[] {
  return Object.values(mirror.cards)
    .filter((c) => c.deckId === deckId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

export function mCard(id: string): Card | undefined {
  return mirror.cards[id];
}

export function mCountCards(deckId: string): number {
  return Object.values(mirror.cards).filter((c) => c.deckId === deckId).length;
}

export function mReview(cardId: string): Review | undefined {
  return mirror.reviews[cardId];
}

export function mReviewsByCards(cardIds: string[]): Review[] {
  return cardIds.map((id) => mirror.reviews[id]).filter(Boolean) as Review[];
}

// ---------------------------------------------------------------------------
// Mirror writes (mutate mirror + queue the matching server op)
// ---------------------------------------------------------------------------

export async function insertFolder(folder: Folder): Promise<void> {
  mirror.folders[folder.id] = folder;
  // Don't send is_public: the DB column defaults to false, and omitting it keeps
  // basic folder creation working even on a database that predates phase5.sql.
  // color/icon omitted when null for backward compat with pre-phase7 DBs.
  const values: Record<string, unknown> = { id: folder.id, parent_id: folder.parentId, name: folder.name };
  if (folder.color) values.color = folder.color;
  if (folder.icon) values.icon = folder.icon;
  await commit({ kind: 'insert', table: 'folders', values });
}

export async function updateFolder(
  id: string,
  patch: Partial<Pick<Folder, 'name' | 'isPublic' | 'color' | 'icon'>>
): Promise<void> {
  const cur = mirror.folders[id];
  if (cur) mirror.folders[id] = { ...cur, ...patch };
  const values: Record<string, unknown> = {};
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.isPublic !== undefined) values.is_public = patch.isPublic;
  if ('color' in patch) values.color = patch.color;
  if ('icon' in patch) values.icon = patch.icon;
  await commit({ kind: 'update', table: 'folders', match: { id }, values });
}

function removeFolderTree(id: string): void {
  for (const f of Object.values(mirror.folders)) if (f.parentId === id) removeFolderTree(f.id);
  for (const d of Object.values(mirror.decks)) if (d.folderId === id) removeDeckTree(d.id);
  delete mirror.folders[id];
}

function removeDeckTree(id: string): void {
  for (const c of Object.values(mirror.cards)) {
    if (c.deckId === id) {
      delete mirror.reviews[c.id];
      delete mirror.cards[c.id];
    }
  }
  delete mirror.decks[id];
}

export async function deleteFolder(id: string): Promise<void> {
  removeFolderTree(id); // replicate the DB's ON DELETE CASCADE locally
  await commit({ kind: 'delete', table: 'folders', match: { id } });
}

export async function insertDeck(deck: Deck): Promise<void> {
  mirror.decks[deck.id] = deck;
  // is_public omitted: defaults to false in the DB.
  // Optional fields omitted when default so this works on pre-phase6/7 DBs.
  const values: Record<string, unknown> = {
    id: deck.id,
    folder_id: deck.folderId,
    title: deck.title,
    description: deck.description,
  };
  if (deck.tags.length > 0) values.tags = deck.tags;
  if (deck.color) values.color = deck.color;
  if (deck.icon) values.icon = deck.icon;
  if (deck.frontLabel && deck.frontLabel !== 'Front') values.front_label = deck.frontLabel;
  if (deck.backLabel && deck.backLabel !== 'Back') values.back_label = deck.backLabel;
  if (deck.studyOrder !== 'sequential') values.study_order = deck.studyOrder;
  await commit({ kind: 'insert', table: 'decks', values });
}

export async function updateDeck(
  id: string,
  patch: Partial<Pick<Deck, 'title' | 'description' | 'isPublic' | 'folderId' | 'tags' | 'color' | 'icon' | 'frontLabel' | 'backLabel' | 'studyOrder'>>
): Promise<void> {
  const cur = mirror.decks[id];
  if (cur) mirror.decks[id] = { ...cur, ...patch };
  const values: Record<string, unknown> = {};
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.description !== undefined) values.description = patch.description;
  if (patch.isPublic !== undefined) values.is_public = patch.isPublic;
  if (patch.folderId !== undefined) values.folder_id = patch.folderId;
  if (patch.tags !== undefined) values.tags = patch.tags;
  if ('color' in patch) values.color = patch.color;
  if ('icon' in patch) values.icon = patch.icon;
  if (patch.frontLabel !== undefined) values.front_label = patch.frontLabel;
  if (patch.backLabel !== undefined) values.back_label = patch.backLabel;
  if (patch.studyOrder !== undefined) values.study_order = patch.studyOrder;
  await commit({ kind: 'update', table: 'decks', match: { id }, values });
}

export async function deleteDeck(id: string): Promise<void> {
  removeDeckTree(id);
  await commit({ kind: 'delete', table: 'decks', match: { id } });
}

export async function insertCard(card: Card): Promise<void> {
  mirror.cards[card.id] = card;
  await commit({
    kind: 'insert',
    table: 'cards',
    values: {
      id: card.id,
      deck_id: card.deckId,
      front: card.front,
      back: card.back,
      position: card.position,
    },
  });
}

export async function updateCard(
  id: string,
  patch: Partial<Pick<Card, 'front' | 'back' | 'position'>>
): Promise<void> {
  const cur = mirror.cards[id];
  if (cur) mirror.cards[id] = { ...cur, ...patch };
  const values: Record<string, unknown> = {};
  if (patch.front !== undefined) values.front = patch.front;
  if (patch.back !== undefined) values.back = patch.back;
  if (patch.position !== undefined) values.position = patch.position;
  await commit({ kind: 'update', table: 'cards', match: { id }, values });
}

export async function deleteCard(id: string): Promise<void> {
  delete mirror.reviews[id];
  delete mirror.cards[id];
  await commit({ kind: 'delete', table: 'cards', match: { id } });
}

export async function reorderCards(orderedIds: string[]): Promise<void> {
  const ops: Op[] = [];
  orderedIds.forEach((id, index) => {
    const cur = mirror.cards[id];
    if (cur) mirror.cards[id] = { ...cur, position: index };
    ops.push({ kind: 'update', table: 'cards', match: { id }, values: { position: index } });
  });
  await commit(ops);
}

export async function upsertReview(review: Review): Promise<void> {
  mirror.reviews[review.cardId] = review;
  await commit({
    kind: 'upsert',
    table: 'card_reviews',
    values: {
      card_id: review.cardId,
      interval: review.interval,
      ease: review.ease,
      due_date: review.dueDate,
    },
    onConflict: 'user_id,card_id',
  });
}

// ---------------------------------------------------------------------------
// Hydrate / clear
// ---------------------------------------------------------------------------

/** Pulls the full owned dataset from Supabase into the mirror (online only). */
export async function hydrate(): Promise<void> {
  await ensureLoaded();
  if (!online) return;
  const uid = await getUserId();
  if (!uid) return;
  try {
    await flush();
    if (outbox.length > 0) return; // don't clobber writes that haven't synced yet

    const [folderRows, deckRows, reviewRows] = await Promise.all([
      supabase.from('folders').select('*').eq('owner_id', uid),
      supabase.from('decks').select('*').eq('owner_id', uid),
      supabase.from('card_reviews').select('*').eq('user_id', uid),
    ]);
    const folders = (unwrap(folderRows) ?? []) as any[];
    const decks = (unwrap(deckRows) ?? []) as any[];
    const reviews = (unwrap(reviewRows) ?? []) as any[];

    const deckIds = decks.map((d) => d.id);
    const cards =
      deckIds.length > 0
        ? ((unwrap(await supabase.from('cards').select('*').in('deck_id', deckIds)) ?? []) as any[])
        : [];

    const next = emptyMirror();
    for (const r of folders) next.folders[r.id] = toFolder(r);
    for (const r of decks) next.decks[r.id] = toDeck(r);
    for (const r of cards) next.cards[r.id] = toCard(r);
    for (const r of reviews) next.reviews[r.card_id] = toReview(r);
    mirror = next;
    await persist();
  } catch {
    // Offline / transient error: keep whatever is already cached.
  }
}

/** Wipes the mirror + outbox (call on sign-out). */
export async function clear(): Promise<void> {
  mirror = emptyMirror();
  outbox = [];
  userId = null;
  loaded = true;
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
