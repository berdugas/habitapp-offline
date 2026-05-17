import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { toDeviceDateString } from "@/utils/dates";
import type { Habit } from "@/lib/db/repositories/habits";
import { listHabits } from "@/lib/db/repositories/habits";
import type { HabitLog } from "@/lib/db/repositories/habit_logs";
import { listLogsByUser } from "@/lib/db/repositories/habit_logs";
import type { Preference } from "@/lib/db/repositories/preferences";
import { listPreferences } from "@/lib/db/repositories/preferences";
import type { ReminderSetting } from "@/lib/db/repositories/reminders";
import { listRemindersForUser } from "@/lib/db/repositories/reminders";
import type { SRHIResponse } from "@/lib/db/repositories/srhi_responses";
import { getSRHIResponsesForUser } from "@/lib/db/repositories/srhi_responses";
import type { WeeklyReviewRecord } from "@/lib/db/repositories/weekly_reviews";
import { listReviewsForUser } from "@/lib/db/repositories/weekly_reviews";

export type ExportErrorCode = "no_user" | "sharing_unavailable";

export class ExportError extends Error {
  code: ExportErrorCode;
  constructor(code: ExportErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ExportError";
  }
}

export type HabitsExportDocument = {
  exportVersion: 1;
  exportedAt: string;
  appVersion: string;
  userId: string;

  habits: Habit[];
  habitLogs: HabitLog[];
  weeklyReviews: WeeklyReviewRecord[];
  srhiResponses: SRHIResponse[];
  reminderSettings: ReminderSetting[];
  preferences: Preference[];

  summary: {
    totalHabits: number;
    activeHabits: number;
    graduatedHabits: number;
    archivedHabits: number;
    backlogHabits: number;
    totalLogs: number;
    totalReviews: number;
    totalSRHIResponses: number;
    oldestHabitDate: string | null;
    newestLogDate: string | null;
  };
};

export async function buildExportDocument(
  userId: string,
): Promise<HabitsExportDocument> {
  const habits = await listHabits({ user_id: userId });
  const habitLogs = await listLogsByUser({ user_id: userId });
  const weeklyReviews = await listReviewsForUser(userId);
  const srhiResponses = await getSRHIResponsesForUser(userId);
  const reminderSettings = await listRemindersForUser(userId);
  // local_user_preferences has no user_id column — preferences are global to the device.
  const preferences = await listPreferences();

  const activeHabits = habits.filter(
    (h) => h.status === "active" && h.habit_state === "active",
  ).length;
  const graduatedHabits = habits.filter(
    (h) => h.status === "active" && h.habit_state === "automatic",
  ).length;
  const archivedHabits = habits.filter((h) => h.status === "archived").length;
  const backlogHabits = habits.filter((h) => h.status === "backlog").length;

  const sortedStartDates = habits
    .map((h) => h.start_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const sortedLogDates = habitLogs.map((l) => l.log_date).sort();

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? "unknown",
    userId,
    habits,
    habitLogs,
    weeklyReviews,
    srhiResponses,
    reminderSettings,
    preferences,
    summary: {
      totalHabits: habits.length,
      activeHabits,
      graduatedHabits,
      archivedHabits,
      backlogHabits,
      totalLogs: habitLogs.length,
      totalReviews: weeklyReviews.length,
      totalSRHIResponses: srhiResponses.length,
      oldestHabitDate: sortedStartDates[0] ?? null,
      newestLogDate: sortedLogDates[sortedLogDates.length - 1] ?? null,
    },
  };
}

/**
 * Auth-gated wrapper around exportAndShare. Keeping the gate as a plain async
 * function (rather than inline inside the hook) means the test surface for
 * the no_user branch is a pure function with no React Query involvement.
 *
 * The optional `share` parameter is a seam for tests — same-module calls can't
 * be intercepted via jest.mock, so the default delegates to the real
 * exportAndShare and the test passes a stub. Production callers omit it.
 */
export async function exportForUser(
  user: { id: string } | null | undefined,
  share: (userId: string) => Promise<void> = exportAndShare,
): Promise<void> {
  if (!user?.id) {
    throw new ExportError(
      "no_user",
      "You need an account session before exporting your data.",
    );
  }
  await share(user.id);
}

export async function exportAndShare(userId: string): Promise<void> {
  // Preflight before touching the filesystem so unsupported platforms surface
  // ExportError("sharing_unavailable") instead of a misleading file-system error.
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new ExportError(
      "sharing_unavailable",
      "Sharing is not available on this device.",
    );
  }

  const document = await buildExportDocument(userId);
  const json = JSON.stringify(document, null, 2);

  // Uses the legacy file-system API (`expo-file-system/legacy`). The new
  // synchronous `File`/`Paths` API in expo-file-system 19 has been observed
  // to fail silently on Android dev builds; the legacy async API matches the
  // original Sprint 19 ticket spec and works reliably across platforms.
  const fileName = `habits-export-${toDeviceDateString()}.json`;
  const filePath = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(filePath, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(filePath, {
    mimeType: "application/json",
    dialogTitle: "Export your habit data",
    UTI: "public.json",
  });
}
