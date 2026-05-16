const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();

jest.mock("expo-notifications", () => ({
  __esModule: true,
  SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
  scheduleNotificationAsync: (...args: unknown[]) =>
    mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) =>
    mockCancelScheduledNotificationAsync(...args),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
}));

import {
  materializePendingReminder,
  persistReminderIntent,
} from "@/features/reminders/notifications";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit } from "@/lib/db/repositories/habits";
import {
  getReminderByHabitId,
  upsertReminder,
} from "@/lib/db/repositories/reminders";

async function seedHabit() {
  return createHabit({
    user_id: "user-1",
    title: "Run",
    identity_phrase: "a runner",
    cue: "after coffee",
    tiny_action: "run for 2 minutes",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: "2026-05-01",
    habit_state: "active",
    status: "active",
  });
}

describe("reminders/notifications — backlog intent helpers", () => {
  beforeEach(async () => {
    await initDb();
    mockScheduleNotificationAsync.mockClear();
    mockCancelScheduledNotificationAsync.mockClear();
    mockScheduleNotificationAsync.mockResolvedValue("noti-id-1");
  });

  afterEach(async () => {
    await closeDb();
  });

  describe("persistReminderIntent", () => {
    it("writes a row with reminder_type='none', the given time, and empty notification_ids", async () => {
      const habit = await seedHabit();

      await persistReminderIntent(habit.id, "08:30");

      const row = await getReminderByHabitId(habit.id);
      expect(row).not.toBeNull();
      expect(row!.reminder_type).toBe("none");
      expect(row!.reminder_time).toBe("08:30");
      expect(row!.notification_ids).toBe("[]");
    });

    it("does not schedule any OS notifications", async () => {
      const habit = await seedHabit();
      await persistReminderIntent(habit.id, "09:00");
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it("upserts on subsequent calls", async () => {
      const habit = await seedHabit();
      await persistReminderIntent(habit.id, "08:00");
      await persistReminderIntent(habit.id, "10:00");

      const row = await getReminderByHabitId(habit.id);
      expect(row!.reminder_time).toBe("10:00");
    });
  });

  describe("materializePendingReminder", () => {
    it("returns false when no intent row exists", async () => {
      const habit = await seedHabit();
      const result = await materializePendingReminder(habit.id, "user-1", [
        1, 2, 3, 4, 5, 6, 7,
      ]);
      expect(result).toBe(false);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it("reads the persisted intent and schedules with 'daily' type", async () => {
      const habit = await seedHabit();
      await persistReminderIntent(habit.id, "07:45");

      const result = await materializePendingReminder(habit.id, "user-1", [1, 2, 3, 4, 5]);

      expect(result).toBe(true);
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
      // 5 active days → 5 weekly schedules.
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(5);

      // The reminder row should now reflect daily + the scheduled ids.
      const row = await getReminderByHabitId(habit.id);
      expect(row!.reminder_type).toBe("daily");
      expect(row!.reminder_time).toBe("07:45");
      const ids: string[] = JSON.parse(row!.notification_ids);
      expect(ids.length).toBe(5);
    });

    it("returns false AND preserves the intent when every per-day schedule fails", async () => {
      // expo-notifications rejects every per-day schedule (permission denied,
      // no slots, etc.). scheduleReminder catches per-day errors and still
      // upserts the row at the end, but with notification_ids='[]'. The helper
      // must detect that and restore the original intent so a later retry
      // (e.g. the user grants permission and tries again) can pick it up.
      mockScheduleNotificationAsync.mockRejectedValue(new Error("permission denied"));
      const habit = await seedHabit();
      await persistReminderIntent(habit.id, "07:45");

      const result = await materializePendingReminder(habit.id, "user-1", [1, 2, 3, 4, 5]);

      expect(result).toBe(false);

      const row = await getReminderByHabitId(habit.id);
      expect(row).not.toBeNull();
      expect(row!.reminder_type).toBe("none");
      expect(row!.reminder_time).toBe("07:45");
      expect(row!.notification_ids).toBe("[]");
    });

    it("returns false AND preserves the intent when scheduleReminder itself throws", async () => {
      // Force scheduleReminder to throw (simulate an unexpected internal
      // failure). The intent must still survive so a later retry can find it.
      mockScheduleNotificationAsync.mockImplementation(() => {
        throw new Error("synchronous failure");
      });
      const habit = await seedHabit();
      await persistReminderIntent(habit.id, "07:45");

      const result = await materializePendingReminder(habit.id, "user-1", [1, 2, 3, 4, 5]);

      expect(result).toBe(false);

      const row = await getReminderByHabitId(habit.id);
      expect(row!.reminder_type).toBe("none");
      expect(row!.reminder_time).toBe("07:45");
    });

    it("returns false when an existing reminder row is already type='daily'", async () => {
      const habit = await seedHabit();
      await upsertReminder({
        habit_id: habit.id,
        reminder_type: "daily",
        reminder_time: "09:00",
        notification_ids: "[\"abc\"]",
      });

      const result = await materializePendingReminder(habit.id, "user-1", [1]);
      expect(result).toBe(false);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
