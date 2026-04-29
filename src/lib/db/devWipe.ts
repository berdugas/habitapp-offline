import * as SQLite from "expo-sqlite";

import { closeDb } from "@/lib/db/client";
import { logger } from "@/services/logger";

const DB_NAME = "habits.db";

/**
 * Closes the current DB connection and deletes the underlying SQLite file.
 * The next call to `initDb()` recreates everything from scratch.
 *
 * Dev-only — no-ops in production builds (gated behind __DEV__).
 */
export async function wipeLocalDb(): Promise<void> {
  if (!__DEV__) return;

  logger.info("devWipe: closing database connection");
  await closeDb();

  logger.info("devWipe: deleting database file", { name: DB_NAME });
  await SQLite.deleteDatabaseAsync(DB_NAME);

  logger.info("devWipe: done — restart the app or call initDb() to recreate");
}
