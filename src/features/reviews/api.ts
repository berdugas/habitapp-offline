import { getHabitById } from "@/features/habits/api";
import {
  applyTuneUp as dbApplyTuneUp,
  getLatestWeeklyReview as dbGetLatest,
  getLatestWeeklyReviewsForHabits as dbGetLatestForHabits,
  getWeeklyReviewForWeek as dbGetForWeek,
  upsertWeeklyReview as dbUpsert,
  upsertWeeklyReviewsBatch as dbUpsertBatch,
} from "@/lib/db/repositories/weekly_reviews";
import { exceedsLength, isBlank } from "@/utils/validation";

import type { Habit } from "@/lib/db/repositories/habits";
import type {
  UpsertWeeklyReviewPayload,
  WeeklyReviewRecord,
} from "@/features/reviews/types";

export type ApplyTuneUpForHabitPayload = UpsertWeeklyReviewPayload & {
  habitPatch?: { cue?: string; tinyAction?: string };
};

export class ApplyTuneUpValidationError extends Error {
  field: "cue" | "tinyAction";
  constructor(field: "cue" | "tinyAction", message: string) {
    super(message);
    this.field = field;
    this.name = "ApplyTuneUpValidationError";
  }
}

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
    weekStart: payload.weekStart,
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
      weekStart: p.weekStart,
    })),
  );
}

export async function applyTuneUpForHabit(
  userId: string,
  payload: ApplyTuneUpForHabitPayload,
): Promise<{ review: WeeklyReviewRecord; habit: Habit | null }> {
  await getHabitById(userId, payload.habitId); // ownership/auth

  // Mirror the create/update validators: cue and tiny_action are required
  // non-blank AND length-bounded at 240 chars on the habit row. The repo's
  // plain `updateHabit` accepts a partial patch, so we have to enforce
  // both rules here in the tune-up path — otherwise a whitespace-only
  // edit would trim to "" and overwrite a required field, and an
  // overlong edit would persist a value the normal edit/create flow
  // would reject.
  if (payload.habitPatch?.cue !== undefined) {
    if (isBlank(payload.habitPatch.cue)) {
      throw new ApplyTuneUpValidationError(
        "cue",
        "A cue is required — what comes before this habit?",
      );
    }
    if (exceedsLength(payload.habitPatch.cue, 240)) {
      throw new ApplyTuneUpValidationError(
        "cue",
        "Cue must stay under 240 characters.",
      );
    }
  }
  if (payload.habitPatch?.tinyAction !== undefined) {
    if (isBlank(payload.habitPatch.tinyAction)) {
      throw new ApplyTuneUpValidationError(
        "tinyAction",
        "A tiny action is required.",
      );
    }
    if (exceedsLength(payload.habitPatch.tinyAction, 240)) {
      throw new ApplyTuneUpValidationError(
        "tinyAction",
        "Tiny action must stay under 240 characters.",
      );
    }
  }

  const { habitPatch, ...reviewPayload } = payload;
  return dbApplyTuneUp({
    habitPatch,
    reviewInput: { ...reviewPayload, userId },
  });
}
