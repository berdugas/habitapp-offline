import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import { createHabit } from "@/lib/db/repositories/habits";
import {
  deleteLog,
  getLog,
  listLogs,
  listLogsByUser,
  upsertLog,
  type UpsertLogInput,
} from "@/lib/db/repositories/habit_logs";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

async function seedHabit(db: SQLiteDatabase, userId = "user-1"): Promise<string> {
  // Insert directly so we don't depend on the habits repo mock path.
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_habits
       (id, user_id, title, cue, tiny_action, habit_state, status, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    "Meditate",
    "After coffee",
    "2 minutes",
    "active",
    "active",
    "2026-04-29",
    now,
    now,
  );
  return id;
}

function makeLogInput(
  habitId: string,
  overrides: Partial<UpsertLogInput> = {},
): UpsertLogInput {
  return {
    habit_id: habitId,
    user_id: "user-1",
    log_date: "2026-04-29",
    status: "done",
    ...overrides,
  };
}

describe("habit_logs repository", () => {
  let db: SQLiteDatabase;
  let habitId: string;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    habitId = await seedHabit(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("upsertLog inserts a new row when (user, habit, date) is unique", async () => {
    const log = await upsertLog(makeLogInput(habitId));

    expect(log.id).toBeTruthy();
    expect(log.habit_id).toBe(habitId);
    expect(log.status).toBe("done");
    expect(log.created_at).toBeTruthy();
    expect(log.updated_at).toBeTruthy();
  });

  it("upsertLog on collision updates status and updated_at but preserves id and created_at", async () => {
    const first = await upsertLog(makeLogInput(habitId, { status: "done" }));

    await new Promise((r) => setTimeout(r, 5));
    const second = await upsertLog(makeLogInput(habitId, { status: "skipped" }));

    expect(second.id).toBe(first.id);
    expect(second.created_at).toBe(first.created_at);
    expect(second.status).toBe("skipped");
    expect(second.updated_at > first.updated_at).toBe(true);
  });

  it("upsertLog on collision updates note", async () => {
    await upsertLog(makeLogInput(habitId, { note: "felt good" }));
    const updated = await upsertLog(makeLogInput(habitId, { note: "felt great" }));

    expect(updated.note).toBe("felt great");
  });

  it("getLog returns the log for matching args", async () => {
    await upsertLog(makeLogInput(habitId));

    const log = await getLog({
      habit_id: habitId,
      user_id: "user-1",
      log_date: "2026-04-29",
    });
    expect(log).not.toBeNull();
    expect(log!.habit_id).toBe(habitId);
  });

  it("getLog returns null when no match exists", async () => {
    const log = await getLog({
      habit_id: habitId,
      user_id: "user-1",
      log_date: "2000-01-01",
    });
    expect(log).toBeNull();
  });

  it("listLogs returns logs in descending log_date order", async () => {
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-27" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-29" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-28" }));

    const logs = await listLogs({ habit_id: habitId });
    const dates = logs.map((l) => l.log_date);
    expect(dates).toEqual(["2026-04-29", "2026-04-28", "2026-04-27"]);
  });

  it("listLogs with from_date and to_date filters inclusively", async () => {
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-26" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-27" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-28" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-29" }));

    const logs = await listLogs({
      habit_id: habitId,
      from_date: "2026-04-27",
      to_date: "2026-04-28",
    });
    const dates = logs.map((l) => l.log_date);
    expect(dates).toEqual(["2026-04-28", "2026-04-27"]);
  });

  it("listLogs with limit returns at most that many rows", async () => {
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-27" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-28" }));
    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-29" }));

    const logs = await listLogs({ habit_id: habitId, limit: 2 });
    expect(logs).toHaveLength(2);
  });

  it("listLogsByUser returns logs across multiple habits for one user", async () => {
    const habitId2 = await seedHabit(db);

    await upsertLog(makeLogInput(habitId, { log_date: "2026-04-29" }));
    await upsertLog(makeLogInput(habitId2, { log_date: "2026-04-28" }));

    const logs = await listLogsByUser({ user_id: "user-1" });
    expect(logs).toHaveLength(2);
    const ids = new Set(logs.map((l) => l.habit_id));
    expect(ids).toContain(habitId);
    expect(ids).toContain(habitId2);
  });

  it("deleteLog removes the row by id and returns true", async () => {
    const log = await upsertLog(makeLogInput(habitId));
    const deleted = await deleteLog(log.id);

    expect(deleted).toBe(true);
    expect(await getLog({
      habit_id: habitId,
      user_id: "user-1",
      log_date: "2026-04-29",
    })).toBeNull();
  });

  it("deleteLog returns false when the id does not exist", async () => {
    expect(await deleteLog("does-not-exist")).toBe(false);
  });

  it("declares status and habit foreign-key constraints in the schema", async () => {
    const row = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'local_habit_logs'",
    );

    expect(row?.sql).toContain("status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'missed'))");
    expect(row?.sql).toContain("FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE");
  });
});
