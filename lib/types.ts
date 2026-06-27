/** Domain types used across the data layer and UI. IDs are Supabase uuids. */

export type Folder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
};

export type Deck = {
  id: string;
  ownerId: string;
  folderId: string | null;
  title: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
};

/** A deck enriched with how many cards it holds (for list screens). */
export type DeckWithCount = Deck & {
  cardCount: number;
};

export type Card = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  position: number;
  createdAt: string;
};
