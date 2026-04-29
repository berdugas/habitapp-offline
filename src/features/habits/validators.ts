import { exceedsLength, isBlank } from "@/utils/validation";
import { listActiveHabits } from "@/features/habits/api";
import {
  ACTIVE_FOCUS_LIMIT,
  ACTIVE_HABIT_CAP,
  ACTIVE_SUPPORTING_LIMIT,
} from "@/features/habits/contract";

import type { HabitSetupPayload, HabitState } from "@/features/habits/types";

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

// ─── 3-active cap helper ──────────────────────────────────────────────────────

export type CapCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "focus_full" | "supporting_full" | "total_cap_reached";
      counts: { focus: number; supporting: number };
    };

/**
 * Checks whether the user can add a new active habit of the given state.
 * Queries the DB for current active habit counts, then compares against
 * ACTIVE_HABIT_CAP / ACTIVE_FOCUS_LIMIT / ACTIVE_SUPPORTING_LIMIT.
 *
 * "automatic" habits never count toward the cap.
 */
export async function assertCanCreateActiveHabit(
  userId: string,
  nextHabitState: HabitState,
): Promise<CapCheckResult> {
  if (nextHabitState === "automatic") {
    return { ok: true };
  }

  const active = await listActiveHabits(userId);
  const counts = {
    focus: active.filter((h) => h.habit_state === "focus").length,
    supporting: active.filter((h) => h.habit_state === "supporting").length,
  };

  if (nextHabitState === "focus" && counts.focus >= ACTIVE_FOCUS_LIMIT) {
    return { ok: false, reason: "focus_full", counts };
  }

  if (nextHabitState === "supporting" && counts.supporting >= ACTIVE_SUPPORTING_LIMIT) {
    return { ok: false, reason: "supporting_full", counts };
  }

  if (counts.focus + counts.supporting >= ACTIVE_HABIT_CAP) {
    return { ok: false, reason: "total_cap_reached", counts };
  }

  return { ok: true };
}
