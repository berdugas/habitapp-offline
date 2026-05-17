import { assertCanCreateActiveHabit } from "@/features/habits/validators";
import { serializeActiveDays, ALL_DAYS } from "@/features/habits/activeDays";
import { createHabit as createHabitRepo } from "@/lib/db/repositories/habits";
import {
  deletePreference,
  setPreference,
} from "@/lib/db/repositories/preferences";
import { getDb } from "@/lib/db/client";
import { logger } from "@/services/logger";
import { nowIso, todayDateString } from "@/utils/clock";
import { requestPermission, scheduleReminder } from "@/features/reminders/notifications";

import type { Habit } from "@/features/habits/types";
import {
  onboardingCompletedAtKey,
  onboardingDraftKey,
  type OnboardingDraft,
} from "./types";

export type OnboardingFinalizationReason = "cap_failed" | "write_failed";

export class OnboardingFinalizationError extends Error {
  reason: OnboardingFinalizationReason;
  constructor(reason: OnboardingFinalizationReason, message: string) {
    super(message);
    this.name = "OnboardingFinalizationError";
    this.reason = reason;
  }
}

export async function finalizeOnboarding(
  userId: string,
  draft: OnboardingDraft,
): Promise<Habit> {
  // (D6) Cap check before transaction — reads only, fine outside the atomic block.
  const capCheck = await assertCanCreateActiveHabit(userId, draft.becomingPhrase.trim());
  if (!capCheck.ok) {
    throw new OnboardingFinalizationError(
      "cap_failed",
      `Cannot create habit: ${capCheck.reason}`,
    );
  }

  const db = getDb();
  const today = todayDateString();
  const completedAt = nowIso();

  let createdHabit: Habit | undefined;

  // (D4) Atomic write: habit row + completion mark + draft clear.
  // If any step throws, withTransactionAsync rolls all three back.
  try {
    await db.withTransactionAsync(async () => {
      createdHabit = await createHabitRepo({
        user_id: userId,
        title: draft.habitName.trim() || draft.tinyAction.trim(),
        identity_phrase: draft.becomingPhrase.trim() || null,
        cue: draft.cueExisting.trim(),
        tiny_action: draft.tinyAction.trim(),
        minimum_viable_action: null,
        preferred_time_window: null,
        icon: draft.habitIcon ?? null,
        active_days: serializeActiveDays(draft.activeDays ?? ALL_DAYS),
        habit_state: "active",
        status: "active",
        start_date: today,
      });
      await setPreference(onboardingCompletedAtKey(userId), completedAt);
      await deletePreference(onboardingDraftKey(userId));
    });
  } catch (error) {
    logger.warn("Onboarding finalization transaction failed", { error });
    throw new OnboardingFinalizationError(
      "write_failed",
      "Failed to finalize onboarding. Please try again.",
    );
  }

  if (!createdHabit) {
    // Defensive: transaction completed but createdHabit wasn't set.
    throw new OnboardingFinalizationError(
      "write_failed",
      "Habit was not created.",
    );
  }

  if (draft.reminderEnabled && draft.reminderTime) {
    try {
      await requestPermission();
      await scheduleReminder(
        createdHabit.id,
        userId,
        "daily",
        draft.reminderTime,
        draft.activeDays ?? ALL_DAYS,
      );
    } catch (err) {
      logger.warn("Failed to schedule onboarding reminder", { err });
    }
  }

  return createdHabit;
}
