import { useQuery } from "@tanstack/react-query";

import { getPreference } from "@/lib/db/repositories/preferences";
import { useHabitLogsForHabitsInRange } from "@/features/today/hooks";
import { todayDateString } from "@/utils/clock";

import {
  detectSingleMiss,
  detectStreakBreak,
  recoveryModalPreferenceKey,
  singleMissBannerPreferenceKey,
} from "./api";

import type { HabitLog } from "@/lib/db/repositories/habit_logs";

export type RecoveryHabitRef = {
  id: string;
  start_date: string;
  title: string;
};

type RecoveryCheckResult = {
  shouldShowModal: boolean;
  triggeringHabit: RecoveryHabitRef | null;
  breakRunStartDate: string | null;
  logs: HabitLog[];
};

// Checks whether the recovery modal should appear for any active habit.
// Bulk-fetches 90 days of logs for all habits, then runs detectStreakBreak
// per habit in plain JS (no hooks-in-loop). Returns logs so TodayScreen
// can forward them to useSingleMissBanner without a second subscription.
export function useRecoveryCheck(habits: RecoveryHabitRef[]): RecoveryCheckResult {
  const habitIds = habits.map((h) => h.id);
  const today = todayDateString();

  const logsQuery = useHabitLogsForHabitsInRange(habitIds, 90);
  const allLogs = logsQuery.data ?? [];

  // Partition logs by habit_id for per-habit detection.
  const logsByHabitId = new Map<string, HabitLog[]>();
  for (const log of allLogs) {
    const existing = logsByHabitId.get(log.habit_id) ?? [];
    existing.push(log);
    logsByHabitId.set(log.habit_id, existing);
  }

  // Find the first habit with a streak break.
  let triggeringHabit: RecoveryHabitRef | null = null;
  let breakRunStartDate: string | null = null;

  for (const habit of habits) {
    const habitLogs = logsByHabitId.get(habit.id) ?? [];
    const result = detectStreakBreak(habitLogs, habit.start_date, today);
    if (result.broken) {
      triggeringHabit = habit;
      breakRunStartDate = result.breakRunStartDate;
      break;
    }
  }

  const modalShownKey =
    triggeringHabit && breakRunStartDate
      ? recoveryModalPreferenceKey(triggeringHabit.id, breakRunStartDate)
      : null;

  const preferenceQuery = useQuery({
    enabled: Boolean(modalShownKey),
    queryFn: () => getPreference(modalShownKey!),
    queryKey: ["preferences", modalShownKey],
    staleTime: 0,
  });

  const shouldShowModal =
    Boolean(triggeringHabit) && preferenceQuery.data === null;

  return {
    shouldShowModal,
    triggeringHabit,
    breakRunStartDate,
    logs: allLogs,
  };
}

type SingleMissBannerResult = {
  showBanner: boolean;
  missDate: string | null;
  missingHabitId: string | null;
};

// Checks whether the single-miss reframing banner should appear for any habit.
// Accepts allLogs from useRecoveryCheck to avoid a second DB subscription.
// If the recovery modal is showing, the banner is suppressed.
export function useSingleMissBanner(
  habits: RecoveryHabitRef[],
  allLogs: HabitLog[],
  shouldShowModal: boolean,
): SingleMissBannerResult {
  const today = todayDateString();

  const logsByHabitId = new Map<string, HabitLog[]>();
  for (const log of allLogs) {
    const existing = logsByHabitId.get(log.habit_id) ?? [];
    existing.push(log);
    logsByHabitId.set(log.habit_id, existing);
  }

  let missingHabit: RecoveryHabitRef | null = null;
  let missDate: string | null = null;

  if (!shouldShowModal) {
    for (const habit of habits) {
      const habitLogs = logsByHabitId.get(habit.id) ?? [];
      const result = detectSingleMiss(habitLogs, habit.start_date, today);
      if (result.isSingleMiss) {
        missingHabit = habit;
        missDate = result.missDate;
        break;
      }
    }
  }

  const bannerDismissedKey =
    missingHabit && missDate
      ? singleMissBannerPreferenceKey(missingHabit.id, missDate)
      : null;

  const preferenceQuery = useQuery({
    enabled: Boolean(bannerDismissedKey),
    queryFn: () => getPreference(bannerDismissedKey!),
    queryKey: ["preferences", bannerDismissedKey],
    staleTime: 0,
  });

  const showBanner = Boolean(missingHabit) && preferenceQuery.data === null;

  return {
    showBanner,
    missDate,
    missingHabitId: missingHabit?.id ?? null,
  };
}
