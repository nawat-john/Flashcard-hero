# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Phases 0–5 are **done**: a flashcard app (**Expo SDK 54**, React Native 0.81, React 19.1, TypeScript 5.9, expo-router 6) with email/password auth, a Supabase (Postgres) cloud backend, sharing (publish / Discover / fork-on-copy for both decks and whole folder subtrees), SM-2 spaced repetition, drag-to-reorder cards, and offline support. `plan.md` (Thai) is the source of truth. All in-app features are built; what remains are external-only items: a custom app icon (needs design art), on-device testing, and `eas build` / store submission (need the user's Expo + store accounts). `eas.json` and bundle ids (`com.flashcardhero.app`) are already in place.

- **Spaced repetition** (`lib/reviews.ts`): a simplified SM-2 over `card_reviews`, storing only `interval`/`ease`/`due_date` (review stage is inferred from `interval`, so no extra column). Grading is binary; `recordReview` upserts on `(user_id, card_id)`. The study session records every grade and supports a due-only mode via `/study/[deckId]?due=1`; the deck screen shows a "review due (N)" button. Swipe right/left on the study card grades remembered/forgot (needs `GestureHandlerRootView`, set in `app/_layout.tsx`).

- **Offline support** (`lib/store.ts`): AsyncStorage-backed mirror of the signed-in user's own folders/decks/cards/reviews, plus an outbox write-queue flushed by NetInfo. All `lib/*.ts` data-layer functions read from the mirror when offline and queue writes through `store.commit`. `lib/uuid.ts` generates client-side UUIDs so offline creates get a stable id immediately. `initSync()` is called once in `app/_layout.tsx`; `hydrate()` on login/reconnect; `clear()` on sign-out. The offline banner (`components/offline-banner.tsx`) shows a grey strip when offline.

- **Folder sharing** (`lib/folders.ts` + `supabase/phase5.sql`): `share_folder` RPC flips `is_public` on a folder subtree and all its decks. `copy_folder` RPC forks a public folder subtree. `app/folder-preview/[id].tsx` is the preview+copy screen (deep link `flashcardhero://folder-preview/<id>`). `components/folder-browser.tsx` has publish/share-link menu items for folders. `app/(tabs)/discover.tsx` shows both public folders and public decks.

- **Drag-to-reorder cards**: `app/deck/[id].tsx` uses a `DragCardRow` component (Reanimated + GestureDetector, long-press to activate) backed by `lib/cards.ts::reorderCards` which persists via the offline store.

The DB has SQL files in `supabase/`: `schema.sql` (full, drops+recreates — source of truth), `phase3.sql` (additive: `list_public_decks` + `copy_deck`), and `phase5.sql` (additive: `folders.is_public` column + `share_folder` / `list_public_folders` / `copy_folder` functions). When changing the schema, update `schema.sql`; for additive changes also provide an incremental file so existing databases don't have to be dropped. **New deployments must run `phase5.sql` in the Supabase SQL editor** (or re-run the full `schema.sql`).

SDK is pinned to **54** deliberately: the target device runs Expo Go for SDK 54, and Expo Go only loads its own SDK. Do not bump the Expo SDK without confirming the device's Expo Go version first (a mismatch makes the app refuse to open). Bumping the SDK means `npx expo install expo@<sdk>` then `npx expo install --fix`.

### Supabase setup (required to run)

The app needs a Supabase project. `lib/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env` (gitignored; see `.env.example`). Until real values are present, `isSupabaseConfigured` is false and the login screen shows a setup notice instead of the form. The full schema + RLS lives in `supabase/schema.sql` — run it once in the Supabase SQL editor. After editing `.env` you must restart `npm start` (Expo inlines `EXPO_PUBLIC_*` at bundle time).

### Layout

Routes are in root-level `app/` (expo-router, file-based — not `src/app/`). Shared code sits in root `components/`, `constants/`, `hooks/`, `lib/`.

- `lib/supabase.ts` — the shared Supabase client (session persisted in AsyncStorage) plus `unwrap()`, which throws on a Postgrest error and returns `data`. **All data-layer calls go through `unwrap`.**
- `lib/` data layer — `folders.ts`, `decks.ts`, `cards.ts`, `profiles.ts`, `types.ts`. Pure async functions over the Supabase client; **no React imports**. Screens import from here and never touch the client directly. `owner_id` is **never set client-side** — the DB column defaults to `auth.uid()`, and RLS enforces ownership.
- IDs are Supabase **uuids (strings)**, not numbers. Route params are used as-is (no `Number(...)`).
- `lib/auth.tsx` — `AuthProvider` + `useAuth()` (session, `signIn`/`signUp`/`signOut`). `app/_layout.tsx`'s `RootNavigator` redirects between `(auth)` and the app based on session (the standard expo-router auth-group guard).
- Routes: `app/(auth)/login.tsx` (sign in/up). `app/(tabs)/` = four tabs (`index` = Library browser, `study` = pick-a-deck list, `discover` = public decks + folders, `profile` = account + logout). Detail screens in the root stack: `app/folder/[id].tsx`, `app/folder-preview/[id].tsx` (read-only view of any public folder + "add to library"), `app/deck/[id].tsx` (owner view + publish toggle/share), `app/deck-preview/[id].tsx` (read-only view of any public deck + "add to library"), `app/study/[deckId].tsx`.
- Sharing is **fork-on-copy**: `copy_deck()` / `copy_folder()` (server-side, `security invoker`) duplicate a public/owned deck or folder subtree under the caller, private. Copies get new ids so study progress never carries over. `lib/discover.ts` wraps `listPublicDecks` + `listPublicFolders`; `setDeckPublic`/`copyDeck` in `lib/decks.ts`; `shareFolder`/`copyFolder` in `lib/folders.ts`.
- **Typed routes**: `folder-preview/[id]` is new — if `tsc` complains about the route literal not being assignable to `Href`, run `npm start` once to regenerate `.expo/types/`. Until then, use `as any` on the push argument.
- Both the Library tab and `folder/[id]` render the shared `components/folder-browser.tsx` (folderId `null` = root). Screens reload via `useFocusEffect` and show `LoadingScreen` / `ErrorState` (with retry) around the async data layer.

`supabase/schema.sql` is the single source of truth for the DB. **Keep it in sync** when changing tables/policies; there's no migration tool — you re-run the file (it drops + recreates the app tables).

## Commands

```
npm start              # expo start — then scan the QR with Expo Go on a real device
npm run android        # open on Android emulator/device
npm run ios            # open on iOS simulator (macOS only)
npm run web            # run in browser
npm run lint           # expo lint (ESLint, eslint-config-expo flat config)
npm run typecheck      # tsc --noEmit
npm run format         # prettier --write .
npm run format:check   # prettier --check .
npx expo-doctor        # validate dependency/config health
```

There is no test runner wired up yet. Add one (and document the single-test command here) when the first tests land.

## What is being built

A flashcard app whose distinguishing features are **nestable folders** (a folder tree, not a flat list), **user-authored cards**, and **sharing**: publish your own decks and copy other people's into your library.

**Intended stack:** Expo (React Native + TypeScript) + expo-router for the app; `expo-sqlite` for local storage in Phase 1; Supabase (Postgres / Auth / Storage) for cloud, auth, and sharing from Phase 2 on.

## Architecture rules that span files

These are deliberate decisions from the plan — preserve them when implementing:

- **Data layer is separated from UI.** All CRUD lives behind a data-layer module (e.g. `/lib` or `/db`), never inline in screens. This is load-bearing: Phase 2 swaps the storage backend from SQLite to Supabase, and the goal is to change it in one place. Do not let components call the database directly.

- **Folders are self-referential (nested).** `folders.parent_id` points back at `folders.id`. Folder browsing pushes a new navigation screen per level. Deleting a folder must handle everything inside it (subfolders, decks, cards). When moving to Supabase, fetching a whole folder subtree is done with a recursive Postgres function, not N client round-trips.

- **Sharing is fork-on-copy.** Copying a public deck INSERTs an independent copy owned by the copier — it is not linked to the original. Editing the original must never affect existing copies. Per-user study progress (`card_reviews`) starts fresh on a copy and is never carried over. Copying a folder copies the whole subtree (folders + decks + cards).

- **Row Level Security is mandatory** (Phase 2+). Every Supabase table has RLS on. Users may read/write only rows they own (`owner_id`); anyone may read rows where `is_public = true` but cannot modify them. This is the primary security boundary — do not ship tables with RLS disabled.

## Data model

Local (Phase 1, SQLite):

```
folders (id, parent_id, name, created_at)         -- parent_id self-references folders → nesting
decks   (id, folder_id, title, description, created_at)
cards   (id, deck_id, front, back, position, created_at)
```

Cloud (Phase 2+, Postgres) adds ownership, publishing, and per-user progress:

```
profiles      (id, display_name, created_at)
folders       (id, owner_id, parent_id, name, created_at)
decks         (id, owner_id, folder_id, title, description, is_public, created_at)
cards         (id, deck_id, front, back, position)
card_reviews  (user_id, card_id, due_date, interval, ease)   -- per-user study progress
```

Phase 4 adds SM-2 spaced repetition computed over `card_reviews` (`due_date` derived from answer quality; a "due cards only" study mode).

## Conventions

- Secrets (Supabase keys) go in env files and must not be committed.
- The plan and its checklists are in Thai; match the language already in use in surrounding files/UI when contributing.
- Path alias `@/*` maps to the repo root `./*` (see `tsconfig.json`); prefer it over long relative imports.
- `AGENTS.md` warns that Expo APIs change between versions — check the versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing Expo-specific code.
- Typed routes are on (`app.json` → `experiments.typedRoutes`). Route literal types live in `.expo/types/` and are regenerated when the dev server runs; if `tsc` complains a valid route string isn't assignable to `Href`, run `npm start` once to regenerate them.
- `expo-env.d.ts` is generated and gitignored; recreate it with `/// <reference types="expo/types" />` if a typecheck complains about missing module declarations.
