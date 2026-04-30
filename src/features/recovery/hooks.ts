import { useQuery } from "@tanstack/react-query";

import { getPreference } from "@/lib/db/repositories/preferences";
import { useHabitLogsForRange } from "@/features/today/hooks";
import { todayDateString } from "@/utils/clock";

import {
  detectSingleMiss,
  detectStreakBreak,
  recoveryModalPreferenceKey,
  singleMissBannerPreferenceKey,
} from "./api";

import type { HabitState } from "@/features/habits/types";
import type { HabitLog } from "@/lib/db/repositories/habit_logs";

// Minimal habit fields required by recovery detection. Satisfied by both
// HabitRecord (snake_case) and any inline adapter created from TodayHabitCardData.
export type RecoveryHabitRef = {
  id: string;
  habit_state: HabitState;
  start_date: string;
};

type RecoveryCheckResult = {
  shouldShowModal: boolean;
  breakRunStartDate: string | null;
  logs: HabitLog[];
};

// Checks whether the recovery modal should appear for the given Focus habit.
// Returns logs so TodayScreen can forward them to useSingleMissBanner without
// a second subscription.
export function useRecoveryCheck(
  habit: RecoveryHabitRef | null,
): RecoveryCheckResult {
  const isFocusHabit = habit?.habit_state === "focus";
  const logsQuery = useHabitLogsForRange(
    isFocusHabit ? habit?.id : undefined,
    90,
  );
  const logs = logsQuery.data ?? [];
  const today = todayDateString();

  const breakResult =
    habit && isFocusHabit
      ? detectStreakBreak(logs, habit.start_date, today)
      : { broken: false as const };

  const modalShownKey =
    breakResult.broken && habit
      ? recoveryModalPreferenceKey(habit.id, breakResult.breakRunStartDate)
      : null;

  const preferenceQuery = useQuery({
    enabled: Boolean(modalShownKey),
    queryFn: () => getPreference(modalShownKey!),
    queryKey: ["preferences", modalShownKey],
    staleTime: 0,
  });

  // shouldShowModal: broken AND the "shown" preference is absent from the DB.
  // preferenceQuery.data === null  → key not in DB (modal not yet shown)
  // preferenceQuery.data === "true" → key in DB (modal was shown; suppress)
  // preferenceQuery.data === undefined → disabled or still loading; suppress
  const shouldShowModal =
    breakResult.broken && preferenceQuery.data === null;

  return {
    shouldShowModal,
    breakRunStartDate: breakResult.broken
      ? breakResult.breakRunStartDate
      : null,
    logs,
  };
}

type SingleMissBannerResult = {
  showBanner: boolean;
  missDate: string | null;
};

// Checks whether the single-miss reframing banner should appear.
// Accepts logs from useRecoveryCheck to avoid a second subscription.
// shouldShowModal must be passed in; if the modal is showing, the banner is suppressed.
export function useSingleMissBanner(
  habit: RecoveryHabitRef | null,
  logs: HabitLog[],
  shouldShowModal: boolean,
): SingleMissBannerResult {
  const today = todayDateString();

  const missResult =
    habit && !shouldShowModal
      ? detectSingleMiss(logs, habit.start_date, today)
      : { isSingleMiss: false as const };

  const bannerDismissedKey =
    missResult.isSingleMiss && habit
      ? singleMissBannerPreferenceKey(habit.id, missResult.missDate)
      : null;

  const preferenceQuery = useQuery({
    enabled: Boolean(bannerDismissedKey),
    queryFn: () => getPreference(bannerDismissedKey!),
    queryKey: ["preferences", bannerDismissedKey],
    staleTime: 0,
  });

  const showBanner = missResult.isSingleMiss && preferenceQuery.data === null;

  return {
    showBanner,
    missDate: missResult.isSingleMiss ? missResult.missDate : null,
  };
}
