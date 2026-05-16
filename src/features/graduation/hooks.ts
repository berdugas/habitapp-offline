import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import {
  getEligibleHabitsQueryKey,
  getHabitDetailQueryKey,
  getLibraryQueryKey,
} from "@/features/habits/hooks";
import { recordAndProcessGraduation } from "@/features/graduation/graduation";
import {
  getLatestSRHIQueryKey,
  getSRHIHistoryQueryKey,
} from "@/features/graduation/queryKeys";
import {
  getLatestSRHIResponse,
  getSRHIResponsesForHabit,
} from "@/lib/db/repositories/srhi_responses";
import { logger } from "@/services/logger";
import { toDeviceDateString } from "@/utils/dates";

export { getLatestSRHIQueryKey, getSRHIHistoryQueryKey };

function normalizeHabitId(habitId: string | string[] | undefined) {
  if (Array.isArray(habitId)) {
    return habitId[0];
  }

  return habitId;
}

export function useLatestSRHIQuery(
  habitIdParam: string | string[] | undefined,
) {
  const habitId = normalizeHabitId(habitIdParam);

  return useQuery({
    enabled: Boolean(habitId),
    queryFn: () => getLatestSRHIResponse(habitId!),
    queryKey: getLatestSRHIQueryKey(habitId),
  });
}

export function useSRHIHistoryQuery(
  habitIdParam: string | string[] | undefined,
) {
  const habitId = normalizeHabitId(habitIdParam);

  return useQuery({
    enabled: Boolean(habitId),
    queryFn: () => getSRHIResponsesForHabit(habitId!),
    queryKey: getSRHIHistoryQueryKey(habitId),
  });
}

export type RecordGraduationVariables = {
  habit_id: string;
  q1_score: number;
  q2_score: number;
  q3_score: number;
};

export function useRecordGraduationMutation() {
  const { user } = useAuthSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: RecordGraduationVariables) => {
      if (!user?.id) {
        throw new Error(
          "You need an account session before recording a graduation.",
        );
      }

      return recordAndProcessGraduation({
        habit_id: variables.habit_id,
        user_id: user.id,
        q1_score: variables.q1_score,
        q2_score: variables.q2_score,
        q3_score: variables.q3_score,
      });
    },
    onSuccess: async (_result, variables) => {
      if (!user?.id) {
        return;
      }

      const todayDate = toDeviceDateString();

      await queryClient.invalidateQueries({
        queryKey: getHabitDetailQueryKey(user.id, variables.habit_id),
      });
      await queryClient.invalidateQueries({
        queryKey: getEligibleHabitsQueryKey(user.id, todayDate),
      });
      await queryClient.invalidateQueries({
        queryKey: getLatestSRHIQueryKey(variables.habit_id),
      });
      await queryClient.invalidateQueries({
        queryKey: getSRHIHistoryQueryKey(variables.habit_id),
      });
      await queryClient.invalidateQueries({
        queryKey: getLibraryQueryKey(user.id),
      });
    },
    onError: (error, variables) => {
      logger.error("Graduation mutation failed", {
        error,
        habitId: variables.habit_id,
        userId: user?.id ?? null,
      });
    },
  });
}
