export function getLatestWeeklyReviewQueryKey(
  userId: string | undefined,
  habitId: string | undefined,
) {
  return ["weekly-reviews", "latest", userId ?? "guest", habitId ?? "unknown"];
}

export function getCurrentWeeklyReviewQueryKey(
  userId: string | undefined,
  habitId: string | undefined,
  weekStart: string,
) {
  return [
    "weekly-reviews",
    "current",
    userId ?? "guest",
    habitId ?? "unknown",
    weekStart,
  ];
}

export function getGoalReviewStatusQueryKey(
  userId: string | undefined,
  identityPhrase: string | undefined,
  weekStart: string,
  todayDate: string,
) {
  // todayDate is part of the key because getGoalReviewStatus uses it to
  // decide habit reviewability (status==active && start_date<=todayDate &&
  // age>=7 days). Crossing midnight or a habit reaching its start date
  // both change the result without changing weekStart.
  return [
    "reviews",
    "goal-status",
    userId ?? "guest",
    identityPhrase ?? "unknown",
    weekStart,
    todayDate,
  ] as const;
}
