import { exceedsLength, isBlank } from "@/utils/validation";
import { listActiveHabits } from "@/features/habits/api";
import { ACTIVE_HABITS_PER_GOAL_SOFT_CAP } from "@/features/habits/contract";

import type { HabitSetupPayload } from "@/features/habits/types";

export type HabitValidationErrors = Partial<Record<keyof HabitSetupPayload, string>>;

export function normalizeHabitSetupPayload(
  payload: HabitSetupPayload,
): HabitSetupPayload {
  return {
    title: payload.title.trim(),
    identityPhrase: payload.identityPhrase.trim(),
    cue: payload.cue.trim(),
    tinyAction: payload.tinyAction.trim(),
    minimumViableAction: payload.minimumViableAction.trim(),
    preferredTimeWindow: payload.preferredTimeWindow.trim(),
  };
}

export function validateHabitSetupPayload(
  payload: HabitSetupPayload,
): HabitValidationErrors {
  const normalized = normalizeHabitSetupPayload(payload);
  const errors: HabitValidationErrors = {};

  if (isBlank(normalized.title)) {
    errors.title = "Habit name is required.";
  } else if (exceedsLength(normalized.title, 120)) {
    errors.title = "Habit name must stay under 120 characters.";
  }

  if (isBlank(normalized.cue)) {
    errors.cue = "A cue is required — what comes before this habit?";
  } else if (exceedsLength(normalized.cue, 240)) {
    errors.cue = "Cue must stay under 240 characters.";
  }

  if (isBlank(normalized.tinyAction)) {
    errors.tinyAction = "A tiny action is required.";
  } else if (exceedsLength(normalized.tinyAction, 240)) {
    errors.tinyAction = "Tiny action must stay under 240 characters.";
  }

  if (!isBlank(normalized.minimumViableAction) && exceedsLength(normalized.minimumViableAction, 240)) {
    errors.minimumViableAction = "Minimum viable action must stay under 240 characters.";
  }

  if (!isBlank(normalized.identityPhrase) && exceedsLength(normalized.identityPhrase, 240)) {
    errors.identityPhrase = "Identity phrase must stay under 240 characters.";
  }

  if (!isBlank(normalized.preferredTimeWindow) && exceedsLength(normalized.preferredTimeWindow, 80)) {
    errors.preferredTimeWindow = "Preferred time window must stay under 80 characters.";
  }

  return errors;
}

export const validateCreateHabitPayload = validateHabitSetupPayload;

// ─── Per-goal active cap helper ───────────────────────────────────────────────

export type CapCheckResult =
  | { ok: true }
  | { ok: false; reason: "soft_cap_warning"; count: number };

/**
 * Soft cap: warn when a user already has 3+ active habits under the same
 * identity phrase (goal). Creation is never hard-blocked — the warning is
 * surfaced in the UI so the user can make an informed choice.
 */
export async function assertCanCreateActiveHabit(
  userId: string,
  identityPhrase: string,
): Promise<CapCheckResult> {
  const active = await listActiveHabits(userId);
  const count = active.filter(
    (h) => h.habit_state === "active" && h.identity_phrase === identityPhrase,
  ).length;

  if (count >= ACTIVE_HABITS_PER_GOAL_SOFT_CAP) {
    return { ok: false, reason: "soft_cap_warning", count };
  }

  return { ok: true };
}
