import { getHabitById } from "@/features/habits/api";
import {
  getLatestWeeklyReview as dbGetLatest,
  getWeeklyReviewForWeek as dbGetForWeek,
  upsertWeeklyReview as dbUpsert,
} from "@/lib/db/repositories/weekly_reviews";

import type {
  UpsertWeeklyReviewPayload,
  WeeklyReviewRecord,
} from "@/features/reviews/types";

export async function getLatestWeeklyReview(
  userId: string,
  habitId: string,
): Promise<WeeklyReviewRecord | null> {
  return dbGetLatest(userId, habitId);
}

export async function getWeeklyReviewForWeek(
  userId: string,
  habitId: string,
  weekStart: string,
): Promise<WeeklyReviewRecord | null> {
  return dbGetForWeek(userId, habitId, weekStart);
}

export async function upsertWeeklyReview(
  userId: string,
  payload: UpsertWeeklyReviewPayload,
): Promise<WeeklyReviewRecord> {
  await getHabitById(userId, payload.habitId);

  return dbUpsert({
    adjustmentNote: payload.adjustmentNote,
    habitId: payload.habitId,
    tinyActionTooHard: payload.tinyActionTooHard,
    triggerWorked: payload.triggerWorked,
    userId,
    wasHard: payload.wasHard,
    weekStart: payload.weekStart,
    wentWell: payload.wentWell,
  });
}
