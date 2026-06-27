import * as store from '@/lib/store';
import { supabase, unwrap } from '@/lib/supabase';
import { listCards } from '@/lib/cards';
import type { Card, Review } from '@/lib/types';

/**
 * Spaced repetition (a simplified SM-2) over the `card_reviews` table.
 *
 * We store only `interval` (days), `ease`, and `due_date`; the review "stage"
 * is inferred from the interval, so no extra column is needed:
 *   - no row yet / interval <= 0  → brand-new card
 *   - interval === 1              → seen once
 *   - interval >= 2              → graduated, interval grows by `ease`
 *
 * Grading is binary (the study UI's "จำได้ / จำไม่ได้"): remembered ≈ SM-2
 * quality 4 (ease unchanged), forgot resets the interval and lowers ease.
 */

const DAY_MS = 86_400_000;
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

type ReviewRow = {
  card_id: string;
  due_date: string | null;
  interval: number;
  ease: number;
};

function nextSchedule(
  prev: { interval: number; ease: number } | null,
  remembered: boolean
): { interval: number; ease: number; dueDate: string } {
  const prevInterval = prev?.interval ?? 0;
  const prevEase = prev?.ease ?? DEFAULT_EASE;

  let interval: number;
  let ease: number;

  if (!remembered) {
    interval = 1;
    ease = Math.max(MIN_EASE, prevEase - 0.2);
  } else {
    if (prevInterval <= 0) interval = 1;
    else if (prevInterval === 1) interval = 6;
    else interval = Math.round(prevInterval * prevEase);
    ease = prevEase; // remembered ≈ quality 4 → ease unchanged
  }

  return { interval, ease, dueDate: new Date(Date.now() + interval * DAY_MS).toISOString() };
}

/** Records one grade for a card and advances its schedule. */
export async function recordReview(cardId: string, remembered: boolean): Promise<void> {
  await store.ensureLoaded();

  // Read from mirror first (avoids a server round-trip when offline).
  const cached = store.mReview(cardId);
  let prev: { interval: number; ease: number } | null = cached ?? null;

  if (!cached && store.isOnline()) {
    try {
      const row = unwrap(
        await supabase
          .from('card_reviews')
          .select('interval, ease')
          .eq('card_id', cardId)
          .maybeSingle()
      ) as ReviewRow | null;
      if (row) prev = { interval: row.interval, ease: row.ease };
    } catch {
      // proceed with null prev — will treat as new card
    }
  }

  const { interval, ease, dueDate } = nextSchedule(prev, remembered);
  // user_id defaults to auth.uid() in the DB; RLS keeps each user's progress separate.
  const review: Review = { cardId, interval, ease, dueDate };
  await store.upsertReview(review);
}

/** Cards in a deck that are due now — never-reviewed cards count as due. */
export async function getDueCards(deckId: string): Promise<Card[]> {
  await store.ensureLoaded();
  const cards = await listCards(deckId);
  if (cards.length === 0) return [];

  let reviews: Review[] = store.mReviewsByCards(cards.map((c) => c.id));

  // If we're online and any card has no mirror review, fetch from server once.
  if (store.isOnline()) {
    try {
      const rows =
        (unwrap(
          await supabase
            .from('card_reviews')
            .select('card_id, due_date, interval, ease')
            .in(
              'card_id',
              cards.map((c) => c.id)
            )
        ) as ReviewRow[] | null) ?? [];
      reviews = rows.map((r) => ({
        cardId: r.card_id,
        dueDate: r.due_date,
        interval: r.interval,
        ease: r.ease,
      }));
      store.cacheReviews(reviews);
    } catch {
      // fall through to mirror
    }
  }

  const dueByCard = new Map(reviews.map((r) => [r.cardId, r.dueDate]));
  const now = Date.now();
  return cards.filter((card) => {
    if (!dueByCard.has(card.id)) return true; // new card
    const due = dueByCard.get(card.id);
    return !due || new Date(due).getTime() <= now;
  });
}

export async function countDueCards(deckId: string): Promise<number> {
  return (await getDueCards(deckId)).length;
}
