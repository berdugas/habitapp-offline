import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listHabits } from "@/lib/db/repositories/habits";

import { useAuthSession } from "@/features/auth/hooks";
import {
  activateBacklogHabit,
  archiveGoal,
  archiveHabit,
  createHabit,
  deleteGoal,
  deleteHabit,
  getHabitById,
  getHabitLogsForHabitInRange,
  listArchivedGoals,
  listArchivedHabits,
  listBacklogHabits,
  listEligibleHabitsForToday,
  listGoalHabits,
  listUpcomingHabits,
  renameGoal,
  restoreGoal,
  restoreHabit,
  updateHabit,
  upsertHabitLog,
} from "@/features/habits/api";
import {
  getLatestSRHIQueryKey,
  getSRHIHistoryQueryKey,
} from "@/features/graduation/queryKeys";
import { parseActiveDays } from "@/features/habits/activeDays";
import { useTrialValidation } from "@/features/trial/hooks";
import { getLatestWeeklyReview } from "@/features/reviews/api";
import { getLatestWeeklyReviewQueryKey } from "@/features/reviews/queryKeys";
import { formatHabitFormula } from "@/features/habits/formatters";
import { summarizeHabitProgress } from "@/features/today/progress";
import { trackEvent } from "@/services/analytics";
import { logger } from "@/services/logger";
import {
  daysBetweenDates,
  getTrailingDateRangeStrings,
  toDeviceDateString,
} from "@/utils/dates";
import { todayDateString } from "@/utils/clock";
import { useTodayDateString } from "@/utils/dayBoundary";
import { aliasGoalId, goalIdFor } from "@/services/goalIdRegistry";
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

export function getActiveHabitCountQueryKey(userId: string | undefined) {
  return ["habits", "active-count", userId ?? "guest"] as const;
}

export type ActiveHabitCount = {
  activeCount: number;
  manageable: number;
  soleActiveHabitId: string | null;
};

/**
 * Counts the user's active-state habits for the paywall gate. activeCount =
 * status='active'; manageable = status in (active, backlog) — both only count
 * habit_state='active' (graduated/automatic habits never count toward the
 * free-tier cap). Mirrors assertCanCreateHabitOnFreeTier's counting.
 */
export function useActiveHabitCountQuery() {
  const { user } = useAuthSession();
  return useQuery({
    enabled: Boolean(user?.id),
    queryKey: getActiveHabitCountQueryKey(user?.id),
    queryFn: async (): Promise<ActiveHabitCount> => {
      const rows = await listHabits({
        user_id: user!.id,
        status: ["active", "backlog"],
      });
      const manageableRows = rows.filter((h) => h.habit_state === "active");
      const actives = manageableRows.filter((h) => h.status === "active");
      return {
        activeCount: actives.length,
        manageable: manageableRows.length,
        soleActiveHabitId: actives.length === 1 ? actives[0].id : null,
      };
    },
  });
}

export function getArchivedGoalsQueryKey(userId: string | undefined) {
  return ["habits", "archived-goals", userId ?? "guest"] as const;
}

export function getArchivedGoalDetailQueryKey(
  userId: string | undefined,
  identityPhrase: string | undefined,
) {
  return [
    "habits",
    "archived-goal-detail",
    userId ?? "guest",
    identityPhrase ?? "",
  ] as const;
}

export function useEligibleHabitsQuery() {
  const { user } = useAuthSession();
  const todayDate = useTodayDateString();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listEligibleHabitsForToday(user!.id, todayDate),
    queryKey: getEligibleHabitsQueryKey(user?.id, todayDate),
  });
}

export function useUpcomingActiveHabitsQuery() {
  const { user } = useAuthSession();
  const todayDate = useTodayDateString();

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
      startDate: habit?.start_date,
      windowDays: TODAY_PROGRESS_WINDOW_DAYS,
    }),
    recentLogs,
  };
}

export function useCreateHabitMutation() {
  const { user } = useAuthSession();
  const { accessMode } = useTrialValidation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateHabitPayload) => {
      if (!user?.id) {
        throw new Error("You need an account session before creating a habit.");
      }

      return createHabit(user.id, payload, accessMode);
    },
    onSuccess: async () => {
      trackEvent("habit_created");
      // Creating a habit changes the active/manageable counts the paywall
      // gate derives. The always-mounted PaywallHardBlock never remounts on
      // navigation, so its active-count query must be invalidated explicitly
      // or a same-session trial→expiry can read a stale count and misclassify.
      await queryClient.invalidateQueries({
        queryKey: ["habits", "active-count"],
      });
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
  await queryClient.invalidateQueries({ queryKey: ["habits", "active-count"] });
  await queryClient.invalidateQueries({
    queryKey: getLibraryQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    queryKey: getBacklogQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    // Any habit mutation that flips status into or out of 'archived' can
    // change whether a goal qualifies as fully-archived. Refetch broadly.
    queryKey: getArchivedGoalsQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    // The archived-goal-detail screen shows every habit under a phrase
    // (every status) — a per-habit archive/restore/edit can change the
    // habit list shape and the fully-archived predicate the screen gates
    // on. Broad prefix invalidation hits every cached identity_phrase.
    queryKey: ["habits", "archived-goal-detail"],
  });
  await queryClient.invalidateQueries({
    // Cascade count (active+backlog under each phrase) changes whenever
    // a habit's status flips. Broad prefix invalidation hits every cached
    // identity_phrase at once.
    queryKey: ["habits", "goal-cascade-count"],
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
  await queryClient.invalidateQueries({
    // Deleting the last archived habit under a goal removes the goal from
    // the Archive list; deleting habits more broadly can also flip a goal
    // into the archived state if it leaves zero active+backlog rows.
    queryKey: getArchivedGoalsQueryKey(userId),
  });
  await queryClient.invalidateQueries({
    // ArchivedGoalDetailScreen lists every habit under a phrase; deleting
    // one shrinks that list (and may flip the fully-archived predicate).
    // Broad prefix invalidation hits every cached identity_phrase.
    queryKey: ["habits", "archived-goal-detail"],
  });
  await queryClient.invalidateQueries({
    queryKey: ["habits", "goal-cascade-count"],
  });
  await queryClient.invalidateQueries({ queryKey: ["habits", "active-count"] });

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
  const { accessMode } = useTrialValidation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId, payload }: UpdateHabitMutationVariables) => {
      if (!user?.id) {
        throw new Error("You need an account session before updating a habit.");
      }

      return updateHabit(user.id, habitId, payload, accessMode);
    },
    onSuccess: async (_updatedHabit, variables) => {
      if (!user?.id) {
        return;
      }
      // Coarse-grained "edit happened" signal. A future enhancement could
      // diff the payload against the prior habit to populate a `fields`
      // array; today the diff context only lives at the call site
      // (EditHabitScreen) since the mutationFn receives a normalized full
      // payload, not a partial.
      trackEvent("habit_updated", { habit_id: variables.habitId });

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
  const { accessMode } = useTrialValidation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before archiving a habit.",
        );
      }

      return archiveHabit(user.id, habitId, accessMode);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) {
        return;
      }
      trackEvent("habit_archived", { habit_id: variables.habitId });

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

export function useRestoreHabitMutation() {
  const { user } = useAuthSession();
  const { accessMode } = useTrialValidation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before restoring a habit.",
        );
      }
      return restoreHabit(user.id, habitId, accessMode);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) return;
      trackEvent("habit_restored", { habit_id: variables.habitId });
      await invalidateHabitSurfaceQueries(user.id, variables.habitId, queryClient);
    },
    onError: (error, variables) => {
      logger.error("Habit restore mutation failed", {
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
  const { accessMode } = useTrialValidation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ habitId }: { habitId: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before deleting a habit.",
        );
      }
      await deleteHabit(user.id, habitId, accessMode);
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) return;
      trackEvent("habit_deleted", { habit_id: variables.habitId });
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
      // Goals key on identityPhrase (user-typed string); we ship an opaque
      // per-phrase random id as goal_id to keep PII out of the warehouse
      // while still letting us segment funnels by goal. See
      // src/services/goalIdRegistry.ts for the registry that maps each
      // phrase to a stable random id, and the threat-model note there
      // for what this protects vs. what it doesn't. Goal mutations run
      // long after registry hydration on real launches, so unlike the
      // ScreenTracker / GoalDetailScreen call sites we don't need to
      // gate this on isGoalIdRegistryHydrated().
      trackEvent("goal_deleted", {
        goal_id: goalIdFor(variables.identityPhrase),
      });

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

export function useRenameGoalMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      oldPhrase,
      newPhrase,
    }: {
      oldPhrase: string;
      newPhrase: string;
    }) => {
      if (!user?.id) {
        throw new Error("You need an account session before renaming a goal.");
      }
      return renameGoal(user.id, oldPhrase, newPhrase);
    },
    onSuccess: async (result, variables) => {
      if (!user?.id) return;

      // Carry the goal's analytics id to the new phrase FIRST and
      // synchronously, before the screen navigates and the remounted goal
      // page emits goal_detail_viewed under the new phrase. No-ops on a
      // merge (target keeps its id). See src/services/goalIdRegistry.ts.
      aliasGoalId(variables.oldPhrase, variables.newPhrase);

      trackEvent("goal_renamed", {
        goal_id: goalIdFor(variables.newPhrase),
      });

      // Surviving-row mutation: every renamed habit still exists (only its
      // identity_phrase changed), so refresh per-habit caches via the surface
      // helper — NOT the list helper, which forbids the getHabitById fetch.
      // The goal-scoped caches it invalidates use broad-prefix keys that omit
      // the phrase, so this one loop refreshes both the old (now empty) and
      // new (now populated) goals.
      for (const habitId of result.renamedHabitIds) {
        await invalidateHabitSurfaceQueries(user.id, habitId, queryClient);
      }
    },
    onError: (error, variables) => {
      logger.error("Goal rename mutation failed", {
        error,
        oldPhrase: variables.oldPhrase,
        newPhrase: variables.newPhrase,
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

      // Telemetry: retro-log path — logDate can be 0 (today) up to ~48h back
      // per HabitDetailScreen's retro-backfill window. days_back is derived
      // from (today - logDate); the helper signature is (from, to) → to-from
      // in days, so logDate must come first to yield a non-negative result.
      trackEvent("habit_logged", {
        habit_id: variables.habitId,
        status: variables.status,
        days_back: daysBetweenDates(variables.logDate, todayDateString()),
      });

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

      // 5) Goal Detail's bulk-range metrics — keyed on habitIds+dateRange,
      //    so prefix-invalidate to cover every cached goal. Without this,
      //    a retro-log from Habit Detail leaves the goal's chart, streak,
      //    and consistency stale for up to staleTime.
      await queryClient.invalidateQueries({
        queryKey: ["habit-logs", "bulk-range"],
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

// ─── Goal archive / restore ───────────────────────────────────────────────────

export function useArchivedGoalsQuery() {
  const { user } = useAuthSession();

  return useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => listArchivedGoals(user!.id),
    queryKey: getArchivedGoalsQueryKey(user?.id),
  });
}

// Returns ALL habits under the phrase (every status). The screen uses this
// to gate render + delete on "fully archived" — i.e. the phrase has at
// least one archived habit AND zero active/backlog habits. Without that
// gate, a direct-open or stale-stack mount on a mixed-state phrase would
// show an archived-only view but the delete button (which hard-deletes
// across every status) would still wipe the live habits.
export function useArchivedGoalDetailQuery(identityPhrase: string | undefined) {
  const { user } = useAuthSession();

  return useQuery({
    enabled: Boolean(user?.id && identityPhrase),
    queryFn: () => listGoalHabits(user!.id, identityPhrase!),
    queryKey: getArchivedGoalDetailQueryKey(user?.id, identityPhrase),
  });
}

// Count of habits the archive cascade would actually touch — i.e. active
// + backlog only, mirroring archiveGoal's WHERE clause. Used by the live
// Goal Detail Archive card so the body copy + hide rule reflect what the
// cascade truly moves (already-archived habits aren't part of the move).
export function getGoalCascadeCountQueryKey(
  userId: string | undefined,
  identityPhrase: string | undefined,
) {
  return [
    "habits",
    "goal-cascade-count",
    userId ?? "guest",
    identityPhrase ?? "",
  ] as const;
}

export function useGoalCascadeCountQuery(identityPhrase: string | undefined) {
  const { user } = useAuthSession();

  return useQuery({
    enabled: Boolean(user?.id && identityPhrase),
    queryFn: async () => {
      const habits = await listGoalHabits(user!.id, identityPhrase!);
      return habits.filter(
        (h) => h.status === "active" || h.status === "backlog",
      ).length;
    },
    queryKey: getGoalCascadeCountQueryKey(user?.id, identityPhrase),
  });
}

export function useArchiveGoalMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ identityPhrase }: { identityPhrase: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before archiving a goal.",
        );
      }
      return archiveGoal(user.id, identityPhrase);
    },
    onSuccess: async (result, variables) => {
      if (!user?.id) return;
      trackEvent("goal_archived", {
        goal_id: goalIdFor(variables.identityPhrase),
      });

      // Surviving-row mutation: every cascaded habit is still in the DB
      // (status='archived'), so we refresh its per-habit caches the same way
      // we would after archive/edit. Same shape as useDeleteGoalMutation's
      // loop but using the surface helper, not the list helper.
      for (const habitId of result.cascadedHabitIds) {
        await invalidateHabitSurfaceQueries(user.id, habitId, queryClient);
      }

      await queryClient.invalidateQueries({
        queryKey: getGoalHabitCountQueryKey(user.id, variables.identityPhrase),
      });
      await queryClient.invalidateQueries({
        queryKey: getArchivedGoalDetailQueryKey(
          user.id,
          variables.identityPhrase,
        ),
      });
    },
    onError: (error, variables) => {
      logger.error("Goal archive mutation failed", {
        error,
        identityPhrase: variables.identityPhrase,
        userId: user?.id ?? null,
      });
    },
  });
}

export function useRestoreGoalMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ identityPhrase }: { identityPhrase: string }) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before restoring a goal.",
        );
      }
      return restoreGoal(user.id, identityPhrase);
    },
    onSuccess: async (result, variables) => {
      if (!user?.id) return;
      trackEvent("goal_restored", {
        goal_id: goalIdFor(variables.identityPhrase),
      });

      for (const habitId of result.restoredHabitIds) {
        await invalidateHabitSurfaceQueries(user.id, habitId, queryClient);
      }

      await queryClient.invalidateQueries({
        queryKey: getGoalHabitCountQueryKey(user.id, variables.identityPhrase),
      });
      await queryClient.invalidateQueries({
        queryKey: getArchivedGoalDetailQueryKey(
          user.id,
          variables.identityPhrase,
        ),
      });
    },
    onError: (error, variables) => {
      logger.error("Goal restore mutation failed", {
        error,
        identityPhrase: variables.identityPhrase,
        userId: user?.id ?? null,
      });
    },
  });
}
