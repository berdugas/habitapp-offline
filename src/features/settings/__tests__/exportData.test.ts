/**
 * Export integration tests.
 *
 * MAINTAINER NOTE: If you add a new local SQLite table that contains
 * user data, update buildExportDocument() and these tests to include it.
 * The export must be a complete snapshot of the user's local data.
 */
import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "1.2.3" },
  },
}));

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

import { buildExportDocument } from "@/features/settings/exportData";

const USER = "user-export-test";
const OTHER_USER = "user-other";

async function insertHabit(
  db: SQLiteDatabase,
  habit: {
    id: string;
    user_id?: string;
    title?: string;
    habit_state?: "active" | "automatic";
    status?: "active" | "archived" | "backlog";
    start_date?: string;
  },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_habits
       (id, user_id, title, cue, tiny_action, habit_state, status, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    habit.id,
    habit.user_id ?? USER,
    habit.title ?? "Run",
    "After coffee",
    "Run 1 minute",
    habit.habit_state ?? "active",
    habit.status ?? "active",
    habit.start_date ?? "2026-04-01",
    now,
    now,
  );
}

async function insertLog(
  db: SQLiteDatabase,
  log: {
    id: string;
    habit_id: string;
    user_id?: string;
    log_date: string;
    status?: "done" | "skipped" | "missed";
  },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_habit_logs
       (id, habit_id, user_id, log_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    log.id,
    log.habit_id,
    log.user_id ?? USER,
    log.log_date,
    log.status ?? "done",
    now,
    now,
  );
}

async function insertReview(
  db: SQLiteDatabase,
  review: {
    id: string;
    habit_id: string;
    user_id?: string;
    week_start: string;
    trigger_worked?: 0 | 1 | null;
    tiny_action_too_hard?: 0 | 1 | null;
  },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_weekly_reviews
       (id, habit_id, user_id, week_start, went_well, was_hard, adjustment_note,
        trigger_worked, tiny_action_too_hard, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
    review.id,
    review.habit_id,
    review.user_id ?? USER,
    review.week_start,
    review.trigger_worked ?? null,
    review.tiny_action_too_hard ?? null,
    now,
    now,
  );
}

async function insertSRHI(
  db: SQLiteDatabase,
  srhi: {
    id: string;
    habit_id: string;
    user_id?: string;
    graduated?: 0 | 1;
  },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_srhi_responses
       (id, habit_id, user_id, q1_score, q2_score, q3_score, average_score, graduated, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    srhi.id,
    srhi.habit_id,
    srhi.user_id ?? USER,
    5,
    5,
    5,
    5,
    srhi.graduated ?? 1,
    now,
  );
}

async function insertReminder(
  db: SQLiteDatabase,
  reminder: { id: string; habit_id: string },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_reminder_settings
       (id, habit_id, reminder_type, reminder_time, notification_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    reminder.id,
    reminder.habit_id,
    "daily",
    "09:00",
    "[]",
    now,
    now,
  );
}

async function insertPreference(
  db: SQLiteDatabase,
  pref: { key: string; value: string },
) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
    pref.key,
    pref.value,
    now,
  );
}

describe("buildExportDocument", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("produces a full export with all six tables and correct summary counts", async () => {
    // 2 active habits
    await insertHabit(db, { id: "h-active-1", start_date: "2026-01-10" });
    await insertHabit(db, { id: "h-active-2", start_date: "2026-02-20" });
    // 1 graduated habit
    await insertHabit(db, {
      id: "h-grad",
      habit_state: "automatic",
      status: "active",
      start_date: "2025-11-05",
    });
    // 1 archived habit
    await insertHabit(db, { id: "h-archived", status: "archived" });
    // 1 backlog habit
    await insertHabit(db, { id: "h-backlog", status: "backlog" });

    await insertLog(db, { id: "log-1", habit_id: "h-active-1", log_date: "2026-04-10" });
    await insertLog(db, { id: "log-2", habit_id: "h-active-1", log_date: "2026-04-12" });
    await insertLog(db, { id: "log-3", habit_id: "h-active-2", log_date: "2026-04-30" });

    await insertReview(db, {
      id: "rev-1",
      habit_id: "h-active-1",
      week_start: "2026-04-14",
      trigger_worked: 1,
      tiny_action_too_hard: 0,
    });

    await insertSRHI(db, { id: "srhi-1", habit_id: "h-grad", graduated: 1 });

    await insertReminder(db, { id: "rem-1", habit_id: "h-active-1" });
    await insertReminder(db, { id: "rem-2", habit_id: "h-active-2" });

    await insertPreference(db, { key: "onboarding_complete", value: "true" });
    await insertPreference(db, { key: "analytics_opt_out", value: "false" });
    await insertPreference(db, { key: "master_reminder_enabled", value: "true" });

    const doc = await buildExportDocument(USER);

    expect(doc.exportVersion).toBe(1);
    expect(doc.appVersion).toBe("1.2.3");
    expect(doc.userId).toBe(USER);
    expect(doc.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(doc.habits).toHaveLength(5);
    expect(doc.habitLogs).toHaveLength(3);
    expect(doc.weeklyReviews).toHaveLength(1);
    expect(doc.srhiResponses).toHaveLength(1);
    expect(doc.reminderSettings).toHaveLength(2);
    expect(doc.preferences).toHaveLength(3);

    expect(doc.summary).toEqual({
      totalHabits: 5,
      activeHabits: 2,
      graduatedHabits: 1,
      archivedHabits: 1,
      backlogHabits: 1,
      totalLogs: 3,
      totalReviews: 1,
      totalSRHIResponses: 1,
      oldestHabitDate: "2025-11-05",
      newestLogDate: "2026-04-30",
    });
  });

  it("maps boolean fields to booleans (not 0/1) for SRHI and weekly reviews", async () => {
    await insertHabit(db, { id: "h-1" });
    await insertReview(db, {
      id: "rev-1",
      habit_id: "h-1",
      week_start: "2026-04-14",
      trigger_worked: 1,
      tiny_action_too_hard: 0,
    });
    await insertReview(db, {
      id: "rev-2",
      habit_id: "h-1",
      week_start: "2026-04-21",
      trigger_worked: null,
      tiny_action_too_hard: null,
    });
    await insertSRHI(db, { id: "srhi-1", habit_id: "h-1", graduated: 1 });
    await insertSRHI(db, { id: "srhi-2", habit_id: "h-1", graduated: 0 });

    const doc = await buildExportDocument(USER);

    const r1 = doc.weeklyReviews.find((r) => r.id === "rev-1")!;
    const r2 = doc.weeklyReviews.find((r) => r.id === "rev-2")!;
    expect(r1.trigger_worked).toBe(true);
    expect(r1.tiny_action_too_hard).toBe(false);
    expect(r2.trigger_worked).toBeNull();
    expect(r2.tiny_action_too_hard).toBeNull();

    const s1 = doc.srhiResponses.find((s) => s.id === "srhi-1")!;
    const s2 = doc.srhiResponses.find((s) => s.id === "srhi-2")!;
    expect(s1.graduated).toBe(true);
    expect(s2.graduated).toBe(false);
  });

  it("computes oldestHabitDate and newestLogDate correctly across many rows", async () => {
    await insertHabit(db, { id: "h-1", start_date: "2026-03-01" });
    await insertHabit(db, { id: "h-2", start_date: "2025-12-15" });
    await insertHabit(db, { id: "h-3", start_date: "2026-04-20" });

    await insertLog(db, { id: "log-1", habit_id: "h-1", log_date: "2026-04-01" });
    await insertLog(db, { id: "log-2", habit_id: "h-2", log_date: "2026-05-10" });
    await insertLog(db, { id: "log-3", habit_id: "h-3", log_date: "2026-03-22" });

    const doc = await buildExportDocument(USER);

    expect(doc.summary.oldestHabitDate).toBe("2025-12-15");
    expect(doc.summary.newestLogDate).toBe("2026-05-10");
  });

  it("returns empty arrays and zero summary counts for an empty database", async () => {
    const doc = await buildExportDocument(USER);

    expect(doc.habits).toEqual([]);
    expect(doc.habitLogs).toEqual([]);
    expect(doc.weeklyReviews).toEqual([]);
    expect(doc.srhiResponses).toEqual([]);
    expect(doc.reminderSettings).toEqual([]);
    expect(doc.preferences).toEqual([]);

    expect(doc.summary).toEqual({
      totalHabits: 0,
      activeHabits: 0,
      graduatedHabits: 0,
      archivedHabits: 0,
      backlogHabits: 0,
      totalLogs: 0,
      totalReviews: 0,
      totalSRHIResponses: 0,
      oldestHabitDate: null,
      newestLogDate: null,
    });
  });

  it("isolates user data: user A's export excludes user B's habits/logs/reviews/SRHI/reminders", async () => {
    await insertHabit(db, { id: "h-mine", user_id: USER });
    await insertLog(db, {
      id: "log-mine",
      habit_id: "h-mine",
      user_id: USER,
      log_date: "2026-04-01",
    });
    await insertReview(db, {
      id: "rev-mine",
      habit_id: "h-mine",
      user_id: USER,
      week_start: "2026-04-14",
    });
    await insertSRHI(db, { id: "srhi-mine", habit_id: "h-mine", user_id: USER });
    await insertReminder(db, { id: "rem-mine", habit_id: "h-mine" });

    await insertHabit(db, { id: "h-theirs", user_id: OTHER_USER });
    await insertLog(db, {
      id: "log-theirs",
      habit_id: "h-theirs",
      user_id: OTHER_USER,
      log_date: "2026-04-02",
    });
    await insertReview(db, {
      id: "rev-theirs",
      habit_id: "h-theirs",
      user_id: OTHER_USER,
      week_start: "2026-04-14",
    });
    await insertSRHI(db, {
      id: "srhi-theirs",
      habit_id: "h-theirs",
      user_id: OTHER_USER,
    });
    await insertReminder(db, { id: "rem-theirs", habit_id: "h-theirs" });

    await insertPreference(db, { key: "global_pref", value: "shared" });

    const docMine = await buildExportDocument(USER);

    expect(docMine.habits.map((h) => h.id)).toEqual(["h-mine"]);
    expect(docMine.habitLogs.map((l) => l.id)).toEqual(["log-mine"]);
    expect(docMine.weeklyReviews.map((r) => r.id)).toEqual(["rev-mine"]);
    expect(docMine.srhiResponses.map((s) => s.id)).toEqual(["srhi-mine"]);
    expect(docMine.reminderSettings.map((r) => r.id)).toEqual(["rem-mine"]);

    // Preferences are global to the device (no user_id column).
    // The export deliberately includes all preferences regardless of userId.
    const docTheirs = await buildExportDocument(OTHER_USER);
    expect(docMine.preferences.map((p) => p.key)).toEqual(["global_pref"]);
    expect(docTheirs.preferences.map((p) => p.key)).toEqual(["global_pref"]);
  });

  it("is JSON-serializable: round-trips through JSON.parse(JSON.stringify(...))", async () => {
    await insertHabit(db, { id: "h-1" });
    await insertLog(db, { id: "log-1", habit_id: "h-1", log_date: "2026-04-10" });
    await insertReview(db, {
      id: "rev-1",
      habit_id: "h-1",
      week_start: "2026-04-14",
      trigger_worked: 1,
      tiny_action_too_hard: 0,
    });
    await insertSRHI(db, { id: "srhi-1", habit_id: "h-1", graduated: 1 });
    await insertReminder(db, { id: "rem-1", habit_id: "h-1" });
    await insertPreference(db, { key: "k", value: "v" });

    const doc = await buildExportDocument(USER);
    const roundTripped = JSON.parse(JSON.stringify(doc));

    expect(roundTripped).toEqual(doc);
  });

  it("partition: an archived-but-automatic habit counts as archived only, not graduated", async () => {
    // The risky case: archiveHabit() only updates `status`, leaving habit_state='automatic'.
    // The summary buckets must not double-count it.
    await insertHabit(db, {
      id: "h-archived-grad",
      status: "archived",
      habit_state: "automatic",
    });
    await insertHabit(db, {
      id: "h-active-grad",
      status: "active",
      habit_state: "automatic",
    });
    await insertHabit(db, { id: "h-active", status: "active", habit_state: "active" });
    await insertHabit(db, { id: "h-backlog", status: "backlog" });

    const doc = await buildExportDocument(USER);

    expect(doc.summary.archivedHabits).toBe(1);
    expect(doc.summary.graduatedHabits).toBe(1);
    expect(doc.summary.activeHabits).toBe(1);
    expect(doc.summary.backlogHabits).toBe(1);

    const sum =
      doc.summary.activeHabits +
      doc.summary.graduatedHabits +
      doc.summary.archivedHabits +
      doc.summary.backlogHabits;
    expect(sum).toBe(doc.summary.totalHabits);
  });
});
