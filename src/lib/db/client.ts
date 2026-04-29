import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import { runMigrations } from "@/lib/db/migrations";
import { logger } from "@/services/logger";

const DB_NAME = "habits.db";

let dbInstance: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Initializes the local SQLite database. Opens the connection, enables
 * foreign-key enforcement, and runs any pending migrations.
 *
 * Call once at app start (from `app/_layout.tsx`) and gate route render
 * until the returned promise resolves. Repository code should call
 * `getDb()` rather than awaiting this directly.
 *
 * Idempotent: calling more than once returns the same instance.
 * Concurrent calls share the same in-flight initialization promise.
 */
export async function initDb(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    logger.info("DB init: opening database", { name: DB_NAME });
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    // SQLite does not enforce foreign keys by default. Must be set on a
    // fresh connection, outside any transaction, before queries run.
    await db.execAsync("PRAGMA foreign_keys = ON;");

    await runMigrations(db);

    dbInstance = db;
    logger.info("DB init: ready");
    return db;
  })();

  try {
    return await initPromise;
  } catch (error) {
    // Reset so a retry is possible on next call.
    initPromise = null;
    throw error;
  }
}

/**
 * Returns the initialized SQLite database instance.
 *
 * Throws if `initDb()` has not yet completed. Repository functions and
 * other consumers should call this rather than opening their own
 * connections — the database is intended to be a single shared handle
 * for the lifetime of the app.
 */
export function getDb(): SQLiteDatabase {
  if (!dbInstance) {
    throw new Error(
      "Database not initialized. Ensure initDb() is called and awaited at app start.",
    );
  }
  return dbInstance;
}
