import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import {
  activateBacklogHabit,
  archiveHabit,
  createHabit,
  deleteGoal,
  deleteHabit,
  getHabitById,
  getHabitLogsForHabitInRange,
  listArchivedHabits,
  listBacklogHabits,
  listEligibleHabitsForToday,
  listGoalHabits,
  listUpcomingHabits,
  updateHabit,
  upsertHabitLog,
} from "@/features/habits/api";
import {
  getLatestSRHIQueryKey,
  getSRHIHistoryQueryKey,
} from "@/features/graduation/queryKeys";
import { parseActiveDays } from "@/features/habits/activeDays";
import { getLatestWeeklyReview } from "@/features/reviews/api";
import { getLatestWeeklyReviewQueryKey } from "@/features/reviews/queryKeys";
import { formatHabitFormula } from "@/features/habits/formatters";
import { summarizeHabitProgress } from "@/features/today/progress";
import { trackEvent } from "@/services/analytics";
import { logger } from "@/services/logger";
import {
  getTrailingDateRangeStrings,
  toDeviceDateString,
} from "@/utils/dates";
import { TODAY_PROGRESS_WINDOW_DAYS } from "@/features/today/constants";

import type {
  CreateHabitPayload,
  HabitLogRecord,
  HabitLogStatus,
  HabitRecord,
  HabitSetupPayload,
} from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

export function getEligibleHabitsQueryKey(
  userId: string | undefined,
  todayDate: string,
) {
  return ["habits", "eligible", userId ?? "guest", todayDate];
}

export function getUpcomingActiveHabitsQueryKey(
  userId: string | undefined,
  todayDate: string,
) {
  return ["habits", "upcoming", userId ?? "guest", todayDate];
}

export function getInactiveHabitsQueryKey(userId: string | undefined) {
  return ["habits", "inactive", userId ?? "guest"];
}

export function getHabitDetailQueryKey(
  userId: string | undefined,
  habitId: string | undefined,
) {
  return ["habits", "detail", userId ?? "guest", habitId ?? "unknown"];
}

export function getHabitDetailLogsQueryKey(
  userId: string | undefined,
  habitId: string | undefined,
  startDate: string,
  endDate: string,
) {
  return [
    "habit-logs",
    "detail",
    userId ?? "guest",
    habitId ?? "unknown",
    startDate,
    endDate,
  ];
}

export function getLibraryQueryKey(userId: string | undefined) {
  return ["habits", "library", userId ?? "guest"] as const;
}

export function getBacklogQueryKey(userId: string | undefined) {
  return ["habits", "backlog", userId ?? "guest"] as const;
}

export function useEligibleHabitsQuery() {
  const { user } = useAuthSession();
  const todayDate = toDeviceDateString();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listEligibleHabitsForToday(user!.id, todayDate),
    queryKey: getEligibleHabitsQueryKey(user?.id, todayDate),
  });
}

export function useUpcomingActiveHabitsQuery() {
  const { user } = useAuthSession();
  const todayDate = toDeviceDateString();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listUpcomingHabits(user!.id, todayDate),
    queryKey: getUpcomingActiveHabitsQueryKey(user?.id, todayDate),
  });
}

export function getGoalHabitCountQueryKey(
  userId: string | undefined,
  identityPhrase: string | undefined,
) {
  return ["habits", "goal-count", userId ?? "guest", identityPhrase ?? ""] as const;
}

export function useGoalHabitCountQuery(identityPhrase: string | undefined) {
  const { user } = useAuthSession();
  return useQuery({
    enabled: Boolean(user?.id && identityPhrase),
    queryFn: async () => {
      const habits = await listGoalHabits(user!.id, identityPhrase!);
      return habits.length;
    },
    queryKey: getGoalHabitCountQueryKey(user?.id, identityPhrase),
  });
}

type UseHabitDetailResult = {
  error: Error | null;
  formula: string;
  habit: HabitRecord | null;
  isLoading: boolean;
  isUpcoming: boolean;
  latestReview: WeeklyReviewRecord | null;
  recentLogs: HabitLogRecord[];
  progress: ReturnType<typeof summarizeHabitProgress>;
};

function normalizeHabitId(habitId: string | string[] | undefined) {
  if (Array.isArray(habitId)) {
    return habitId[0];
  }

  return habitId;
}

export function useOwnedHabitQuery(
  habitIdParam: string | string[] | undefined,
) {
  const { user } = useAuthSession();
  const habitId = normalizeHabitId(habitIdParam);

  return useQuery({
    enabled: Boolean(user?.id && habitId),
    queryFn: () => getHabitById(user!.id, habitId!),
    queryKey: getHabitDetailQueryKey(user?.id, habitId),
  });
}

export function useInactiveHabitsQuery() {
  const { user } = useAuthSession();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listArchivedHabits(user!.id),
    queryKey: getInactiveHabitsQueryKey(user?.id),
  });
}

export function useHabitDetail(
  habitIdParam: string | string[] | undefined,
): UseHabitDetailResult {
  const { user } = useAuthSession();
  const habitId = normalizeHabitId(habitIdParam);
  const { endDate, startDate } = getTrailingDateRangeStrings(
    TODAY_PROGRESS_WINDOW_DAYS,
  );
  const endDateObject = new Date(`${endDate}T12:00:00`);
  const routeError = habitId ? null : new Error("Missing habit id.");

  const habitQuery = useOwnedHabitQuery(habitId);
  const habitLogsQuery = useQuery({
    enabled: Boolean(user?.id && habitId),
    queryFn: () =>
      getHabitLogsForHabitInRange(user!.id, habitId!, startDate, endDate),
    queryKey: getHabitDetailLogsQueryKey(user?.id, habitId, startDate, endDate),
  });
  const latestReviewQuery = useQuery({
    enabled: Boolean(user?.id && habitId),
    queryFn: () => getLatestWeeklyReview(user!.id, habitId!),
    queryKey: getLatestWeeklyReviewQueryKey(user?.id, habitId),
  });

  const habit = habitQuery.data ?? null;
  const latestReview = latestReviewQuery.data ?? null;
  const recentLogs = habitLogsQuery.data ?? [];

  return {
    error:
      routeError ??
      (habitQuery.error as Error | null) ??
      (habitLogsQuery.error as Error | null) ??
      null,
    formula: habit
      ? formatHabitFormula(habit.cue, habit.tiny_action)
      : "",
    habit,
    isLoading:
      !routeError &&
      (habitQuery.isLoading ||
        habitLogsQuery.isLoading ||
        latestReviewQuery.isLoading),
    isUpcoming: habit ? habit.start_date > endDate : false,
    latestReview,
    progress: summarizeHabitProgress({
      activeDays: habit ? parseActiveDays(habit.active_days) : undefined,
      endDate: endDateObject,
      logs: recentLogs,
      windowDays: TODAY_PROGRESS_WINDOW_DAYS,
    }),
    recentLogs,
  };
}

export function useCreateHabitMutation() {
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: async (payload: CreateHabitPayload) => {
      if (!user?.id) {
        throw new Error("You need an account session before creating a habit.");
      }

      return createHabit(user.id, payload);
    },
    onSuccess: () => {
      trackEvent("habit_created");
    },
  });
}

export async function invalidateHabitSurfaceQueries(
  userId: string,
  habitId: string,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const todayDate = toDeviceDateString();

  await queryClient.invalidateQueries({
    queryKey: getHabitDetailQueryKey(userId, habitId),
  });
  await queryClient.fetchQuery({
    queryFn: () => getHabitById(userId, habitId),
    queryKey: getHabitDetailQueryKey(userId, habitId),
  });
  await queryClient.invalidateQueries({
    queryKey: getEligibleHabitsQueryKey(userId, todayDate),
  });
  await queryClient.invalidateQueries({
    queryKey: getUpcomingActiveHabitsQueryKey(userId, todayDate),
  });
  await queryClient.invalidateQueries({
    queryKey: getInactiveHabitsQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    // Any habit mutation that touches identity_phrase / state / status can
    // change which habits a goal contains, so invalidate the all-status
    // goal-count cache broadly. Hits every cached identity_phrase at once.
    queryKey: ["habits", "goal-count"],
  });
  await queryClient.invalidateQueries({
    queryKey: getLibraryQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    queryKey: getBacklogQueryKey(userId),
  });
  // Goal-status caches a goal's habit membership implicitly. Any habit
  // create/edit/archive/backlog can change which habits a goal contains, so
  // every goal-status query has to refetch.
  await queryClient.invalidateQueries({
    queryKey: ["reviews", "goal-status"],
  });
}

// Used by hard-delete paths. Invalidates list queries that may have shown the
// habit, then drops every cache entry keyed to the now-gone habit id. Must NOT
// call fetchQuery on the habit detail — getHabitById would throw post-delete.
export async function invalidateHabitListQueries(
  userId: string,
  habitId: string,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const todayDate = toDeviceDateString();

  await queryClient.invalidateQueries({
    queryKey: getEligibleHabitsQueryKey(userId, todayDate),
  });
  await queryClient.invalidateQueries({
    queryKey: getUpcomingActiveHabitsQueryKey(userId, todayDate),
  });
  await queryClient.invalidateQueries({
    queryKey: getInactiveHabitsQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    queryKey: getLibraryQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    queryKey: getBacklogQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    queryKey: ["reviews", "goal-status"],
  });
  await queryClient.invalidateQueries({
    // Single-habit delete can shrink the goal-count for its identity_phrase.
    queryKey: ["habits", "goal-count"],
  });

  queryClient.removeQueries({ queryKey: getHabitDetailQueryKey(userId, habitId) });
  queryClient.removeQueries({ queryKey: ["habit-logs", "detail", userId, habitId] });
  queryClient.removeQueries({ queryKey: ["habit-logs", "range", habitId] });
  queryClient.removeQueries({ queryKey: getLatestSRHIQueryKey(habitId) });
  queryClient.removeQueries({ queryKey: getSRHIHistoryQueryKey(habitId) });
}

type UpdateHabitMutationVariables = {
  habitId: string;
  payload: HabitSetupPayload;
};

export function useUpdateHabitMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, payload }: UpdateHabitMutationVariables) => {
      if (!user?.id) {
        throw new Error("You need an account session before updating a habit.");
      }

      return updateHabit(user.id, habitId, payload);
    },
    onSuccess: async (_updatedHabit, variables) => {
      if (!user?.id) {
        return;
      }

      await invalidateHabitSurfaceQueries(user.id, variables.habitId, queryClient);
    },
    onError: (error, variables) => {
      logger.error("Habit update mutation failed", {
        error,
        habitId: variables.habitId,
        userId: user?.id ?? null,
      });
    },
  });
}

export function useArchiveHabitMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before archiving a habit.",
        );
      }

      return archiveHabit(user.id, habitId);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) {
        return;
      }

      await invalidateHabitSurfaceQueries(user.id, variables.habitId, queryClient);
    },
    onError: (error, variables) => {
      logger.error("Habit archive mutation failed", {
        error,
        habitId: variables.habitId,
        userId: user?.id ?? null,
      });
    },
  });
}

export function useBacklogHabitsQuery() {
  const { user } = useAuthSession();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listBacklogHabits(user!.id),
    queryKey: getBacklogQueryKey(user?.id),
  });
}

export function useActivateBacklogHabitMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before activating a habit.",
        );
      }
      return activateBacklogHabit(user.id, habitId);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) return;
      await invalidateHabitSurfaceQueries(user.id, variables.habitId, queryClient);
    },
    onError: (error, variables) => {
      logger.error("Habit activate-backlog mutation failed", {
        error,
        habitId: variables.habitId,
        userId: user?.id ?? null,
      });
    },
  });
}

export function useDeleteHabitMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before deleting a habit.",
        );
      }
      await deleteHabit(user.id, habitId);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) return;
      await invalidateHabitListQueries(user.id, variables.habitId, queryClient);
    },
    onError: (error, variables) => {
      logger.error("Habit delete mutation failed", {
        error,
        habitId: variables.habitId,
        userId: user?.id ?? null,
      });
    },
  });
}

export function useDeleteGoalMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ identityPhrase }: { identityPhrase: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before deleting a goal.",
        );
      }
      return deleteGoal(user.id, identityPhrase);
    },
    onSuccess: async (result, variables) => {
      if (!user?.id) return;

      // Per-habit detail / log / SRHI caches are now stale. Drop them for
      // every deleted habit ID — same hygiene as single-habit delete.
      for (const habitId of result.deletedHabitIds) {
        await invalidateHabitListQueries(user.id, habitId, queryClient);
      }

      // The dedicated count query for this specific goal phrase.
      // (invalidateHabitListQueries hits the broad ["habits", "goal-count"]
      // prefix already, but invalidating the exact key is a no-op + clearer.)
      await queryClient.invalidateQueries({
        queryKey: getGoalHabitCountQueryKey(user.id, variables.identityPhrase),
      });
    },
    onError: (error, variables) => {
      logger.error("Goal delete mutation failed", {
        error,
        identityPhrase: variables.identityPhrase,
        userId: user?.id ?? null,
      });
    },
  });
}

type UpsertHabitLogVariables = {
  habitId: string;
  logDate: string;
  status: HabitLogStatus;
};

export function useUpsertHabitLogMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      habitId,
      logDate,
      status,
    }: UpsertHabitLogVariables): Promise<HabitLogRecord> => {
      if (!user?.id) {
        throw new Error("You need an account session before logging a habit.");
      }
      return upsertHabitLog(user.id, { habitId, logDate, status });
    },
    onSuccess: async (_data, variables) => {
      if (!user?.id) return;

      // 1) Heatmap range query for this habit (prefix-match all date ranges).
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "range", variables.habitId],
      });

      // 2) Today aggregate query.
      const { endDate, startDate } = getTrailingDateRangeStrings(
        TODAY_PROGRESS_WINDOW_DAYS,
      );
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", user.id, startDate, endDate],
      });

      // 3) Habit Detail progress/recent-history logs.
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "detail", user.id, variables.habitId],
      });

      // 4) Habit detail query.
      await queryClient.invalidateQueries({
        queryKey: getHabitDetailQueryKey(user.id, variables.habitId),
      });
    },
    onError: (error, variables) => {
      logger.error("Retro log mutation failed", {
        error,
        habitId: variables.habitId,
        logDate: variables.logDate,
        status: variables.status,
        userId: user?.id ?? null,
      });
    },
  });
}
