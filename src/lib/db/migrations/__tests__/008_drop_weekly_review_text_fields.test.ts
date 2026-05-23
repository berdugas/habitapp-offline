import type { SQLiteDatabase } from "expo-sqlite";

import { openDatabaseAsync } from "@/tests/setup/sqliteTestAdapter";
import { runMigrations } from "@/lib/db/migrations";
import { migrations } from "@/lib/db/migrations/index";

type TableRow = { name: string };
type ColumnRow = { name: string };
type ArchiveRow = {
  review_id: string;
  habit_id: string;
  user_id: string;
  week_start: string;
  went_well: string | null;
  was_hard: string | null;
  archived_at: string;
};

async function tableExists(db: SQLiteDatabase, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<TableRow>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    name,
  );
  return row !== null;
}

async function columnNames(
  db: SQLiteDatabase,
  table: string,
): Promise<string[]> {
  const rows = await db.getAllAsync<ColumnRow>(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

async function seedHabit(db: SQLiteDatabase, id: string, userId = "user-1") {
  await db.runAsync(
    `INSERT INTO local_habits
       (id, user_id, title, identity_phrase, cue, tiny_action,
        habit_state, status, start_date, created_at, updated_at, active_days)
     VALUES (?, ?, ?, NULL, ?, ?, 'active', 'active', '2026-04-01',
             '2026-04-01T00:00:00Z', '2026-04-01T00:00:00Z', '[1,2,3,4,5,6,7]')`,
    id,
    userId,
    `Habit ${id}`,
    "After coffee",
    "1 page",
  );
}

async function seedReviewWithText(
  db: SQLiteDatabase,
  reviewId: string,
  habitId: string,
  text: { wentWell: string | null; wasHard: string | null },
  userId = "user-1",
  weekStart = "2026-04-20",
) {
  await db.runAsync(
    `INSERT INTO local_weekly_reviews
       (id, habit_id, user_id, week_start, went_well, was_hard,
        adjustment_note, trigger_worked, tiny_action_too_hard,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, 1, 0,
             '2026-04-21T00:00:00Z', '2026-04-21T00:00:00Z')`,
    reviewId,
    habitId,
    userId,
    weekStart,
    text.wentWell,
    text.wasHard,
  );
}

describe("migration 008 — drop weekly review text fields with preservation", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await openDatabaseAsync(":memory:");
    await db.execAsync("PRAGMA foreign_keys = ON;");
    // Apply migrations 001..007 to set up the pre-008 schema (with
    // went_well / was_hard still on local_weekly_reviews).
    await runMigrations(db, migrations.slice(0, 7));
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("creates the archive table and drops the text columns from local_weekly_reviews", async () => {
    await runMigrations(db); // applies 008
    expect(await tableExists(db, "local_weekly_review_text_archive")).toBe(true);
    const reviewCols = await columnNames(db, "local_weekly_reviews");
    expect(reviewCols).not.toContain("went_well");
    expect(reviewCols).not.toContain("was_hard");
    expect(reviewCols).toEqual(
      expect.arrayContaining([
        "id",
        "habit_id",
        "user_id",
        "week_start",
        "adjustment_note",
        "trigger_worked",
        "tiny_action_too_hard",
        "created_at",
        "updated_at",
      ]),
    );
  });

  it("archives rows with non-empty went_well", async () => {
    await seedHabit(db, "h1");
    await seedReviewWithText(db, "r1", "h1", {
      wentWell: "Coffee cue worked",
      wasHard: null,
    });

    await runMigrations(db);

    const archived = await db.getAllAsync<ArchiveRow>(
      "SELECT * FROM local_weekly_review_text_archive",
    );
    expect(archived).toHaveLength(1);
    expect(archived[0]!.review_id).toBe("r1");
    expect(archived[0]!.went_well).toBe("Coffee cue worked");
    expect(archived[0]!.was_hard).toBeNull();
    expect(archived[0]!.habit_id).toBe("h1");
    expect(archived[0]!.user_id).toBe("user-1");
    expect(archived[0]!.week_start).toBe("2026-04-20");
    expect(archived[0]!.archived_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("archives rows with non-empty was_hard even when went_well is null", async () => {
    await seedHabit(db, "h1");
    await seedReviewWithText(db, "r1", "h1", {
      wentWell: null,
      wasHard: "Mornings felt rushed",
    });

    await runMigrations(db);

    const archived = await db.getAllAsync<ArchiveRow>(
      "SELECT * FROM local_weekly_review_text_archive",
    );
    expect(archived).toHaveLength(1);
    expect(archived[0]!.went_well).toBeNull();
    expect(archived[0]!.was_hard).toBe("Mornings felt rushed");
  });

  it("does NOT archive rows where both columns are null or whitespace-only", async () => {
    await seedHabit(db, "h1");
    await seedReviewWithText(db, "r-null", "h1", {
      wentWell: null,
      wasHard: null,
    });
    await seedReviewWithText(
      db,
      "r-empty",
      "h1",
      { wentWell: "", wasHard: "" },
      "user-1",
      "2026-04-27",
    );
    await seedReviewWithText(
      db,
      "r-whitespace",
      "h1",
      { wentWell: "   ", wasHard: "  " },
      "user-1",
      "2026-05-04",
    );

    await runMigrations(db);

    const archived = await db.getAllAsync<ArchiveRow>(
      "SELECT * FROM local_weekly_review_text_archive",
    );
    expect(archived).toHaveLength(0);
  });

  it("preserves the review row itself even when its text is archived (no orphan deletion)", async () => {
    await seedHabit(db, "h1");
    await seedReviewWithText(db, "r1", "h1", {
      wentWell: "Coffee cue worked",
      wasHard: null,
    });

    await runMigrations(db);

    // The review row still exists in the new table — just without the
    // text columns. The Y/N answers, adjustment_note, and timestamps
    // are preserved.
    const review = await db.getFirstAsync<{
      id: string;
      trigger_worked: number;
      tiny_action_too_hard: number;
    }>("SELECT id, trigger_worked, tiny_action_too_hard FROM local_weekly_reviews WHERE id = ?", "r1");
    expect(review).not.toBeNull();
    expect(review!.id).toBe("r1");
    expect(review!.trigger_worked).toBe(1);
    expect(review!.tiny_action_too_hard).toBe(0);
  });

  it("archives multiple rows in one migration run", async () => {
    await seedHabit(db, "h1");
    await seedHabit(db, "h2");
    await seedReviewWithText(db, "r1", "h1", {
      wentWell: "Steady",
      wasHard: null,
    });
    await seedReviewWithText(
      db,
      "r2",
      "h2",
      { wentWell: null, wasHard: "Hard on Tue" },
      "user-1",
      "2026-04-27",
    );

    await runMigrations(db);

    const archived = await db.getAllAsync<ArchiveRow>(
      "SELECT * FROM local_weekly_review_text_archive ORDER BY review_id ASC",
    );
    expect(archived).toHaveLength(2);
    expect(archived.map((r) => r.review_id)).toEqual(["r1", "r2"]);
  });
});
