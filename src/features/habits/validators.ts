import { exceedsLength, isBlank } from "@/utils/validation";
import { listActiveHabits } from "@/features/habits/api";
import { listHabits } from "@/lib/db/repositories/habits";
import { ACTIVE_HABITS_PER_GOAL_SOFT_CAP } from "@/features/habits/contract";
import { stripLeadingAfter, stripLeadingIWill } from "@/features/habits/formatters";

import type { HabitSetupPayload } from "@/features/habits/types";
import type { AccessMode } from "@/features/trial/types";

export type HabitValidationErrors = Partial<Record<keyof HabitSetupPayload, string>>;

export function normalizeHabitSetupPayload(
  payload: HabitSetupPayload,
): HabitSetupPayload {
  const days = payload.activeDays ?? [1, 2, 3, 4, 5, 6, 7];
  return {
    title: payload.title.trim(),
    identityPhrase: payload.identityPhrase.trim(),
    cue: stripLeadingAfter(payload.cue),
    tinyAction: stripLeadingIWill(payload.tinyAction),
    minimumViableAction: payload.minimumViableAction.trim(),
    preferredTimeWindow: payload.preferredTimeWindow.trim(),
    icon: payload.icon.trim(),
    activeDays: days.length > 0 ? days : [1, 2, 3, 4, 5, 6, 7],
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

  if (!isBlank(normalized.icon) && exceedsLength(normalized.icon, 60)) {
    errors.icon = "Icon name must stay under 60 characters.";
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

// ─── Free-tier global cap ─────────────────────────────────────────────────────

export type FreeTierCapCheck =
  | { ok: true }
  | { ok: false; reason: "free_tier_cap"; activeCount: number };

/**
 * Free-tier hard cap: when accessMode gates the user (anything other
 * than 'full'), allow at most 1 active habit.
 *
 * Why accessMode and not entitlement_status: the spec promises trial
 * users full access for the entire 14-day window. computeAccessMode
 * encodes that policy (Branch 3) and returns 'full' for in-window
 * trial users; reusing its output here keeps a single source of truth
 * for "who is currently capped".
 *
 * Only counts habit_state='active' rows; 'automatic' (graduated)
 * habits are excluded so a user who graduated their one allowed habit
 * isn't blocked from creating a replacement.
 *
 * Counts active AND backlog status rows because the paywall picker
 * treats both as "slots taken". Without this, a gated user could
 * bypass the cap by stacking backlog habits.
 */
export async function assertCanCreateHabitOnFreeTier(
  userId: string,
  accessMode: AccessMode,
): Promise<FreeTierCapCheck> {
  if (accessMode === "full") {
    return { ok: true };
  }

  const habits = await listHabits({
    user_id: userId,
    status: ["active", "backlog"],
  });
  const slotsUsed = habits.filter((h) => h.habit_state === "active").length;

  if (slotsUsed >= 1) {
    return { ok: false, reason: "free_tier_cap", activeCount: slotsUsed };
  }

  return { ok: true };
}
