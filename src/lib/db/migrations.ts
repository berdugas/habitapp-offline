import type { SQLiteDatabase } from "expo-sqlite";

import { migrations, type Migration } from "@/lib/db/migrations/index";
import { logger } from "@/services/logger";

/**
 * Ensures the schema_migrations bookkeeping table exists, then applies any
 * registered migrations whose IDs are not already recorded as applied.
 *
 * Each migration runs inside its own transaction — if the SQL fails, the
 * transaction rolls back and the row in schema_migrations is never written,
 * so the next launch retries cleanly.
 *
 * Forward-only: there is no "down" path. To undo a migration, write a new
 * one that compensates.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = await db.getAllAsync<{ id: number }>(
    "SELECT id FROM schema_migrations ORDER BY id ASC",
  );
  const appliedIds = new Set(appliedRows.map((row) => row.id));

  const pending = migrations.filter((m) => !appliedIds.has(m.id));

  if (pending.length === 0) {
    logger.info("DB migrations: up to date", {
      applied: appliedIds.size,
    });
    return;
  }

  logger.info("DB migrations: applying pending", {
    pending: pending.map((m) => m.name),
  });

  for (const migration of pending) {
    await applyMigration(db, migration);
  }

  logger.info("DB migrations: complete", {
    applied: appliedIds.size + pending.length,
  });
}

async function applyMigration(
  db: SQLiteDatabase,
  migration: Migration,
): Promise<void> {
  try {
    if (migration.raw) {
      // Raw migrations run outside a transaction so DDL like PRAGMA foreign_keys = OFF
      // can take effect. The schema_migrations bookkeeping row is inserted separately.
      await db.execAsync(migration.up);
      await db.runAsync(
        "INSERT INTO schema_migrations (id, name) VALUES (?, ?)",
        migration.id,
        migration.name,
      );
    } else {
      await db.withTransactionAsync(async () => {
        await db.execAsync(migration.up);
        await db.runAsync(
          "INSERT INTO schema_migrations (id, name) VALUES (?, ?)",
          migration.id,
          migration.name,
        );
      });
    }
    logger.info("DB migration applied", {
      id: migration.id,
      name: migration.name,
    });
  } catch (error) {
    logger.error("DB migration failed", {
      id: migration.id,
      name: migration.name,
      error,
    });
    throw error;
  }
}
