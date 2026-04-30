import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import {
  getHabitLogsInRange,
  upsertHabitLog,
} from "@/features/habits/api";
import {
  useEligibleHabitsQuery,
  useUpcomingActiveHabitsQuery,
} from "@/features/habits/hooks";
import { formatHabitFormula } from "@/features/habits/formatters";
import { getLatestWeeklyReview } from "@/features/reviews/api";
import { isWeeklyReviewDue } from "@/features/reviews/due";
import { getLatestWeeklyReviewQueryKey } from "@/features/reviews/queryKeys";
import { summarizeHabitProgress } from "@/features/today/progress";
import { logger } from "@/services/logger";
import {
  addDeviceDays,
  getWeekStartDateString,
  getTrailingDateRangeStrings,
  toDeviceDateString,
} from "@/utils/dates";
import { TODAY_PROGRESS_WINDOW_DAYS } from "@/features/today/constants";
import { listLogsForHabitInRange } from "@/lib/db/repositories/habit_logs";
import { todayDateString } from "@/utils/clock";

import type { HabitLogRecord, HabitLogStatus } from "@/features/habits/types";
import type {
  TodayHabitCardData,
  UpcomingHabitCardData,
} from "@/features/today/types";

export function getUserHabitLogsRangeQueryKey(
  userId: string | undefined,
  startDate: string,
  endDate: string,
) {
  return ["habit-logs", userId ?? "guest", startDate, endDate];
}

export function getHabitLogsRangeQueryKey(
  habitId: string,
  fromDate: string,
  toDate: string,
) {
  return ["habit_logs", "range", habitId, fromDate, toDate];
}

export function useHabitLogsForRange(habitId: string | undefined, days: number) {
  const today = todayDateString();
  const fromDate = toDeviceDateString(addDeviceDays(new Date(), -(days - 1)));
  return useQuery({
    enabled: Boolean(habitId),
    queryFn: () => listLogsForHabitInRange(habitId!, fromDate, today),
    queryKey: getHabitLogsRangeQueryKey(habitId ?? "none", fromDate, today),
    staleTime: 30_000,
  });
}

export function useTodayHabits() {
  const { user } = useAuthSession();
  const eligibleHabitsQuery = useEligibleHabitsQuery();
  const upcomingHabitsQuery = useUpcomingActiveHabitsQuery();
  const eligibleHabits = eligibleHabitsQuery.data ?? [];
  const todayDate = toDeviceDateString();
  const currentWeekStart = getWeekStartDateString();
  const { endDate, startDate } = getTrailingDateRangeStrings(
    TODAY_PROGRESS_WINDOW_DAYS,
  );
  const historyLogsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getHabitLogsInRange(user!.id, startDate, endDate),
    queryKey: getUserHabitLogsRangeQueryKey(user?.id, startDate, endDate),
  });
  const latestReviewQueries = useQueries({
    queries: eligibleHabits.map((habit) => ({
      enabled: Boolean(user?.id),
      queryFn: () => getLatestWeeklyReview(user!.id, habit.id),
      queryKey: getLatestWeeklyReviewQueryKey(user?.id, habit.id),
    })),
  });
  const logsByHabitId = new Map<string, HabitLogRecord[]>();
  const latestReviewsByHabitId = new Map(
    eligibleHabits.map((habit, index) => [
      habit.id,
      latestReviewQueries[index]?.data ?? null,
    ]),
  );
  const historyWindowEndDate = new Date(`${endDate}T12:00:00`);
  const latestReviewError = latestReviewQueries.find((query) => query.error)?.error;

  for (const log of historyLogsQuery.data ?? []) {
    const existingLogs = logsByHabitId.get(log.habit_id) ?? [];
    existingLogs.push(log);
    logsByHabitId.set(log.habit_id, existingLogs);
  }

  return {
    ...historyLogsQuery,
    error:
      eligibleHabitsQuery.error ??
      upcomingHabitsQuery.error ??
      historyLogsQuery.error ??
      null,
    habits: eligibleHabits.map<TodayHabitCardData>((habit) => {
      const latestReview = latestReviewsByHabitId.get(habit.id) ?? null;

      return {
        ...summarizeHabitProgress({
          endDate: historyWindowEndDate,
          logs: logsByHabitId.get(habit.id) ?? [],
          windowDays: TODAY_PROGRESS_WINDOW_DAYS,
        }),
        cue: habit.cue,
        formula: formatHabitFormula(habit.cue, habit.tiny_action),
        habitState: habit.habit_state,
        id: habit.id,
        identityPhrase: habit.identity_phrase ?? "",
        isWeeklyReviewDue: isWeeklyReviewDue({
          currentWeekStart,
          habit,
          latestReview,
          todayDate,
        }),
        latestReviewWeekStart: latestReview?.week_start ?? null,
        name: habit.title,
        startDate: habit.start_date,
        tinyAction: habit.tiny_action,
      };
    }),
    isLoading:
      eligibleHabitsQuery.isLoading ||
      upcomingHabitsQuery.isLoading ||
      historyLogsQuery.isLoading ||
      latestReviewQueries.some((query) => query.isLoading),
    upcomingHabits: (upcomingHabitsQuery.data ?? []).map<UpcomingHabitCardData>(
      (habit) => ({
        formula: formatHabitFormula(habit.cue, habit.tiny_action),
        id: habit.id,
        name: habit.title,
        startDate: habit.start_date,
      }),
    ),
  };
}

type UpsertTodayHabitStatusVariables = {
  habitId: string;
  status: HabitLogStatus;
};

export function useUpsertTodayHabitStatusMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      habitId,
      status,
    }: UpsertTodayHabitStatusVariables) => {
      if (!user?.id) {
        throw new Error("You need an account session before logging a habit.");
      }

      const todayDate = toDeviceDateString();

      return upsertHabitLog(user.id, {
        habitId,
        logDate: todayDate,
        status,
      });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.id) {
        return;
      }

      const { endDate, startDate } = getTrailingDateRangeStrings(
        TODAY_PROGRESS_WINDOW_DAYS,
      );
      const queryKey = getUserHabitLogsRangeQueryKey(user.id, startDate, endDate);

      await queryClient.invalidateQueries({ queryKey });
      await queryClient.fetchQuery({
        queryFn: () => getHabitLogsInRange(user.id, startDate, endDate),
        queryKey,
      });

      // Invalidate the habit-specific range query so the heatmap re-renders.
      await queryClient.invalidateQueries({
        queryKey: ["habit_logs", "range", variables.habitId],
      });
    },
    onError: (error, variables) => {
      logger.error("Today status mutation failed", {
        error,
        habitId: variables.habitId,
        status: variables.status,
        userId: user?.id ?? null,
      });
    },
  });
}
