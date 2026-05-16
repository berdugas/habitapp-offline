import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import { getHabitDetailQueryKey } from "@/features/habits/hooks";
import {
  getLatestWeeklyReview,
  getWeeklyReviewForWeek,
  upsertWeeklyReview,
} from "@/features/reviews/api";
import {
  getCurrentWeeklyReviewQueryKey,
  getLatestWeeklyReviewQueryKey,
} from "@/features/reviews/queryKeys";
import { logger } from "@/services/logger";
import { getWeekStartDateString } from "@/utils/dates";
import { normalizeParam } from "@/utils/params";

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
