# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

Phase 0 is **done**: the Expo app is scaffolded at the repo root (Expo SDK 56, React Native 0.85, React 19, TypeScript 6, expo-router with a tabs layout). `plan.md` (Thai) remains the source of truth for what to build next — Phase 1 (core local app on `expo-sqlite`) is the next milestone and has not been started.

Routes live in `src/app/` (expo-router, file-based). The default template still ships its starter screens (`index.tsx`, `explore.tsx`); these get replaced in Phase 1 by the three-tab structure from the plan (คลังของฉัน / เรียน / โปรไฟล์).

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
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`); prefer it over long relative imports.
- `AGENTS.md` warns that Expo APIs change between versions — check the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing Expo-specific code.
- `expo-env.d.ts` is generated and gitignored; recreate it with `/// <reference types="expo/types" />` if a typecheck complains about missing `.css`/`.module.css` module declarations.
