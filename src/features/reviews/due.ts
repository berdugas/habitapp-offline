import type { HabitRecord } from "@/features/habits/types";
import type { WeeklyReviewRecord } from "@/features/reviews/types";

export const MINIMUM_DAYS_BEFORE_REVIEW = 7;

export type GoalReviewStatus = {
  isDue: boolean;
  habitsDue: string[];
  habitsReviewed: string[];
  allReviewed: boolean;
};

type GoalReviewStatusInput = {
  habits: HabitRecord[];
  latestReviews: Map<string, WeeklyReviewRecord | null>;
  currentWeekStart: string;
  todayDate: string;
};

export function getGoalReviewStatus({
  habits,
  latestReviews,
  currentWeekStart,
  todayDate,
}: GoalReviewStatusInput): GoalReviewStatus {
  const habitsDue: string[] = [];
  const habitsReviewed: string[] = [];
  let reviewableCount = 0;
  for (const habit of habits) {
    if (habit.status !== "active" || habit.start_date > todayDate) continue;
    const daysSinceStart = Math.floor(
      (new Date(todayDate).getTime() - new Date(habit.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSinceStart < MINIMUM_DAYS_BEFORE_REVIEW) continue;
    reviewableCount++;
    const latest = latestReviews.get(habit.id) ?? null;
    if (latest?.week_start === currentWeekStart) {
      habitsReviewed.push(habit.id);
    } else {
      habitsDue.push(habit.id);
    }
  }
  return {
    allReviewed: reviewableCount > 0 && habitsDue.length === 0,
    habitsDue,
    habitsReviewed,
    isDue: habitsDue.length > 0,
  };
}

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
