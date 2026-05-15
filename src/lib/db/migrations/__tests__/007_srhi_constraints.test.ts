import type { SQLiteDatabase } from "expo-sqlite";

import { createTestDb } from "@/tests/setup/createTestDb";

// Runtime smoke tests for the schema-declared CHECK and FK enforcement on
// local_srhi_responses. These complement the schema-text assertions in
// 007_srhi_responses.test.ts — that file proves the constraints are
// declared in CREATE TABLE; this file proves SQLite actually rejects bad
// writes. Each test re-enables both pragmas explicitly, uses raw runAsync
// (no mocked getDb), and inserts via independent SQL strings so prepared-
// statement caching cannot mask a regression.

async function seedHabit(db: SQLiteDatabase): Promise<string> {
  const id = "habit-seed";
  await db.runAsync(
    `INSERT INTO local_habits (
       id, user_id, title, cue, tiny_action, habit_state, status,
       active_days, start_date, created_at, updated_at
     ) VALUES (?, 'u', 't', 'c', 'ta', 'active', 'active',
       '[1,2,3,4,5,6,7]', '2026-01-01', '2026-01-01T00:00:00.000Z',
       '2026-01-01T00:00:00.000Z')`,
    id,
  );
  return id;
}

describe("local_srhi_responses runtime constraints", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await db.execAsync("PRAGMA ignore_check_constraints = 0;");
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("rejects q1_score below 1 (CHECK)", async () => {
    await db.execAsync("PRAGMA ignore_check_constraints = 0;");
    const habitId = await seedHabit(db);
    await expect(
      db.runAsync(
        `INSERT INTO local_srhi_responses
           (id, habit_id, user_id, q1_score, q2_score, q3_score, average_score, graduated, created_at)
         VALUES ('r-low', ?, 'u', 0, 3, 3, 2.0, 0, '2026-05-01T00:00:00.000Z')`,
        habitId,
      ),
    ).rejects.toThrow(/CHECK|constraint/i);
  });

  it("rejects q1_score above 5 (CHECK)", async () => {
    await db.execAsync("PRAGMA ignore_check_constraints = 0;");
    const habitId = await seedHabit(db);
    await expect(
      db.runAsync(
        `INSERT INTO local_srhi_responses
           (id, habit_id, user_id, q1_score, q2_score, q3_score, average_score, graduated, created_at)
         VALUES ('r-high', ?, 'u', 6, 3, 3, 4.0, 0, '2026-05-01T00:00:00.000Z')`,
        habitId,
      ),
    ).rejects.toThrow(/CHECK|constraint/i);
  });

  it("rejects an SRHI row referencing a non-existent habit_id (FK)", async () => {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    await expect(
      db.runAsync(
        `INSERT INTO local_srhi_responses
           (id, habit_id, user_id, q1_score, q2_score, q3_score, average_score, graduated, created_at)
         VALUES ('r-orphan', 'missing-habit', 'u', 4, 4, 4, 4.0, 1, '2026-05-01T00:00:00.000Z')`,
      ),
    ).rejects.toThrow(/FOREIGN KEY|constraint/i);
  });

  it("cascades deletes from local_habits to local_srhi_responses", async () => {
    await db.execAsync("PRAGMA foreign_keys = ON;");
    const habitId = await seedHabit(db);
    await db.runAsync(
      `INSERT INTO local_srhi_responses
         (id, habit_id, user_id, q1_score, q2_score, q3_score, average_score, graduated, created_at)
       VALUES ('r-keep', ?, 'u', 5, 5, 5, 5.0, 1, '2026-05-01T00:00:00.000Z')`,
      habitId,
    );

    await db.runAsync("DELETE FROM local_habits WHERE id = ?", habitId);

    const remaining = await db.getAllAsync(
      "SELECT id FROM local_srhi_responses WHERE habit_id = ?",
      habitId,
    );
    expect(remaining).toHaveLength(0);
  });
});
