import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import {
  getHabitDetailQueryKey,
  useEligibleHabitsQuery,
} from "@/features/habits/hooks";
import {
  getLatestWeeklyReview,
  getLatestWeeklyReviewsForHabits,
  getWeeklyReviewForWeek,
  upsertWeeklyReview,
  upsertWeeklyReviewsBatch,
} from "@/features/reviews/api";
import { getGoalReviewStatus } from "@/features/reviews/due";
import {
  getCurrentWeeklyReviewQueryKey,
  getGoalReviewStatusQueryKey,
  getLatestWeeklyReviewQueryKey,
} from "@/features/reviews/queryKeys";
import { logger } from "@/services/logger";
import { getWeekStartDateString, toDeviceDateString } from "@/utils/dates";
import { normalizeParam } from "@/utils/params";

import type { GoalReviewStatus } from "@/features/reviews/due";
import type { UpsertWeeklyReviewPayload } from "@/features/reviews/types";

export function useLatestWeeklyReviewQuery(
  habitIdParam: string | string[] | undefined,
) {
  const { user } = useAuthSession();
  const habitId = normalizeParam(habitIdParam);

  return useQuery({
    enabled: Boolean(user?.id && habitId),
    queryFn: () => getLatestWeeklyReview(user!.id, habitId!),
    queryKey: getLatestWeeklyReviewQueryKey(user?.id, habitId),
  });
}

export function useCurrentWeeklyReviewQuery(
  habitIdParam: string | string[] | undefined,
) {
  const { user } = useAuthSession();
  const habitId = normalizeParam(habitIdParam);
  const weekStart = getWeekStartDateString();

  return useQuery({
    enabled: Boolean(user?.id && habitId),
    queryFn: () => getWeeklyReviewForWeek(user!.id, habitId!, weekStart),
    queryKey: getCurrentWeeklyReviewQueryKey(user?.id, habitId, weekStart),
  });
}

export function useGoalReviewStatusQuery(identityPhrase: string | undefined) {
  const { user } = useAuthSession();
  const eligibleHabitsQuery = useEligibleHabitsQuery();
  const weekStart = getWeekStartDateString();
  const todayDate = toDeviceDateString();
  const goalHabits = (eligibleHabitsQuery.data ?? []).filter(
    (h) => identityPhrase && h.identity_phrase === identityPhrase,
  );
  const habitIds = goalHabits.map((h) => h.id);

  const query = useQuery<GoalReviewStatus>({
    enabled: Boolean(user?.id && identityPhrase && eligibleHabitsQuery.data),
    queryFn: async () => {
      const latestReviews = await getLatestWeeklyReviewsForHabits(
        user!.id,
        habitIds,
      );
      return getGoalReviewStatus({
        currentWeekStart: weekStart,
        habits: goalHabits,
        latestReviews,
        todayDate,
      });
    },
    queryKey: getGoalReviewStatusQueryKey(
      user?.id,
      identityPhrase,
      weekStart,
      todayDate,
    ),
  });

  // The goal-status query is gated on eligibleHabitsQuery.data. If that
  // upstream fetch fails, the inner useQuery stays disabled (not errored),
  // which would render the Goal Detail with no prompt AND no error card.
  // Compose both states so consumers see a single isError signal and
  // refetch() retries both upstream queries.
  const upstreamErrored = Boolean(eligibleHabitsQuery.error);
  const upstreamFetching = eligibleHabitsQuery.isFetching;
  return {
    ...query,
    isError: query.isError || upstreamErrored,
    isFetching: query.isFetching || upstreamFetching,
    error: query.error ?? eligibleHabitsQuery.error ?? null,
    refetch: async (...args: Parameters<typeof query.refetch>) => {
      if (upstreamErrored) {
        await eligibleHabitsQuery.refetch();
      }
      return query.refetch(...args);
    },
  } as typeof query;
}

export function useUpsertGoalReviewsMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payloads: UpsertWeeklyReviewPayload[]) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before saving a weekly review.",
        );
      }
      return upsertWeeklyReviewsBatch(user.id, payloads);
    },
    onError: (error, payloads) => {
      logger.error("Goal review batch mutation failed", {
        error,
        habitIds: payloads.map((p) => p.habitId),
        userId: user?.id ?? null,
      });
    },
    onSuccess: async (savedReviews) => {
      if (!user?.id) return;
      for (const saved of savedReviews) {
        queryClient.setQueryData(
          getLatestWeeklyReviewQueryKey(user.id, saved.habit_id),
          saved,
        );
        queryClient.setQueryData(
          getCurrentWeeklyReviewQueryKey(
            user.id,
            saved.habit_id,
            saved.week_start,
          ),
          saved,
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["weekly-reviews"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["reviews", "goal-status"],
        }),
      ]);
    },
  });
}

export function useUpsertWeeklyReviewMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpsertWeeklyReviewPayload) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before saving a weekly review.",
        );
      }

      return upsertWeeklyReview(user.id, payload);
    },
    onSuccess: async (savedReview, payload) => {
      if (!user?.id) {
        return;
      }

      const latestReviewKey = getLatestWeeklyReviewQueryKey(
        user.id,
        payload.habitId,
      );
      const currentReviewKey = getCurrentWeeklyReviewQueryKey(
        user.id,
        payload.habitId,
        payload.weekStart,
      );

      queryClient.setQueryData(latestReviewKey, savedReview);
      queryClient.setQueryData(currentReviewKey, savedReview);

      await queryClient.invalidateQueries({
        queryKey: latestReviewKey,
      });
      await queryClient.invalidateQueries({
        queryKey: currentReviewKey,
      });
      await queryClient.invalidateQueries({
        queryKey: getHabitDetailQueryKey(user.id, payload.habitId),
      });
      await queryClient.invalidateQueries({
        queryKey: ["reviews", "goal-status"],
      });
    },
    onError: (error, payload) => {
      logger.error("Weekly review mutation failed", {
        error,
        habitId: payload.habitId,
        userId: user?.id ?? null,
        weekStart: payload.weekStart,
      });
    },
  });
}
