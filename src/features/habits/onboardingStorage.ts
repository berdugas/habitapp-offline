import { getPreference, setPreference } from "@/lib/db/repositories/preferences";
import { logger } from "@/services/logger";
import { nowIso } from "@/utils/clock";

import { HABITS_ARCHIVE_INTRO_SEEN_AT_KEY } from "@/features/onboarding/types";

export async function isArchiveIntroSeen(): Promise<boolean> {
  const value = await getPreference(HABITS_ARCHIVE_INTRO_SEEN_AT_KEY);
  return value !== null;
}

// Returns true if the write actually persisted, false if it was swallowed
// after an I/O failure. Mirrors markWeeklyReviewIntroSeen — callers can roll
// back an optimistic UI update on a `false` return without crashing on a
// transient DB error.
export async function markArchiveIntroSeen(): Promise<boolean> {
  try {
    await setPreference(HABITS_ARCHIVE_INTRO_SEEN_AT_KEY, nowIso());
    return true;
  } catch (error) {
    logger.warn("Failed to persist archive intro seen", { error });
    return false;
  }
}
