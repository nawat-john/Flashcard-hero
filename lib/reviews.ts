import { listCards } from '@/lib/cards';
import { supabase, unwrap } from '@/lib/supabase';
import type { Card } from '@/lib/types';

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

/** Records one grade for a card and advances its schedule (upserts the review). */
export async function recordReview(cardId: string, remembered: boolean): Promise<void> {
  const prev = unwrap(
    await supabase.from('card_reviews').select('interval, ease').eq('card_id', cardId).maybeSingle()
  );
  const { interval, ease, dueDate } = nextSchedule(prev, remembered);
  // user_id defaults to auth.uid() in the DB; RLS keeps each user's progress separate.
  unwrap(
    await supabase
      .from('card_reviews')
      .upsert(
        { card_id: cardId, interval, ease, due_date: dueDate },
        { onConflict: 'user_id,card_id' }
      )
  );
}

/** Cards in a deck that are due now — never-reviewed cards count as due. */
export async function getDueCards(deckId: string): Promise<Card[]> {
  const cards = await listCards(deckId);
  if (cards.length === 0) return [];

  const reviews =
    (unwrap(
      await supabase
        .from('card_reviews')
        .select('card_id, due_date')
        .in(
          'card_id',
          cards.map((c) => c.id)
        )
    ) as ReviewRow[] | null) ?? [];

  const dueByCard = new Map(reviews.map((r) => [r.card_id, r.due_date]));
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
