import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabaseAsync } from "@/tests/setup/sqliteTestAdapter";
import { runMigrations } from "@/lib/db/migrations";

/**
 * Creates a fresh in-memory SQLite DB, enables foreign-key enforcement,
 * and runs all registered migrations against it.
 *
 * Each call returns a fully isolated database — use in `beforeEach` so no
 * test state leaks between cases.
 */
export async function createTestDb(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(":memory:");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  return db;
}
