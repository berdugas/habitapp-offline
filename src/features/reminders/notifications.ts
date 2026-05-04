import * as Notifications from "expo-notifications";

import { isActiveDay, parseActiveDays } from "@/features/habits/activeDays";
import {
  deleteReminderByHabitId,
  getReminderByHabitId,
  listAllReminders,
  upsertReminder,
} from "@/lib/db/repositories/reminders";
import { getPreference, setPreference } from "@/lib/db/repositories/preferences";
import { getHabit } from "@/lib/db/repositories/habits";
import { listLogsForHabitInRange } from "@/lib/db/repositories/habit_logs";
import { todayDateString } from "@/utils/clock";
import { logger } from "@/services/logger";
import { getBackupNotificationBody, getDailyNotificationBody } from "./copy";

const PERMISSION_PROMPTED_KEY = "notifications.permission_prompted";

// ISO weekday → expo-notifications weekday (Sun=1 … Sat=7)
function toExpoWeekday(isoDay: number): number {
  // ISO: Mon=1 … Sun=7 → Expo: Sun=1, Mon=2 … Sat=7
  return isoDay === 7 ? 1 : isoDay + 1;
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function hasBeenPrompted(): Promise<boolean> {
  const val = await getPreference(PERMISSION_PROMPTED_KEY);
  return val === "true";
}

export async function markPrompted(): Promise<void> {
  await setPreference(PERMISSION_PROMPTED_KEY, "true");
}

export async function scheduleReminder(
  habitId: string,
  userId: string,
  reminderType: "backup" | "daily",
  reminderTime: string,
  activeDays: number[],
): Promise<void> {
  // Cancel any existing notifications for this habit first
  await cancelReminder(habitId);

  const [hStr, mStr] = reminderTime.split(":");
  const hour = parseInt(hStr, 10);
  const minute = parseInt(mStr, 10);

  const habit = await getHabit(habitId).catch(() => null);
  const habitName = habit?.title ?? "your habit";

  const scheduledIds: string[] = [];

  for (const isoDay of activeDays) {
    const weekday = toExpoWeekday(isoDay);
    const body =
      reminderType === "backup"
        ? getBackupNotificationBody(habitName, isoDay)
        : getDailyNotificationBody(habitName, isoDay);

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Habit reminder",
          body,
          data: { habitId, reminderType },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      });
      scheduledIds.push(id);
    } catch (err) {
      logger.warn("Failed to schedule notification for day", { isoDay, err });
    }
  }

  await upsertReminder({
    habit_id: habitId,
    reminder_type: reminderType,
    reminder_time: reminderTime,
    notification_ids: JSON.stringify(scheduledIds),
  });
}

export async function cancelReminder(habitId: string): Promise<void> {
  const existing = await getReminderByHabitId(habitId);
  if (!existing) return;

  try {
    const ids: string[] = JSON.parse(existing.notification_ids);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  } catch (err) {
    logger.warn("Failed to cancel notification(s)", { habitId, err });
  }

  await upsertReminder({
    habit_id: habitId,
    reminder_type: "none",
    reminder_time: null,
    notification_ids: "[]",
  });
}

export async function rescheduleAll(userId: string): Promise<void> {
  const all = await listAllReminders();
  for (const reminder of all) {
    if (reminder.reminder_type === "none" || !reminder.reminder_time) continue;
    const habit = await getHabit(reminder.habit_id).catch(() => null);
    if (!habit || habit.user_id !== userId) continue;

    const activeDays = parseActiveDays(habit.active_days);

    await scheduleReminder(
      reminder.habit_id,
      userId,
      reminder.reminder_type,
      reminder.reminder_time,
      activeDays,
    );
  }
}

// Called from the foreground notification received listener.
// Suppresses backup reminders when today's log already exists.
export async function handleForegroundNotification(
  notification: Notifications.Notification,
  userId: string,
): Promise<boolean> {
  const data = notification.request.content.data as Record<string, unknown> | undefined;
  if (!data) return true;

  const habitId = data.habitId as string | undefined;
  const reminderType = data.reminderType as string | undefined;

  if (reminderType !== "backup" || !habitId) return true;

  try {
    const today = todayDateString();
    const logs = await listLogsForHabitInRange(habitId, today, today);
    if (logs.some((l) => l.status === "done" || l.status === "skipped")) {
      // Already logged — suppress notification
      await Notifications.dismissNotificationAsync(notification.request.identifier);
      return false;
    }
  } catch (err) {
    logger.warn("Failed to check log for backup suppression", { habitId, err });
  }

  return true;
}
