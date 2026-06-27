import * as SQLite from 'expo-sqlite';

/**
 * Single shared SQLite connection for the whole app.
 *
 * The data layer (everything under `lib/`) talks to the database through
 * `getDatabase()` only — UI components never open or query the DB directly.
 * That separation is what lets Phase 2 swap this file out for Supabase
 * without touching the screens.
 */

const DATABASE_NAME = 'flashcards.db';

/**
 * Ordered list of migrations. The array index + 1 is the schema version, so
 * never reorder or delete entries — only append new ones.
 */
const MIGRATIONS: ((db: SQLite.SQLiteDatabase) => Promise<void>)[] = [
  // v1 — initial local schema (folders / decks / cards)
  async (db) => {
    await db.execAsync(`
      CREATE TABLE folders (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id  INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE decks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        description TEXT,
        created_at  INTEGER NOT NULL
      );

      CREATE TABLE cards (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id    INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        front      TEXT NOT NULL,
        back       TEXT NOT NULL,
        position   INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX idx_folders_parent ON folders(parent_id);
      CREATE INDEX idx_decks_folder ON decks(folder_id);
      CREATE INDEX idx_cards_deck ON cards(deck_id);
    `);
  },
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  // Foreign keys are off by default in SQLite and the setting is per-connection,
  // so it must be enabled on every open. This is what makes ON DELETE CASCADE
  // recursively clean up nested folders / decks / cards.
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = result?.user_version ?? 0;

  for (let version = currentVersion; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[version](db);
    });
    // PRAGMA can't be parameterized; version is an integer we control.
    await db.execAsync(`PRAGMA user_version = ${version + 1};`);
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Returns the shared, migrated database connection (opened lazily once). */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}
