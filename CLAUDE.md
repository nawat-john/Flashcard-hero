# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Phases 0–2 are **done**: a flashcard app (**Expo SDK 54**, React Native 0.81, React 19.1, TypeScript 5.9, expo-router 6) with email/password auth and a Supabase (Postgres) cloud backend. `plan.md` (Thai) is the source of truth for what's next — **Phase 3** (share / discover / copy public decks) has not been started.

SDK is pinned to **54** deliberately: the target device runs Expo Go for SDK 54, and Expo Go only loads its own SDK. Do not bump the Expo SDK without confirming the device's Expo Go version first (a mismatch makes the app refuse to open). Bumping the SDK means `npx expo install expo@<sdk>` then `npx expo install --fix`.

### Supabase setup (required to run)

The app needs a Supabase project. `lib/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env` (gitignored; see `.env.example`). Until real values are present, `isSupabaseConfigured` is false and the login screen shows a setup notice instead of the form. The full schema + RLS lives in `supabase/schema.sql` — run it once in the Supabase SQL editor. After editing `.env` you must restart `npm start` (Expo inlines `EXPO_PUBLIC_*` at bundle time).

### Layout

Routes are in root-level `app/` (expo-router, file-based — not `src/app/`). Shared code sits in root `components/`, `constants/`, `hooks/`, `lib/`.

- `lib/supabase.ts` — the shared Supabase client (session persisted in AsyncStorage) plus `unwrap()`, which throws on a Postgrest error and returns `data`. **All data-layer calls go through `unwrap`.**
- `lib/` data layer — `folders.ts`, `decks.ts`, `cards.ts`, `profiles.ts`, `types.ts`. Pure async functions over the Supabase client; **no React imports**. Screens import from here and never touch the client directly. `owner_id` is **never set client-side** — the DB column defaults to `auth.uid()`, and RLS enforces ownership.
- IDs are Supabase **uuids (strings)**, not numbers. Route params are used as-is (no `Number(...)`).
- `lib/auth.tsx` — `AuthProvider` + `useAuth()` (session, `signIn`/`signUp`/`signOut`). `app/_layout.tsx`'s `RootNavigator` redirects between `(auth)` and the app based on session (the standard expo-router auth-group guard).
- Routes: `app/(auth)/login.tsx` (sign in/up). `app/(tabs)/` = three tabs (`index` = Library browser, `study` = pick-a-deck list, `profile` = account + logout). Detail screens in the root stack: `app/folder/[id].tsx`, `app/deck/[id].tsx`, `app/study/[deckId].tsx`.
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
