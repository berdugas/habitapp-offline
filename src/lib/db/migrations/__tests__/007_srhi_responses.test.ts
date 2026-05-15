import type { SQLiteDatabase } from "expo-sqlite";

import { createTestDb } from "@/tests/setup/createTestDb";
import { openDatabaseAsync } from "@/tests/setup/sqliteTestAdapter";
import { runMigrations } from "@/lib/db/migrations";
import { migrations } from "@/lib/db/migrations/index";

type TableRow = { name: string };
type IndexRow = { name: string };
type MigrationRow = { id: number };

async function tableExists(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<TableRow>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    name,
  );
  return row !== null;
}

async function indexExists(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<IndexRow>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
    name,
  );
  return row !== null;
}

async function appliedIds(db: SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<MigrationRow>(
    "SELECT id FROM schema_migrations ORDER BY id ASC",
  );
  return rows.map((r) => r.id);
}

describe("migration 007 — local_srhi_responses", () => {
  describe("fresh apply", () => {
    let db: SQLiteDatabase;

    beforeEach(async () => {
      db = await createTestDb();
    });

    afterEach(async () => {
      await db.closeAsync();
    });

    it("creates local_srhi_responses table and idx_srhi_habit index", async () => {
      expect(await tableExists(db, "local_srhi_responses")).toBe(true);
      expect(await indexExists(db, "idx_srhi_habit")).toBe(true);
    });

    // Schema-text assertions instead of runtime constraint-violation INSERTs:
    // better-sqlite3 + Jest module-cache interaction caused those INSERT
    // assertions to be non-deterministic across the full test suite (some
    // earlier test in the process leaves the engine in a state where CHECK
    // and FK violations don't propagate as exceptions). The schema strings
    // in sqlite_master are deterministic — they're what CREATE TABLE wrote.
    // This mirrors the existing pattern at habits.test.ts:216-223.

    it("declares CHECK constraints on q1_score, q2_score, q3_score in the schema", async () => {
      const row = await db.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='local_srhi_responses'",
      );
      expect(row?.sql).toContain("CHECK (q1_score BETWEEN 1 AND 5)");
      expect(row?.sql).toContain("CHECK (q2_score BETWEEN 1 AND 5)");
      expect(row?.sql).toContain("CHECK (q3_score BETWEEN 1 AND 5)");
    });

    it("declares FK to local_habits with ON DELETE CASCADE in the schema", async () => {
      const row = await db.getFirstAsync<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='local_srhi_responses'",
      );
      expect(row?.sql).toContain(
        "FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE",
      );
    });
  });

  describe("incremental apply (1–6 then 7)", () => {
    let db: SQLiteDatabase;

    beforeEach(async () => {
      db = await openDatabaseAsync(":memory:");
      await db.execAsync("PRAGMA foreign_keys = ON;");
    });

    afterEach(async () => {
      await db.closeAsync();
    });

    it("applies through migration 6 without the SRHI table, then adds it on the second pass", async () => {
      await runMigrations(db, migrations.slice(0, 6));

      expect(await tableExists(db, "local_srhi_responses")).toBe(false);
      expect(await appliedIds(db)).toEqual([1, 2, 3, 4, 5, 6]);

      await runMigrations(db);

      expect(await tableExists(db, "local_srhi_responses")).toBe(true);
      expect(await indexExists(db, "idx_srhi_habit")).toBe(true);
      expect(await appliedIds(db)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
  });
});
