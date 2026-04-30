import type { WeeklyReviewRecord } from "@/lib/db/repositories/weekly_reviews";

export type { WeeklyReviewRecord };

export type UpsertWeeklyReviewPayload = {
  adjustmentNote: string;
  habitId: string;
  tinyActionTooHard: boolean | null;
  triggerWorked: boolean | null;
  wasHard: string;
  weekStart: string;
  wentWell: string;
};
