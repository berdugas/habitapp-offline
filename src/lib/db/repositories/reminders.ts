import { getDb } from "@/lib/db/client";

export type ReminderType = "none" | "backup" | "daily";

export type ReminderSetting = {
  id: string;
  habit_id: string;
  reminder_type: ReminderType;
  reminder_time: string | null;
  notification_ids: string;
  created_at: string;
  updated_at: string;
};

export type UpsertReminderInput = {
  habit_id: string;
  reminder_type: ReminderType;
  reminder_time: string | null;
  notification_ids: string;
};

export async function upsertReminder(
  input: UpsertReminderInput,
): Promise<ReminderSetting> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO local_reminder_settings
       (id, habit_id, reminder_type, reminder_time, notification_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (habit_id) DO UPDATE SET
       reminder_type = excluded.reminder_type,
       reminder_time = excluded.reminder_time,
       notification_ids = excluded.notification_ids,
       updated_at = excluded.updated_at`,
    id,
    input.habit_id,
    input.reminder_type,
    input.reminder_time,
    input.notification_ids,
    now,
    now,
  );

  return (await getReminderByHabitId(input.habit_id))!;
}

export async function getReminderByHabitId(
  habitId: string,
): Promise<ReminderSetting | null> {
  const db = getDb();
  return db.getFirstAsync<ReminderSetting>(
    "SELECT * FROM local_reminder_settings WHERE habit_id = ?",
    habitId,
  );
}

export async function deleteReminderByHabitId(habitId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "DELETE FROM local_reminder_settings WHERE habit_id = ?",
    habitId,
  );
}

export async function listAllReminders(): Promise<ReminderSetting[]> {
  const db = getDb();
  return db.getAllAsync<ReminderSetting>(
    "SELECT * FROM local_reminder_settings",
  );
}

export async function listRemindersForUser(
  userId: string,
): Promise<ReminderSetting[]> {
  const db = getDb();
  return db.getAllAsync<ReminderSetting>(
    `SELECT r.* FROM local_reminder_settings r
     INNER JOIN local_habits h ON r.habit_id = h.id
     WHERE h.user_id = ?`,
    userId,
  );
}
