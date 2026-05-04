// Mock expo-notifications before any imports
const mockScheduleNotification = jest.fn().mockResolvedValue("notif-id-1");
const mockCancelScheduledNotification = jest.fn().mockResolvedValue(undefined);
const mockDismissNotification = jest.fn().mockResolvedValue(undefined);
const mockRequestPermissions = jest.fn().mockResolvedValue({ status: "granted" });

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { WEEKLY: "weekly" },
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotification(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotification(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismissNotification(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
}));

jest.mock("@/lib/db/repositories/reminders");
jest.mock("@/lib/db/repositories/habits");
jest.mock("@/lib/db/repositories/habit_logs");
jest.mock("@/lib/db/repositories/preferences");

import {
  cancelReminder,
  handleForegroundNotification,
  hasBeenPrompted,
  markPrompted,
  requestPermission,
  scheduleReminder,
} from "@/features/reminders/notifications";
import { getBackupNotificationBody, getDailyNotificationBody } from "@/features/reminders/copy";
import * as remindersRepo from "@/lib/db/repositories/reminders";
import * as habitsRepo from "@/lib/db/repositories/habits";
import * as logsRepo from "@/lib/db/repositories/habit_logs";
import * as prefsRepo from "@/lib/db/repositories/preferences";

const mockGetReminderByHabitId = remindersRepo.getReminderByHabitId as jest.Mock;
const mockUpsertReminder = remindersRepo.upsertReminder as jest.Mock;
const mockListAllReminders = remindersRepo.listAllReminders as jest.Mock;
const mockGetHabit = habitsRepo.getHabit as jest.Mock;
const mockListLogsForHabitInRange = logsRepo.listLogsForHabitInRange as jest.Mock;
const mockGetPreference = prefsRepo.getPreference as jest.Mock;
const mockSetPreference = prefsRepo.setPreference as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetReminderByHabitId.mockResolvedValue(null);
  mockUpsertReminder.mockResolvedValue(undefined);
  mockListAllReminders.mockResolvedValue([]);
  mockGetHabit.mockResolvedValue({ id: "habit-1", title: "Run", active_days: "[1,2,3,4,5,6,7]", user_id: "user-1" });
  mockListLogsForHabitInRange.mockResolvedValue([]);
  mockGetPreference.mockResolvedValue(null);
  mockSetPreference.mockResolvedValue(undefined);
});

describe("requestPermission", () => {
  it("returns true when permissions are granted", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "granted" });
    expect(await requestPermission()).toBe(true);
  });

  it("returns false when permissions are denied", async () => {
    mockRequestPermissions.mockResolvedValue({ status: "denied" });
    expect(await requestPermission()).toBe(false);
  });
});

describe("hasBeenPrompted / markPrompted", () => {
  it("hasBeenPrompted returns false when preference is absent", async () => {
    mockGetPreference.mockResolvedValue(null);
    expect(await hasBeenPrompted()).toBe(false);
  });

  it("hasBeenPrompted returns true after markPrompted", async () => {
    mockGetPreference.mockResolvedValue("true");
    expect(await hasBeenPrompted()).toBe(true);
  });

  it("markPrompted calls setPreference with 'true'", async () => {
    await markPrompted();
    expect(mockSetPreference).toHaveBeenCalledWith("notifications.permission_prompted", "true");
  });
});

describe("scheduleReminder", () => {
  it("schedules one notification per active day (MWF → 3 notifications)", async () => {
    mockScheduleNotification.mockResolvedValueOnce("id-1").mockResolvedValueOnce("id-2").mockResolvedValueOnce("id-3");

    await scheduleReminder("habit-1", "user-1", "daily", "09:00", [1, 3, 5]);

    expect(mockScheduleNotification).toHaveBeenCalledTimes(3);
    expect(mockUpsertReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        habit_id: "habit-1",
        reminder_type: "daily",
        reminder_time: "09:00",
        notification_ids: JSON.stringify(["id-1", "id-2", "id-3"]),
      }),
    );
  });

  it("schedules 7 notifications for an every-day habit", async () => {
    mockScheduleNotification.mockResolvedValue("id-x");

    await scheduleReminder("habit-1", "user-1", "backup", "12:00", [1, 2, 3, 4, 5, 6, 7]);

    expect(mockScheduleNotification).toHaveBeenCalledTimes(7);
  });

  it("cancels existing notifications before scheduling new ones", async () => {
    mockGetReminderByHabitId.mockResolvedValue({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: '["old-1","old-2"]',
    });

    await scheduleReminder("habit-1", "user-1", "daily", "10:00", [1]);

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith("old-1");
    expect(mockCancelScheduledNotification).toHaveBeenCalledWith("old-2");
  });
});

describe("cancelReminder", () => {
  it("cancels all notification IDs in the JSON array", async () => {
    mockGetReminderByHabitId.mockResolvedValue({
      habit_id: "habit-1",
      reminder_type: "backup",
      reminder_time: "09:00",
      notification_ids: '["notif-a","notif-b","notif-c"]',
    });

    await cancelReminder("habit-1");

    expect(mockCancelScheduledNotification).toHaveBeenCalledWith("notif-a");
    expect(mockCancelScheduledNotification).toHaveBeenCalledWith("notif-b");
    expect(mockCancelScheduledNotification).toHaveBeenCalledWith("notif-c");
  });

  it("is a no-op when no reminder exists", async () => {
    mockGetReminderByHabitId.mockResolvedValue(null);
    await cancelReminder("habit-1");
    expect(mockCancelScheduledNotification).not.toHaveBeenCalled();
  });

  it("updates reminder_type to 'none' and clears notification_ids after cancel", async () => {
    mockGetReminderByHabitId.mockResolvedValue({
      habit_id: "habit-1",
      reminder_type: "daily",
      reminder_time: "09:00",
      notification_ids: '["notif-1"]',
    });

    await cancelReminder("habit-1");

    expect(mockUpsertReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        habit_id: "habit-1",
        reminder_type: "none",
        reminder_time: null,
        notification_ids: "[]",
      }),
    );
  });
});

describe("handleForegroundNotification — backup suppression", () => {
  function makeNotification(reminderType: string, habitId = "habit-1") {
    return {
      request: {
        identifier: "notif-xyz",
        content: { data: { habitId, reminderType } },
      },
    } as any;
  }

  it("backup: suppresses notification if habit is already logged today", async () => {
    mockListLogsForHabitInRange.mockResolvedValue([
      { status: "done", log_date: "2026-04-23" },
    ]);

    const shouldShow = await handleForegroundNotification(
      makeNotification("backup"),
      "user-1",
    );

    expect(shouldShow).toBe(false);
    expect(mockDismissNotification).toHaveBeenCalledWith("notif-xyz");
  });

  it("backup: shows notification if habit is NOT yet logged today", async () => {
    mockListLogsForHabitInRange.mockResolvedValue([]);

    const shouldShow = await handleForegroundNotification(
      makeNotification("backup"),
      "user-1",
    );

    expect(shouldShow).toBe(true);
    expect(mockDismissNotification).not.toHaveBeenCalled();
  });

  it("daily: always shows regardless of log status", async () => {
    mockListLogsForHabitInRange.mockResolvedValue([
      { status: "done", log_date: "2026-04-23" },
    ]);

    const shouldShow = await handleForegroundNotification(
      makeNotification("daily"),
      "user-1",
    );

    expect(shouldShow).toBe(true);
    expect(mockDismissNotification).not.toHaveBeenCalled();
  });

  it("returns true and does nothing when notification data is absent", async () => {
    const notification = {
      request: { identifier: "notif-xyz", content: { data: undefined } },
    } as any;
    expect(await handleForegroundNotification(notification, "user-1")).toBe(true);
  });
});

describe("notification copy — no streak-loss language", () => {
  const STREAK_WORDS = ["streak", "broke", "lost", "broken", "miss", "fail"];

  it("backup copy templates contain no streak-related negative language", () => {
    for (let seed = 0; seed < 5; seed++) {
      const body = getBackupNotificationBody("Run", seed);
      STREAK_WORDS.forEach((word) => {
        expect(body.toLowerCase()).not.toContain(word);
      });
    }
  });

  it("daily copy templates contain no streak-related negative language", () => {
    for (let seed = 0; seed < 5; seed++) {
      const body = getDailyNotificationBody("Meditate", seed);
      STREAK_WORDS.forEach((word) => {
        expect(body.toLowerCase()).not.toContain(word);
      });
    }
  });
});
