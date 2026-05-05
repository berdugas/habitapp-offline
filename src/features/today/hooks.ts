import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import {
  deleteHabitLog,
  getHabitLogsInRange,
  upsertHabitLog,
} from "@/features/habits/api";
import { isActiveDay, parseActiveDays } from "@/features/habits/activeDays";
import {
  useEligibleHabitsQuery,
  useUpcomingActiveHabitsQuery,
} from "@/features/habits/hooks";
import { formatHabitFormula } from "@/features/habits/formatters";
import { summarizeHabitProgress } from "@/features/today/progress";
import { avgConsistencyRate, oldestStreak } from "@/features/today/goalMetrics";
import { logger } from "@/services/logger";
import {
  addDeviceDays,
  getTrailingDateRangeStrings,
  toDeviceDateString,
} from "@/utils/dates";
import { TODAY_PROGRESS_WINDOW_DAYS } from "@/features/today/constants";
import {
  listLogsForHabitInRange,
  listLogsForHabitsInRange,
} from "@/lib/db/repositories/habit_logs";
import { now, todayDateString } from "@/utils/clock";

import type { HabitLogRecord, HabitLogStatus } from "@/features/habits/types";
import type {
  TodayHabitCardData,
  UpcomingHabitCardData,
} from "@/features/today/types";
import type { HeatmapLog } from "@/components/CalendarGrid";

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
  return ["habit-logs", "range", habitId, fromDate, toDate];
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

export function useHabitLogsForHabitsInRange(habitIds: string[], days: number) {
  const today = todayDateString();
  const fromDate = toDeviceDateString(addDeviceDays(new Date(), -(days - 1)));
  return useQuery({
    enabled: habitIds.length > 0,
    queryFn: () => listLogsForHabitsInRange(habitIds, fromDate, today),
    queryKey: ["habit-logs", "bulk-range", habitIds, fromDate, today],
    staleTime: 30_000,
  });
}

export function useTodayHabits() {
  const { user } = useAuthSession();
  const eligibleHabitsQuery = useEligibleHabitsQuery();
  const upcomingHabitsQuery = useUpcomingActiveHabitsQuery();
  const eligibleHabits = eligibleHabitsQuery.data ?? [];
  const { endDate, startDate } = getTrailingDateRangeStrings(
    TODAY_PROGRESS_WINDOW_DAYS,
    now(),
  );
  const historyLogsQuery = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getHabitLogsInRange(user!.id, startDate, endDate),
    queryKey: getUserHabitLogsRangeQueryKey(user?.id, startDate, endDate),
  });
  const logsByHabitId = new Map<string, HabitLogRecord[]>();
  const historyWindowEndDate = new Date(`${endDate}T12:00:00`);

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
      const activeDays = parseActiveDays(habit.active_days);
      const offDay = !isActiveDay(todayDateString(), activeDays);
      return {
        ...summarizeHabitProgress({
          activeDays,
          endDate: historyWindowEndDate,
          logs: logsByHabitId.get(habit.id) ?? [],
          windowDays: TODAY_PROGRESS_WINDOW_DAYS,
        }),
        activeDays,
        cue: habit.cue,
        formula: formatHabitFormula(habit.cue, habit.tiny_action),
        icon: habit.icon ?? null,
        id: habit.id,
        identityPhrase: habit.identity_phrase ?? "",
        name: habit.title,
        offDay,
        startDate: habit.start_date,
        tinyAction: habit.tiny_action,
      };
    }),
    isLoading:
      eligibleHabitsQuery.isLoading ||
      upcomingHabitsQuery.isLoading ||
      historyLogsQuery.isLoading,
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

      return upsertHabitLog(user.id, {
        habitId,
        logDate: todayDateString(),
        status,
      });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.id) {
        return;
      }

      const { endDate, startDate } = getTrailingDateRangeStrings(
        TODAY_PROGRESS_WINDOW_DAYS,
        now(),
      );
      const queryKey = getUserHabitLogsRangeQueryKey(user.id, startDate, endDate);

      await queryClient.invalidateQueries({ queryKey });
      await queryClient.fetchQuery({
        queryFn: () => getHabitLogsInRange(user.id, startDate, endDate),
        queryKey,
      });

      // Invalidate the habit-specific range query so the heatmap re-renders.
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "range", variables.habitId],
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

export function useDeleteTodayHabitLogMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (habitId: string) => {
      if (!user?.id) {
        throw new Error("You need an account session before undoing a habit log.");
      }
      return deleteHabitLog(user.id, habitId, todayDateString());
    },
    onSuccess: async (_data, habitId) => {
      if (!user?.id) return;

      const { endDate, startDate } = getTrailingDateRangeStrings(
        TODAY_PROGRESS_WINDOW_DAYS,
        now(),
      );
      const queryKey = getUserHabitLogsRangeQueryKey(user.id, startDate, endDate);

      await queryClient.invalidateQueries({ queryKey });
      await queryClient.fetchQuery({
        queryFn: () => getHabitLogsInRange(user.id, startDate, endDate),
        queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "range", habitId],
      });
    },
    onError: (error, habitId) => {
      logger.error("Today undo log mutation failed", {
        error,
        habitId,
        userId: user?.id ?? null,
      });
    },
  });
}

export type GoalHabitDetail = {
  activeDays: number[];
  consistencyRate: number;
  icon: string | null;
  id: string;
  logs: HeatmapLog[];
  name: string;
  skipCount: number;
  startDate: string;
  streak: number;
};

export function useGoalDetail(identityPhrase: string | undefined) {
  const { endDate } = getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, now());
  const endDateObj = new Date(`${endDate}T12:00:00`);

  const allHabitsQuery = useEligibleHabitsQuery();
  const goalHabits = (allHabitsQuery.data ?? []).filter(
    (h) => h.identity_phrase === identityPhrase,
  );

  const habitIds = goalHabits.map((h) => h.id);
  const logsQuery = useHabitLogsForHabitsInRange(habitIds, TODAY_PROGRESS_WINDOW_DAYS);
  const allLogs = logsQuery.data ?? [];

  const logsByHabitId = new Map<string, HabitLogRecord[]>();
  for (const log of allLogs) {
    const arr = logsByHabitId.get(log.habit_id) ?? [];
    arr.push(log);
    logsByHabitId.set(log.habit_id, arr);
  }

  const habits: GoalHabitDetail[] = goalHabits.map((habit) => {
    const activeDays = parseActiveDays(habit.active_days);
    const habitLogs = logsByHabitId.get(habit.id) ?? [];
    const progress = summarizeHabitProgress({
      activeDays,
      endDate: endDateObj,
      logs: habitLogs,
      windowDays: TODAY_PROGRESS_WINDOW_DAYS,
    });
    return {
      activeDays,
      consistencyRate: progress.consistencyRate,
      icon: habit.icon ?? null,
      id: habit.id,
      logs: habitLogs.map((l) => ({ log_date: l.log_date, status: l.status })),
      name: habit.title,
      skipCount: progress.skipCount,
      startDate: habit.start_date,
      streak: progress.streak,
    };
  });

  return {
    error: allHabitsQuery.error ?? logsQuery.error ?? null,
    goalConsistencyRate: avgConsistencyRate(habits),
    goalStreak: oldestStreak(habits),
    habits,
    identityPhrase: identityPhrase ?? "",
    isLoading: allHabitsQuery.isLoading || logsQuery.isLoading,
  };
}
