/**
 * Unit tests for the offline store (lib/store.ts).
 *
 * Supabase is mocked so these tests run entirely in memory — no network, no
 * Supabase project required. The NetInfo and AsyncStorage mocks (configured in
 * jest.config.js) ensure the store always sees itself as "online" and persists
 * to an in-memory Map.
 */

jest.mock('@/lib/supabase', () => {
  // Success response for all write operations.
  const ok = { data: null, error: null };

  // A chainable query builder stub. Chainable methods return `chain` so
  // `.select().eq()` etc. all compose. The chain itself is thenable so
  // `await chain.update().eq(...)` resolves to ok.
  const chain: any = {};
  for (const m of ['select', 'update', 'delete', 'eq', 'neq', 'is', 'in', 'order', 'limit']) {
    chain[m] = () => chain;
  }
  chain.insert = () => Promise.resolve(ok);
  chain.upsert = () => Promise.resolve(ok);
  chain.maybeSingle = () => Promise.resolve(ok);
  chain.then = (resolve: any, reject: any) => Promise.resolve(ok).then(resolve, reject);

  return {
    supabase: {
      from: () => chain,
      auth: {
        getSession: () =>
          Promise.resolve({ data: { session: { user: { id: 'mock-uid' } } } }),
      },
      rpc: () => Promise.resolve(ok),
    },
    unwrap: (res: any) => {
      if (res?.error) throw new Error(res.error.message);
      return res?.data ?? null;
    },
    isSupabaseConfigured: true,
  };
});

import * as store from '@/lib/store';
import type { Card, Deck, Folder, Review } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2024-01-01T00:00:00.000Z';

function mkFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'f1',
    ownerId: 'u1',
    parentId: null,
    name: 'Root',
    isPublic: false,
    createdAt: NOW,
    ...overrides,
  };
}

function mkDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'd1',
    ownerId: 'u1',
    folderId: null,
    title: 'Deck',
    description: null,
    isPublic: false,
    createdAt: NOW,
    ...overrides,
  };
}

function mkCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    deckId: 'd1',
    front: 'Q',
    back: 'A',
    position: 0,
    createdAt: NOW,
    ...overrides,
  };
}

function mkReview(overrides: Partial<Review> = {}): Review {
  return { cardId: 'c1', dueDate: null, interval: 1, ease: 2.5, ...overrides };
}

beforeEach(async () => {
  await store.clear();
  store.setUser('u1');
});

// ---------------------------------------------------------------------------
// Folder mirror operations
// ---------------------------------------------------------------------------

describe('insertFolder / mFolder / mFoldersByParent', () => {
  it('stores a folder and retrieves it by id', async () => {
    const f = mkFolder();
    await store.insertFolder(f);
    expect(store.mFolder('f1')).toMatchObject({ id: 'f1', name: 'Root' });
  });

  it('lists folders by parent id', async () => {
    await store.insertFolder(mkFolder({ id: 'f1', parentId: null, name: 'Alpha' }));
    await store.insertFolder(mkFolder({ id: 'f2', parentId: null, name: 'Beta' }));
    await store.insertFolder(mkFolder({ id: 'f3', parentId: 'f1', name: 'Child' }));

    const root = store.mFoldersByParent(null);
    expect(root.map((f) => f.id).sort()).toEqual(['f1', 'f2']);

    const children = store.mFoldersByParent('f1');
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('f3');
  });

  it('returns folders sorted by name', async () => {
    await store.insertFolder(mkFolder({ id: 'f2', name: 'Banana' }));
    await store.insertFolder(mkFolder({ id: 'f1', name: 'Apple' }));
    await store.insertFolder(mkFolder({ id: 'f3', name: 'Cherry' }));

    const names = store.mFoldersByParent(null).map((f) => f.name);
    expect(names).toEqual(['Apple', 'Banana', 'Cherry']);
  });
});

describe('updateFolder', () => {
  it('changes the folder name in the mirror', async () => {
    await store.insertFolder(mkFolder({ name: 'Old' }));
    await store.updateFolder('f1', { name: 'New' });
    expect(store.mFolder('f1')?.name).toBe('New');
  });

  it('changes isPublic in the mirror', async () => {
    await store.insertFolder(mkFolder({ isPublic: false }));
    await store.updateFolder('f1', { isPublic: true });
    expect(store.mFolder('f1')?.isPublic).toBe(true);
  });

  it('is a no-op for unknown folders', async () => {
    await expect(store.updateFolder('ghost', { name: 'X' })).resolves.not.toThrow();
  });
});

describe('deleteFolder (cascade)', () => {
  it('removes the folder itself', async () => {
    await store.insertFolder(mkFolder());
    await store.deleteFolder('f1');
    expect(store.mFolder('f1')).toBeUndefined();
  });

  it('cascades into subfolders, decks, cards, and reviews', async () => {
    // Tree: f1 → f2 → d1 → c1 (with review r1)
    await store.insertFolder(mkFolder({ id: 'f1', parentId: null }));
    await store.insertFolder(mkFolder({ id: 'f2', parentId: 'f1' }));
    await store.insertDeck(mkDeck({ id: 'd1', folderId: 'f2' }));
    await store.insertCard(mkCard({ id: 'c1', deckId: 'd1' }));
    await store.upsertReview(mkReview({ cardId: 'c1' }));

    await store.deleteFolder('f1');

    expect(store.mFolder('f1')).toBeUndefined();
    expect(store.mFolder('f2')).toBeUndefined();
    expect(store.mDeck('d1')).toBeUndefined();
    expect(store.mCard('c1')).toBeUndefined();
    expect(store.mReview('c1')).toBeUndefined();
  });

  it('only removes the targeted subtree, not siblings', async () => {
    await store.insertFolder(mkFolder({ id: 'f1', parentId: null }));
    await store.insertFolder(mkFolder({ id: 'f2', parentId: null }));

    await store.deleteFolder('f1');

    expect(store.mFolder('f2')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Deck mirror operations
// ---------------------------------------------------------------------------

describe('insertDeck / mDeck / mDecksByFolder / mAllDecks', () => {
  it('stores a deck and retrieves it by id', async () => {
    await store.insertDeck(mkDeck({ id: 'd1', title: 'My Deck' }));
    expect(store.mDeck('d1')).toMatchObject({ id: 'd1', title: 'My Deck' });
  });

  it('lists decks by folder', async () => {
    await store.insertDeck(mkDeck({ id: 'd1', folderId: 'f1' }));
    await store.insertDeck(mkDeck({ id: 'd2', folderId: 'f1' }));
    await store.insertDeck(mkDeck({ id: 'd3', folderId: null }));

    expect(store.mDecksByFolder('f1')).toHaveLength(2);
    expect(store.mDecksByFolder(null)).toHaveLength(1);
  });

  it('hasDeck returns true iff the deck is in the mirror', async () => {
    await store.insertDeck(mkDeck());
    expect(store.hasDeck('d1')).toBe(true);
    expect(store.hasDeck('ghost')).toBe(false);
  });
});

describe('updateDeck', () => {
  it('updates title and description', async () => {
    await store.insertDeck(mkDeck({ title: 'Old', description: 'Old desc' }));
    await store.updateDeck('d1', { title: 'New', description: 'New desc' });
    const d = store.mDeck('d1')!;
    expect(d.title).toBe('New');
    expect(d.description).toBe('New desc');
  });

  it('updates isPublic', async () => {
    await store.insertDeck(mkDeck({ isPublic: false }));
    await store.updateDeck('d1', { isPublic: true });
    expect(store.mDeck('d1')?.isPublic).toBe(true);
  });
});

describe('deleteDeck (cascade)', () => {
  it('removes the deck, its cards, and their reviews', async () => {
    await store.insertDeck(mkDeck({ id: 'd1' }));
    await store.insertCard(mkCard({ id: 'c1', deckId: 'd1' }));
    await store.insertCard(mkCard({ id: 'c2', deckId: 'd1' }));
    await store.upsertReview(mkReview({ cardId: 'c1' }));
    await store.upsertReview(mkReview({ cardId: 'c2' }));

    await store.deleteDeck('d1');

    expect(store.mDeck('d1')).toBeUndefined();
    expect(store.mCard('c1')).toBeUndefined();
    expect(store.mCard('c2')).toBeUndefined();
    expect(store.mReview('c1')).toBeUndefined();
    expect(store.mReview('c2')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Card mirror operations
// ---------------------------------------------------------------------------

describe('insertCard / mCard / mCardsByDeck / mCountCards', () => {
  it('stores a card and retrieves it by id', async () => {
    await store.insertCard(mkCard({ id: 'c1', front: 'Hello' }));
    expect(store.mCard('c1')).toMatchObject({ id: 'c1', front: 'Hello' });
  });

  it('lists cards for a deck sorted by position then createdAt', async () => {
    await store.insertCard(mkCard({ id: 'c2', position: 1, createdAt: '2024-01-02T00:00:00Z' }));
    await store.insertCard(mkCard({ id: 'c1', position: 0, createdAt: '2024-01-01T00:00:00Z' }));
    await store.insertCard(mkCard({ id: 'c3', position: 2, createdAt: '2024-01-03T00:00:00Z' }));

    const ids = store.mCardsByDeck('d1').map((c) => c.id);
    expect(ids).toEqual(['c1', 'c2', 'c3']);
  });

  it('counts cards correctly', async () => {
    expect(store.mCountCards('d1')).toBe(0);
    await store.insertCard(mkCard({ id: 'c1' }));
    await store.insertCard(mkCard({ id: 'c2' }));
    expect(store.mCountCards('d1')).toBe(2);
  });
});

describe('updateCard', () => {
  it('changes front and back', async () => {
    await store.insertCard(mkCard({ front: 'Old Q', back: 'Old A' }));
    await store.updateCard('c1', { front: 'New Q', back: 'New A' });
    const c = store.mCard('c1')!;
    expect(c.front).toBe('New Q');
    expect(c.back).toBe('New A');
  });
});

describe('deleteCard', () => {
  it('removes the card and its review', async () => {
    await store.insertCard(mkCard({ id: 'c1' }));
    await store.upsertReview(mkReview({ cardId: 'c1' }));
    await store.deleteCard('c1');
    expect(store.mCard('c1')).toBeUndefined();
    expect(store.mReview('c1')).toBeUndefined();
  });
});

describe('reorderCards', () => {
  it('updates each card position to its index in the ordered list', async () => {
    await store.insertCard(mkCard({ id: 'c1', position: 0 }));
    await store.insertCard(mkCard({ id: 'c2', position: 1 }));
    await store.insertCard(mkCard({ id: 'c3', position: 2 }));

    // Reverse the order
    await store.reorderCards(['c3', 'c2', 'c1']);

    expect(store.mCard('c1')?.position).toBe(2);
    expect(store.mCard('c2')?.position).toBe(1);
    expect(store.mCard('c3')?.position).toBe(0);
  });

  it('reflects new order in mCardsByDeck', async () => {
    await store.insertCard(mkCard({ id: 'c1', position: 0 }));
    await store.insertCard(mkCard({ id: 'c2', position: 1 }));

    await store.reorderCards(['c2', 'c1']);

    const ids = store.mCardsByDeck('d1').map((c) => c.id);
    expect(ids).toEqual(['c2', 'c1']);
  });
});

// ---------------------------------------------------------------------------
// Review mirror operations
// ---------------------------------------------------------------------------

describe('upsertReview / mReview / mReviewsByCards', () => {
  it('stores and retrieves a review', async () => {
    await store.upsertReview(mkReview({ cardId: 'c1', interval: 6, ease: 2.8 }));
    const r = store.mReview('c1')!;
    expect(r.interval).toBe(6);
    expect(r.ease).toBe(2.8);
  });

  it('overwrites a previous review on upsert', async () => {
    await store.upsertReview(mkReview({ cardId: 'c1', interval: 1 }));
    await store.upsertReview(mkReview({ cardId: 'c1', interval: 6 }));
    expect(store.mReview('c1')?.interval).toBe(6);
  });

  it('mReviewsByCards returns only reviews for the given card ids', async () => {
    await store.upsertReview(mkReview({ cardId: 'c1' }));
    await store.upsertReview(mkReview({ cardId: 'c2' }));
    await store.upsertReview(mkReview({ cardId: 'c3' }));

    const result = store.mReviewsByCards(['c1', 'c3']);
    expect(result.map((r) => r.cardId).sort()).toEqual(['c1', 'c3']);
  });
});

// ---------------------------------------------------------------------------
// Cache helpers (used by the data layer to warm the mirror)
// ---------------------------------------------------------------------------

describe('cacheFolders / cacheFolder / cacheDecks / cacheDeck / replaceDeckCards / cacheReviews', () => {
  it('cacheFolders adds all folders to the mirror', () => {
    const folders = [
      mkFolder({ id: 'f1', name: 'A' }),
      mkFolder({ id: 'f2', name: 'B' }),
    ];
    store.cacheFolders(folders);
    expect(store.mFolder('f1')).toBeDefined();
    expect(store.mFolder('f2')).toBeDefined();
  });

  it('cacheDecks adds decks to the mirror', () => {
    store.cacheDecks([mkDeck({ id: 'd1' }), mkDeck({ id: 'd2' })]);
    expect(store.mDeck('d1')).toBeDefined();
    expect(store.mDeck('d2')).toBeDefined();
  });

  it('replaceDeckCards replaces existing cards for that deck only', async () => {
    // Seed the mirror directly (no outbox)
    store.cacheDecks([mkDeck({ id: 'd1' }), mkDeck({ id: 'd2' })]);
    await store.insertCard(mkCard({ id: 'c-old', deckId: 'd1' }));
    await store.insertCard(mkCard({ id: 'c-other', deckId: 'd2' }));

    store.replaceDeckCards('d1', [mkCard({ id: 'c-new', deckId: 'd1' })]);

    expect(store.mCard('c-old')).toBeUndefined();
    expect(store.mCard('c-new')).toBeDefined();
    // Cards from the other deck are untouched
    expect(store.mCard('c-other')).toBeDefined();
  });

  it('cacheReviews adds reviews to the mirror', () => {
    store.cacheReviews([mkReview({ cardId: 'c1' }), mkReview({ cardId: 'c2' })]);
    expect(store.mReview('c1')).toBeDefined();
    expect(store.mReview('c2')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// clear()
// ---------------------------------------------------------------------------

describe('clear()', () => {
  it('wipes all mirror data', async () => {
    await store.insertFolder(mkFolder({ id: 'f1' }));
    await store.insertDeck(mkDeck({ id: 'd1' }));
    await store.insertCard(mkCard({ id: 'c1' }));
    await store.upsertReview(mkReview({ cardId: 'c1' }));

    await store.clear();

    expect(store.mFolder('f1')).toBeUndefined();
    expect(store.mDeck('d1')).toBeUndefined();
    expect(store.mCard('c1')).toBeUndefined();
    expect(store.mReview('c1')).toBeUndefined();
  });

  it('resets userId so setUser is needed again', async () => {
    store.setUser('u1');
    await store.clear();
    // After clear, userId is null; getUserId falls back to supabase.auth.getSession()
    const id = await store.getUserId();
    // The mock session has user id 'mock-uid'
    expect(id).toBe('mock-uid');
  });
});

// ---------------------------------------------------------------------------
// Online subscription
// ---------------------------------------------------------------------------

describe('subscribeOnline', () => {
  it('returns an unsubscribe function and does not fire after unsubscribe', () => {
    const calls: boolean[] = [];
    const unsub = store.subscribeOnline((v) => calls.push(v));
    unsub();
    // Subscribing and immediately unsubscribing — no further callbacks expected.
    expect(calls).toHaveLength(0);
  });
});
