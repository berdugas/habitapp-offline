import {
  deletePreference,
  getPreference,
  setPreference,
} from "@/lib/db/repositories/preferences";
import { logger } from "@/services/logger";
import { nowIso } from "@/utils/clock";

import {
  WEEKLY_REVIEW_FIRST_RUN_COMPLETED_AT_KEY,
  WEEKLY_REVIEW_INTRO_SEEN_AT_KEY,
} from "@/features/onboarding/types";

export async function isWeeklyReviewIntroSeen(): Promise<boolean> {
  const value = await getPreference(WEEKLY_REVIEW_INTRO_SEEN_AT_KEY);
  return value !== null;
}

// Returns true if the write actually persisted, false if it was swallowed
// after an I/O failure. Callers should gate "completed"-style analytics and
// UI state changes on the return value — they remain free to navigate
// regardless so a transient DB failure can't produce a dead tap.
export async function markWeeklyReviewIntroSeen(): Promise<boolean> {
  try {
    await setPreference(WEEKLY_REVIEW_INTRO_SEEN_AT_KEY, nowIso());
    return true;
  } catch (error) {
    logger.warn("Failed to persist weekly review intro seen", { error });
    return false;
  }
}

export async function clearWeeklyReviewIntroSeen(): Promise<boolean> {
  try {
    await deletePreference(WEEKLY_REVIEW_INTRO_SEEN_AT_KEY);
    return true;
  } catch (error) {
    logger.warn("Failed to clear weekly review intro seen", { error });
    return false;
  }
}

export async function isWeeklyReviewFirstRunCompleted(): Promise<boolean> {
  const value = await getPreference(WEEKLY_REVIEW_FIRST_RUN_COMPLETED_AT_KEY);
  return value !== null;
}

export async function markWeeklyReviewFirstRunCompleted(): Promise<boolean> {
  try {
    await setPreference(WEEKLY_REVIEW_FIRST_RUN_COMPLETED_AT_KEY, nowIso());
    return true;
  } catch (error) {
    logger.warn("Failed to persist weekly review first run completed", {
      error,
    });
    return false;
  }
}
