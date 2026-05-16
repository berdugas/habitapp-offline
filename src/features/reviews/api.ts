import { getHabitById } from "@/features/habits/api";
import {
  getLatestWeeklyReview as dbGetLatest,
  getLatestWeeklyReviewsForHabits as dbGetLatestForHabits,
  getWeeklyReviewForWeek as dbGetForWeek,
  upsertWeeklyReview as dbUpsert,
  upsertWeeklyReviewsBatch as dbUpsertBatch,
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

export async function getLatestWeeklyReviewsForHabits(
  userId: string,
  habitIds: string[],
): Promise<Map<string, WeeklyReviewRecord | null>> {
  return dbGetLatestForHabits(userId, habitIds);
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

export async function upsertWeeklyReviewsBatch(
  userId: string,
  payloads: UpsertWeeklyReviewPayload[],
): Promise<WeeklyReviewRecord[]> {
  for (const p of payloads) {
    await getHabitById(userId, p.habitId);
  }
  return dbUpsertBatch(
    payloads.map((p) => ({
      adjustmentNote: p.adjustmentNote,
      habitId: p.habitId,
      tinyActionTooHard: p.tinyActionTooHard,
      triggerWorked: p.triggerWorked,
      userId,
      wasHard: p.wasHard,
      weekStart: p.weekStart,
      wentWell: p.wentWell,
    })),
  );
}
