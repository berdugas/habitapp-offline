import type { HabitRecord } from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

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

  return latestReview?.week_start !== currentWeekStart;
}
