/**
 * Unit tests for lib/reviews.ts — SM-2 scheduling logic.
 *
 * Supabase is replaced with a stateful in-memory stub that tracks card_reviews
 * rows so getDueCards can read back what recordReview stored, without any
 * real network. lib/cards is mocked so listCards returns whatever each test
 * needs.
 */

// Stateful stub: captures upserted card_reviews rows and returns them on
// subsequent select queries (so getDueCards sees reviews written by recordReview).
jest.mock('@/lib/supabase', () => {
  const ok = { data: null, error: null };
  const reviewDB = new Map<string, Record<string, unknown>>();

  function makeCardReviewsChain() {
    let pendingIds: string[] | undefined;
    let pendingCardId: string | undefined;
    const c: Record<string, unknown> = {
      select() { return c; },
      in(_col: string, ids: string[]) { pendingIds = ids; return c; },
      eq(_col: string, val: string) { pendingCardId = val; return c; },
      maybeSingle() {
        return Promise.resolve({ data: pendingCardId ? (reviewDB.get(pendingCardId) ?? null) : null, error: null });
      },
      upsert(values: Record<string, unknown>) {
        reviewDB.set(values.card_id as string, values);
        return Promise.resolve(ok);
      },
    };
    (c as any).then = (resolve: any, reject: any) => {
      const data = pendingIds ? pendingIds.map((id) => reviewDB.get(id)).filter(Boolean) : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return c;
  }

  function makeNoopChain() {
    const c: any = {};
    for (const m of ['select', 'update', 'delete', 'eq', 'neq', 'is', 'in', 'order', 'limit']) {
      c[m] = () => c;
    }
    c.insert = () => Promise.resolve(ok);
    c.upsert = () => Promise.resolve(ok);
    c.maybeSingle = () => Promise.resolve(ok);
    c.then = (resolve: any, reject: any) => Promise.resolve(ok).then(resolve, reject);
    return c;
  }

  return {
    supabase: {
      from: (table: string) => (table === 'card_reviews' ? makeCardReviewsChain() : makeNoopChain()),
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'mock-uid' } } } }),
      },
      rpc: () => Promise.resolve(ok),
    },
    unwrap: (res: any) => {
      if (res?.error) throw new Error(res.error.message);
      return res?.data ?? null;
    },
    isSupabaseConfigured: true,
    _reviewDB: reviewDB,
  };
});

jest.mock('@/lib/cards', () => ({
  listCards: jest.fn(),
}));

import { listCards } from '@/lib/cards';
import * as store from '@/lib/store';
import { countDueCards, getDueCards, recordReview } from '@/lib/reviews';
import type { Card } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2024-01-01T00:00:00.000Z';

function mkCard(overrides: Partial<Card> = {}): Card {
  return { id: 'c1', deckId: 'dk1', front: 'Q', back: 'A', position: 0, createdAt: NOW, ...overrides };
}

function getReviewDB() {
  return (jest.requireMock('@/lib/supabase') as any)._reviewDB as Map<string, any>;
}

beforeEach(async () => {
  getReviewDB().clear();
  await store.clear();
  store.setUser('u1');
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// recordReview — SM-2 interval progression
// ---------------------------------------------------------------------------

describe('recordReview — scheduling math', () => {
  it('new card remembered: interval = 1, ease stays at 2.5', async () => {
    await recordReview('c1', true);
    const r = store.mReview('c1')!;
    expect(r.interval).toBe(1);
    expect(r.ease).toBe(2.5);
    expect(r.dueDate).not.toBeNull();
  });

  it('interval-1 card remembered: interval becomes 6', async () => {
    await recordReview('c1', true); // new → 1
    await recordReview('c1', true); // 1   → 6
    expect(store.mReview('c1')!.interval).toBe(6);
  });

  it('interval-6 card remembered: interval = round(6 × ease) = 15', async () => {
    await recordReview('c1', true); // → 1
    await recordReview('c1', true); // → 6
    await recordReview('c1', true); // → round(6 × 2.5) = 15
    expect(store.mReview('c1')!.interval).toBe(15);
  });

  it('forgotten card: resets interval to 1', async () => {
    await recordReview('c1', true); // → 1
    await recordReview('c1', true); // → 6
    await recordReview('c1', false); // reset
    expect(store.mReview('c1')!.interval).toBe(1);
  });

  it('forgotten card: lowers ease by 0.2', async () => {
    await recordReview('c1', true); // ease stays 2.5
    const before = store.mReview('c1')!.ease;
    await recordReview('c1', false);
    expect(store.mReview('c1')!.ease).toBeCloseTo(before - 0.2, 5);
  });

  it('ease cannot drop below 1.3 (MIN_EASE)', async () => {
    for (let i = 0; i < 30; i++) {
      await recordReview('c1', false);
    }
    expect(store.mReview('c1')!.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('due date is at least 1 day in the future after remembering', async () => {
    const before = Date.now();
    await recordReview('c1', true);
    const dueMs = new Date(store.mReview('c1')!.dueDate!).getTime();
    expect(dueMs).toBeGreaterThan(before + 23 * 60 * 60 * 1000); // > 23 h from now
  });

  it('remembered card: ease is unchanged', async () => {
    await recordReview('c1', true); // ease = 2.5
    await recordReview('c1', false); // ease → 2.3
    await recordReview('c1', true);  // remembered — ease stays 2.3
    const r = store.mReview('c1')!;
    expect(r.ease).toBeCloseTo(2.3, 5);
  });
});

// ---------------------------------------------------------------------------
// getDueCards
// ---------------------------------------------------------------------------

describe('getDueCards', () => {
  it('returns [] for an empty deck', async () => {
    (listCards as jest.Mock).mockResolvedValue([]);
    expect(await getDueCards('dk1')).toEqual([]);
  });

  it('returns all cards when none have been reviewed (all new)', async () => {
    const cards = [mkCard({ id: 'c1' }), mkCard({ id: 'c2' })];
    (listCards as jest.Mock).mockResolvedValue(cards);
    const due = await getDueCards('dk1');
    expect(due.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
  });

  it('excludes a card whose due date is in the future', async () => {
    const card = mkCard({ id: 'c1' });
    (listCards as jest.Mock).mockResolvedValue([card]);

    // recordReview stores in the mock DB so getDueCards can read it back.
    await recordReview('c1', true); // interval = 1 → due tomorrow
    const due = await getDueCards('dk1');
    expect(due.find((c) => c.id === 'c1')).toBeUndefined();
  });

  it('includes a card whose due date is in the past', async () => {
    const card = mkCard({ id: 'c1' });
    (listCards as jest.Mock).mockResolvedValue([card]);

    // Seed an already-overdue review directly into the mock DB.
    getReviewDB().set('c1', {
      card_id: 'c1',
      due_date: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago
      interval: 1,
      ease: 2.5,
    });

    const due = await getDueCards('dk1');
    expect(due.some((c) => c.id === 'c1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// countDueCards
// ---------------------------------------------------------------------------

describe('countDueCards', () => {
  it('returns 0 for an empty deck', async () => {
    (listCards as jest.Mock).mockResolvedValue([]);
    expect(await countDueCards('dk1')).toBe(0);
  });

  it('returns the number of cards due (all new = all due)', async () => {
    (listCards as jest.Mock).mockResolvedValue([
      mkCard({ id: 'c1' }),
      mkCard({ id: 'c2' }),
      mkCard({ id: 'c3' }),
    ]);
    expect(await countDueCards('dk1')).toBe(3);
  });

  it('counts only the subset that is actually due', async () => {
    const cards = [mkCard({ id: 'c1' }), mkCard({ id: 'c2' })];
    (listCards as jest.Mock).mockResolvedValue(cards);

    // c1 reviewed and not yet due
    await recordReview('c1', true);

    expect(await countDueCards('dk1')).toBe(1); // only c2 (new)
  });
});
