/** Domain types used across the data layer and UI. */

export type Folder = {
  id: number;
  parentId: number | null;
  name: string;
  createdAt: number;
};

export type Deck = {
  id: number;
  folderId: number | null;
  title: string;
  description: string | null;
  createdAt: number;
};

/** A deck enriched with how many cards it holds (for list screens). */
export type DeckWithCount = Deck & {
  cardCount: number;
};

export type Card = {
  id: number;
  deckId: number;
  front: string;
  back: string;
  position: number;
  createdAt: number;
};
