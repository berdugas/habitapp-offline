import { useQuery } from "@tanstack/react-query";

import { useAuthSession } from "@/features/auth/hooks";
import { listEligibleHabitsForToday } from "@/features/habits/api";
import { buildGoalWeekSummary } from "@/features/reviews/buildGoalWeekSummary";
import { listLogsForHabitsInRange } from "@/lib/db/repositories/habit_logs";
import { addDeviceDays, toDeviceDateString } from "@/utils/dates";

import type { GoalWeekSummary } from "@/features/reviews/buildGoalWeekSummary";

export function getGoalWeekSummaryQueryKey(
  userId: string | undefined,
  identityPhrase: string | undefined,
  weekStartDate: string,
  todayDate: string,
) {
  // todayDate is part of the key because buildGoalWeekSummary uses it to
  // classify unlogged active days as 'missed' (date < today) vs null
  // (date >= today). Crossing midnight rolls a "today" cell into "missed"
  // without changing weekStartDate, so without todayDate in the key the
  // strip would stay stale.
  return [
    "reviews",
    "goal-week-summary",
    userId ?? "guest",
    identityPhrase ?? "unknown",
    weekStartDate,
    todayDate,
  ] as const;
}

export function useGoalWeekSummary(
  identityPhrase: string | undefined,
  weekStartDate: string,
) {
  const { user } = useAuthSession();
  const todayDate = toDeviceDateString();

  return useQuery<GoalWeekSummary>({
    enabled: Boolean(user?.id && identityPhrase),
    queryFn: async () => {
      const userId = user!.id;
      const phrase = identityPhrase!;
      const allEligible = await listEligibleHabitsForToday(userId, todayDate);
      const goalHabits = allEligible.filter(
        (h) => h.identity_phrase === phrase,
      );
      const habitIds = goalHabits.map((h) => h.id);

      const weekStart = new Date(`${weekStartDate}T12:00:00`);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = addDeviceDays(weekStart, 6);
      const weekEndStr = toDeviceDateString(weekEnd);

      const logs =
        habitIds.length === 0
          ? []
          : await listLogsForHabitsInRange(habitIds, weekStartDate, weekEndStr);

      return buildGoalWeekSummary({
        identityPhrase: phrase,
        habits: goalHabits,
        logs,
        weekStartDate,
        todayDate,
      });
    },
    queryKey: getGoalWeekSummaryQueryKey(
      user?.id,
      identityPhrase,
      weekStartDate,
      todayDate,
    ),
  });
}
