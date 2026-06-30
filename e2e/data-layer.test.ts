/**
 * E2E tests for the data layer against a live Supabase project.
 *
 * Prerequisites:
 *   1. `.env` must contain EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 *   2. Two pre-created test accounts must exist in the project:
 *        TEST_USER1_EMAIL / TEST_USER1_PASSWORD
 *        TEST_USER2_EMAIL / TEST_USER2_PASSWORD
 *      Add them to `.env` (they are never committed).
 *   3. `supabase/schema.sql` + `supabase/phase5.sql` must be applied.
 *
 * Run: npm run test:e2e
 *
 * Tests are isolated: all rows created here are prefixed with "[e2e]" and
 * deleted in afterAll so repeated runs leave the DB clean.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import * as store from '@/lib/store';
import { createFolder, renameFolder, deleteFolder, listFolders } from '@/lib/folders';
import { createDeck, updateDeck, deleteDeck, listDecks, listAllDecks, setDeckPublic, copyDeck } from '@/lib/decks';
import { createCard, updateCard, deleteCard, listCards, reorderCards } from '@/lib/cards';
import { recordReview, getDueCards } from '@/lib/reviews';

// ---------------------------------------------------------------------------
// Guard: skip all e2e tests if Supabase is not configured or credentials
// are missing, so unit-test runs (npm test) don't fail on a bare checkout.
// ---------------------------------------------------------------------------

const SKIP =
  !isSupabaseConfigured ||
  !process.env.TEST_USER1_EMAIL ||
  !process.env.TEST_USER1_PASSWORD ||
  !process.env.TEST_USER2_EMAIL ||
  !process.env.TEST_USER2_PASSWORD;

const describe_e2e = SKIP ? describe.skip : describe;

if (SKIP) {
  test('e2e skipped — set TEST_USER1_EMAIL/PASSWORD and TEST_USER2_EMAIL/PASSWORD in .env', () => {
    expect(true).toBe(true);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signIn(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return data.user.id;
}

async function switchUser(email: string, password: string): Promise<string> {
  await supabase.auth.signOut();
  await store.clear();
  const uid = await signIn(email, password);
  store.setUser(uid);
  return uid;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe_e2e('Data layer e2e', () => {
  const E2E = '[e2e]';
  const u1 = { email: process.env.TEST_USER1_EMAIL!, password: process.env.TEST_USER1_PASSWORD! };
  const u2 = { email: process.env.TEST_USER2_EMAIL!, password: process.env.TEST_USER2_PASSWORD! };

  // IDs of rows created in this run, used for cleanup in afterAll.
  const cleanup = { folders: [] as string[], decks: [] as string[] };

  beforeAll(async () => {
    await switchUser(u1.email, u1.password);
  });

  afterAll(async () => {
    // Re-auth as user1 and delete their e2e test data.
    await switchUser(u1.email, u1.password);
    for (const id of cleanup.folders) {
      await deleteFolder(id).catch(() => {});
    }
    for (const id of cleanup.decks) {
      await deleteDeck(id).catch(() => {});
    }

    // Delete user2's e2e data (decks/folders they forked from user1).
    await switchUser(u2.email, u2.password);
    const u2Decks = await listAllDecks();
    for (const d of u2Decks) {
      if (d.title.startsWith(E2E)) await deleteDeck(d.id).catch(() => {});
    }
    const u2Folders = await listFolders(null);
    for (const f of u2Folders) {
      if (f.name.startsWith(E2E)) await deleteFolder(f.id).catch(() => {});
    }

    await supabase.auth.signOut();
  });

  // Ensure user1 is signed in before each test group.
  beforeEach(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.email !== u1.email) {
      await switchUser(u1.email, u1.password);
    }
  });

  // ---------------------------------------------------------------------------
  describe('Folder CRUD', () => {
    let folderId: string;

    it('creates a root folder', async () => {
      folderId = await createFolder(null, `${E2E} Folder`);
      cleanup.folders.push(folderId);

      const folders = await listFolders(null);
      const found = folders.find((f) => f.id === folderId);
      expect(found).toBeDefined();
      expect(found?.name).toBe(`${E2E} Folder`);
    });

    it('creates a nested subfolder', async () => {
      const childId = await createFolder(folderId, `${E2E} Child`);
      cleanup.folders.push(childId);

      const children = await listFolders(folderId);
      expect(children.some((f) => f.id === childId)).toBe(true);
    });

    it('renames a folder', async () => {
      await renameFolder(folderId, `${E2E} Folder Renamed`);
      const folders = await listFolders(null);
      const found = folders.find((f) => f.id === folderId);
      expect(found?.name).toBe(`${E2E} Folder Renamed`);
    });

    it('deletes a folder (server-side ON DELETE CASCADE removes descendants)', async () => {
      const tempId = await createFolder(null, `${E2E} Temp`);
      await deleteFolder(tempId);

      const folders = await listFolders(null);
      expect(folders.find((f) => f.id === tempId)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Deck CRUD', () => {
    let deckId: string;

    it('creates a deck at root level', async () => {
      deckId = await createDeck(null, `${E2E} Deck`, 'Test description');
      cleanup.decks.push(deckId);

      const decks = await listAllDecks();
      const found = decks.find((d) => d.id === deckId);
      expect(found).toBeDefined();
      expect(found?.title).toBe(`${E2E} Deck`);
    });

    it('updates the deck title and description', async () => {
      await updateDeck(deckId, { title: `${E2E} Deck Updated`, description: 'New description' });
      const decks = await listAllDecks();
      const found = decks.find((d) => d.id === deckId);
      expect(found?.title).toBe(`${E2E} Deck Updated`);
    });

    it('lists decks by folder (null = root)', async () => {
      const decks = await listDecks(null);
      expect(decks.some((d) => d.id === deckId)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Card CRUD + reorder', () => {
    let deckId: string;
    let cardA: string;
    let cardB: string;
    let cardC: string;

    beforeAll(async () => {
      deckId = await createDeck(null, `${E2E} Cards Deck`, '');
      cleanup.decks.push(deckId);
      cardA = await createCard(deckId, 'Front A', 'Back A');
      cardB = await createCard(deckId, 'Front B', 'Back B');
      cardC = await createCard(deckId, 'Front C', 'Back C');
    });

    it('lists cards in insertion order', async () => {
      const cards = await listCards(deckId);
      const ids = cards.map((c) => c.id);
      expect(ids).toEqual([cardA, cardB, cardC]);
    });

    it('updates card front and back', async () => {
      await updateCard(cardA, 'Updated Front', 'Updated Back');
      const cards = await listCards(deckId);
      const a = cards.find((c) => c.id === cardA)!;
      expect(a.front).toBe('Updated Front');
      expect(a.back).toBe('Updated Back');
    });

    it('reorders cards — positions and list order match', async () => {
      await reorderCards(deckId, [cardC, cardA, cardB]);
      const cards = await listCards(deckId);
      // After server round-trip, the order should be C, A, B by position.
      const ids = cards.map((c) => c.id);
      expect(ids).toEqual([cardC, cardA, cardB]);
    });

    it('deletes a card', async () => {
      await deleteCard(cardC);
      const cards = await listCards(deckId);
      expect(cards.find((c) => c.id === cardC)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  describe('SM-2 spaced repetition', () => {
    let deckId: string;
    let cardId: string;

    beforeAll(async () => {
      deckId = await createDeck(null, `${E2E} SM2 Deck`, '');
      cleanup.decks.push(deckId);
      cardId = await createCard(deckId, 'Q', 'A');
    });

    it('new card is always due', async () => {
      const due = await getDueCards(deckId);
      expect(due.some((c) => c.id === cardId)).toBe(true);
    });

    it('remembered card advances the interval and is no longer due today', async () => {
      await recordReview(cardId, true /* remembered */);
      // After a "got it", interval >= 1 day so the card is not due today.
      const due = await getDueCards(deckId);
      expect(due.find((c) => c.id === cardId)).toBeUndefined();
    });

    it('forgotten card resets interval to 1 and lowers ease', async () => {
      await recordReview(cardId, false /* forgot */);
      const r = store.mReview(cardId);
      expect(r).toBeDefined();
      expect(r!.interval).toBe(1);
      expect(r!.ease).toBeLessThan(2.5);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Deck sharing (fork-on-copy)', () => {
    let sourceDeckId: string;
    let sourceCardId: string;

    beforeAll(async () => {
      sourceDeckId = await createDeck(null, `${E2E} Public Deck`, '');
      cleanup.decks.push(sourceDeckId);
      sourceCardId = await createCard(sourceDeckId, 'Public Q', 'Public A');
    });

    it('unpublished deck is not visible in user2 listAllDecks', async () => {
      await switchUser(u2.email, u2.password);
      const decks = await listAllDecks();
      expect(decks.find((d) => d.id === sourceDeckId)).toBeUndefined();
    });

    it('published deck can be forked by user2', async () => {
      // Re-auth as user1 to publish
      await switchUser(u1.email, u1.password);
      await setDeckPublic(sourceDeckId, true);

      // Switch to user2 and copy
      await switchUser(u2.email, u2.password);
      const copyId = await copyDeck(sourceDeckId, null);
      expect(typeof copyId).toBe('string');

      // The copy is user2's own deck
      const decks = await listAllDecks();
      const copy = decks.find((d) => d.id === copyId);
      expect(copy).toBeDefined();
      // Forked deck is private by default
      expect(copy?.isPublic).toBe(false);

      // The copy has the same card content
      const cards = await listCards(copyId);
      expect(cards.some((c) => c.front === 'Public Q')).toBe(true);
      // But the card ids are different (true fork — not shared)
      expect(cards.find((c) => c.id === sourceCardId)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  describe('RLS isolation', () => {
    let privateId: string;

    beforeAll(async () => {
      await switchUser(u1.email, u1.password);
      privateId = await createFolder(null, `${E2E} Private`);
      cleanup.folders.push(privateId);
    });

    it('user2 cannot see user1 private folder in listFolders', async () => {
      await switchUser(u2.email, u2.password);
      const folders = await listFolders(null);
      expect(folders.find((f) => f.id === privateId)).toBeUndefined();
    });

    it('user2 cannot see user1 private deck in listAllDecks', async () => {
      await switchUser(u1.email, u1.password);
      const privateDeckId = await createDeck(null, `${E2E} Private Deck`, '');
      cleanup.decks.push(privateDeckId);

      await switchUser(u2.email, u2.password);
      const decks = await listAllDecks();
      expect(decks.find((d) => d.id === privateDeckId)).toBeUndefined();
    });

    it('user1 published deck appears to user2 only via copy_deck, not in their library', async () => {
      // listAllDecks for user2 should not show user1 decks even if public.
      // (The query is scoped by owner_id; discover is a separate flow.)
      await switchUser(u2.email, u2.password);
      const decks = await listAllDecks();
      // None of user1 deck ids appear in user2 library
      const u1DeckIds = new Set(cleanup.decks);
      expect(decks.filter((d) => u1DeckIds.has(d.id))).toHaveLength(0);
    });
  });
});
