import {
  useMutation,
  useQueries,
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
import { isGoalGraduated } from "@/features/graduation/graduation";
import { getLatestWeeklyReviewsForHabits } from "@/features/reviews/api";
import { getGoalReviewStatus } from "@/features/reviews/due";
import { getGoalReviewStatusQueryKey } from "@/features/reviews/queryKeys";
import { summarizeHabitProgress } from "@/features/today/progress";
import {
  avgConsistencyRate,
  computeGoalDailyStates,
  computeGoalStreak,
  computeWeeklyConsistency,
} from "@/features/today/goalMetrics";
import { logger } from "@/services/logger";
import {
  addDeviceDays,
  getTrailingDateRangeStrings,
  getWeekStartDate,
  getWeekStartDateString,
  toDeviceDateString,
} from "@/utils/dates";
import {
  GOAL_DETAIL_WINDOW_DAYS,
  NO_GOAL_KEY,
  TODAY_PROGRESS_WINDOW_DAYS,
} from "@/features/today/constants";
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

  const habitsByIdentity = new Map<string, typeof eligibleHabits>();
  for (const habit of eligibleHabits) {
    const key = habit.identity_phrase || NO_GOAL_KEY;
    const arr = habitsByIdentity.get(key) ?? [];
    arr.push(habit);
    habitsByIdentity.set(key, arr);
  }

  const goalStreaks: Record<string, number> = {};
  for (const [key, groupHabits] of habitsByIdentity) {
    goalStreaks[key] = computeGoalStreak(
      groupHabits.map((habit) => ({
        activeDays: parseActiveDays(habit.active_days),
        logs: (logsByHabitId.get(habit.id) ?? []).map((l) => ({
          log_date: l.log_date,
          status: l.status,
        })),
        startDate: habit.start_date,
      })),
      TODAY_PROGRESS_WINDOW_DAYS,
      historyWindowEndDate,
    );
  }

  // Compute over eligible + upcoming so an upcoming habit (which can't be automatic yet) correctly suppresses the marker.
  const upcomingHabits = upcomingHabitsQuery.data ?? [];
  const allActiveByIdentity = new Map<string, typeof eligibleHabits>();
  for (const habit of [...eligibleHabits, ...upcomingHabits]) {
    const key = habit.identity_phrase || NO_GOAL_KEY;
    const arr = allActiveByIdentity.get(key) ?? [];
    arr.push(habit);
    allActiveByIdentity.set(key, arr);
  }
  const goalGraduatedByIdentity: Record<string, boolean> = {};
  for (const [key, allHabits] of allActiveByIdentity) {
    goalGraduatedByIdentity[key] =
      key !== NO_GOAL_KEY &&
      isGoalGraduated(allHabits.map((h) => ({ habit_state: h.habit_state })));
  }

  const weekStartForReview = getWeekStartDateString(now());
  const todayDateForReview = toDeviceDateString();
  const reviewIdentityKeys = Array.from(habitsByIdentity.keys()).filter(
    (key) => key !== NO_GOAL_KEY,
  );
  const reviewQueries = useQueries({
    queries: reviewIdentityKeys.map((identity) => {
      const groupHabits = habitsByIdentity.get(identity) ?? [];
      return {
        enabled: Boolean(user?.id),
        queryFn: async () => {
          const latestReviews = await getLatestWeeklyReviewsForHabits(
            user!.id,
            groupHabits.map((h) => h.id),
          );
          return getGoalReviewStatus({
            currentWeekStart: weekStartForReview,
            habits: groupHabits,
            latestReviews,
            todayDate: todayDateForReview,
          });
        },
        queryKey: getGoalReviewStatusQueryKey(
          user?.id,
          identity,
          weekStartForReview,
          todayDateForReview,
        ),
      };
    }),
  });
  const reviewDueByIdentity: Record<string, boolean> = {};
  const reviewStatusErrorByIdentity: Record<string, boolean> = {};
  reviewIdentityKeys.forEach((identity, i) => {
    const q = reviewQueries[i];
    reviewDueByIdentity[identity] = q?.data?.isDue ?? false;
    if (q?.isError) {
      reviewStatusErrorByIdentity[identity] = true;
      logger.error("Goal review status query failed", {
        error: q.error,
        identityPhrase: identity,
        userId: user?.id ?? null,
      });
    }
  });

  return {
    ...historyLogsQuery,
    error:
      eligibleHabitsQuery.error ??
      upcomingHabitsQuery.error ??
      historyLogsQuery.error ??
      null,
    goalGraduatedByIdentity,
    goalStreaks,
    reviewDueByIdentity,
    reviewStatusErrorByIdentity,
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
        habitState: habit.habit_state,
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

      // Invalidate the habit detail logs so progress metrics stay in sync.
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "detail", user.id, variables.habitId],
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

      // Invalidate the habit detail logs so progress metrics stay in sync.
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "detail", user.id, habitId],
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
  consistencyDenominator: number;
  consistencyRate: number;
  icon: string | null;
  id: string;
  logs: HeatmapLog[];
  name: string;
  startDate: string;
  streak: number;
};

export function useGoalDetail(identityPhrase: string | undefined) {
  const { endDate } = getTrailingDateRangeStrings(TODAY_PROGRESS_WINDOW_DAYS, now());
  const endDateObj = new Date(`${endDate}T12:00:00`);

  const allHabitsQuery = useEligibleHabitsQuery();
  const upcomingHabitsQuery = useUpcomingActiveHabitsQuery();
  const goalHabits = (allHabitsQuery.data ?? []).filter(
    (h) => h.identity_phrase === identityPhrase,
  );
  const upcomingGoalHabits = (upcomingHabitsQuery.data ?? []).filter(
    (h) => h.identity_phrase === identityPhrase,
  );

  const habitIds = goalHabits.map((h) => h.id);
  const logsQuery = useHabitLogsForHabitsInRange(habitIds, GOAL_DETAIL_WINDOW_DAYS);
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
      consistencyDenominator: progress.consistencyDenominator,
      consistencyRate: progress.consistencyRate,
      icon: habit.icon ?? null,
      id: habit.id,
      logs: habitLogs.map((l) => ({ log_date: l.log_date, status: l.status })),
      name: habit.title,
      startDate: habit.start_date,
      streak: progress.streak,
    };
  });

  const oldestActiveDaysCount = (() => {
    if (habits.length === 0) return 0;
    const oldest = [...habits].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    )[0];
    if (!oldest) return 0;
    const start = new Date(`${oldest.startDate}T12:00:00`);
    start.setHours(0, 0, 0, 0);
    const today = now();
    today.setHours(0, 0, 0, 0);
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= today) {
      if (isActiveDay(cursor, oldest.activeDays)) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  })();

  const thisWeekMonday = getWeekStartDate(now());
  const elevenWeeksBackMonday = addDeviceDays(thisWeekMonday, -11 * 7);
  const elevenWeeksBackMondayIso = toDeviceDateString(elevenWeeksBackMonday);

  const oldestStartIso =
    habits.length > 0
      ? [...habits].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
          .startDate
      : toDeviceDateString(now());
  const oldestStartMondayIso = toDeviceDateString(
    getWeekStartDate(new Date(`${oldestStartIso}T12:00:00`)),
  );

  const chartStartIso =
    oldestStartMondayIso > elevenWeeksBackMondayIso
      ? oldestStartMondayIso
      : elevenWeeksBackMondayIso;

  const weeklyData = computeWeeklyConsistency(habits, chartStartIso, endDateObj);
  const goalDailyStates = computeGoalDailyStates(habits, 28);

  // Same eligible + upcoming merge as useTodayHabits, scoped to this goal.
  const allActiveGoalHabits = [...goalHabits, ...upcomingGoalHabits];
  const goalGraduated =
    allActiveGoalHabits.length > 0 &&
    isGoalGraduated(
      allActiveGoalHabits.map((h) => ({ habit_state: h.habit_state })),
    );

  return {
    error:
      allHabitsQuery.error ??
      upcomingHabitsQuery.error ??
      logsQuery.error ??
      null,
    earliestStartDate: oldestStartIso,
    goalConsistencyRate: avgConsistencyRate(habits),
    goalDailyStates,
    goalGraduated,
    goalStreak: computeGoalStreak(habits, TODAY_PROGRESS_WINDOW_DAYS, endDateObj),
    habits,
    identityPhrase: identityPhrase ?? "",
    isLoading:
      allHabitsQuery.isLoading ||
      upcomingHabitsQuery.isLoading ||
      logsQuery.isLoading,
    oldestActiveDaysCount,
    weeklyData,
  };
}
