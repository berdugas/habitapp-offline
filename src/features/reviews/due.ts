import type { HabitRecord } from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

export const MINIMUM_DAYS_BEFORE_REVIEW = 7;

type WeeklyReviewDueInput = {
  currentWeekStart: string;
  habit: HabitRecord | null | undefined;
  latestReview: WeeklyReviewRecord | null | undefined;
  todayDate: string;
};

export function isWeeklyReviewDue({
  currentWeekStart,
  habit,
  latestReview,
  todayDate,
}: WeeklyReviewDueInput) {
  if (!habit || habit.status !== "active" || habit.start_date > todayDate) {
    return false;
  }

  const daysSinceStart = Math.floor(
    (new Date(todayDate).getTime() - new Date(habit.start_date).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (daysSinceStart < MINIMUM_DAYS_BEFORE_REVIEW) {
    return false;
  }

  return latestReview?.week_start !== currentWeekStart;
}
