import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import { createHabit } from "@/lib/db/repositories/habits";
import {
  deleteReminderByHabitId,
  getReminderByHabitId,
  listAllReminders,
  listRemindersForUser,
  upsertReminder,
} from "@/lib/db/repositories/reminders";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

const USER = "user-1";

async function makeHabit(db: SQLiteDatabase, id = "habit-1") {
  await db.runAsync(
    `INSERT INTO local_habits (id, user_id, title, cue, tiny_action, start_date, habit_state, status, created_at, updated_at)
     VALUES (?, ?, 'Run', 'After coffee', 'Run 1 min', '2026-04-01', 'active', 'active', datetime('now'), datetime('now'))`,
    id, USER,
  );
}

describe("reminders repository", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    await makeHabit(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("getReminderByHabitId returns null when no reminder exists", async () => {
    expect(await getReminderByHabitId("habit-1")).toBeNull();
  });

  it("upsertReminder creates a new reminder and getReminderByHabitId retrieves it", async () => {
    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: '["notif-1","notif-2"]',
    });

    const r = await getReminderByHabitId("habit-1");
    expect(r).not.toBeNull();
    expect(r!.habit_id).toBe("habit-1");
    expect(r!.reminder_type).toBe("backup");
    expect(r!.reminder_time).toBe("09:00");
    expect(r!.notification_ids).toBe('["notif-1","notif-2"]');
  });

  it("upsertReminder on existing habit_id updates the record", async () => {
    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: '["notif-1"]',
    });

    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "daily",
      reminder_time: "12:00",
      notification_ids: '["notif-2","notif-3"]',
    });

    const r = await getReminderByHabitId("habit-1");
    expect(r!.reminder_type).toBe("daily");
    expect(r!.reminder_time).toBe("12:00");
    expect(r!.notification_ids).toBe('["notif-2","notif-3"]');
  });

  it("deleteReminderByHabitId removes the reminder", async () => {
    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: "[]",
    });

    await deleteReminderByHabitId("habit-1");
    expect(await getReminderByHabitId("habit-1")).toBeNull();
  });

  it("listAllReminders returns all rows", async () => {
    await makeHabit(db, "habit-2");
    await upsertReminder({ habit_id: "habit-1", reminder_type: "backup", reminder_time: "09:00", notification_ids: "[]" });
    await upsertReminder({ habit_id: "habit-2", reminder_type: "daily", reminder_time: "20:00", notification_ids: "[]" });

    const all = await listAllReminders();
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.habit_id).sort()).toEqual(["habit-1", "habit-2"]);
  });

  it("deleteReminderByHabitId is a no-op for a non-existent habit_id", async () => {
    await expect(deleteReminderByHabitId("ghost-habit")).resolves.not.toThrow();
  });

  it("listRemindersForUser returns reminders for a user via habit join", async () => {
    await makeHabit(db, "habit-2");
    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: "[]",
    });
    await upsertReminder({
      habit_id: "habit-2",
      reminder_type: "daily",
      reminder_time: "20:00",
      notification_ids: "[]",
    });

    const reminders = await listRemindersForUser(USER);

    expect(reminders).toHaveLength(2);
    expect(reminders.map((r) => r.habit_id).sort()).toEqual([
      "habit-1",
      "habit-2",
    ]);
  });

  it("listRemindersForUser excludes other users' reminders", async () => {
    await db.runAsync(
      `INSERT INTO local_habits (id, user_id, title, cue, tiny_action, start_date, habit_state, status, created_at, updated_at)
       VALUES ('habit-other', 'user-other', 'Read', 'After lunch', '1 page', '2026-04-01', 'active', 'active', datetime('now'), datetime('now'))`,
    );
    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: "[]",
    });
    await upsertReminder({
      habit_id: "habit-other",
      reminder_type: "daily",
      reminder_time: "21:00",
      notification_ids: "[]",
    });

    const mine = await listRemindersForUser(USER);
    expect(mine).toHaveLength(1);
    expect(mine[0].habit_id).toBe("habit-1");

    const theirs = await listRemindersForUser("user-other");
    expect(theirs).toHaveLength(1);
    expect(theirs[0].habit_id).toBe("habit-other");
  });

  it("listRemindersForUser returns [] when the user has no reminders", async () => {
    expect(await listRemindersForUser("nobody")).toEqual([]);
  });

  it("ON DELETE CASCADE removes the reminder when the habit is deleted", async () => {
    await upsertReminder({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: "[]",
    });

    await db.runAsync("DELETE FROM local_habits WHERE id = ?", "habit-1");
    expect(await getReminderByHabitId("habit-1")).toBeNull();
  });
});
